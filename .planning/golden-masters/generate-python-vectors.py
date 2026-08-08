#!/usr/bin/env python3
"""
Golden-master vector generator — PRIMARY (balance_engine.py) oracle.

Executes the balance_engine.py prototype VERBATIM (source loaded from
.planning/prototype/balance_engine.py) except for exactly one string patch:
the hardcoded seed-DB path is redirected to the real seed DB preserved at
.planning/prototype/sprinkles-ingredient-seed-db.json.

Recipe vectors embed the (trimmed) real ingredient rows they were computed
against, so the TS test suite replays them self-contained. The generator also
verifies the engine's output for pistachio v2 against the balance card's
printed values (.planning/prototype/sprinkles-balance-card.html) and records
the comparison in the output.

Usage (from repo root):  python3 .planning/golden-masters/generate-python-vectors.py
"""
import io, json, math, subprocess, sys, os
from contextlib import redirect_stdout
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ENGINE_SRC = os.path.join(REPO, ".planning", "prototype", "balance_engine.py")
DB_PATH = os.path.join(REPO, ".planning", "prototype", "sprinkles-ingredient-seed-db.json")

# Fields balance() actually reads; embedded rows are trimmed to these (+ id/name).
READ_FIELDS = ["fat_pct", "msnf_pct", "sugars_pct", "water_pct", "solids_pct", "pac", "pod", "kcal_per_100g"]

seed = json.load(open(DB_PATH))
rows_full = {r["id"]: r for r in seed["ingredients"]}
def trimmed(iid):
    r = rows_full[iid]
    return {"id": r["id"], "name": r["name"], **{f: r.get(f) for f in READ_FIELDS}}

# ---------------------------------------------------------------------------
# Load the engine verbatim, patching ONLY the seed-DB path.
# ---------------------------------------------------------------------------
with open(ENGINE_SRC) as f:
    src = f.read()
patched = src.replace("/home/claude/sprinkles-ingredient-seed-db.json", DB_PATH)
assert patched != src, "seed-DB path not found in engine source — layout changed?"

ns = {}
with redirect_stdout(io.StringIO()):     # the engine prints reports at import; discard
    exec(compile(patched, ENGINE_SRC, "exec"), ns)

fpd_from_c, c_from_fpd = ns["fpd_from_c"], ns["c_from_fpd"]
frozen_at, freezing_curve = ns["frozen_at"], ns["freezing_curve"]
balance, assess = ns["balance"], ns["assess"]
TARGETS, FPD_A, FPD_B = ns["TARGETS"], ns["FPD_A"], ns["FPD_B"]
LACTOSE_FRACTION = ns["LACTOSE_FRACTION_OF_MSNF"]

# ---------------------------------------------------------------------------
# Vectors
# ---------------------------------------------------------------------------
v = {"meta": None, "fpd_curve": [], "frozen_at": [], "freezing_curves": [],
     "targets": TARGETS, "recipes": [], "card_verification": None}

# 1. FPD quadratic and inverse round-trip, c = g sucrose-equivalent / 100 g water.
for i in range(0, 61, 2):
    c = float(i)
    fpd = fpd_from_c(c)
    v["fpd_curve"].append({"c": c, "fpd": fpd, "c_roundtrip": c_from_fpd(fpd)})

# 2. frozen_at over (pac, water) mixes and a temperature sweep,
#    including the T >= fp0 and Se <= 0 guard branches.
for pac, water in [(20.0, 60.0), (27.0, 62.0), (19.9, 59.0), (30.0, 55.0), (0.0, 60.0), (25.0, 0.0)]:
    mix = {"pac": pac, "water": water}
    for T in [0, -1, -2, -4, -6, -8, -11, -12, -14, -18, -25]:
        v["frozen_at"].append({"pac": pac, "water": water, "T": T, "frozen_pct": frozen_at(mix, float(T))})

# 3. Full freezing curves for two mixes.
for pac, water in [(27.0, 62.0), (19.9, 59.0)]:
    fc = freezing_curve({"pac": pac, "water": water})
    v["freezing_curves"].append({"pac": pac, "water": water, "fp0": fc["fp0"], "points": fc["points"]})

