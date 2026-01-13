/**
 * Tools Module
 * PAC/POD Calculator, G/Mol Calculator, Egg/Yolk Calculator
 */
import { toFloat, round, nGenerator, filterPosNumberInput } from './helpers.js';
import { Warning, Info } from '../ui/components.js';

// Dependencies injected from app.js
let getRecipe = null;

/**
 * Initialize the tools module with dependencies
 * @param {object} deps - Dependencies from the main app
 * @param {function} deps.getRecipe - Function to get current Recipe object
 */
export function initTools(deps) {
    if (deps.getRecipe) getRecipe = deps.getRecipe;
}

// ============================================================
// Sugar Reference Data
// ============================================================

/**
 * Sugar reference table with g/mol and POD values
 * Format: { "Name": [g/mol, POD] }
 */
export const Sugars = {            // g/mol     POD
    "Sucrose": [342.3, 100],
    "Dextrose": [180, 70],
    "Fructose": [180, 170],
    "Lactose": [342, 16],
    "Galactose": [180, 63],
    "Maltose": [342, 35], // sweetness is heavily dependent on concentration 30-60% of sucrose, here we assume an avg 10% solution
    "Invert Sugar": [204, 130],
    "Atomized Glucose 42DE": [980, 50],
    "Glucose Syrup 42DE": [428, 55],
    "Honey": [190, 130],
    "Maltodextrin 15DE": [1180, 17],
    "Inulin": [522, 10],
    "Trehalose": [342, 20],
    "Erythritol": [122, 65],
    "Salt": [58.44, 0],
    "Ethanol": [46.07, 0]
};

// ============================================================
// Egg Type Reference Data
// ============================================================

/**
 * Egg weight standards by region (in grams)
 */
export const eggTypes = {
    "Bulk": 100,
    "CD/US Jumbo": 70,
    "CD/US XL": 63,
    "CD/US L": 56,
    "CD/US M": 49,
    "CD/US S": 42,
    "EU XL": 78,
    "EU L": 68,
    "EU M": 58,
    "EU S": 48,
    "GOST В": 80,
    "GOST О": 70,
    "GOST 1": 60,
    "GOST 2": 50,
    "GOST 3": 40,
    "AU King-Size": 73,
    "AU Jumbo": 68,
    "AU XL": 60,
    "AU L": 52,
    "AU M": 43,
    "NZ Jumbo": 68,
    "NZ Large": 62,
    "NZ Standard": 53,
    "NZ Medium": 44,
    "NZ Pullet": 35,
    "BRA Jumbo": 70,
    "BRA Extra": 62.5,
    "BRA L": 57.5,
    "BRA M": 52.5,
    "BRA S": 47.5,
    "BRA Industrial": 42.5
};

// ============================================================
// Egg Calculator Model
// ============================================================

/**
 * Egg calculator model for yolk/white calculations
 */
export class cEgg {
    constructor(weight) {
        this.m_Number = 1.;
        this.m_Weight = weight;
        this.Factors = {
            Number: 0.0,
            Total: 1.0,
            // Shell: 0.085,
            Liquids: 0.915,
            White: 0.915 * (2. / 3.),
            Yolk: 0.915 * (1. / 3.),
            Lecithin: 0.915 * (1. / 3.) * 0.075,
            Mixture: 0.915 * (1. / 3.) * 0.075 * (1 / 0.0025)
        };
    }
    Get(key) {
        if (!this.Factors.hasOwnProperty(key)) {
            console.assert(false);
            return 0.;
        } else if (key == "Number")
            return this.m_Number;

        return this.m_Number * this.Factors[key] * this.m_Weight;
    }
    Set(key, value) {
        if (!this.Factors.hasOwnProperty(key)) {
            console.assert(false);
            return;
        } else if (key == "Number")
            this.m_Number = value;
        else
            this.m_Number = value / (this.Factors[key] * this.m_Weight);
    }
}

// ============================================================
// PAC/POD Calculator
// ============================================================

/**
 * Handler for PAC/POD calculator sugar amount input
 */
