/**
 * Calculations Module
 * Freezing curve calculations and recipe fitness/optimization
 *
 * Based on research from University of Guelph
 * https://www.uoguelph.ca/foodscience/sites/default/files/FreezingCurveCalculation.pdf
 */

/**
 * Approximation function for Freezing Point Depression (FDP) from Sucrose Equivalent (SE) solved in water.
 *
 * Based on values found in "Freezing Point Depression of a Mix"
 * https://www.uoguelph.ca/foodscience/sites/uoguelph.ca.foodscience/files/public/FreezingCurveCalculation.pdf
 * an addendum of Goff, Douglas: Ice Cream eBook, University of Guelph
 * https://www.uoguelph.ca/foodscience/book-page/ice-cream-ebook
 *
 * @param {number} se - The normalized parts of SE per part water (0.5 = 50g sucrose in 100g water)
 * @returns {number} Freezing Point Depression in C° (average error in range [0.0, 1.8] SE is 0.1098 °C)
 */
export function SE_to_FPD(se) {
    return 0.7592693269656435 * se * se + 6.5366647596977 * se - 0.1876732904734074;
}

/**
 * Inverse function of SE_to_FPD - converts FPD back to SE
 * @param {number} fdp - Freezing Point Depression in C°
 * @returns {number} Sucrose Equivalent concentration
 */
export function FDP_to_SE(fdp) {
    const a = 0.7592693269656435;
    const b = 6.5366647596977;
    const c = 0.1876732904734074;
    return (0.5 * (Math.sqrt(4.0 * a * fdp + b * b + 4.0 * a * c) - b)) / a;
}

/**
 * Calculate Freezing Point Depression
 * All parameters are expected as absolute/non-normalized weight
 *
 * @param {number} Water - Water content in grams
 * @param {number} PAC - Potere Anti Congelante (freezing point depression power)
 * @param {number} MSNF - Milk Solids Non-Fat content
 * @returns {number} Total freezing point depression
 */
export function CalcFDP(Water, PAC, MSNF) {
    const se_concentration = PAC / Water;
    const fdp_se = -SE_to_FPD(se_concentration);
    const fdp_sa = -MSNF * 2.37 / Water;
    const fdp_total = fdp_se + fdp_sa;
    return fdp_total;
}

/**
 * Calculate ideal PAC (Sucrose Equivalent) for desired hardness at serving temperature
 * @param {object} Recipe - Recipe object with Hardness and ServingTemperature
 * @param {object} Target - Target type with MSNF.Mean value
 * @param {object} Sums - Optional sums object (defaults to Recipe.Sums)
 * @returns {number} Absolute required SE in grams
 */
export function GetIdealPAC(Recipe, Target, Sums = null) {
    if (Sums == null)
        Sums = Recipe.Sums;
    const water = Sums.Water * (1.0 - Recipe.Hardness);
    const ideal_fdp_sa = Target.MSNF.Mean * Sums.Amount * 2.37 / water;
    const ideal_fdp_se = Recipe.ServingTemperature + ideal_fdp_sa;
    const se_concentration = FDP_to_SE(-ideal_fdp_se);
    return se_concentration * water;
}

/**
 * Calculate recipe fitness against target values
 * Used by optimization algorithm to evaluate how well a recipe matches targets
 *
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
