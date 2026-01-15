/**
 * Ingredients Module
 * Step 3 of modularization - extracted from app.js
 *
 * Contains:
 * - cIngredient class
 * - Ingredient data loading and management
 * - CRUD operations
 * - Display and filtering
 * - Import/Export
 * - USDA FoodData Central integration
 */

import { toFloat, round, nGenerator, objIsEmpty, filterPosNumberInput, filterNumberInput, DamerauLevenshteinDistance } from '../utils/helpers.js';

// Constants
export const IngredientDataFields = ["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer", "kcal"];

// Module state
export let Ingredients = {};

// UI dependencies (injected via initIngredients)
let showModal = null;
let hideModal = null;
let Warning = null;
let Info = null;
let DisplayRecipe = null;
let getRecipeContext = null;  // Function to get Recipe, RecipeBackup, RecipeStack
let Sugars = null;  // Sugars reference table for USDA calculations
let storage = null;  // Storage instance for syncing ingredient changes
let pushIngredientsToCloud = null;  // Cloud sync callback

/**
 * Initialize ingredients module with UI dependencies
 * @param {object} deps - Dependencies object
 */
export function initIngredients(deps) {
    showModal = deps.showModal;
    hideModal = deps.hideModal;
    Warning = deps.Warning;
    Info = deps.Info;
    DisplayRecipe = deps.DisplayRecipe;
    getRecipeContext = deps.getRecipeContext;
    Sugars = deps.Sugars;
    storage = deps.storage;
    pushIngredientsToCloud = deps.pushIngredients || null;
}

/**
 * cIngredient class - represents a single ingredient with nutritional properties
 * All values are ratios (e.g., 30% Fat is stored as 0.3)
 */
export class cIngredient {
    constructor(water = 0.0, sugar = 0.0, fat = 0.0, solids = 0.0, MSNF = 0.0, PAC = 0.0, POD = 0.0, kcal = 0.0, stabilizer = 0.0) {
        if (water > 0.0)
            this.Water = water;
        if (sugar > 0.0)
            this.Sugar = sugar;
        if (fat > 0.0)
            this.Fat = fat;
        if (solids > 0.0)
            this.Solids = solids;
        if (MSNF > 0.0)
            this.MSNF = MSNF; // Milk Solids Non-Fat
        if (Math.abs(PAC) > 0.0)
            this.PAC = PAC; // potere anticongelante / anti-freezing power / Freezing point depression factor
        if (POD > 0.0)
            this.POD = POD;   // potere edulcorante / sweetening power
        if (kcal > 0.0)
            this.kcal = kcal;
        if (stabilizer > 0.0)
            this.Stabilizer = stabilizer;
    }

    copy() {
        return Object.assign(new cIngredient(), this);
    }

    get isSugar() { return this.Sugar >= 0.3 && this.PAC >= 0.5 && !this.isMilkPowder; }
    get isMilkPowder() { return this.MSNF > 0.9 && this.Water < 0.05 }

    get milkFat() {
        if (isNaN(this.Fat)) {
            console.log(`cIngredient: Fat is NaN, returning 0.0`);
            return 0.0
        };
        if (isNaN(this.MSNF)) {
            console.log(`cIngredient: MSNF is NaN; returning 0.0)`);
            return 0.0;
        }
        if (this.MSNF < 0.001) {
            console.log(`cIngredient: MSNF(${this.MSNF}) is too low; returning 0.0`);
            return 0.0;
        }
        console.log(`cIngredient: default returning Fat (${this.Fat})`);
        return this.Fat;
    }

    get nonLactoseSugar() {
        if (isNaN(this.Sugar)) {
            return 0.0
        };
        if (isNaN(this.MSNF)) {
            return this.Sugar;
        }
        if (this.MSNF < 0.001) {
            return this.Sugar;
        }
        return 0.0;
    }
}

// --- Data Management ---

