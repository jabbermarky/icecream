//=====================================================================================================================================================================
// Recipe Manager Module - Recipe state management and display functions
// Extracted from js/app.js during Phase 9 modularization
//=====================================================================================================================================================================

import { toFloat, round, nGenerator, filterPosNumberInput, clickOn } from '../utils/helpers.js';
import { cRecipe, cTargetValue, Targets } from '../models/core.js';
import { IngredientNames, IngredientDataFields, cIngredient, importIngredients, syncIngredientsToStorage } from './ingredients.js';
import { GetIdealPAC, Fitness } from './calculations.js';
import { DrawFreezingGraph } from '../ui/graph.js';
import { getCSS } from '../ui/components.js';
import { saveToFile, parseRecipeFile } from '../utils/file-io.js';
import { buildRecipeContainer, hydrateRecipe, containerProblem, invalidContainerMessage } from '../models/recipe-serialization.js';

// Module-level state
let RecipeBackup = [];  // backups recipe states on optimization
let RecipeStack = {};   // keeps previous recipes when loading or creating new recipes
let sortBy = null;
let sortAsc = false;
let draggedRow = null;  // tracks the row being dragged during drag-drop reordering
let dragStartElement = null;  // tracks the element where mousedown occurred (for drag-handle check)

// Recipe table column indices (0-based for childNodes, CSS nth-child uses 1-based)
const RECIPE_COLS = {
    DRAG_HANDLE: 0,
    INGREDIENT: 1,
    AMOUNT: 2,
    SCALE: 3,
    // CSS nth-child is 1-based
    nthChild: (index) => index + 1
};

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

// Storage reference (injected via initRecipeButtons)
let recipeStorage = null;

// Cloud sync callback (injected via initRecipeButtons)
let pushRecipeToCloud = null;

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
        // Wire up drag-drop event handlers
        row.onmousedown = onRowMouseDown;
        row.ondragstart = onDragStart;
        row.ondragover = onDragOver;
        row.ondragenter = onDragEnter;
        row.ondragleave = onDragLeave;
        row.ondrop = onDrop;
        row.ondragend = onDragEnd;
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
        row.childNodes[RECIPE_COLS.INGREDIENT].firstChild.value = ingredient.Name;
        row.childNodes[RECIPE_COLS.AMOUNT].firstChild.value = round(ingredient.Amount);

        row = tableBody.appendChild(row);
        UpdateRecipeRow(row, i);
    });
    var row = CreateRecipeRow(ingredientNames, false); // empty line for adding new ingredients (not draggable)
    row.Name = "";
    row.childNodes[RECIPE_COLS.INGREDIENT].firstChild.value = "";
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
        row.childNodes[RECIPE_COLS.DRAG_HANDLE].textContent = '\u2630';  // Add hamburger icon
        // Wire up drag-drop event handlers
        row.onmousedown = onRowMouseDown;
        row.ondragstart = onDragStart;
        row.ondragover = onDragOver;
        row.ondragenter = onDragEnter;
        row.ondragleave = onDragLeave;
        row.ondrop = onDrop;
        row.ondragend = onDragEnd;
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

// --- Drag-Drop Event Handlers ---

/**
 * Track mousedown target for drag-handle verification
 * @param {MouseEvent} event - The mouse event
 */
function onRowMouseDown(event) {
    dragStartElement = event.target;
}

/**
 * Handle drag start event for recipe row reordering
 * @param {DragEvent} event - The drag event
 */
function onDragStart(event) {
    // Only allow drag to start from the drag handle
    // Use the mousedown target since dragstart target is always the row
    const target = dragStartElement?.nodeType === Node.ELEMENT_NODE
        ? dragStartElement
        : dragStartElement?.parentElement;
    const handle = target && target.closest('.drag-handle');
    dragStartElement = null;  // Reset for next drag attempt

    if (!handle) {
        event.preventDefault();
        return;
    }
    draggedRow = this;
    this.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');  // Required for Firefox
}

/**
 * Handle drag over event to allow drop
 * @param {DragEvent} event - The drag event
 */
function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

/**
 * Handle drag enter event to show drop target indicator
 * @param {DragEvent} event - The drag event
 */
