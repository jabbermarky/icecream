//=====================================================================================================================================================================
// Recipe Manager Module - Recipe state management and display functions
// Extracted from js/app.js during Phase 9 modularization
//=====================================================================================================================================================================

import { toFloat, round, nGenerator, filterPosNumberInput } from '../utils/helpers.js';
import { cRecipe, cTargetValue, Targets } from '../models/core.js';
import { IngredientNames, IngredientDataFields } from './ingredients.js';
import { GetIdealPAC, Fitness } from './calculations.js';
import { DrawFreezingGraph } from '../ui/graph.js';
import { getCSS } from '../ui/components.js';

// Module-level state
let RecipeBackup = [];  // backups recipe states on optimization
let RecipeStack = {};   // keeps previous recipes when loading or creating new recipes
let sortBy = null;
let sortAsc = false;

// Dependency references (injected via initRecipeManager)
let getRecipe = null;
let setRecipe = null;
let getIngredients = null;
let getRecipeDataColumns = null;
let getRecipeColumns = null;
let sliders = null;
let scoopSizes = null;
let tgtSelection = null;
let showModal = null;
let hideModal = null;
let Info = null;
let Warning = null;
let ErrorMsg = null;

/**
 * Initialize recipe manager module with dependencies
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.getRecipe - Function returning current Recipe
 * @param {Function} deps.setRecipe - Function to set Recipe
 * @param {Function} deps.getIngredients - Function returning Ingredients object
 * @param {Function} deps.getRecipeDataColumns - Function returning RecipeDataColumns array
 * @param {Function} deps.getRecipeColumns - Function returning RecipeColumns array
 * @param {Object} deps.sliders - Slider elements { slServingTemperature, slHardness, slOverrun, slScoopSize }
 * @param {Array} deps.scoopSizes - Array of scoop size definitions
 * @param {HTMLSelectElement} deps.tgtSelection - Target type selection element
 * @param {Function} deps.showModal - Function to show modal dialog
 * @param {Function} deps.hideModal - Function to hide modal dialog
 * @param {Function} deps.Info - Info message function
 * @param {Function} deps.Warning - Warning message function
 * @param {Function} deps.ErrorMsg - Error message function
 */
export function initRecipeManager(deps) {
    getRecipe = deps.getRecipe;
    setRecipe = deps.setRecipe;
    getIngredients = deps.getIngredients;
    getRecipeDataColumns = deps.getRecipeDataColumns;
    getRecipeColumns = deps.getRecipeColumns;
    sliders = deps.sliders;
    scoopSizes = deps.scoopSizes;
    tgtSelection = deps.tgtSelection;
    showModal = deps.showModal;
    hideModal = deps.hideModal;
    Info = deps.Info;
    Warning = deps.Warning;
    ErrorMsg = deps.ErrorMsg;
}

// --- Recipe Modified State ---

/**
 * Set or check the recipe modified state
 * @param {boolean} modified - Whether recipe is modified (default true)
 */
export function SetRecipeModified(modified = true) {
    const changed = SetRecipeModified.modified != modified;
    SetRecipeModified.modified = modified;
    if (changed) {
        document.getElementById("ModifiedIndicator").style = "display: " + (modified ? "inline-block;" : "none;");
    }
}

/**
 * Check if recipe has been modified
 * @returns {boolean} True if recipe is modified
 */
export function IsRecipeModified() {
    return SetRecipeModified.modified;
}

// --- Recipe Backup/Restore ---

/**
 * Backup the current recipe to the stack
 */
export function BackupCurrentRecipe() {
    if (BackupRecipe(getRecipe()))
        DisplayBackupList();
}

/**
 * Backup a specific recipe to the stack
 * @param {cRecipe} recipe - Recipe to backup
 * @returns {boolean} True if backup was successful
 */