/**
 * Load ingredients from external JSON file
 */
export async function loadIngredients() {
    try {
        const response = await fetch('data/ingredients.json');
        if (!response.ok) {
            throw new Error(`Failed to load ingredients: ${response.status}`);
        }
        const data = await response.json();
        // Clear existing ingredients and populate with loaded data
        // (mutate in place to preserve window.Ingredients reference)
        for (const key in Ingredients) {
            delete Ingredients[key];
        }
        for (const key in data.ingredients) {
            Ingredients[key] = Object.assign(new cIngredient(), data.ingredients[key]);
        }
        SortIngredients();
        // Update window reference after loading
        if (typeof window !== 'undefined') {
            window.Ingredients = Ingredients;
        }
    } catch (error) {
        console.error('Error loading ingredients:', error);
        alert('Failed to load ingredients database. Please refresh the page.');
    }
}

/**
 * Load ingredients from storage (library)
 * @param {Object} storage - Storage instance with loadIngredients method
 * @returns {Promise<boolean>} True if loaded from storage, false otherwise
 */
export async function loadIngredientsFromStorage(storage) {
    try {
        const data = await storage.loadIngredients();
        if (!data || Object.keys(data).length === 0) {
            return false;
        }
        // Clear existing ingredients and populate with loaded data
        // (mutate in place to preserve window.Ingredients reference)
        for (const key in Ingredients) {
            delete Ingredients[key];
        }
        for (const key in data) {
            Ingredients[key] = Object.assign(new cIngredient(), data[key]);
        }
        SortIngredients();
        // Update window reference after loading
        if (typeof window !== 'undefined') {
            window.Ingredients = Ingredients;
        }
        return true;
    } catch (error) {
        console.error('Error loading ingredients from storage:', error);
        return false;
    }
}

/**
 * Save ingredients to storage (library)
 * @param {Object} storage - Storage instance with saveIngredients method
 * @returns {Promise<boolean>} True on success, false on failure
 */
export async function saveIngredientsToStorage(storage) {
    try {
        return await storage.saveIngredients(Ingredients);
    } catch (error) {
        console.error('Error saving ingredients to storage:', error);
        return false;
    }
}

/**
 * Sync ingredients to storage after modification
 * Logs errors but doesn't interrupt user workflow
 */
export async function syncIngredientsToStorage() {
    if (!storage) return;
    const success = await saveIngredientsToStorage(storage);
    if (success) {
        // Push to cloud if signed in (fire-and-forget)
        if (pushIngredientsToCloud) {
            pushIngredientsToCloud(Ingredients);
        }
    } else {
        console.error('Failed to sync ingredients to storage');
    }
}

/**
 * Get sorted array of ingredient names
 * @returns {string[]} Array of ingredient names
 */
export function IngredientNames() {
    return Object.keys(Ingredients);
}

/**
 * Sort ingredients alphabetically by name
 */
export function SortIngredients() {
    const keys = Object.keys(Ingredients).sort();
    // Create sorted copy
    var tmp = {};
    for (const key of keys) {
        tmp[key] = Ingredients[key];
    }
    // Clear and repopulate to maintain object reference
    for (const key in Ingredients) {
        delete Ingredients[key];
    }
    for (const key in tmp) {
        Ingredients[key] = tmp[key];
    }
}

// --- CRUD Operations ---

/**
 * Check if an ingredient is used in any recipe
 * @param {string} ingredientName - Name of ingredient to check
 * @returns {{IsUsed: boolean, IsUsedBy: string}} Result with usage status
 */