# 4. balance() + assess() over the engine's own recipes (verbatim from
#    balance_engine.py) plus two extra shapes for edge coverage. Real seed-DB
#    rows, trimmed to the fields balance() reads, are embedded per recipe.
RECIPES = {
    "pistachio-v1": ns["pistachio"],
    "pistachio-v2": ns["pistachio_v2"],
    "mullan-validation": ns["mullan"],   # includes 'water' row -> kcal None-guard coverage
    "sugar-water-minimal": [("water", 100), ("sucrose", 25)],
    "no-dairy-sorbet-shape": [("water", 550), ("sucrose", 150), ("dextrose", 50), ("trimoline-full", 30)],
}
NOTES = {
    "pistachio-v1": "Engine's own recipe: negative-PAC paste, multi-sugar blend, stabilizer.",
    "pistachio-v2": "Engine's own tuned recipe; the balance card renders this mix.",
    "mullan-validation": "Engine's known-answer recipe (Mullan 2021 publishes PAC ~26.9, ~65% frozen at -11C).",
    "sugar-water-minimal": "Minimal two-ingredient mix.",
    "no-dairy-sorbet-shape": "No dairy: lactose/MSNF terms all zero.",
}
for rid, recipe in RECIPES.items():
    mix = balance(recipe)
    v["recipes"].append({
        "id": rid,
        "note": NOTES[rid],
        "input": {"recipe": recipe, "ingredientRows": {iid: trimmed(iid) for iid, _ in recipe}},
        "expected": {
            "mix": mix,
            "assess": [{"metric": k, "value": val, "lo": lo, "hi": hi, "mark": mark.strip()}
                       for k, val, lo, hi, mark, _ in assess(mix)],
            "fp0": -fpd_from_c(mix["pac"] / mix["water"] * 100) if mix["water"] else None,
            "frozen_at_minus12": frozen_at(mix, -12.0),
        },
    })

# 5. Verify the balance card's printed pistachio-v2 values against the engine
#    running on the real seed DB. Card values are print-rounded; tolerances match.
mix2 = balance(ns["pistachio_v2"])
fp0_2 = -fpd_from_c(mix2["pac"] / mix2["water"] * 100)
M2 = mix2["total_g"]
contribs = {iid: g * (rows_full[iid].get("pac") or 0) / M2 for iid, g in ns["pistachio_v2"]}
CARD = {  # printed on sprinkles-balance-card.html
    "total_g": (916, 0.5), "kcal_per_100g": (200, 0.5), "fat": (9.4, 0.05),
    "msnf": (9.5, 0.05), "added_sugars": (16.9, 0.05), "solids": (40.6, 0.05),
    "pac": (19.9, 0.05), "pod": (17.5, 0.05),
}
checks = []
for k, (want, tol) in CARD.items():
    got = mix2[k]
    checks.append({"metric": k, "card": want, "engine": got, "tolerance": tol, "pass": abs(got - want) <= tol})
checks.append({"metric": "fp0_c", "card": -2.1, "engine": fp0_2, "tolerance": 0.05, "pass": abs(fp0_2 - (-2.1)) <= 0.05})
fr12 = frozen_at(mix2, -12.0)
checks.append({"metric": "frozen_pct_at_minus12", "card": 74, "engine": fr12, "tolerance": 0.5, "pass": abs(fr12 - 74) <= 0.5})
CARD_CONTRIB = {"whole-milk": 2.79, "heavy-cream-36": 0.23, "skim-milk-powder": 2.18,
                "sucrose": 9.27, "dextrose": 9.92, "trimoline-full": 2.77,
                "pistachio-paste-pure": -7.26, "locust-bean-gum": 0.00}
for iid, want in CARD_CONTRIB.items():
    got = contribs[iid]
    checks.append({"metric": f"pac_contrib:{iid}", "card": want, "engine": got, "tolerance": 0.005, "pass": abs(got - want) <= 0.005})
v["card_verification"] = {
    "source": ".planning/prototype/sprinkles-balance-card.html",
    "recipe": "pistachio-v2",
    "all_pass": all(c["pass"] for c in checks),
    "checks": checks,
}

# ---------------------------------------------------------------------------
# Meta + write
# ---------------------------------------------------------------------------
commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True).stdout.strip()
v["meta"] = {
    "oracle": "balance_engine.py (primary)",
    "engineSource": ".planning/prototype/balance_engine.py (executed verbatim; only the seed-DB path patched)",
    "ingredientData": f"REAL seed DB: {seed['meta']['name']} v{seed['meta']['version']} ({seed['meta']['count']} ingredients), .planning/prototype/sprinkles-ingredient-seed-db.json; rows trimmed to balance()-read fields and embedded per recipe",
    "constants": {"FPD_A": FPD_A, "FPD_B": FPD_B, "LACTOSE_FRACTION_OF_MSNF": LACTOSE_FRACTION},
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "repoCommit": commit,
    "pythonVersion": sys.version.split()[0],
    "counts": {"fpd_curve": len(v["fpd_curve"]), "frozen_at": len(v["frozen_at"]),
               "freezing_curves": len(v["freezing_curves"]), "recipes": len(v["recipes"]),
               "card_checks": len(checks)},
}

out = os.path.join(HERE, "python-vectors.json")
with open(out, "w") as f:
    json.dump(v, f, indent=2)
    f.write("\n")
print(f"Wrote {out}")
print(json.dumps(v["meta"]["counts"]))
print("card verification:", "ALL PASS" if v["card_verification"]["all_pass"] else "FAILURES:")
for c in checks:
    if not c["pass"]:
        print(f"  FAIL {c['metric']}: card {c['card']} engine {c['engine']:.4f} (tol {c['tolerance']})")