export function BackupRecipe(recipe) {
    const Recipe = getRecipe();
    if (Recipe.Ingredients.length == 0)
        return false;
    if (Recipe.Name == "") {
        const sample = array => {
            return array[Math.floor(Math.random() * array.length)];
        };
        do {
            Recipe.Name = sample(["The ", ""]) + sample(["Incredible", "Great", "Tasty", "Wonderful", "Fantastic", "Outstanding", "Delicious", "Yummy", "Extraordinary", "Palatable", "Savory", "Flavorful", "Flavorsome", "Toothsome", "Relishable", "Sapid", "Pleasant-Tasting"])
                + " " + (["Gelato", "Sorbet", "Sherbet"].includes(Recipe.Type) ? Recipe.Type : "Ice Cream");
        } while (RecipeStack.hasOwnProperty(Recipe.Name))
    }

    RecipeStack[Recipe.Name] = {
        'Recipe': cRecipe.copyFrom(Recipe),
        'Modified': IsRecipeModified()
    };
    return true;
}

/**
 * Display the backup recipe list in the UI
 */
export function DisplayBackupList() {
    var element = document.getElementById("RecipeStack");
    element.innerHTML = "";
    if (Object.keys(RecipeStack).length == 0)
        return;

    var b = document.createElement('b');
    b.innerText = "Recent Recipes";
    element.appendChild(b);
    element.appendChild(document.createElement('br'));
    for (const item in RecipeStack) {
        var span = document.createElement('a');
        span.innerText = item;
        span.style = "cursor: pointer;";
        if (RecipeStack[item].Modified) {
            var mod = document.createElement('span');
            mod.setAttribute('class', 'ModifiedIndicator');
            mod.style = "display: inline-block;"
            span.appendChild(mod);
        }
        span.onclick = function () {
            RestoreBackup(this.innerText);
        };
        element.appendChild(span);
        element.appendChild(document.createElement('br'));
    }
}

/**
 * Restore a backed-up recipe
 * @param {string} recipeName - Name of recipe to restore
 */
export function RestoreBackup(recipeName) {
    BackupRecipe(getRecipe());
    sortBy = null;

    setRecipe(cRecipe.copyFrom(RecipeStack[recipeName].Recipe));
    DisplayRecipe();
    SetRecipeModified(RecipeStack[recipeName].Modified);
    delete RecipeStack[recipeName];
    DisplayBackupList();
}

// --- Recipe Sorting ---

/**
 * Sort recipe ingredients by column
 * @param {Event|null} event - Click event from column header, or null to re-sort
 */
export function SortRecipe(event = null) {
    const Ingredients = getIngredients();
    const RecipeDataColumns = getRecipeDataColumns();
    const Recipe = getRecipe();

    if (event !== null) {
        var sortStr = event.target.innerText;
        if (/^.* [▲▼]$/.test(sortStr))
            sortStr = sortStr.slice(0, -2);

        if (sortStr === sortBy)
            sortAsc ^= true;
        sortBy = sortStr;
    }

    var cmp = null;
    switch (sortBy) {
        case "Name":
            cmp = function (a, b) { return a.Name < b.Name; };
            break;
        case "Amount":
        case "Scale to":
            cmp = function (a, b) { return a.Amount > b.Amount; };
            break;
        default:
            if (RecipeDataColumns.includes(sortBy))
                cmp = function (a, b) {
                    return (Ingredients[a.Name].hasOwnProperty(sortBy) ? Ingredients[a.Name][sortBy] * a.Amount : 0.0)
                        > (Ingredients[b.Name].hasOwnProperty(sortBy) ? Ingredients[b.Name][sortBy] * b.Amount : 0.0)
                };
    }

    if (cmp !== null) {
        const asc = sortAsc ? 1 : -1;
        Recipe.Ingredients.sort((a, b) => { return cmp(a, b) ? asc : -asc });
    }
    DisplayRecipe();
}

// --- Recipe Row Creation ---

/**
 * Create a table row for a recipe ingredient
 * @param {string[]|null} ingredientNames - Array of ingredient names, or null to generate
 * @returns {HTMLTableRowElement} The created table row
 */