export function isIngredientUsed(ingredientName) {
    console.assert(ingredientName.length > 0);

    var result = {
        IsUsed: false,
        IsUsedBy: ""
    };

    const { Recipe, RecipeBackup, RecipeStack } = getRecipeContext();

    function CheckUsage(recipe) {
        const used = recipe.Ingredients.some(ingredient => ingredient.Name === ingredientName);
        if (used)
            result.IsUsedBy = recipe.Name;
        return used;
    }

    result.IsUsed = CheckUsage(Recipe)
        || RecipeBackup.some(recipe => CheckUsage(recipe))
        || (() => {
            for (const key in RecipeStack)
                if (CheckUsage(RecipeStack[key].Recipe))
                    return true;
            return false;
        })();
    return result;
}

/**
 * Handle ingredient property edit
 * @param {Event} element - The input event
 */
export function onIngredientEdit(element) {
    const ingredientName = element.currentTarget.parentNode.parentNode.firstChild.firstChild.value;
    const propertyName = element.currentTarget.name;
    const propertyValue = element.currentTarget.value;

    if (propertyName == "Name") {
        if (propertyValue == "")
            return;

        const originalName = element.currentTarget.parentNode.parentNode.name;
        if (originalName != "") {
            const IngredientUsed = isIngredientUsed(originalName);
            if (IngredientUsed.IsUsed) {
                Warning(originalName + " is used by " + IngredientUsed.IsUsedBy);
                element.currentTarget.value = originalName;
                return;
            }

            // check for duplicate name and reset value as required
            if (Ingredients.hasOwnProperty(ingredientName)) {
                Warning(ingredientName + " already exists.");
                element.currentTarget.value = originalName;
                return;
            }

            Ingredients[ingredientName] = Ingredients[originalName];
            element.currentTarget.parentNode.parentNode.name = ingredientName;
            delete Ingredients[originalName];
        } else {
            // check for duplicate name and reset value as required
            if (Ingredients.hasOwnProperty(ingredientName)) {
                Warning(ingredientName + " already exists.");
                element.currentTarget.value = "";
                return;
            }
            Ingredients[ingredientName] = new cIngredient(0, 0, 0, 0);
            element.currentTarget.parentNode.parentNode.name = ingredientName;
        }
    } else {
        if (ingredientName == "" || !Ingredients.hasOwnProperty(ingredientName)) {
            element.currentTarget.value = "";
            return;
        }

        const value = propertyValue == "" ? 0. : toFloat(propertyValue);
        if (isNaN(value)) {
            Warning(propertyValue + " is not a valid number.");
            element.currentTarget.value = round(Ingredients[ingredientName][propertyName] * 100.);
        } else {
            Ingredients[ingredientName][propertyName] = value / 100.;
        }
    }

    // add empty line on top
    var row = element.currentTarget.closest('tr');
    if (row.rowIndex == 1 && ingredientName != "") {
        row.parentNode.insertBefore(createIngredientRow(), row);
    }

    // Sync changes to storage (fire-and-forget)
    syncIngredientsToStorage();
}

/**
 * Handle ingredient deletion
 * @param {Event} element - The click event
 */
export function onIngredientDeleted(element) {
    const ingredientName = element.currentTarget.parentNode.parentNode.firstChild.firstChild.value;
    if (ingredientName == "")
        return;

    const IngredientUsed = isIngredientUsed(ingredientName);
    if (IngredientUsed.IsUsed) {
        Warning(ingredientName + " is used by " + IngredientUsed.IsUsedBy);
        return;
    }

    delete Ingredients[ingredientName];
    element.currentTarget.closest('tr').remove();

    // Sync changes to storage (fire-and-forget)
    syncIngredientsToStorage();
}

// --- Display & Filtering ---

// Static property for filter state
let filterIgnored = null;

/**
 * Handle filter input edit
 */
export function onIngredientFilterEdit() {
    filterIgnored = null;
    filterIngredients();
}

/**
 * Filter ingredients table by search term
 */
export function filterIngredients() {
    var rows = document.getElementById("tblIngredientsList").getElementsByTagName('tr');
    const filter = document.getElementById('edIngredientFilter').value.toLowerCase();
    const doFilter = filter.length > 0;
    for (var row of rows)
        row.style.display = (doFilter && row.hasOwnProperty('name') && row.name != "" && !(row.name.toLowerCase().includes(filter) || row.name == filterIgnored)) ? 'none' : '';
}

