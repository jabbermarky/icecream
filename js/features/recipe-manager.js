//=====================================================================================================================================================================
// Recipe Manager Module - Recipe state management and display functions
// Extracted from js/app.js during Phase 9 modularization
//=====================================================================================================================================================================

import { toFloat, round, nGenerator, filterPosNumberInput, clickOn } from '../utils/helpers.js';
import { cRecipe, cTargetValue, Targets } from '../models/core.js';
import { IngredientNames, IngredientDataFields, cIngredient, importIngredients } from './ingredients.js';
import { GetIdealPAC, Fitness } from './calculations.js';
import { DrawFreezingGraph } from '../ui/graph.js';
import { getCSS } from '../ui/components.js';
import { saveToFile, parseRecipeFile } from '../utils/file-io.js';

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
 * @param {boolean} isDraggable - Whether this row should be draggable (false for empty "add new" row)
 * @returns {HTMLTableRowElement} The created table row
 */
export function CreateRecipeRow(ingredientNames = null, isDraggable = true) {
    const RecipeDataColumns = getRecipeDataColumns();

    var row = document.createElement('tr');

    // Add drag handle cell as first cell
    var cell = document.createElement('td');
    cell.classList.add('drag-handle');
    cell.classList.add('noprint');
    if (isDraggable) {
        cell.textContent = '\u2630';  // Hamburger menu icon (☰)
        row.draggable = true;
        row.classList.add('draggable-row');
    }
    row.appendChild(cell);

    cell = document.createElement('td');
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
    // Add empty header cell for drag handle column
    var dragHandleHeader = document.createElement('th');
    dragHandleHeader.classList.add('noprint');
    row.appendChild(dragHandleHeader);
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
        var row = CreateRecipeRow(ingredientNames, true);  // draggable ingredient row
        row.Name = ingredient.Name;
        row.childNodes[1].firstChild.value = ingredient.Name;  // index 1 = ingredient select (after drag handle)
        row.childNodes[2].firstChild.value = round(ingredient.Amount);  // index 2 = amount input

        row = tableBody.appendChild(row);
        UpdateRecipeRow(row, i);
    });
    var row = CreateRecipeRow(ingredientNames, false); // empty line for adding new ingredients (not draggable)
    row.Name = "";
    row.childNodes[1].firstChild.value = "";  // index 1 = ingredient select (after drag handle)
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
        // Make the current row draggable since it now has an ingredient
        row.draggable = true;
        row.classList.add('draggable-row');
        row.childNodes[0].textContent = '\u2630';  // Add hamburger icon to drag handle
        row.parentNode.appendChild(CreateRecipeRow(null, false)); // add new empty row to table (not draggable)
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

// --- Optimization Functions ---

/**
 * Optimize the recipe to better match target values
 * Uses hill-climbing algorithm to adjust ingredient amounts
 * @param {boolean} OptimizeForMean - If true, optimize for mean values; if false, optimize for range
 */
