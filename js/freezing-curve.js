// Freezing Curve Calculations and Recipe Fitness
// Based on research from University of Guelph
// https://www.uoguelph.ca/foodscience/sites/default/files/FreezingCurveCalculation.pdf

// Approximation function for Freezing Point Depression (FDP) from Sucrose Equivalent (SE) solved in water.
// Params:
//      se: The normalized parts of SE per part water. 0.5 means 50g sucrose in 100g water, 1.0 means 100g sucrose in 100g water
// Returns:
//      Freezing Point Depression in C°
// The average error in the range of [0.0, 1.8] SE is 0.1098 °C.
//
// This function is based on values found in
//      "Freezing Point Depression of a Mix"
// https://www.uoguelph.ca/foodscience/sites/uoguelph.ca.foodscience/files/public/FreezingCurveCalculation.pdf
// an addendum of
//      Goff, Douglas: Ice Cream eBook, University of Guelph https://www.uoguelph.ca/foodscience/book-page/ice-cream-ebook
export function SE_to_FPD(se) {
    return 0.7592693269656435 * se * se + 6.5366647596977 * se - 0.1876732904734074;
}

// inverse function of SE_to_FPD
export function FDP_to_SE(fdp) {
    const a = 0.7592693269656435;
    const b = 6.5366647596977;
    const c = 0.1876732904734074;
    return (0.5 * (Math.sqrt(4.0 * a * fdp + b * b + 4.0 * a * c) - b)) / a;
}

// Calculate Freezing Point Depression
// according to https://www.uoguelph.ca/foodscience/sites/default/files/FreezingCurveCalculation.pdf
// all parameters are expected as absolute/non-normalized weight
export function CalcFDP(Water, PAC, MSNF) {
    const se_concentration = PAC / Water;
    const fdp_se = -SE_to_FPD(se_concentration);
    const fdp_sa = -MSNF * 2.37 / Water;
    const fdp_total = fdp_se + fdp_sa;
    return fdp_total;
}

// returns absolute required SE in g that gains desired hardness at serving temperature
export function GetIdealPAC(Recipe, Target, Sums = null) {
    if (Sums == null)
        Sums = Recipe.Sums;
    const water = Sums.Water * (1.0 - Recipe.Hardness);
    const ideal_fdp_sa = Target.MSNF.Mean * Sums.Amount * 2.37 / water;
    const ideal_fdp_se = Recipe.ServingTemperature + ideal_fdp_sa;
    const se_concentration = FDP_to_SE(-ideal_fdp_se);
    return se_concentration * water;
}

// DrawFreezingGraph is now in ui/graph.js

/**
 * Calculate recipe fitness against target values
 * Used by optimization algorithm to evaluate how well a recipe matches targets
 * @param {object} Candidate - Recipe candidate to evaluate
 * @param {object} Recipe - Current recipe (for GetIdealPAC context)
 * @param {object} tgtType - Target type with min/max values
 * @param {Array} fitnessFields - Fields to include in fitness calculation
 * @param {function} cTargetValueClass - The cTargetValue constructor class
 * @param {boolean} OptimizeForMean - Whether to optimize for mean (true) or range (false)
 * @returns {number} Fitness score (lower is better)
 */
export function Fitness(Candidate, Recipe, tgtType, fitnessFields, cTargetValueClass, OptimizeForMean = true) {
    var fitness = 0.0;
    const sums = Candidate.Sums;
    const pac_value = GetIdealPAC(Recipe, tgtType, sums) / sums.Amount; // adjust required PAC to current recipe
    tgtType.PAC = new cTargetValueClass(pac_value * 0.95, pac_value * 1.05); // +/- 5%
    for (const columnName of fitnessFields) {
        const currValue = sums[columnName];
        const tgtValue = sums.Amount * tgtType[columnName].Mean;
        if (currValue == 0.0 || tgtValue == 0)
            fitness += 1.0; // can not calculate -> define as 100%
        else
            fitness += OptimizeForMean ? tgtType[columnName].getMeanError(sums.Amount, currValue)
                : tgtType[columnName].getRangeError(sums.Amount, currValue);
    }

    return fitness;
}