/**
 * Set ignored ingredient for filter (used during USDA import)
 * @param {string} name - Ingredient name to ignore in filter
 */
export function setFilterIgnored(name) {
    filterIgnored = name;
}

/**
 * Create a table row for an ingredient
 * @param {string} name - Ingredient name
 * @param {cIngredient} ingredient - Ingredient data
 * @returns {HTMLTableRowElement} The table row element
 */
export function createIngredientRow(name = "", ingredient = null) {
    function addCell(columnName, value) {
        var cell = document.createElement('td');

        var input = document.createElement('input');
        input.name = columnName;
        input.placeholder = columnName;
        input.oninput = onIngredientEdit;
        if (typeof value === "number") {
            input.value = round(value * 100.);
            input.onkeypress = filterPosNumberInput;
            input.pattern = "[0-9]+([\.,][0-9]+)?";
            if (columnName === "PAC") {
                input.onkeypress = filterNumberInput;
                input.pattern = "-?" + input.pattern;
            }
            input.step = "any";
            if (value == 0.0)
                input.value = null;
        } else
            input.value = value;

        cell.appendChild(input);
        if (columnName === "Name") {
            var btn = document.createElement('button');
            btn.title = "Try to download values from FoodData Central";
            btn.innerText = "\u{1F310}";  // Globe emoji
            btn.onclick = onDownloadIngredientData;
            btn.style = "margin-left: 7px;";
            cell.appendChild(btn);

            btn = document.createElement('button');
            btn.title = "Delete";
            btn.innerText = "\u{1F5D1}\u{FE0F}";  // Trash emoji
            btn.onclick = onIngredientDeleted;
            btn.style = "margin-left: 7px;";
            cell.appendChild(btn);
        }
        row.appendChild(cell);
    }

    var row = document.createElement('tr');
    addCell("Name", name);
    row.name = name;
    for (const columnName of IngredientDataFields) {
        if (ingredient != null && ingredient.hasOwnProperty(columnName)) {
            addCell(columnName, ingredient[columnName]);
        } else {
            addCell(columnName, 0);
        }
    }
    return row;
}

/**
 * Display the ingredients table
 */
export function DisplayIngredients() {
    var table = document.createElement('table');

    var tableHead = document.createElement('thead');
    var row = document.createElement('tr');
    var cell = document.createElement('th');
    cell.appendChild(document.createTextNode("Name"));
    row.appendChild(cell);
    for (const columnName of IngredientDataFields) {
        var cell = document.createElement('th');
        cell.appendChild(document.createTextNode(columnName));
        row.appendChild(cell);
    }
    tableHead.appendChild(row);
    table.appendChild(tableHead);

    var tableBody = document.createElement('tbody');
    tableBody.appendChild(createIngredientRow());
    for (const key in Ingredients)
        tableBody.appendChild(createIngredientRow(key, Ingredients[key]));
    table.appendChild(tableBody);
    table.id = "tblIngredientsList";

    document.getElementById("tblIngredientsList").replaceWith(table);

    if (document.getElementById("edIngredientFilter").value != "")
        filterIngredients();
}

// --- Import/Export ---

/**
 * Compare two ingredient objects and return differences
 * @param {object} A - First ingredient object
 * @param {object} B - Second ingredient object
 * @returns {object} Object with differing properties
 */
export function diffIngredients(A, B) {
    var diffObj = {};
    function cmp(a, b) {
        for (const [key, data] of Object.entries(a))
            if (!diffObj.hasOwnProperty(key)
                && (!b.hasOwnProperty(key)
                    || typeof (a[key]) != typeof (b[key])
                    || a[key] != b[key]))
                diffObj[key] = [
                    A.hasOwnProperty(key) ? A[key] : null,
                    B.hasOwnProperty(key) ? B[key] : null
                ];
    };
    cmp(A, B);
    cmp(B, A);
    return diffObj;
}

