//=====================================================================================================================================================================
// Recipe Manager Module - Recipe state management and display functions
// Extracted from js/app.js during Phase 9 modularization
//=====================================================================================================================================================================

import { toFloat, round, nGenerator, filterPosNumberInput } from '../utils/helpers.js';
import { cRecipe } from '../models/core.js';
import { IngredientNames } from './ingredients.js';

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
let updateRecipeSums = null;
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
 * @param {Function} deps.updateRecipeSums - Function to update recipe sums display
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
    updateRecipeSums = deps.updateRecipeSums;
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
    updateRecipeSums();
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
    updateRecipeSums();
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
        updateRecipeSums();
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

    updateRecipeSums();
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