export function CreateRecipeRow(ingredientNames = null) {
    const RecipeDataColumns = getRecipeDataColumns();

    var row = document.createElement('tr');

    var cell = document.createElement('td');
    var select = document.createElement('select');

    if (ingredientNames == null)
        ingredientNames = IngredientNames();
    for (const name of ingredientNames) {
        var option = document.createElement('option');
        option.value = name;
        option.text = name;
        select.appendChild(option);
    }
    var option = document.createElement('option');
    select.appendChild(option);
    select.value = "";
    select.onchange = onIngredientChanged;
    cell.appendChild(select);
    row.appendChild(cell);

    cell = document.createElement('td');
    var input = document.createElement('input');
    input.name = 'Amount';
    input.placeholder = 'Amount';
    input.type = 'number';
    input.min = 0;
    input.step = 'any';
    input.oninput = onIngredientAmountEdited;
    input.onkeypress = filterPosNumberInput;
    input.pattern = '[0-9]+([\.,][0-9]+)?';
    cell.appendChild(input);
    row.appendChild(cell);

    cell = document.createElement('td');
    cell.hidden = true;
    cell.classList.add("noprint");
    input = document.createElement('input');
    input.name = 'Scale to';
    input.placeholder = 'Scale to';
    input.type = 'number';
    input.min = 0.001;
    input.step = 'any';
    input.onkeypress = filterPosNumberInput;
    input.onkeyup = onScaleInputKeyUp;
    input.pattern = '[0-9]+([\.,][0-9]+)?';
    cell.appendChild(input);
    row.appendChild(cell);

    cell = document.createElement('td');
    cell.classList.add("noprint");
    var btn = document.createElement('button');
    btn.title = "Delete";
    btn.innerText = "\uD83D\uDDD1\uFE0F";  // Trash emoji
    btn.onclick = onRecipeIngredientDeleted;
    cell.appendChild(btn);
    row.appendChild(cell);

    for (const columnName of RecipeDataColumns) {
        cell = document.createElement('td');
        cell.name = columnName;
        row.appendChild(cell);
    }

    return row;
}

// --- Recipe Display ---

/**
 * Display the recipe in the UI
 */
export function DisplayRecipe() {
    const Recipe = getRecipe();
    const RecipeColumns = getRecipeColumns();
    const { slServingTemperature, slHardness, slOverrun, slScoopSize } = sliders;

    document.getElementById("edRecipeName").value = Recipe.Name;
    tgtSelection.value = Recipe.Type;
    document.getElementById('taRecipeNotes').innerHTML = Recipe.Notes;
    slServingTemperature.value = Recipe.ServingTemperature;
    slHardness.value = Recipe.Hardness * 100;
    slOverrun.value = round(Math.sqrt(Recipe.Overrun / 1.5) * slOverrun.max);
    slServingTemperature.oninput(); // update display value
    slHardness.oninput();
    slOverrun.oninput();

    var table = document.createElement('table');

    // --- table head ---
    var tableHead = document.createElement('thead');
    var row = document.createElement('tr');
    for (const columnName of RecipeColumns) {
        var cell = document.createElement('th');
        cell.innerHTML = columnName;
        if (columnName === sortBy)
            cell.innerHTML += '<span class="noprint">' + (sortAsc ? " \u25B2" : " \u25BC") + '</span>';
        if (columnName == "Scale to") {
            cell.hidden = true;
            cell.classList.add("noprint");
        }
        if (columnName == "") {
            cell.classList.add("noprint");
        }
        cell.onclick = SortRecipe;
        row.appendChild(cell);
    }
    tableHead.appendChild(row);
    table.appendChild(tableHead);

    // --- table body ---
    var tableBody = document.createElement('tbody');
    const ingredientNames = IngredientNames();
    Recipe.Ingredients.forEach((ingredient, i) => {
        var row = CreateRecipeRow(ingredientNames);
        row.Name = ingredient.Name;
        row.childNodes[0].firstChild.value = ingredient.Name;
        row.childNodes[1].firstChild.value = round(ingredient.Amount);

        row = tableBody.appendChild(row);
        UpdateRecipeRow(row, i);
    });
    var row = CreateRecipeRow(ingredientNames); // empty line for adding new ingredients
    row.Name = "";
    row.childNodes[0].firstChild.value = "";
    tableBody.appendChild(row);
    table.appendChild(tableBody);

    // --- table foot ---
    var tableFoot = document.createElement('tfoot');
    table.appendChild(tableFoot);

    table.id = "tblRecipe";
    document.getElementById("tblRecipe").replaceWith(table);
    UpdateRecipeSums();
}