/**
 * Import ingredients with optional merge conflict resolution
 * @param {object} dataObj - Ingredients data to import
 * @param {boolean} overrideExisting - Whether to override existing ingredients
 * @param {string} mergeMessageMtml - Optional HTML message for merge dialog
 * @param {object} columnLabels - Column label overrides for merge dialog { current: "Current", imported: "Imported" }
 * @param {object} buttonLabels - Button label overrides for merge dialog { keep: "Keep", replace: "Replace" }
 */
export function importIngredients(dataObj, overrideExisting = false, mergeMessageMtml = null, columnLabels = { current: "Current", imported: "Imported" }, buttonLabels = { keep: "Keep", replace: "Replace" }) {
    var mergeList = {};
    for (const [key, data] of Object.entries(dataObj)) {
        dataObj[key] = Object.assign(new cIngredient(), dataObj[key]);

        if (overrideExisting || !Ingredients.hasOwnProperty(key)) {
            Ingredients[key] = dataObj[key];
        } else {
            const diff = diffIngredients(Ingredients[key], dataObj[key]);
            if (!objIsEmpty(diff))
                mergeList[key] = diff;
        }
    }

    SortIngredients();

    // display merge dialog
    const mergeItems = Object.keys(mergeList).length;
    if (mergeItems > 0) {
        const multi = mergeItems > 1;

        var div = document.createElement("div");
        div.style = "display: table; table-layout: fixed;";
        var h3 = document.createElement("h3");
        h3.innerText = "Resolve Merge Conflict" + (multi ? "s" : "");
        div.appendChild(h3);
        if (mergeMessageMtml != null) {
            var p = document.createElement("p");
            p.style = "text-align: initial;";
            p.innerHTML = mergeMessageMtml;
            div.appendChild(p);
        }

        var table = document.createElement("table");
        var th = document.createElement("thead");
        var tr = document.createElement('tr');
        for (const name of ["Ingredient", columnLabels.current, columnLabels.imported]) {
            var cell = document.createElement('th');
            cell.innerText = name;
            tr.appendChild(cell);
        }
        th.appendChild(tr);
        table.appendChild(th);
        var tbody = document.createElement("tbody");

        for (const [key, data] of Object.entries(mergeList)) {
            tr = document.createElement('tr');
            tr.Name = key;

            var cells = [...nGenerator(3, () => { return document.createElement('td'); })];
            cells[0].innerHTML = "<b>" + key + "</b>";
            if (multi) {
                cells[1].innerHTML = '<input type="radio" name="' + key + '" value="Current">';
                cells[2].innerHTML = '<input type="radio" name="' + key + '" value="Imported">';
            }
            for (const [fieldKey, fieldValues] of Object.entries(data)) {
                cells[0].innerHTML += "<br>" + fieldKey;
                cells[1].innerHTML += "<br>" + (fieldValues[0] == null ? "-" : round(fieldValues[0] * 100.));
                cells[2].innerHTML += "<br>" + (fieldValues[1] == null ? "-" : round(fieldValues[1] * 100.));
            }
            for (const cell of cells)
                tr.appendChild(cell);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        div.appendChild(table);

        var buttonBar = document.createElement("div");
        var buttons = [...nGenerator(multi ? 3 : 2, () => { return document.createElement('button'); })];
        buttons[0].innerText = buttonLabels.keep;
        buttons[0].onclick = hideModal;
        buttons[1].innerText = buttonLabels.replace;
        buttons[1].onclick = function () {
            for (const [key, data] of Object.entries(mergeList))
                Ingredients[key] = dataObj[key];
            hideModal();
            DisplayRecipe();
            DisplayIngredients();
            syncIngredientsToStorage();
        };
        if (multi) {
            buttons[2].innerText = "Apply";
            buttons[2].onclick = function () {
                // check if all rows are selected
                for (const row of table.tBodies[0].rows) {
                    const rbCurrent = row.querySelector("input[type='radio'][value='Current']");
                    const rbImported = row.querySelector("input[type='radio'][value='Imported']");
                    if (!rbCurrent.checked && !rbImported.checked) {
                        Warning("Please select one option for each ingredient.");
                        return;
                    }
                }
                // merge selected
                for (const row of table.tBodies[0].rows)
                    if (row.querySelector("input[type='radio'][value='Imported']").checked)
                        Ingredients[row.Name] = dataObj[row.Name];

                hideModal();
                DisplayRecipe();
                DisplayIngredients();
                syncIngredientsToStorage();
            };
        }

        for (const button of buttons)
            buttonBar.appendChild(button);
        showModal(div, buttonBar);
    } else {
        DisplayRecipe();
        DisplayIngredients();
        syncIngredientsToStorage();
    }
}

// --- USDA FoodData Central Integration ---

/**
 * Download ingredient data from USDA FoodData Central
 * @param {Event} element - The click event
 */
export function onDownloadIngredientData(element) {
    const ingredientName = element.currentTarget.parentNode.parentNode.firstChild.firstChild.value;
    if (ingredientName == "")
        return;

    requestData(ingredientName);

    function requestData(ingredientName) {
        var httpRequest = new XMLHttpRequest();
        httpRequest.onreadystatechange = resultHandler;

        const searchParams = {
            query: ingredientName,
            dataType: ["Foundation", "Survey (FNDDS)", "SR Legacy"]
        };
        httpRequest.open('POST', "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=wiMzQqoyJ2hgzPsDdUsubCjltt6djhCjG6phgSLT");
        httpRequest.setRequestHeader('Content-type', 'application/json');
        httpRequest.send(JSON.stringify(searchParams));
    }

    function resultHandler() {
        if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
            var dataObj = JSON.parse(this.responseText);
            var query = dataObj.foodSearchCriteria.query;

            if (dataObj.totalHits == 0) {
                query = query.substring(0, query.lastIndexOf(" "));
                if (query.length > 1)
                    requestData(query);
                else
                    Info("No data found for " + ingredientName);
                return;
            }

            // filter results using fuzzy matching
            var distances = [];
            for (const food of dataObj.foods)
                distances.push(DamerauLevenshteinDistance(food.description, ingredientName));
            distances.sort();
            const minDistance = distances[Math.min(12, distances.length - 1)];
            dataObj.foods = dataObj.foods.filter(food => {
                return food.dataType == "Foundation"
                    || (DamerauLevenshteinDistance(food.description, ingredientName) <= minDistance);
            });

            // display search results for selection
            var items = [];
            for (const food of dataObj.foods)
                items.push(food.description);
            items = items.filter((value, index, self) => {
                return self.indexOf(value) === index;
            });
            var div = document.createElement("div");
            div.style = "display: table; table-layout: fixed; font-size:125%; line-height: 1.33; text-align: initial;";
            var h3 = document.createElement("h3");
            h3.innerText = "Search Results";
            div.appendChild(h3);

            for (const value of items) {
                var a = document.createElement('a');
                a.style = "cursor: pointer;";
                a.innerText = value;
                a.onclick = importItem;
                div.appendChild(a);
                div.appendChild(document.createElement('br'));
            }

            var buttonBar = document.createElement("div");
            var button = document.createElement('button');
            button.innerText = "Abort";
            button.onclick = hideModal;
            buttonBar.appendChild(button);
            showModal(div, buttonBar);

            function importItem(event) {
                hideModal();

                const name = event.target.innerText;

                const foods = function () {
                    var foundationNdx = -1;
                    var surveyNdx = -1;
                    var legacyNdx = -1;
                    for (const i in dataObj.foods)
                        if (dataObj.foods[i].description === name) {
                            switch (dataObj.foods[i].dataType) {
                                case "Foundation": foundationNdx = i; break
                                case "Survey (FNDDS)": surveyNdx = i; break;
                                case "SR Legacy": legacyNdx = i; break;
                            }
                        }

                    var foods = [];
                    if (foundationNdx >= 0)
                        foods.push(dataObj.foods[foundationNdx]);
                    if (legacyNdx >= 0)
                        foods.push(dataObj.foods[legacyNdx]);
                    if (surveyNdx >= 0)
                        foods.push(dataObj.foods[surveyNdx]);
                    return foods;
                }();

                function getNutritionValue(name, unit = "G") {
                    for (const food of foods)
                        for (const nutritient of food.foodNutrients)
                            if (nutritient.nutrientName === name && nutritient.unitName === unit)
                                return nutritient.value / 100.0;

                    return -1.0;
                }

                if (foods.length > 0) {
                    var imported = Ingredients[ingredientName].copy();

                    var foundFields = {};
                    for (const field of IngredientDataFields)
                        foundFields[field] = false;

                    function setValue(key, value) {
                        if (value >= 0) {
                            foundFields[key] = true;
                            imported[key] = value;
                        }
                        return value;
                    }

                    const water = setValue("Water", getNutritionValue("Water"));
                    const fat = setValue("Fat", getNutritionValue("Total lipid (fat)"));
                    setValue("Sugar", Math.max(getNutritionValue("Sugars, Total NLEA"), getNutritionValue("Sugars, total including NLEA")));
                    setValue("kcal", getNutritionValue("Energy", "KCAL"));

                    var ethanol = Math.max(getNutritionValue("Alcohol, ethyl"), 0.);
                    const sugars = {
                        Sucrose: getNutritionValue("Sucrose"),
                        Dextrose: getNutritionValue("Glucose (dextrose)"),
                        Fructose: getNutritionValue("Fructose"),
                        Lactose: getNutritionValue("Lactose"),
                        Maltose: getNutritionValue("Maltose"),
                        Galactose: getNutritionValue("Galactose"),
                        Ethanol: ethanol
                    };
                    var pacSum = 0.0;
                    var podSum = 0.0;
                    var valid = true;
                    for (const key in sugars) {
                        valid &= sugars[key] >= 0.0;
                        pacSum += 342.3 / Sugars[key][0] * sugars[key];
                        podSum += Sugars[key][1] * sugars[key];
                    }
                    if (valid) {
                        imported.PAC = pacSum;
                        imported.POD = podSum / 100.0;
                        foundFields.PAC = true;
                        foundFields.POD = true;
                    }
                    if (water >= 0) {
                        foundFields.Solids = true;
                        imported.Solids = 1.0 - (water + ethanol);
                        if (fat >= 0 && sugars.Lactose > 0) {
                            foundFields.MSNF = true;
                            imported.MSNF = imported.Solids - fat;
                        }
                    }

                    var notFound = [];
                    for (const field in foundFields)
                        if (!foundFields[field])
                            notFound.push(field);

                    var lib = {};
                    lib[ingredientName] = imported;
                    setFilterIgnored(ingredientName);
                    importIngredients(lib, false, (notFound.length > 0 ? ("Please check values manually for: " + notFound.join(", ")) : null));
                } else {
                    console.assert(false);
                    return;
                }
            }
        }
    }
}

// Expose to window for testing
if (typeof window !== 'undefined') {
    window.Ingredients = Ingredients;
    window.IngredientNames = IngredientNames;
    window.SortIngredients = SortIngredients;
    window.isIngredientUsed = isIngredientUsed;
    window.diffIngredients = diffIngredients;
    window.onDownloadIngredientData = onDownloadIngredientData;
    window.DamerauLevenshteinDistance = DamerauLevenshteinDistance;
}
