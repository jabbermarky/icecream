#!/usr/bin/env python3
"""
Minimal Sprinkles balance engine — exercises the seed DB on real recipes.

Every mix metric is a mass-weighted average of the ingredient values, because
each ingredient field is already per-100g-as-is (see D1):
    mix_X = sum(mass_i * X_i) / total_mass
For PAC/POD this yields the per-100g-mix figure the ice-cream literature uses
(Mullan's gelato ~27, etc.). Water doesn't depress freezing, so PAC comes only
from the sugars/salts already baked into each ingredient's PAC value.
"""
import json, math

DB = {i["id"]: i for i in json.load(open("/home/claude/sprinkles-ingredient-seed-db.json"))["ingredients"]}
LACTOSE_FRACTION_OF_MSNF = 0.545

# Freezing-point-depression model =========================================
# FPD of a sucrose solution vs concentration c = grams sucrose-equivalent per
# 100 g water:  ΔT = A·c + B·c²
#   A = 0.0543 is the ideal colligative term (1.86 °C·molal, sucrose MW 342.3).
#   B = 0.00029 is a nonideality correction fit to sucrose FPD data
#       (10/20/30/40/50 wt% -> 0.60/1.47/2.80/4.85/8.3 °C).
# The mix's sucrose-equivalent load = mix['pac'] (that IS Σ grams×FPDF per 100 g mix).
FPD_A, FPD_B = 0.0543, 0.00029

def fpd_from_c(c):
    return FPD_A * c + FPD_B * c * c

def c_from_fpd(fpd):  # invert the quadratic for c >= 0
    return (-FPD_A + math.sqrt(FPD_A**2 + 4 * FPD_B * fpd)) / (2 * FPD_B)

def frozen_at(mix, T):
    """% of the mix's water frozen at temperature T (°C). Leighton equilibrium:
    ice forms until the concentrated unfrozen solution's freezing point = T."""
    Se, W = mix["pac"], mix["water"]
    if Se <= 0 or W <= 0:
        return 0.0
    fp0 = -fpd_from_c(Se / W * 100)          # initial freezing point
    if T >= fp0:
        return 0.0
    c = c_from_fpd(-T)                        # sugar conc. that freezes at T
    Wu = Se / c * 100                          # unfrozen water remaining
    return max(0.0, min(100.0, (1 - Wu / W) * 100))

def freezing_curve(mix, tmin=-25):
    Se, W = mix["pac"], mix["water"]
    fp0 = -fpd_from_c(Se / W * 100)
    temps = [fp0] + [t for t in range(int(math.floor(fp0)), tmin - 1, -1)]
    return {"fp0": fp0, "points": [(T, frozen_at(mix, T)) for T in temps]}

def balance(recipe):
    M = sum(g for _, g in recipe)
    def wavg(field):
        tot = 0.0
        for iid, g in recipe:
            v = DB[iid].get(field)
            tot += g * (v if v is not None else 0)
        return tot / M
    mix = {
        "total_g": M,
        "fat": wavg("fat_pct"),
        "msnf": wavg("msnf_pct"),
        "sugars": wavg("sugars_pct"),
        "water": wavg("water_pct"),
        "solids": wavg("solids_pct"),
        "pac": wavg("pac"),
        "pod": wavg("pod"),
        "kcal_per_100g": wavg("kcal_per_100g"),
    }
    mix["lactose"] = mix["msnf"] * LACTOSE_FRACTION_OF_MSNF
    # "sugars_pct" for dairy = lactose, which ALSO lives inside MSNF. So added (non-dairy)
    # sugars = total sugars - dairy lactose. Solids identity uses added sugars to avoid
    # double-counting lactose (it is already inside MSNF).
    mix["added_sugars"] = mix["sugars"] - mix["lactose"]
    mix["other_solids"] = mix["solids"] - mix["fat"] - mix["msnf"] - mix["added_sugars"]
    # PAC excluding lactose = the US/UK "FPDF" convention (Mullan)
    mix["pac_excl_lactose"] = mix["pac"] - mix["lactose"] * 1.0
    # sandiness risk: lactose as a share of the water phase (>~0.10-0.11 risks crystallization)
    mix["lactose_in_water"] = mix["lactose"] / mix["water"] if mix["water"] else 0
    return mix

# gelato-oriented target bands (Mullan targets + standard composition ranges)
TARGETS = {
    "fat":    (4, 10,  "%"),
    "msnf":   (7, 12,  "%"),
    "sugars": (16, 22, "%"),
    "solids": (32, 42, "%"),
    "pac":    (22, 30, "index (gelato served ~-11 to -13C; ~20-25 for -18C hard-pack)"),
    "pod":    (12, 18, "sucrose-equiv sweetness"),
}

def assess(mix):
    lines = []
    for k, (lo, hi, unit) in TARGETS.items():
        v = mix["added_sugars"] if k == "sugars" else mix[k]  # composition uses ADDED sugars
        mark = "OK " if lo <= v <= hi else ("LOW" if v < lo else "HIGH")
        lines.append((k, v, lo, hi, mark, unit))
    return lines