export function OptimizeRecipe(OptimizeForMean = true) {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();
    const localBackup = cRecipe.copyFrom(Recipe);

    var tgtType = Targets[tgtSelection.value];

    const fitnessFields = IngredientDataFields.filter(col => tgtType.hasOwnProperty(col));

    // Get the indices of ingredients that directly affect the target parameters.
    // This is required to avoid adjustment of ingredients that affect the fitness of the recipie only
    // indirect by changing the effect of other ingredients by changing their ratio of the volume.
    // Also ingnore ingredients that make up less than 1.5% of the mixture, as they are typically things that primarily contribute to other things than the target parameters.
    const adjustmentIndizes = [...function* () {
        const totalAmount = Recipe.Amount;
        for (var i = 0; i < Recipe.Ingredients.length; ++i) {
            var ingredient = Recipe.Ingredients[i];
            if (Ingredients.hasOwnProperty(ingredient.Name)
                && fitnessFields.some(field => {
                    return Ingredients[ingredient.Name].hasOwnProperty(field) && Ingredients[ingredient.Name][field] > 0.0;
                })
                && ingredient.Amount / totalAmount >= 0.015)
                yield i;
        }
    }()];

    const originalFitness = Fitness(localBackup, Recipe, tgtType, fitnessFields, cTargetValue, OptimizeForMean);

    var recipeFitness = originalFitness;
    let currentRecipe = cRecipe.copyFrom(Recipe);

    var step = 0.1;
    var outerImproved = 0;
    do {
        var improved = 0;

        // test variations and apply the ones that gain improvement
        for (const i of adjustmentIndizes) {
            for (const factor of [1.0 + step, 1.0 - step]) {
                var candidate = cRecipe.copyFrom(currentRecipe);
                candidate.Ingredients[i].Amount *= factor;
                const candidateFitness = Fitness(candidate, Recipe, tgtType, fitnessFields, cTargetValue, OptimizeForMean);
                if (candidateFitness < recipeFitness) {
                    currentRecipe = cRecipe.copyFrom(candidate);
                    recipeFitness = candidateFitness;
                    ++improved;
                    break; // break the inner loop to skip second iteration in case the first succeeded
                }
            }
        }

        if (improved == 0)
            step *= 0.5; // if no improvement was possible reduce the amount of variance
    } while (step > 0.0005);


    // scale to original volume
    var scaledAmount = 0;
    for (const i of adjustmentIndizes)
        scaledAmount += currentRecipe.Ingredients[i].Amount;
    const unscaledAmount = currentRecipe.Amount - scaledAmount;
    const targetAmount = localBackup.Amount - unscaledAmount;
    const factor = targetAmount / scaledAmount;
    var changedIndizes = [];
    for (const i of adjustmentIndizes) {
        currentRecipe.Ingredients[i].Amount *= factor;

        if (Math.abs(localBackup.Ingredients[i].Amount - currentRecipe.Ingredients[i].Amount) > Number.EPSILON)
            changedIndizes.push(i)
    }
    const rowCount = changedIndizes.length;


    if (rowCount > 0)
        RecipeBackup.push(cRecipe.copyFrom(localBackup));

    document.getElementById("btnRestoreRecipe").disabled = RecipeBackup.length == 0;

    // Update Recipe with optimized values
    setRecipe(currentRecipe);

    // display comparision table
    if (rowCount > 0) {
        SetRecipeModified();

        var table = document.createElement("table");
        var th = document.createElement("thead");
        var tr = document.createElement('tr');
        for (var name of ["Name", "Original", "Optimized"]) {
            var cell = document.createElement('th');
            cell.innerText = name;
            tr.appendChild(cell);
        }
        th.appendChild(tr);
        table.appendChild(th);
        var tbody = document.createElement("tbody");
        for (const i of changedIndizes) {
            const old = localBackup.Ingredients[i].Amount;
            const changed = currentRecipe.Ingredients[i].Amount;

            tr = document.createElement('tr');
            var cells = [...nGenerator(3, () => { return document.createElement('td'); })];
            cells[0].innerText = currentRecipe.Ingredients[i].Name;
            cells[1].innerText = round(old);
            cells[2].innerText = round(changed);
            cells[changed > old ? 2 : 1].style = "font-size: " + (Math.sqrt(Math.min((Math.max(changed / old, old / changed) - 1.0) / 3.0, 2.0)) + 1.0) * 125.0 + "%;";

            for (const cell of cells)
                tr.appendChild(cell);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        var buttonBar = document.createElement("div");
        var button = document.createElement('button');
        button.innerText = "Close";
        button.onclick = function () {
            SortRecipe();
            hideModal();
        };
        buttonBar.appendChild(button);
        showModal(table, buttonBar);
    } else
        SortRecipe();

}

/**
 * Restore recipe from the last optimization backup
 */
export function RestoreRecipe() {
    if (!RecipeBackup.length)
        return;
    setRecipe(cRecipe.copyFrom(RecipeBackup.pop()));
    DisplayRecipe();
    document.getElementById("btnRestoreRecipe").disabled = RecipeBackup.length == 0;
}

/**
 * Auto-detect and set recipe type based on fitness score
 */
export function CategorizeRecipe() {
    const Recipe = getRecipe();
    var bestFitness = Number.MAX_VALUE;
    var bestKey = "";
    for (const key in Targets) {
        const value = Targets[key];
        const fitnessFields = IngredientDataFields.filter(col => value.hasOwnProperty(col));
        const score = Fitness(Recipe, value, fitnessFields, false);
        if (score < bestFitness) {
            bestFitness = score;
            bestKey = key;
        }
    }
    Recipe.Type = bestKey;
    tgtSelection.value = bestKey;
    UpdateRecipeSums();
}

// --- Button Handler Implementations ---

/**
 * Handle new recipe button click
 * Creates a new empty recipe after backing up current
 */
function handleNewRecipe() {
    BackupCurrentRecipe();
    const newRecipe = new cRecipe("");
    setRecipe(newRecipe);
    RecipeBackup = [];
    sortBy = null;
    DisplayRecipe();
    document.getElementById("edRecipeName").focus();
    SetRecipeModified(false);
}

/**
 * Handle store as ingredient button click
 * Stores current recipe as a reusable ingredient
 */
function handleStoreAsIngredient() {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();

    if (Recipe.Name == "") {
        Warning("Please add a recipe name.");
        document.getElementById("edRecipeName").focus();
        return;
    }
    if (Recipe.Ingredients.length < 1 || Recipe.Sums.Amount == 0.0) {
        Warning("Recipe has no ingredients.");
        return;
    }

    function storeAsIngredient() {
        var sums = Recipe.Sums;
        const amount = sums.Amount;
        for (const val in sums)
            sums[val] /= amount;
        Ingredients[Recipe.Name] = new cIngredient(sums.Water, sums.Sugar, sums.Fat, sums.Solids, sums.MSNF, sums.PAC, sums.POD, sums.kcal);
        Info("Mixture added. Do not forget to save the ingredient data.");
    }

    if (!Ingredients.hasOwnProperty(Recipe.Name)) {
        storeAsIngredient();
        return;
    }

    var div = document.createElement("div");
    div.style = "display: table; table-layout: fixed;";
    div.innerHTML += "<h3>Confirm</h3><strong>" + Recipe.Name + "</strong> already exists in ingredients list.<br>Do you want to overwrite it?";

    var buttonBar = document.createElement("div");
    var buttons = [...nGenerator(2, () => { return document.createElement('button'); })];
    buttons[0].innerText = "Abort";
    buttons[0].onclick = hideModal;
    buttons[1].innerText = "Replace";
    buttons[1].onclick = function () {
        storeAsIngredient();
        hideModal();
    };
    for (const button of buttons)
        buttonBar.appendChild(button);
    showModal(div, buttonBar);
}

/**
 * Handle save recipe button click
 * Saves current recipe to file
 */
function handleSaveRecipe() {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();

    if (Recipe.Name == "") {
        Warning("Please add a recipe name.");
        document.getElementById("edRecipeName").focus();
        return;
    }

    var container = {
        Recipe: Recipe,
        Ingredients: {}
    };
    for (const ingredient of Recipe.Ingredients)
        if (Ingredients.hasOwnProperty(ingredient.Name)) {
            container.Ingredients[ingredient.Name] = Ingredients[ingredient.Name].copy();
            for (const key in container.Ingredients[ingredient.Name])
                if (container.Ingredients[ingredient.Name][key] == 0.0)
                    delete container.Ingredients[ingredient.Name][key];
        } else
            Warning("Recipe is using undefined ingredient " + ingredient.Name);

    saveToFile(container, Recipe.Name + ".ier", "IER", 1);
    SetRecipeModified(false);
}

/**
 * Handle load recipe file change event
 * @param {Event} event - The file input change event
 */
function handleLoadRecipeFile(event) {
    var reader = new FileReader();
    reader.onload = function () {
        var dataObj = parseRecipeFile(reader.result);

        if (!dataObj) {
            ErrorMsg("Invalid file format in: " + event.target.files[0].name);
            return;
        }

        function loadRecipe() {
            importIngredients(dataObj.data.Ingredients);

            RecipeBackup = [];
            const newRecipe = new cRecipe("");
            setRecipe(newRecipe);
            sortBy = null;

            const Recipe = getRecipe();
            for (const key in Recipe) {
                if (dataObj.data.Recipe.hasOwnProperty(key)) {
                    Recipe[key] = dataObj.data.Recipe[key];
                }
            }
            DisplayRecipe();
            SetRecipeModified(false);
        }

        BackupCurrentRecipe();
        if (RecipeStack.hasOwnProperty(dataObj.data.Recipe.Name)) {
            if (!RecipeStack[dataObj.data.Recipe.Name].Modified) {
                delete RecipeStack[dataObj.data.Recipe.Name];
                DisplayBackupList();
                loadRecipe();
            } else {
                var div = document.createElement("div");
                div.style = "display: table; table-layout: fixed;";
                div.innerHTML += "<h3>Confirm</h3><strong>" + dataObj.data.Recipe.Name + "</strong> is already loaded"
                    + (RecipeStack[dataObj.data.Recipe.Name].Modified ? " and modified" : "")
                    + ".<br>Do you want to replace it?";

                var buttonBar = document.createElement("div");
                var buttons = [...nGenerator(2, () => { return document.createElement('button'); })];
                buttons[0].innerText = "Keep Current";
                buttons[0].onclick = () => {
                    RestoreBackup(dataObj.data.Recipe.Name);
                    hideModal();
                };
                buttons[1].innerText = "Continue Loading";
                buttons[1].onclick = function () {
                    delete RecipeStack[dataObj.data.Recipe.Name];
                    DisplayBackupList();
                    loadRecipe();
                    hideModal();
                };
                for (const button of buttons)
                    buttonBar.appendChild(button);
                showModal(div, buttonBar);
            }
        } else
            loadRecipe();

    };
    reader.readAsText(event.target.files[0]);
}

/**
 * Initialize recipe button handlers
 * @param {Object} buttons - Button element references
 * @param {HTMLButtonElement} buttons.btnNewRecipe - New recipe button
 * @param {HTMLButtonElement} buttons.btnStoreAsIngredient - Store as ingredient button
 * @param {HTMLButtonElement} buttons.btnSaveRecipe - Save recipe button
 * @param {HTMLButtonElement} buttons.btnLoadRecipe - Load recipe button
 * @param {HTMLInputElement} buttons.inputLoadRecipe - Load recipe file input
 * @param {HTMLButtonElement} buttons.btnPrintRecipe - Print recipe button
 * @param {HTMLButtonElement} buttons.btnCategorizeRecipe - Categorize recipe button
 * @param {HTMLButtonElement} buttons.btnOptimizeMean - Optimize for mean button
 * @param {HTMLButtonElement} buttons.btnOptimizeRange - Optimize for range button
 * @param {HTMLButtonElement} buttons.btnRestoreRecipe - Restore recipe button
 * @param {HTMLButtonElement} buttons.btnScale - Scale recipe button
 * @param {HTMLInputElement} buttons.cbxScaleByIngredient - Scale by ingredient checkbox
 * @param {HTMLInputElement} buttons.edTargetWeight - Target weight input
 * @param {HTMLSelectElement} buttons.selTargetWeightMode - Target weight mode select
 * @param {HTMLInputElement} buttons.edRecipeName - Recipe name input
 */
export function initRecipeButtons(buttons) {
    const {
        btnNewRecipe,
        btnStoreAsIngredient,
        btnSaveRecipe,
        btnLoadRecipe,
        inputLoadRecipe,
        btnPrintRecipe,
        btnCategorizeRecipe,
        btnOptimizeMean,
        btnOptimizeRange,
        btnRestoreRecipe,
        btnScale,
        cbxScaleByIngredient,
        edTargetWeight,
        selTargetWeightMode,
        edRecipeName
    } = buttons;

    btnNewRecipe.onclick = handleNewRecipe;
    btnStoreAsIngredient.onclick = handleStoreAsIngredient;
    btnSaveRecipe.onclick = handleSaveRecipe;
    btnLoadRecipe.onclick = () => { clickOn(inputLoadRecipe); };
    inputLoadRecipe.onchange = handleLoadRecipeFile;
    btnPrintRecipe.onclick = () => { window.print(); };
    btnCategorizeRecipe.onclick = CategorizeRecipe;
    btnOptimizeMean.onclick = OptimizeRecipe;
    btnOptimizeRange.onclick = () => { OptimizeRecipe(false); };
    btnRestoreRecipe.onclick = RestoreRecipe;
    btnRestoreRecipe.disabled = true;
    cbxScaleByIngredient.addEventListener('change', ToggleIngredientScale);
}
