#!/usr/bin/env python3
"""
Golden-master vector generator — PRIMARY (balance_engine.py) oracle.

Executes the balance_engine.py prototype VERBATIM (source loaded from
.planning/prototype/balance_engine.py) except for exactly one string patch:
the hardcoded seed-DB path is redirected to a local ingredient table, because
the real sprinkles-ingredient-seed-db.json is not yet available in this repo.

Until the real seed DB lands, recipe rows here are SYNTHETIC (embedded in the
output, so vectors are self-contained). That is sufficient for the formula
contract — mass-weighted balance(), the FPD quadratic, Leighton frozen_at,
derived identities, target bands — which is what the TS port must reproduce.
The balance card's printed values for pistachio_v2 are recorded separately as
pending expectations to be verified once the real DB is available.

Usage (from repo root):  python3 .planning/golden-masters/generate-python-vectors.py
"""
import io, json, math, subprocess, sys, tempfile, os
from contextlib import redirect_stdout
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ENGINE_SRC = os.path.join(REPO, ".planning", "prototype", "balance_engine.py")

# ---------------------------------------------------------------------------
# Synthetic ingredient table. Values are plausible but NOT the real seed DB;
# they exist to exercise the formulas, including edge cases:
#   - negative pac (nut paste)
#   - zero-water ingredient (sucrose)
#   - missing/None fields (locust-bean-gum has no pac/pod -> engine treats as 0)
#   - pure water row
# Every row used is embedded in the vector output, so tests are self-contained.
# ---------------------------------------------------------------------------
SYNTH_DB = {"ingredients": [
    {"id": "whole-milk",          "name": "Whole milk (synthetic)",      "fat_pct": 3.25, "msnf_pct": 8.5,  "sugars_pct": 4.8,  "water_pct": 87.7, "solids_pct": 12.3, "pac": 4.6,   "pod": 0.8,  "kcal_per_100g": 61},
    {"id": "heavy-cream-36",      "name": "Heavy cream 36% (synthetic)", "fat_pct": 36.0, "msnf_pct": 5.6,  "sugars_pct": 3.0,  "water_pct": 58.0, "solids_pct": 42.0, "pac": 3.0,   "pod": 0.5,  "kcal_per_100g": 340},
    {"id": "skim-milk-powder",    "name": "SMP (synthetic)",             "fat_pct": 0.9,  "msnf_pct": 95.0, "sugars_pct": 51.0, "water_pct": 3.0,  "solids_pct": 97.0, "pac": 52.0,  "pod": 8.5,  "kcal_per_100g": 355},
    {"id": "sucrose",             "name": "Sucrose (synthetic)",         "fat_pct": 0.0,  "msnf_pct": 0.0,  "sugars_pct": 100.0,"water_pct": 0.0,  "solids_pct": 100.0,"pac": 100.0, "pod": 100.0,"kcal_per_100g": 385},
    {"id": "dextrose",            "name": "Dextrose (synthetic)",        "fat_pct": 0.0,  "msnf_pct": 0.0,  "sugars_pct": 91.0, "water_pct": 9.0,  "solids_pct": 91.0, "pac": 175.0, "pod": 61.0, "kcal_per_100g": 340},
    {"id": "trimoline-full",      "name": "Invert syrup (synthetic)",    "fat_pct": 0.0,  "msnf_pct": 0.0,  "sugars_pct": 78.0, "water_pct": 22.0, "solids_pct": 78.0, "pac": 141.0, "pod": 105.0,"kcal_per_100g": 310},
    {"id": "pistachio-paste-pure","name": "Pistachio paste (synthetic)", "fat_pct": 52.0, "msnf_pct": 0.0,  "sugars_pct": 7.0,  "water_pct": 4.0,  "solids_pct": 96.0, "pac": -70.0, "pod": 6.0,  "kcal_per_100g": 590},
    {"id": "locust-bean-gum",     "name": "LBG (synthetic, no pac/pod)", "fat_pct": 0.0,  "msnf_pct": 0.0,  "sugars_pct": 0.0,  "water_pct": 8.0,  "solids_pct": 92.0, "kcal_per_100g": 200},
    {"id": "water",               "name": "Water (synthetic)",           "fat_pct": 0.0,  "msnf_pct": 0.0,  "sugars_pct": 0.0,  "water_pct": 100.0,"solids_pct": 0.0,  "pac": 0.0,   "pod": 0.0,  "kcal_per_100g": 0},
]}

# ---------------------------------------------------------------------------
# Load the engine verbatim, patching ONLY the seed-DB path.
# ---------------------------------------------------------------------------
with open(ENGINE_SRC) as f:
    src = f.read()

dbfile = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
json.dump(SYNTH_DB, dbfile); dbfile.close()
patched = src.replace("/home/claude/sprinkles-ingredient-seed-db.json", dbfile.name)
assert patched != src, "seed-DB path not found in engine source — layout changed?"

ns = {}
with redirect_stdout(io.StringIO()):     # the engine prints reports at import; discard
    exec(compile(patched, ENGINE_SRC, "exec"), ns)

fpd_from_c, c_from_fpd = ns["fpd_from_c"], ns["c_from_fpd"]
frozen_at, freezing_curve = ns["frozen_at"], ns["freezing_curve"]
balance, assess = ns["balance"], ns["assess"]
TARGETS, FPD_A, FPD_B = ns["TARGETS"], ns["FPD_A"], ns["FPD_B"]
LACTOSE_FRACTION = ns["LACTOSE_FRACTION_OF_MSNF"]