def report(name, recipe, serve_note=""):
    mix = balance(recipe)
    print(f"\n{'='*72}\n  {name}   ({mix['total_g']:.0f} g mix)")
    if serve_note: print(f"  {serve_note}")
    print('='*72)
    print(f"  {'Ingredient':<34}{'grams':>7}{'PAC':>8}{'POD':>7}{'contrib PAC':>13}")
    print("  " + "-"*68)
    M = mix["total_g"]
    for iid, g in recipe:
        it = DB[iid]; pac = it.get("pac") or 0; pod = it.get("pod") or 0
        print(f"  {it['name']:<34}{g:>7.0f}{pac:>8.1f}{pod:>7.1f}{g*pac/M:>13.2f}")
    print("  " + "-"*68)
    print(f"  MIX PER 100 g:")
    for k, v, lo, hi, mark, unit in assess(mix):
        print(f"    {k:<8} {v:6.1f}   target {lo}-{hi:<4} [{mark}]  {unit if mark!='OK ' else ''}")
    print(f"    {'sugars':<8} added {mix['added_sugars']:.1f} / total {mix['sugars']:.1f} (incl {mix['lactose']:.1f} dairy lactose)")
    print(f"    {'other-sol':<8} {mix['other_solids']:6.1f}   (fruit/cocoa/nut/egg solids, protein beyond MSNF)")
    print(f"    {'water':<8} {mix['water']:6.1f}")
    print(f"    {'kcal/100g':<8} {mix['kcal_per_100g']:6.0f}")
    print(f"    PAC excl. lactose (FPDF): {mix['pac_excl_lactose']:.1f}")
    ratio = mix['lactose_in_water']
    flag = "  <-- SANDINESS RISK (>0.11)" if ratio > 0.11 else ""
    print(f"    lactose/water: {ratio:.3f}{flag}")
    return mix

# ---------------------------------------------------------------------------
# Recipe 1 — Pistachio gelato (Mark's flavor). Exercises negative-PAC paste,
# dairy lactose, multi-sugar sweetener blend, stabilizer.
# ---------------------------------------------------------------------------
pistachio = [
    ("whole-milk",           560),
    ("heavy-cream-36",        70),
    ("skim-milk-powder",      38),
    ("sucrose",               120),
    ("dextrose",              22),
    ("trimoline-full",        15),
    ("pistachio-paste-pure",  95),
    ("locust-bean-gum",       3),
]

# ---------------------------------------------------------------------------
# Recipe 2 — Mullan (2021) worked gelato, as a known-answer validation.
# His mix (per 100g): 8% fat, 14% sucrose, 2% dextrose, 2% invert, 10% SMP,
# 0.3% stab/emul, 36.6% TS; he computes PAC ~= 26.9, serves soft at -11C.
# We reproduce the composition and check our engine lands near 27.
# ---------------------------------------------------------------------------
mullan = [
    ("heavy-cream-36",       222),   # -> ~8% fat
    ("skim-milk-powder",     100),   # -> 10% SMP
    ("sucrose",              140),   # 14%
    ("dextrose",             20),    # 2%
    ("trimoline-full",       20),    # 2% invert
    ("water",                495),   # balance (Mullan uses water, not milk)
    ("locust-bean-gum",      3),
]

# Pistachio v2 — tuned after the v1 diagnosis: shift sucrose->dextrose to raise PAC
# (fight the paste's hardening) without adding sweetness.
pistachio_v2 = [
    ("whole-milk",           555),
    ("heavy-cream-36",        70),
    ("skim-milk-powder",      38),
    ("sucrose",               85),
    ("dextrose",              52),
    ("trimoline-full",        18),
    ("pistachio-paste-pure",  95),
    ("locust-bean-gum",       3),
]

report("Pistachio gelato v1 (Mark)", pistachio, "intended serving ~ -12 C")
report("Pistachio gelato v2 (tuned: sucrose->dextrose)", pistachio_v2, "intended serving ~ -12 C")
report("Mullan (2021) validation gelato", mullan, "his published answer: PAC ~26.9, soft at -11 C")

# --- Freezing curve validation vs Mullan Figure 2 -------------------------
print(f"\n{'='*72}\n  FREEZING CURVE — validation vs Mullan (2021) Figure 2\n{'='*72}")
mm = balance(mullan)
fc = freezing_curve(mm)
print(f"  Mullan gelato: initial freezing point {fc['fp0']:.1f} C")
for T in (-6, -8, -11, -14, -18):
    print(f"    {T:>4} C  -> {frozen_at(mm,T):5.1f}% water frozen"
          + ("   (Mullan: ~65% at -11)" if T==-11 else ""))
print("\n  Pistachio v2 scoopability:")
pv = balance(pistachio_v2)
for T in (-11, -12, -14, -18):
    fr = frozen_at(pv, T); note = "  <-- too hard (>70%)" if fr>70 else ("  scoopable" if fr>=55 else "")
    print(f"    {T:>4} C  -> {fr:5.1f}% frozen{note}")
