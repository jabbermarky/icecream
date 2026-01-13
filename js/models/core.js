//=====================================================================================================================================================================
// Core Data Models - Target and Recipe classes
// Extracted from js/app.js during Phase 8 modularization
//=====================================================================================================================================================================

import { round } from '../utils/helpers.js';
import { Ingredients } from '../features/ingredients.js';

// Dependency injection for RecipeDataColumns
// Will be injected by app.js via initModels()
let getRecipeDataColumns = () => ["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer"];

/**
 * Initialize models module with dependencies
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.getRecipeDataColumns - Function returning recipe data column names
 */
export function initModels(deps) {
    if (deps.getRecipeDataColumns) getRecipeDataColumns = deps.getRecipeDataColumns;
}

/**
 * Represents a target value range with min/max bounds
 * Used for recipe optimization and validation
 */
export class cTargetValue {
    constructor(min, max) {
        this.Min = min;
        this.Max = max;
        this.Range = max - min;
        this.Mean = (min + max) * 0.5;
    }
    getRangeError(factor, value) {
        if (this.Range <= 0.0)
            return getMeanError(factor, value);
        return Math.max(Math.abs(this.Mean * factor - value) - this.Range * factor * 0.5, 0.0) / (this.Range * factor);
    };
    getMeanError(factor, value) {
        const delta = Math.abs(this.Mean * factor - value);
        if (delta == 0.0)
            return 0.0;
        return delta / (this.Mean * factor);
    }
}

/**
 * Represents target constraints for a specific ice cream type
 * Contains target ranges for Fat, MSNF, Solids, POD, and Stabilizer
 */
export class cTarget {
    constructor(fatMin, fatMax
        , msnfMin, msnfMax
        , podMin, podMax
        , stabilizerMin, stabilizerMax
        , solidsMin, solidsMax
    ) {

        this.Fat = new cTargetValue(fatMin, fatMax);
        this.MSNF = new cTargetValue(msnfMin, msnfMax);
        this.Solids = new cTargetValue(solidsMin, solidsMax);
        this.POD = new cTargetValue(podMin, podMax);
        this.Stabilizer = new cTargetValue(stabilizerMin, stabilizerMax);
    }
}

/**
 * Target definitions for different ice cream types
 * Based on: https://www.sciencedirect.com/topics/food-science/frozen-dessert
 */
export const Targets = {};

//       Name                                         Fat       	    MSNF        	    POD                 Stabilizer          Total Solids
Targets["Non-Fat"] = new cTarget(0, 0.005, 0.12, 0.14, 0.18, 0.22, 0.009, 0.011, 0.28, 0.32);
Targets["Low Fat"] = new cTarget(0.02, 0.05, 0.12, 0.14, 0.18, 0.21, 0.007, 0.009, 0.28, 0.32);
Targets["Light"] = new cTarget(0.05, 0.07, 0.11, 0.12, 0.18, 0.2, 0.004, 0.006, 0.3, 0.35);
Targets["Reduced Fat"] = new cTarget(0, 0.1, 0.09, 0.1, 0.14, 0.17, 0.002, 0.004, 0.36, 0.38);
Targets["Standard"] = new cTarget(0.10, 0.12, 0.09, 0.1, 0.14, 0.17, 0.002, 0.004, 0.36, 0.38);
Targets["Premium"] = new cTarget(0.12, 0.14, 0.08, 0.1, 0.13, 0.16, 0.002, 0.004, 0.38, 0.4);
Targets["Super-Premium"] = new cTarget(0.14, 0.18, 0.05, 0.08, 0.14, 0.17, 0.0, 0.002, 0.4, 0.42);
Targets["Gelato"] = new cTarget(0.04, 0.08, 0.09, 0.12, 0.13, 0.17, 0.004, 0.005, 0.32, 0.42);
Targets["Frozen Yogurt: Non-Fat"] = new cTarget(0, 0.005, 0.09, 0.14, 0.15, 0.17, 0.005, 0.007, 0.28, 0.32);
Targets["Frozen Yogurt: Regular"] = new cTarget(0.03, 0.06, 0.09, 0.13, 0.15, 0.17, 0.004, 0.005, 0.3, 0.36);
Targets["Sorbet"] = new cTarget(0.0, 0.01, 0.0, 0.0, 0.22, 0.28, 0.004, 0.005, 0.28, 0.34);
Targets["Sherbet"] = new cTarget(0.01, 0.02, 0.01, 0.03, 0.22, 0.28, 0.004, 0.005, 0.28, 0.34);

/**
 * Represents an ice cream recipe with ingredients and properties
 * @class
 */
export class cRecipe {
    /**
     * Create a new recipe
     * @param {string} name - Recipe name
     * @param {string} notes - Recipe notes
     * @param {Object} defaults - Optional default values for Type, ServingTemperature, Hardness
     */
    constructor(name = "", notes = "", defaults = {}) {
        this.Name = name;
        this.Notes = notes;
        // Use defaults if provided, otherwise use sensible module defaults
        this.Type = defaults.Type !== undefined ? defaults.Type : "Standard";
        this.ServingTemperature = defaults.ServingTemperature !== undefined ? defaults.ServingTemperature : -18;
        this.Hardness = defaults.Hardness !== undefined ? defaults.Hardness : 0.75;
        this.Overrun = 0.3;
        this.Ingredients = [];
    }

    static copyFrom(original) {
        var copy = Object.assign(new cRecipe(""), original);
        copy.Ingredients = original.Ingredients.map(value => ({ ...value }));
        return copy;
    }

    addIngredient(name, amount = 0) {
        this.Ingredients.push(({ Name: name, Amount: amount }));
    }

    get Amount() {
        var sum = 0.0;
        for (const ingredient of this.Ingredients)
            sum += ingredient.Amount;
        return sum;
    }

    set Amount(tgtAmount) {
        const factor = tgtAmount / this.Amount;
        for (const ingredient of this.Ingredients)
            ingredient.Amount = round(ingredient.Amount * factor);
    }

    get Sums() {
        var sums = { Amount: 0.0, nonLactoseSugar: 0.0, milkFat: 0.0 };
        const columns = getRecipeDataColumns().concat("kcal");
        for (const columnName of columns)
            sums[columnName] = 0.0;
        for (const ingredient of this.Ingredients) {
            console.log(`ingredient.Name: ${ingredient.Name}, ingredient.Amount: ${ingredient.Amount}`);

            sums.Amount += ingredient.Amount;
            if (Ingredients.hasOwnProperty(ingredient.Name)) {
                sums.nonLactoseSugar += Ingredients[ingredient.Name].nonLactoseSugar * ingredient.Amount;
                //console.log(`nonLactoseSugar: ${Ingredients[ingredient.Name].nonLactoseSugar * ingredient.Amount}`);
                let ingredientMilkFat = Ingredients[ingredient.Name].milkFat;
                let milkFat = ingredientMilkFat * ingredient.Amount
                sums.milkFat += milkFat;
                console.log(`ingredientMilkFat: ${ingredientMilkFat}`);
                console.log(`milkFat: ${milkFat}`);
            }
            for (const columnName of columns)
                if (Ingredients.hasOwnProperty(ingredient.Name) && Ingredients[ingredient.Name].hasOwnProperty(columnName))
                    sums[columnName] += Ingredients[ingredient.Name][columnName] * ingredient.Amount;
        }
        return sums;
    }
}