rows = {r["id"]: r for r in SYNTH_DB["ingredients"]}

# ---------------------------------------------------------------------------
# Vectors
# ---------------------------------------------------------------------------
v = {"meta": None, "fpd_curve": [], "frozen_at": [], "freezing_curves": [],
     "targets": TARGETS, "recipes": [], "pending_seed_db_expectations": None}

# 1. FPD quadratic and inverse round-trip, c = g sucrose-equivalent / 100 g water.
for i in range(0, 61, 2):
    c = float(i)
    fpd = fpd_from_c(c)
    v["fpd_curve"].append({"c": c, "fpd": fpd, "c_roundtrip": c_from_fpd(fpd)})

# 2. frozen_at over synthetic (pac, water) mixes and a temperature sweep,
#    including the T >= fp0 and Se <= 0 guard branches.
for pac, water in [(20.0, 60.0), (27.0, 62.0), (19.9, 59.0), (30.0, 55.0), (0.0, 60.0), (25.0, 0.0)]:
    mix = {"pac": pac, "water": water}
    for T in [0, -1, -2, -4, -6, -8, -11, -12, -14, -18, -25]:
        v["frozen_at"].append({"pac": pac, "water": water, "T": T, "frozen_pct": frozen_at(mix, float(T))})

# 3. Full freezing curves for two mixes.
for pac, water in [(27.0, 62.0), (19.9, 59.0)]:
    fc = freezing_curve({"pac": pac, "water": water})
    v["freezing_curves"].append({"pac": pac, "water": water, "fp0": fc["fp0"], "points": fc["points"]})

# 4. balance() + assess() over synthetic recipes (rows embedded).
RECIPES = {
    "pistachio-v2-shape": [("whole-milk", 555), ("heavy-cream-36", 70), ("skim-milk-powder", 38),
                           ("sucrose", 85), ("dextrose", 52), ("trimoline-full", 18),
                           ("pistachio-paste-pure", 95), ("locust-bean-gum", 3)],
    "mullan-shape":       [("heavy-cream-36", 222), ("skim-milk-powder", 100), ("sucrose", 140),
                           ("dextrose", 20), ("trimoline-full", 20), ("water", 495), ("locust-bean-gum", 3)],
    "sugar-water-minimal": [("water", 100), ("sucrose", 25)],
    "no-dairy-sorbet-shape": [("water", 550), ("sucrose", 150), ("dextrose", 50), ("trimoline-full", 30)],
}
for rid, recipe in RECIPES.items():
    mix = balance(recipe)
    v["recipes"].append({
        "id": rid,
        "note": "SYNTHETIC rows — validates formulas, not real-recipe outcomes.",
        "input": {"recipe": recipe, "ingredientRows": {iid: rows[iid] for iid, _ in recipe}},
        "expected": {
            "mix": mix,
            "assess": [{"metric": k, "value": val, "lo": lo, "hi": hi, "mark": mark.strip()}
                       for k, val, lo, hi, mark, _ in assess(mix)],
            "fp0": -fpd_from_c(mix["pac"] / mix["water"] * 100) if mix["water"] else None,
            "frozen_at_minus12": frozen_at(mix, -12.0),
        },
    })

# 5. Balance-card printed values for the REAL pistachio_v2 — to be verified the
#    moment the real seed DB is available. Rounded as printed on the card.
v["pending_seed_db_expectations"] = {
    "source": ".planning/prototype/sprinkles-balance-card.html",
    "recipe": RECIPES["pistachio-v2-shape"],
    "printed": {
        "total_g": 916, "kcal_per_100g": 200, "fat": 9.4, "msnf": 9.5,
        "added_sugars": 16.9, "solids": 40.6, "pac": 19.9, "pod": 17.5,
        "fp0_c": -2.1, "frozen_pct_at_minus12": 74,
        "per_ingredient_pac_contrib": {
            "whole-milk": 2.79, "heavy-cream-36": 0.23, "skim-milk-powder": 2.18,
            "sucrose": 9.27, "dextrose": 9.92, "trimoline-full": 2.77,
            "pistachio-paste-pure": -7.26, "locust-bean-gum": 0.00,
        },
    },
    "tolerance_note": "Card values are print-rounded (1-2 decimals); compare accordingly.",
}

# ---------------------------------------------------------------------------
# Meta + write
# ---------------------------------------------------------------------------
commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True).stdout.strip()
v["meta"] = {
    "oracle": "balance_engine.py (primary)",
    "engineSource": ".planning/prototype/balance_engine.py (executed verbatim; only the seed-DB path patched)",
    "ingredientData": "SYNTHETIC (real seed DB not yet in repo) — rows embedded per recipe",
    "constants": {"FPD_A": FPD_A, "FPD_B": FPD_B, "LACTOSE_FRACTION_OF_MSNF": LACTOSE_FRACTION},
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "repoCommit": commit,
    "pythonVersion": sys.version.split()[0],
    "counts": {"fpd_curve": len(v["fpd_curve"]), "frozen_at": len(v["frozen_at"]),
               "freezing_curves": len(v["freezing_curves"]), "recipes": len(v["recipes"])},
}

out = os.path.join(HERE, "python-vectors.json")
with open(out, "w") as f:
    json.dump(v, f, indent=2)
    f.write("\n")
os.unlink(dbfile.name)
print(f"Wrote {out}")
print(json.dumps(v["meta"]["counts"]))