function onDragEnter(event) {
    const targetRow = event.target.closest('tr');
    if (targetRow && targetRow !== draggedRow && targetRow.classList.contains('draggable-row')) {
        targetRow.classList.add('drag-over');
    }
}

/**
 * Handle drag leave event to remove drop target indicator
 * @param {DragEvent} event - The drag event
 */
function onDragLeave(event) {
    const targetRow = event.target.closest('tr');
    if (targetRow) {
        targetRow.classList.remove('drag-over');
    }
}

/**
 * Handle drop event to reorder rows
 * @param {DragEvent} event - The drag event
 */
function onDrop(event) {
    event.preventDefault();
    const targetRow = event.target.closest('tr');

    if (!targetRow || targetRow === draggedRow || !targetRow.classList.contains('draggable-row')) {
        return;
    }

    targetRow.classList.remove('drag-over');

    const tbody = targetRow.closest('tbody');
    const Recipe = getRecipe();

    // Determine if dropping above or below target
    const targetRect = targetRow.getBoundingClientRect();
    const dropY = event.clientY;
    const dropAbove = dropY < targetRect.top + targetRect.height / 2;

    // Reorder DOM
    if (dropAbove) {
        tbody.insertBefore(draggedRow, targetRow);
    } else {
        tbody.insertBefore(draggedRow, targetRow.nextSibling);
    }

    // Reorder Recipe.Ingredients array to match new DOM order
    const rows = Array.from(tbody.querySelectorAll('tr.draggable-row'));
    const newOrder = rows.map(row => row.Name);

    Recipe.Ingredients.sort((a, b) => {
        return newOrder.indexOf(a.Name) - newOrder.indexOf(b.Name);
    });

    // Clear sort state since user manually reordered
    sortBy = null;

    // Remove sort indicator from header
    const header = document.querySelector('#tblRecipe thead tr');
    header.querySelectorAll('th span.noprint').forEach(span => {
        if (span.textContent.includes('▲') || span.textContent.includes('▼')) {
            span.remove();
        }
    });

    SetRecipeModified();
}

/**
 * Handle drag end event to clean up drag state
 * @param {DragEvent} event - The drag event
 */