/**
 * Update a single recipe row with calculated values
 * @param {HTMLTableRowElement} row - The row to update
 * @param {number|undefined} index - Index of ingredient in recipe, or undefined to use row index
 */
export function UpdateRecipeRow(row, index = undefined) {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();
    const RecipeDataColumns = getRecipeDataColumns();

    if (!Ingredients.hasOwnProperty(row.Name)) {
        ErrorMsg("Unknown ingredient: " + row.Name);
        return;
    }

    var recipeIngredient = Recipe.Ingredients[index == undefined ? (row.rowIndex - 1) : index];
    for (var i = 0; i < row.childNodes.length; ++i) {
        var cell = row.childNodes[i];
        if (RecipeDataColumns.includes(cell.name)) {

            if (Ingredients[row.Name].hasOwnProperty(cell.name) && Math.abs(Ingredients[row.Name][cell.name]) > 0) {
                cell.textContent = round(Ingredients[row.Name][cell.name] * recipeIngredient.Amount);
            }
        }
    }
}

// --- Internal Event Handlers ---

/**
 * Handle ingredient selection change in recipe row
 * @param {Event} element - The change event
 */
function onIngredientChanged(element) {
    const Recipe = getRecipe();
    var row = this.closest('tr');
    var recipeIngredient = Recipe.Ingredients[row.rowIndex - 1];
    var amountInput = element.target.parentNode.nextSibling.firstChild;
    if (isNaN(amountInput.value) || amountInput.value == "")
        amountInput.value = 0;

    row.Name = element.target.value;
    if (recipeIngredient !== undefined) { // current ingredient changed -> changed in recipe data
        recipeIngredient.Name = element.target.value;
    } else {
        // New ingredient -> add to recipe data
        Recipe.addIngredient(element.target.value, toFloat(amountInput.value));
        row.parentNode.appendChild(CreateRecipeRow()); // add new empty row to table
    }
    SetRecipeModified();
    UpdateRecipeRow(row);
    UpdateRecipeSums();
    amountInput.focus();
    amountInput.select();
}

/**
 * Handle ingredient amount edit in recipe row
 */
function onIngredientAmountEdited() {
    const Recipe = getRecipe();
    var row = this.closest('tr');
    var recipeIngredient = Recipe.Ingredients[row.rowIndex - 1];
    if (recipeIngredient !== undefined) {
        const floatValue = this.value == "" ? 0. : toFloat(this.value);
        if (isNaN(floatValue) || floatValue < 0) {
            Warning(this.value + "Please enter a valid number.");
            this.value = round(recipeIngredient.Amount);
            return;
        }
        recipeIngredient.Amount = floatValue;
        UpdateRecipeRow(row);
        UpdateRecipeSums();
        SetRecipeModified();
    } else if (row.Name != undefined && row.Name != "")
        ErrorMsg("Unknown ingredient: " + row.Name);
}

/**
 * Handle recipe ingredient deletion
 */
function onRecipeIngredientDeleted() {
    const Recipe = getRecipe();
    const row = this.closest('tr');
    const rowcount = this.closest('tbody').getElementsByTagName('tr').length;
    if (row.rowIndex >= rowcount)
        return;

    Recipe.Ingredients.splice(row.rowIndex - 1, 1); // delete ingredient from array
    this.closest('tr').remove();

    UpdateRecipeSums();
    SetRecipeModified();
}

/**
 * Handle Enter key in scale input to trigger scaling
 * @param {KeyboardEvent} event - The keyboard event
 */
function onScaleInputKeyUp(event) {
    if ((event.which ? event.which : event.keyCode) === 13) {
        event.preventDefault(); // Cancel the default action, if needed
        document.getElementById("btnScale").click();
        return false;
    }
}

// --- State Access Functions ---

/**
 * Get the RecipeBackup array (for use by app.js)
 * @returns {Array} RecipeBackup array
 */