function onSugarAmountEdited() {
    var row = this.closest('tr');
    const sugar = row.firstElementChild.innerText;
    if (this.value == "") {
        row.childNodes[2].innerText = "";
        row.childNodes[3].innerText = "";
    } else {
        const floatValue = toFloat(this.value);
        if (isNaN(floatValue) || floatValue < 0 || floatValue > 100) {
            Warning(this.value + " is not a valid number.");
            this.value = this.lastValue;
            return;
        }
        this.lastValue = this.value;

        row.childNodes[2].innerText = round(342.3 / Sugars[sugar][0] * floatValue);
        row.childNodes[3].innerText = round(Sugars[sugar][1] * floatValue / 100.0);
    }

    UpdateSugarSums();
}

/**
 * Update PAC/POD sums in the calculator table
 */
function UpdateSugarSums() {
    var pacSum = 0;
    var podSum = 0;
    var percentSum = 0;
    var table = document.getElementById("pacPodTable");
    for (const row of table.tBodies[0].rows) {
        const sugar = row.firstElementChild.innerText;
        var floatValue = toFloat(row.childNodes[1].firstElementChild.value);
        if (isNaN(floatValue) || floatValue < 0 || floatValue > 100) {
            continue;
        }
        percentSum += floatValue;
        pacSum += 342.3 / Sugars[sugar][0] * floatValue;
        podSum += Sugars[sugar][1] * floatValue;
    }
    table.tFoot.firstElementChild.childNodes[1].innerText = round(percentSum) + "%";
    table.tFoot.firstElementChild.childNodes[2].innerText = round(pacSum);
    table.tFoot.firstElementChild.childNodes[3].innerText = round(podSum / 100.0);
    if (percentSum > 100)
        Warning("Sum exceeds 100%");
}

/**
 * Initialize the PAC/POD calculator UI
 */
export function initPACPODCalculator() {
    var pacPodCalc = document.getElementById("PacPodCalculator");
    var pacPodTable = document.createElement('table');
    pacPodTable.id = "pacPodTable";

    var th = document.createElement("thead");
    var tr = document.createElement('tr');
    for (var name of ["Name", "%", "PAC", "POD"]) {
        var cell = document.createElement('th');
        cell.innerText = name;
        tr.appendChild(cell);
    }
    th.appendChild(tr);
    pacPodTable.appendChild(th);
    var tbody = document.createElement("tbody");

    for (const sugar in Sugars) {
        tr = document.createElement('tr');
        var cells = [...nGenerator(4, () => { return document.createElement('td'); })];
        cells[0].innerText = sugar;

        var input = document.createElement('input');
        input.name = 'Percentage';
        input.placeholder = '%';
        input.type = 'number';
        input.min = 0;
        input.max = 100;
        input.step = 'any';
        input.oninput = onSugarAmountEdited;
        input.onkeypress = filterPosNumberInput;
        input.pattern = '[0-9]+([\.,][0-9]+)?';
        input.lastValue = 0;
        cells[1].appendChild(input);

        for (const cell of cells)
            tr.appendChild(cell);
        tbody.appendChild(tr);
    }
    pacPodTable.appendChild(tbody);

    var tableFoot = document.createElement('tfoot');
    var row = document.createElement('tr');
    for (var i = 0; i < 4; ++i)
        row.appendChild(document.createElement('th'));
    row.firstChild.innerText = "Sum";
    tableFoot.appendChild(row);

    pacPodTable.appendChild(tableFoot);
    pacPodCalc.appendChild(pacPodTable);

    pacPodCalc.appendChild(document.createElement('br'));
    var btnReset = document.createElement('button');
    btnReset.innerText = "Reset";
    btnReset.onclick = () => {
        var inputs = pacPodTable.getElementsByTagName("input");
        for (var input of inputs)
            input.value = "";
        UpdateSugarSums();
        inputs[0].focus();
    };
    pacPodCalc.appendChild(btnReset);
}

// ============================================================
// G/Mol Calculator
// ============================================================

/**
 * Initialize the G/Mol calculator UI
 */