function onDragEnd(event) {
    if (draggedRow) {
        draggedRow.classList.remove('dragging');
    }
    // Remove drag-over class from all rows (cleanup)
    document.querySelectorAll('#tblRecipe tr.drag-over').forEach(row => {
        row.classList.remove('drag-over');
    });
    draggedRow = null;
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

    // Add empty cell for drag handle column in each footer row
    rows.forEach(row => {
        const emptyCell = document.createElement('th');
        emptyCell.classList.add('noprint');
        row.appendChild(emptyCell);
    });

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
            const inputs = table.querySelectorAll(`tr>*:nth-child(${RECIPE_COLS.nthChild(RECIPE_COLS.SCALE)})>input[type="number"]`);
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
    document.getElementById('RecipeData').querySelectorAll(`tr>*:nth-child(${RECIPE_COLS.nthChild(RECIPE_COLS.SCALE)})`).forEach(cell => {
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
        syncIngredientsToStorage();
        Info("Mixture added to ingredients.");
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
 * Take the one immutable snapshot every save path persists, or report why not.
 *
 * P0.5's canonical build: library save and .ier export both come through here,
 * so a recipe becomes bytes in exactly one place and every destination writes
 * the same detached, frozen object. See js/models/recipe-serialization.js for
 * why the snapshot is detached (the fire-and-forget cloud write serializes
 * after a network round trip) and why it is frozen.
 *
 * @param {cRecipe} recipe - The live recipe to snapshot
 * @param {Object} ingredients - The ingredient library
 * @returns {Object|null} The frozen container, or null after reporting the failure
 */
function snapshotForSave(recipe, ingredients) {
    try {
        return buildRecipeContainer(recipe, ingredients, Warning);
    } catch (error) {
        // Reported rather than rethrown, for BOTH callers: handleSaveRecipe is
        // async, so an uncaught throw is an unhandled rejection; handleExport
        // is sync, so it would reach the console and nowhere else. Either way
        // the user sees the button do nothing at all — the same silent no-op
        // the library-load path was fixed for.
        //
        // The causes are distinct and the message says which (review finding —
        // one sentence used to blame the user's data for all of them). The
        // shared guarantee is appended once so the three branches cannot
        // drift apart on the one sentence that matters.
        console.error('Failed to snapshot recipe for saving:', error);
        const NOTHING_WRITTEN = ' Nothing was saved or exported.';
        if (error instanceof RangeError) {
            ErrorMsg('This recipe is nested too deeply to be stored.' + NOTHING_WRITTEN);
        } else if (typeof structuredClone !== 'function') {
            ErrorMsg('This browser is missing a feature Ice Ed needs to save recipes (structuredClone).' + NOTHING_WRITTEN + ' Try a newer browser version.');
        } else {
            ErrorMsg('This recipe could not be prepared because it holds a value that cannot be stored.' + NOTHING_WRITTEN);
        }
        return null;
    }
}

/**
 * Clear the unsaved-work indicator, but ONLY if the recipe still matches what
 * was actually persisted.
 *
 * Review finding, and a regression this change introduced rather than
 * inherited. Before the snapshot, the container held the live recipe, so an
 * edit landing during the save window still reached storage — inconsistently
 * between backends, which was the bug P0.5 set out to fix. Now the snapshot
 * provably excludes that edit. Clearing the flag unconditionally would turn
 * "inconsistent but captured" into "discarded and reported clean", and
 * ModifiedIndicator is the ONLY signal of outstanding work in this app — there
 * is no beforeunload guard and no undo for it.
 *
 * The comparison is on the serialized snapshot, not object identity: the
 * container is a detached clone, so it never shares references with the live
 * recipe. Cheap at recipe scale (measured in the tens of microseconds).
 *
 * @param {cRecipe} liveRecipe - The recipe as it stands now
 * @param {Object} container - The frozen snapshot that was persisted
 */
function clearModifiedIfUnchanged(liveRecipe, container) {
    // STALE-BINDING GUARD (red-team finding): liveRecipe is the object the
    // save handler captured, but SetRecipeModified is one global flag
    // describing whichever recipe is CURRENT. If the recipe was swapped during
    // the save's await windows (New Recipe, Restore, a completing library
    // load) and the user has edited the new one, comparing the OLD object to
    // its own snapshot would pass — and clear the flag for a different
    // recipe whose edits were never saved. The flag belongs to the current
    // recipe, so only clear it while the saved recipe IS the current one.
    if (getRecipe() !== liveRecipe) return;
    let unchanged;
    try {
        unchanged = JSON.stringify(liveRecipe) === JSON.stringify(container.Recipe);
    } catch {
        // A recipe that will not serialize cannot be proven unchanged. Keep the
        // flag set: a false "modified" costs a redundant save, a false "saved"
        // costs the user's work.
        unchanged = false;
    }
    if (unchanged) SetRecipeModified(false);
}

/**
 * Handle save recipe button click
 * Saves current recipe to library (IndexedDB)
 */
async function handleSaveRecipe() {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();

    if (Recipe.Name == "") {
        Warning("Please add a recipe name.");
        document.getElementById("edRecipeName").focus();
        return;
    }

    // Snapshot BEFORE the awaits below, deliberately: this pins the record to
    // what was on screen when the user clicked Save, rather than to whatever it
    // has become by the time hasRecipe resolves.
    const container = snapshotForSave(Recipe, Ingredients);
    if (!container) return;

    // The KEY comes from the snapshot too, not from the live recipe (review
    // finding, reproduced). edRecipeName.oninput writes straight to Recipe.Name
    // on every keystroke, and the event loop is free while hasRecipe resolves,
    // so re-reading Recipe.Name after that await sampled a DIFFERENT name than
    // the snapshot carries. Three failures came out of that, all silent:
    //   - the record was stored under one name while its payload claimed another
    //   - the existence check asked about the old name while the write targeted
    //     the new one, so IndexedDB's unconditional put could replace a
    //     different saved recipe with no "already exists" prompt
    //   - the local write and the fire-and-forget cloud write read the name
    //     independently, so the two backends could be keyed differently
    // One read, used everywhere. Renaming is routine here (Mango V2.1 -> V2.2),
    // so this window is not exotic.
    const savedName = container.Recipe.Name;

    // Check if recipe already exists and prompt for overwrite
    if (recipeStorage) {
        const exists = await recipeStorage.hasRecipe(savedName);
        if (exists) {
            if (!confirm(`Recipe "${savedName}" already exists. Overwrite?`)) {
                return;
            }
        }

        // Both backends write the SAME frozen snapshot under the SAME key. That
        // is the point of P0.5: the cloud copy and the local copy can no longer
        // diverge, because neither is reading live state.
        const success = await recipeStorage.saveRecipe({ name: savedName, data: container });
        if (success) {
            // Push to cloud if signed in (fire-and-forget)
            if (pushRecipeToCloud) {
                pushRecipeToCloud({ name: savedName, data: container });
            }
            Info(`Saved "${savedName}" to library`);
            clearModifiedIfUnchanged(Recipe, container);
        } else {
            ErrorMsg('Failed to save recipe. Please try again.');
        }
    } else {
        // Fallback to file download if storage not available
        saveToFile(container, savedName + ".ier", "IER", 1);
        clearModifiedIfUnchanged(Recipe, container);
    }
}

/**
 * Handle export recipe button click
 * Exports current recipe to a file for backup or sharing
 */
function handleExportRecipe() {
    const Recipe = getRecipe();
    const Ingredients = getIngredients();

    if (Recipe.Name == "") {
        Warning("Please add a recipe name.");
        document.getElementById("edRecipeName").focus();
        return;
    }

    const container = snapshotForSave(Recipe, Ingredients);
    if (!container) return;

    // The filename comes from the SNAPSHOT, matching handleSaveRecipe's rule
    // (review finding): export is sync today so there is no live-read race,
    // but one future await between snapshot and write would ship a file whose
    // name and payload disagree — the exact fork the save path just closed.
    saveToFile(container, container.Recipe.Name + ".ier", "IER", 1);
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

        // The one refusal gate, BEFORE any mutation — before the recipe backup
        // and before importIngredients touches the library. Covers newer
        // schema (would truncate on next save) and damaged shapes (would
        // crash mid-load or hydrate a blank recipe), each with its own
        // truthful message. See js/models/recipe-serialization.js.
        const problem = containerProblem(dataObj.data);
        if (problem) {
            ErrorMsg(problem);
            return;
        }

        function loadRecipe() {
            // Empty-map fallback: absent Ingredients passes the gate (legal),
            // but importIngredients throws on undefined (Object.entries) —
            // and this path has no catch, so it would die as an unhandled
            // rejection after the backup stack already changed (review
            // finding, same fix as recipe-library-load.js).
            importIngredients(
                dataObj.data.Ingredients || {},
                false,
                "This recipe was saved with different ingredient values than your current library. The library reflects your latest research.",
                { current: "Library", imported: "Recipe" },
                { keep: "Keep Library", replace: "Use Recipe" }
            );

            RecipeBackup = [];
            // Shared declared-fields hydrator; containerProblem already
            // passed above, so null cannot happen here — guarded anyway so a
            // future code motion cannot reintroduce silent truncation.
            const newRecipe = hydrateRecipe(dataObj.data);
            if (!newRecipe) {
                ErrorMsg(containerProblem(dataObj.data) || invalidContainerMessage());
                return;
            }
            setRecipe(newRecipe);
            sortBy = null;
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
 * @param {HTMLButtonElement} buttons.btnExportRecipe - Export recipe to file button
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
 * @param {Object} buttons.storage - Recipe storage instance for library persistence
 */
export function initRecipeButtons(buttons) {
    const {
        btnNewRecipe,
        btnStoreAsIngredient,
        btnSaveRecipe,
        btnExportRecipe,
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
        edRecipeName,
        storage,
        pushRecipe
    } = buttons;

    // Store storage reference at module level for handleSaveRecipe
    recipeStorage = storage;

    // Store cloud sync callback
    pushRecipeToCloud = pushRecipe || null;

    btnNewRecipe.onclick = handleNewRecipe;
    btnStoreAsIngredient.onclick = handleStoreAsIngredient;
    btnSaveRecipe.onclick = handleSaveRecipe;
    if (btnExportRecipe) {
        btnExportRecipe.onclick = handleExportRecipe;
    }
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