export function getRecipeBackup() {
    return RecipeBackup;
}

/**
 * Set the RecipeBackup array (for use by app.js)
 * @param {Array} backup - New RecipeBackup array
 */
export function setRecipeBackup(backup) {
    RecipeBackup = backup;
}

/**
 * Get the RecipeStack object (for use by app.js)
 * @returns {Object} RecipeStack object
 */
export function getRecipeStack() {
    return RecipeStack;
}

/**
 * Clear the sortBy state
 */
export function clearSortBy() {
    sortBy = null;
}

// --- Unit Conversion ---

/**
 * Convert grams to liters (using ice cream density of 1100 g/L)
 * @param {number} value - Value in grams
 * @returns {number} Value in liters
 */
export function gToL(value) { return value / 1100.; }

/**
 * Convert liters to grams (using ice cream density of 1100 g/L)
 * @param {number} value - Value in liters
 * @returns {number} Value in grams
 */
export function LToG(value) { return 1100. * value; }

// --- Recipe Sums and Display ---

/**
 * Update recipe sums display and recalculate all values
 */
export function UpdateRecipeSums() {
    const Recipe = getRecipe();
    const RecipeColumns = getRecipeColumns();
    const sums = Recipe.Sums;

    var tgtType = Targets[tgtSelection.value];
    if (sums.Water > 0) {
        const pac_value = GetIdealPAC(Recipe, tgtType, sums) / sums.Amount;
        tgtType.PAC = new cTargetValue(pac_value * 0.98, pac_value * 1.03); // +3%, -2%
    } else {
        tgtType.PAC = new cTargetValue(0, 0);
    }

    const scaleByIngredient = document.getElementById('cbxScaleByIngredient') != null ? document.getElementById('cbxScaleByIngredient').checked : false;
    var tableFoot = document.querySelector("#tblRecipe > tfoot:first-of-type");
    tableFoot.innerHTML = ""; // remove all childs
    var rows = [...nGenerator(3, () => { return document.createElement('tr'); })];

    for (const columnName of RecipeColumns) {
        var cells = [...nGenerator(3, () => { return document.createElement('th'); })];
        if (sums.hasOwnProperty(columnName)) {
            cells[0].innerHTML = round(sums[columnName]);
            if (tgtType.hasOwnProperty(columnName)) {
                const tgtValue = sums.Amount * tgtType[columnName].Mean;
                cells[1].innerHTML = round(tgtValue);

                if (tgtValue > 0 && sums[columnName] > 0) {
                    const err = tgtType[columnName].getRangeError(sums.Amount, sums[columnName]);

                    cells[2].innerHTML = round(err * 100.0) + "&nbsp;%";
                    const hue = (1.0 - Math.max(Math.min((err - 0.05) * 1.66, 1.0), 0.0)) * 120.0; // scale to hue values: 0% err gree, 33% err: yellow, 66% error: red
                    cells[2].style = "background-color: hsl(" + hue + ", 100%, 75%);";
                    if (err > 0.) {
                        if (tgtValue > sums[columnName])
                            cells[0].innerHTML += "<span class='noprint'>&nbsp;▲</span>";
                        else if (tgtValue < sums[columnName])
                            cells[0].innerHTML += "<span class='noprint'>&nbsp;▼</span>";
                    }
                }
            }
        } else if (columnName == "Name") {
            ["Sum", "Target", "Error"].forEach((text, i) => { cells[i].innerHTML = text });
        } else if (columnName == "Scale to") {
            cells.forEach((cell, i) => {
                cell.hidden = !scaleByIngredient;
                cell.classList.add("noprint");
            });
        } else if (columnName == "") {
            cells.forEach((cell, i) => {
                cell.classList.add("noprint");
            });
        }

        cells.forEach((cell, i) => { rows[i].appendChild(cell); });
    }

    for (const row of rows)
        tableFoot.appendChild(row);

    document.getElementById('btnScale').onclick = onRecipeScaled;
    document.getElementById('cbxScaleByIngredient').checked = scaleByIngredient;

    UpdateRecipeInfo(sums);
    DrawFreezingGraph(sums.Water, sums.PAC, sums.MSNF, Recipe, getCSS);
}