export function initGMolCalculator() {
    var edGMolCalculator = document.getElementById("edGMolCalculator");
    edGMolCalculator.lastValue = 0;
    edGMolCalculator.oninput = function () {
        if (this.value == "") {
            document.getElementById("GMolResult").innerText = "";
            return;
        }

        var floatValue = toFloat(this.value);
        if (isNaN(floatValue) || floatValue < 0) {
            Warning(this.value + " is not a valid number.");
            this.value = this.lastValue;
            return;
        }
        this.lastValue = this.value;
        document.getElementById("GMolResult").innerText = "PAC: " + round(342.3 / floatValue * 100.0);
    };
    edGMolCalculator.onkeypress = filterPosNumberInput;
}

// ============================================================
// Yolk Calculator
// ============================================================

// Module-level variables for yolk calculator
let yolkTable = null;
let Egg = null;

/**
 * Handler for egg value input changes
 */
function EggValueChanged(event) {
    Egg.Set(event.target.name, event.target.value);
    UpdateEggYolkValues();
}

/**
 * Update all egg/yolk value displays
 */
function UpdateEggYolkValues() {
    for (var input of yolkTable.getElementsByTagName("input"))
        input.value = round(Egg.Get(input.name));
}

/**
 * Initialize yolk values from current recipe amount
 * Called when Yolk tab is activated
 */
function InitYolkTable() {
    var inputs = yolkTable.getElementsByTagName("input");
    if ([...inputs].every(input => { return input.value == ""; })) {
        Egg.Set("Mixture", getRecipe().Sums.Amount);
        UpdateEggYolkValues();
    }
}

/**
 * Initialize the Yolk calculator UI
 * @returns {object} Object containing InitYolkTable function for tab handler
 */
export function initYolkCalculator() {
    var yolkCalc = document.getElementById("YolkCalculator");
    yolkTable = document.createElement('table');
    yolkTable.id = "yolkTable";

    var tbody = document.createElement("tbody");

    var tr = document.createElement('tr');
    var cells = [...nGenerator(2, () => { return document.createElement('td'); })];
    cells[0].innerHTML = '<label for="selEggType">Egg Type </label>';
    var selEggType = document.createElement('select');
    selEggType.id = "selEggType";
    for (const key in eggTypes) {
        var option = document.createElement('option');
        option.value = eggTypes[key];
        option.text = key + " - " + eggTypes[key] + " g";
        selEggType.appendChild(option);
    }
    selEggType.value = 56;
    cells[1].appendChild(selEggType);
    for (const cell of cells)
        tr.appendChild(cell);
    tbody.appendChild(tr);

    Egg = new cEgg(selEggType.value);
    for (const key in Egg.Factors) {
        tr = document.createElement('tr');
        var cells = [...nGenerator(2, () => { return document.createElement('td'); })];
        cells[0].innerText = key;

        var input = document.createElement('input');
        input.name = key;
        input.placeholder = key + ' g';
        input.type = 'number';
        input.min = 0;
        input.step = 'any';
        input.pattern = '[0-9]+([\.,][0-9]+)?';
        input.oninput = EggValueChanged;
        input.onkeypress = filterPosNumberInput;
        cells[1].appendChild(input);

        for (const cell of cells)
            tr.appendChild(cell);
        if (key == "Mixture") {
            var cell = document.createElement('td');
            var btn = document.createElement('button');
            btn.innerText = "From Recipe";
            btn.onclick = () => {
                Egg.Set("Mixture", getRecipe().Sums.Amount);
                UpdateEggYolkValues();
            };
            btn.style = "margin-right: 0.66em;";
            cell.appendChild(btn);
            btn = document.createElement('button');
            btn.innerText = "To Recipe";
            btn.onclick = () => {
                const value = Egg.Get("Mixture");
                getRecipe().Amount = value;
                Info("Recipe scaled to " + round(value) + " g");
            };
            cell.appendChild(btn);

            tr.appendChild(cell);
        }

        tbody.appendChild(tr);
    }
    yolkTable.appendChild(tbody);
    yolkCalc.appendChild(yolkTable);

    selEggType.onchange = function (event) {
        const total = Egg.Get("Total");
        Egg.m_Weight = toFloat(event.target.value);
        Egg.Set("Total", total);
        UpdateEggYolkValues();
    };

    return { InitYolkTable };
}