/**
 * Normalize a value to per-1000g (for PAC/POD display)
 * @param {Object} sums - Recipe sums object
 * @param {number} num - Value to normalize
 * @returns {number} Normalized value
 */
function Normalize(sums, num) {
    if (sums.Amount > 0) return Math.round(1000 / sums.Amount * num);
    else return 0;
}

/**
 * Update the recipe info panel with calculated values
 * @param {Object|null} sums - Recipe sums object, or null to recalculate
 */
export function UpdateRecipeInfo(sums = null) {
    const Recipe = getRecipe();
    const { slScoopSize } = sliders;

    if (sums === null)
        sums = Recipe.Sums;
    if (sums.Amount > 0) {
        const scoop = scoopSizes[toFloat(slScoopSize.value)];
        const base = gToL(sums.Amount);
        const total = base * (1. + Recipe.Overrun);
        const scoops = (total * 1000.) / scoop.ML;

        document.getElementById('RecipeInfo').innerHTML = "<b>Info</b><br>"
            + ((sums.kcal > 0) ? round(sums.kcal / sums.Amount * 100.0) : 0) + "&nbsp;<sup>kcal</sup>&frasl;<sub>100&nbsp;g</sub><br>"
            /*         + "<span class='noprint'><br>" + ((sums.kcal > 0) ? round( sums.kcal/sums.Amount * LToG(0.001 * scoop.ML / (1. + Recipe.Overrun)) ) : 0) + "&nbsp;<sup>kcal</sup>&frasl;<sub>Scoop</sub></span><br>" */
            + round(base) + "&nbsp;L&nbsp;Base<br>"
            + round(total) + "&nbsp;L&nbsp;Ice&nbsp;Cream"
            /*         +"<span class='noprint'><br>" + Math.round(scoops) + "&nbsp;Scoops</span><br>" */
            + "<br>"
            + "<span><br>" + Normalize(sums, sums.PAC) + "&nbsp;PAC (220 - 230)</span>"
            + "<span><br>" + Normalize(sums, sums.POD) + "&nbsp;POD (110 - 120)</span>"
            + "<span><br>" + (sums.PAC / sums.POD).toFixed(2) + "&nbsp;PAC : POD</span><br>"
            + "<span><br>" + (sums.Solids / sums.Amount * 100).toFixed(1) + "%&nbsp;Solids</span>"
            + "<span><br>" + (sums.Water / sums.Amount * 100).toFixed(1) + "%&nbsp;Water</span>"
            + "<span><br>" + (sums.Sugar / sums.Amount * 100).toFixed(1) + "%&nbsp;Sugar</span>"
            + "<span><br>" + (sums.nonLactoseSugar / sums.Amount * 100).toFixed(1) + "%&nbsp;Sugar (non-Lactose)</span>"
            + "<span><br>" + (sums.Fat / sums.Amount * 100).toFixed(1) + "%&nbsp;Fat</span>"
            + "<span><br>" + (sums.milkFat / sums.Amount * 100).toFixed(1) + "%&nbsp;Milk Fat</span>"
            + "<span><br>" + (sums.MSNF / sums.Amount * 100).toFixed(1) + "%&nbsp;MSNF</span>"
            + "<span><br>" + (sums.Stabilizer / sums.Amount * 100).toFixed(2) + "%&nbsp;Stabilizer (% Total)</span>"
            + "<span><br>" + (sums.Stabilizer / sums.Water * 100).toFixed(2) + "%&nbsp;Stabilizer (% Water)</span>"
            /*+ "<span><br>" + Math.round(temperatureForTgtHardness) + "°C&nbsp;Temp</span><br>"*/
            ;
    }
    else
        document.getElementById('RecipeInfo').innerHTML = "";
    CheckRecipe(sums);
}

/**
 * Check recipe for hints and warnings
 * @param {Object} sums - Recipe sums object
 */
function CheckRecipe(sums) {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();
    var element = document.getElementById('RecipeHints');
    element.innerHTML = "";

    if (Recipe.Ingredients.length <= 4)
        return;

    var hints = [];

    // check max MSNF
    const maxMilkPowder = sums.Amount * ((Recipe.Type != "Gelato") ? ((1.0 - (sums.Sugar + sums.Fat) / sums.Amount) / 6.9)   // American method
        : ((1.0 - (sums.Sugar + sums.Fat) / sums.Amount) * 0.15)); // Italian method
    var sumMilkPowder = 0.0;
    for (const ingredient of Recipe.Ingredients)
        if (Ingredients[ingredient.Name].isMilkPowder)
            sumMilkPowder += ingredient.Amount;
    if (sumMilkPowder > maxMilkPowder)
        hints.push("Milk powder should not exceed " + round(maxMilkPowder) + "g for this mixture.");

    // check number of sugars used
    var sugarsUsed = 0;
    for (const ingredient of Recipe.Ingredients)
        if (Ingredients[ingredient.Name].isSugar)
            ++sugarsUsed;
    if (sugarsUsed == 1)
        hints.push("Using a mixture of different sugars will help to balance sweetness and freezing point depression.");

    // gelato overrun
    if (Recipe.Type == "Gelato" && Recipe.Overrun >= 0.355)
        hints.push("For gelato overrun should be less than 35%.");

    if (hints.length > 0) {
        var html = "<b>Hints</b><br><ul>";
        for (const item of hints)
            html += "<li>" + item + "</li>";
        element.innerHTML = html + "</ul>";
    }
}

// --- Recipe Scaling ---

/**
 * Handle recipe scale button click
 */
export function onRecipeScaled() {
    const Recipe = getRecipe();
    const { slScoopSize } = sliders;
    var tgtScale = 0;
    if (document.getElementById('cbxScaleByIngredient').checked) {
        const inputs = (() => {
            const table = document.getElementById('RecipeData');
            const inputs = table.querySelectorAll('tr>*:nth-child(3)>input[type="number"]');
            var result = [];
            for (var input of inputs.values()) {
                const tgtValue = toFloat(input.value);
                if (!isNaN(tgtValue) && tgtValue > 0.0)
                    result.push({ 'Index': input.closest('tr').rowIndex - 1, 'Value': tgtValue });
            }
            return result;
        })();
        if (inputs.length < 1) {
            Info('Target value missing.');
            return;
        } else if (inputs.length > 1) {
            Info('Ambigous target values.');
            return;
        }
        tgtScale = Recipe.Amount * inputs[0].Value / Recipe.Ingredients[inputs[0].Index].Amount;
    } else {
        tgtScale = toFloat(document.getElementById("edTargetWeight").value);
        if (document.getElementById("selTargetWeightMode").value == "Scoops")
            tgtScale = LToG((tgtScale * scoopSizes[toFloat(slScoopSize.value)].ML * 0.001) / (1. + Recipe.Overrun));
        else if (document.getElementById("selTargetWeightMode").value == "L")
            tgtScale = LToG(tgtScale / (1. + Recipe.Overrun));
    }

    if (isNaN(tgtScale)) {
        Warning("Input value is not a number.");
        document.getElementById("edTargetWeight").value = round(Recipe.Amount);
    } else if (tgtScale <= 0) {
        Warning("Scaling requires a number larger than zero.");
        document.getElementById("edTargetWeight").value = round(Recipe.Amount);
    } else {
        Recipe.Amount = tgtScale;
        document.getElementById('cbxScaleByIngredient').checked = false;
        document.getElementById('edTargetWeight').disabled = false;
        document.getElementById('selTargetWeightMode').disabled = false;
        document.getElementById('edTargetWeight').value = "";
        DisplayRecipe();
        SetRecipeModified();
    }
}

/**
 * Handle scale mode toggle checkbox change
 * @param {Event} event - The change event
 */
export function ToggleIngredientScale(event) {
    const checked = event.target.checked;
    document.getElementById('edTargetWeight').disabled = checked;
    document.getElementById('selTargetWeightMode').disabled = checked;
    document.getElementById('RecipeData').querySelectorAll('tr>*:nth-child(3)').forEach(cell => {
        cell.hidden = !checked;
    });
}
