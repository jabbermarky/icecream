        //=====================================================================================================================================================================
        // Step 1: Import helper utilities
        import { toFloat, clickOn, getHtmlContent, decimalSeparator } from './utils/helpers.js';

        const VERSION = "0.4.0 beta";






        const docBackup = getHtmlContent(); // Backup of the document needs to be done first before any modifications are applied to the DOM so it can be used to modify and download the file later on

        const RecipeDataColumns = ["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer"];
        const RecipeColumns = ["Name", "Amount", "Scale to", ""].concat(RecipeDataColumns);
        const IngredientDataFields = ["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer", "kcal"];

        // replaceAll is currently not everywhere available. Use this polyfill from https://stackoverflow.com/a/14822579
        String.prototype.replaceAll = String.prototype.replaceAll || function (find, replace) {
            return this.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
        };

        // Init tab handlers
        {
            function tabHandler(event) {
                Array.from(document.getElementsByClassName("tablink")).forEach(function (tablink) {
                    if (tablink.dataset.tabgrp == event.currentTarget.dataset.tabgrp)
                        tablink.className = tablink.className.replace(" active", "");
                });

                Array.from(document.getElementsByClassName("tabcontent")).forEach(function (tabcontent) {
                    if (tabcontent.dataset.tabgrp == event.currentTarget.dataset.tabgrp)
                        tabcontent.style.display = "none";
                });

                document.getElementById(event.currentTarget.dataset.tabid).style.display = "block";
                event.currentTarget.className += " active";

                switch (event.currentTarget.dataset.tabid) {
                    case "Recipe":
                        DisplayRecipe(); // required to add e.g. new items from ingredients list to drop down edits for recipe ingredient items
                        break;
                    case "Ingredients List":
                        DisplayIngredients();
                        document.getElementById("edIngredientFilter").focus();
                        document.getElementById("edIngredientFilter").select();
                        Info(Object.keys(Ingredients).length + " ingredients loaded");
                        break;
                    case "Yolk":
                        InitYolkTable();
                        break;
                }
            }
            Array.from(document.getElementsByClassName("tablink")).forEach(tablink => {
                tablink.onclick = tabHandler;
            });
        }

        class cIngredient {
            // all values are ratios e.g. 30% Fat would be stored as 0.3
            // MSNF = Solids - Fat? (F. Borges
            // FDP_Salt = MSNF * 2.37 ???
            // FDP_M = Lactose * 1.0 ??? -> is Lactose == 1.0 SE
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
                var copy = Object.assign(new cIngredient(), this);
                return copy;
            }
            get isSugar() { return this.Sugar >= 0.3 && this.PAC >= 0.5 && !this.isMilkPowder; }
            get isMilkPowder() { return this.MSNF > 0.9 && this.Water < 0.05 }
            get milkFat() {
                if (isNaN(this.Fat)) {
                    console.log(`cIngredient: Fat is NaN, returning 0.0`);
                    return 0.0
                };
                // has fat 
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
                    //console.log(`cIngredient: Sugar is NaN, returning 0.0`);
                    return 0.0
                };
                // has sugar 
                if (isNaN(this.MSNF)) {
                    //console.log(`cIngredient: MSNF is NaN; returning Sugar amount(${this.Sugar})`);
                    return this.Sugar;
                }
                if (this.MSNF < 0.001) {
                    //console.log(`cIngredient: MSNF(${this.MSNF}) is too low; returning Sugar amount`);
                    return this.Sugar;
                }
                //console.log("cIngredient: default returning 0.0");
                return 0.0;
            }
        }
        var temperatureForTgtHardness = 0;
        var Ingredients = {};
        //  >>> DO NOT EDIT THE INGREDIENT MARKERS! <<<
        /*INGREDIENTS_START_MARKER*/
        Ingredients = JSON.parse('\
{"Alcohol 40%":{"Water":0.6,"PAC":2.97,"kcal":2.31},\
"Almond Paste (pure)":{"Water":0.0441,"Fat":0.4993,"Sugar":0.0435,"kcal":5.79,"PAC":-0.84,"POD":0.043141000000000006,"Solids":0.9559},\
"Apple":{"Water":0.8556,"Fat":0.0017000000000000001,"Sugar":0.1039,"kcal":0.52,"Solids":0.14439999999999997,"PAC":0.221,"POD":0.171},\
"Apricot":{"Water":0.8634999999999999,"Fat":0.0039000000000000003,"Sugar":0.0924,"kcal":0.48,"Solids":0.13650000000000007,"PAC":0.12224569298245615,"POD":0.09147999999999999},\
"Atomized Glucose DE40":{"Sugar":0.366,"Solids":1,"PAC":0.79,"POD":0.28,"kcal":3.64},\
"Banana":{"Water":0.7491,"Fat":0.0033,"Sugar":0.1223,"kcal":0.89,"PAC":0.2109339210526316,"POD":0.14124499999999998,"Solids":0.2509},\
"Black Cherry":{"Water":0.8220000000000001,"Fat":0.002,"Sugar":0.128,"kcal":0.63,"Solids":0.17799999999999994},\
"Blackberries":{"Water":0.8815000000000001,"Fat":0.0049,"Sugar":0.048799999999999996,"kcal":0.43,"PAC":0.09153961403508772,"POD":0.058104,"Solids":0.11849999999999994},\
"Blueberries":{"Water":0.8421,"Fat":0.0033,"Sugar":0.09960000000000001,"kcal":0.57,"PAC":0.18841416666666666,"POD":0.11975,"Solids":0.15790000000000004},\
"Buffalo Milk":{"Water":0.8339,"Fat":0.0689,"kcal":0.97,"Solids":0.16610000000000003,"MSNF":0.0971,"PAC":0.05},\
"Butter":{"Water":0.1617,"Fat":0.8111,"Sugar":0.0006,"kcal":7.17,"Solids":0.8383,"PAC":0.01,"POD":0.001},\
"Buttermilk":{"Water":0.8791,"Fat":0.0331,"Sugar":0.048799999999999996,"kcal":0.62,"Solids":0.12090000000000001,"MSNF":0.08789999999999999,"PAC":0.035,"POD":0.005600000000000001},\
"Buttermilk, light":{"Water":0.9013,"Fat":0.0088,"Sugar":0.0479,"kcal":0.4,"Solids":0.09870000000000001,"MSNF":0.09,"PAC":0.035,"POD":0.005600000000000001},\
"Carboxymethyl Cellulose":{"Solids":1,"POD":0.1,"kcal":1.43, "Stabilizer":1},\
"Chocolate, dark":{"Water":0.0075,"Fat":0.332,"Sugar":0.48810000000000003,"kcal":5.28,"Solids":0.9925,"PAC":-0.239,"POD":0.488},\
"Cocoa Powder":{"Water":0.03,"Fat":0.13699999999999998,"Sugar":0.005,"kcal":2.28,"Solids":0.97,"PAC":-1.6,"POD":0.005},\
"Coconut Milk":{"Water":0.9457,"Fat":0.0208,"Sugar":0.025,"kcal":0.31,"Solids":0.054300000000000015},\
"Coffee Beans":{"Solids":1,"kcal":0.01},\
"Condensed Milk Sweet":{"Water":0.2716,"Fat":0.087,"Sugar":0.544,"kcal":3.21,"Solids":0.7283999999999999,"PAC":0.58,"POD":0.46},\
"Corn Starch":{"kcal":3.81,"Solids":1, "Stabilizer":1},\
"Corn Syrup DE42":{"Water":0.2,"Sugar":0.78,"Solids":0.8,"PAC":0.8,"POD":0.48,"kcal":2.86},\
"Cream 30%":{"Water":0.64,"Sugar":0.032,"Fat":0.3,"Solids":0.363,"MSNF":0.063,"PAC":0.03,"POD":0.0048,"kcal":2.88},\
"Cream, heavy":{"Water":0.5771000000000001,"Fat":0.3608,"Sugar":0.0292,"kcal":3.4,"PAC":0.02922561403508772,"POD":0.004672,"Solids":0.42289999999999994,"MSNF":0.06209999999999993},\
"Cream, light":{"Water":0.7451000000000001,"Fat":0.191,"Sugar":0.036699999999999997,"kcal":1.91,"Solids":0.2548999999999999,"MSNF":0.064,"PAC":0.03,"POD":0.0048},\
"Dextrose":{"Sugar":0.875,"Solids":1,"PAC":1.66,"POD":0.61,"kcal":3.66},\
"Dried Buttermilk Powder (sweet)":{"Water":0.0297,"Fat":0.057800000000000004,"Sugar":0.49,"kcal":3.87,"Solids":0.9703,"MSNF":0.96,"PAC":0.49,"POD":0.078},\
"Dried Skimmed Milk Powder":{"Water":0.02,"Sugar":0.515,"Fat":0.009,"Solids":0.96,"MSNF":0.954,"PAC":0.52,"POD":0.0835,"kcal":3.55},\
"Egg":{"Water":0.758,"Fat":0.09960000000000001,"kcal":1.48,"Solids":0.242},\
"Egg Yolk":{"Water":0.5231,"Fat":0.26539999999999997,"Solids":0.4769,"kcal":3.22,"Sugar":0.005600000000000001,"PAC":0.008186561403508773,"POD":0.003948000000000001,"MSNF":0.21150000000000002},\
"Erythritol":{"Sugar":0.45,"Solids":1,"PAC":2.8,"POD":0.7,"kcal":0.2},\
"Fructose":{"Sugar":1,"Solids":1,"PAC":1.9,"POD":1.7,"kcal":3.98},\
"Goat Milk":{"Water":0.8703,"Fat":0.0414,"Sugar":0.044500000000000005,"kcal":0.69,"Solids":0.12970000000000004,"MSNF":0.08839999999999999,"PAC":0.04},\
"Grapefruit":{"Water":0.9089,"Fat":0.001,"Sugar":0.0698,"kcal":0.32,"Solids":0.09109999999999996,"PAC":0.098,"POD":0.075},\
"Grapes":{"Water":0.8429000000000001,"Fat":0.004699999999999999,"kcal":0.57,"Solids":0.1570999999999999,"PAC":0.293,"POD":0.19},\
"Guar":{"Water":0.15,"Fat":0.005,"Solids":0.85,"kcal":3.32, "Stabilizer":0.85},\
"Half and Half":{"Water":0.8057,"Fat":0.115,"Sugar":0.041299999999999996,"kcal":1.31,"PAC":0.04133622807017544,"POD":0.006607999999999999,"Solids":0.19430000000000003,"MSNF":0.07930000000000002},\
"Hazelnut Paste (pure)":{"Water":0.053099999999999994,"Fat":0.6075,"Sugar":0.0434,"kcal":6.28,"Solids":0.9469,"PAC":-0.91,"POD":0.042},\
"Honey":{"Water":0.171,"Sugar":0.8212,"kcal":3.04,"Solids":0.829,"PAC":1.8,"POD":1.3},\
"Inulin":{"Sugar":0.1,"Solids":1,"POD":0.1,"kcal":1.4},\
"Invert Syrup 80%":{"Water":0.2,"Sugar":0.8,"Solids":0.8,"PAC":1.34,"POD":1.04,"kcal":3.24},\
"Kiwi":{"Water":0.8306999999999999,"Fat":0.0052,"Sugar":0.08990000000000001,"kcal":0.61,"Solids":0.16930000000000012,"PAC":0.223,"POD":0.14800000000000002},\
"Lambda Carrageenan":{"Solids":1,"POD":0.1,"kcal":1.12, "Stabilizer":1},\
"Lecithin":{"Solids":1,"kcal":8.84},\
"Lemon":{"Water":0.8898,"Fat":0.003,"Sugar":0.025,"kcal":0.29,"Solids":0.11019999999999996,"PAC":0.047,"POD":0.042},\
"Lemon Juice":{"Water":0.9231,"Sugar":0.0252,"Fat":0.0024,"Solids":0.07689999999999997,"PAC":0.04404483333333334,"POD":0.029930000000000002,"kcal":0.22},\
"Lime":{"Water":0.8826,"Fat":0.002,"Sugar":0.0169,"kcal":0.3,"Solids":0.11739999999999995,"PAC":0.032,"POD":0.028999999999999998},\
"Litchis":{"Water":0.8176000000000001,"Fat":0.0044,"Sugar":0.1523,"kcal":0.66,"Solids":0.1823999999999999,"PAC":0.287,"POD":0.221},\
"Locust Bean Gum":{"Water":0.15,"Fat":0.005,"Solids":0.85,"kcal":3.32, "Stabilizer":0.85},\
"Maltodextrin":{"Solids":1,"PAC":0.29,"POD":0.17,"kcal":3.8},\
"Mango":{"Water":0.8345999999999999,"Fat":0.0038,"Sugar":0.1366,"kcal":0.6,"Solids":0.1654000000000001,"PAC":0.19692149999999997,"POD":0.16332999999999998},\
"Maple Syrup":{"Water":0.3239,"Fat":0.0006,"Sugar":0.6046,"kcal":2.6,"Solids":0.6760999999999999,"PAC":0.605,"POD":0.605},\
"Milk Chocolate":{"Water":0.015,"Fat":0.2966,"Sugar":0.515,"kcal":5.35,"Solids":0.985,"PAC":0.135,"POD":0.53,"MSNF":0.16},\
"Oranges":{"Water":0.867,"Fat":0.0015,"Sugar":0.0857,"kcal":0.47,"Solids":0.133,"PAC":0.125193,"POD":0.09616},\
"Papaya":{"Water":0.8806,"Fat":0.0026,"Sugar":0.0782,"kcal":0.43,"PAC":0.14871033333333333,"POD":0.09204000000000001,"Solids":0.11939999999999995},\
"Passion Fruit":{"Water":0.7293000000000001,"Fat":0.006999999999999999,"Sugar":0.133,"kcal":0.97,"Solids":0.27069999999999994,"PAC":0.214,"POD":0.146},\
"Peach":{"Water":0.883,"Fat":0.0027,"Sugar":0.0839,"kcal":0.42,"Solids":0.11699999999999999,"PAC":0.11571970175438596,"POD":0.087918},\
"Pineapple":{"Water":0.86,"Fat":0.0012,"Sugar":0.09849999999999999,"kcal":0.5,"PAC":0.13311416666666667,"POD":0.10805,"Solids":0.14},\
"Pistachio Paste (pure)":{"Water":0.0437,"Fat":0.4532,"Sugar":0.0766,"kcal":5.6,"Solids":0.9563,"PAC":-0.7,"POD":0.075},\
"Raspberries":{"Water":0.8575,"Fat":0.006500000000000001,"Sugar":0.044199999999999996,"kcal":0.52,"PAC":0.08206016666666668,"POD":0.05497,"Solids":0.14249999999999996},\
"Rum 40%":{"Water":0.6659999999999999,"kcal":2.31,"Solids":1.1102230246251565e-16,"PAC":2.97},\
"Salt":{"Water":0.002,"Solids":0.998,"PAC":5.86},\
"Skim Milk":{"Water":0.9079999999999999,"Fat":0.0008,"Sugar":0.050499999999999996,"kcal":0.34,"Solids":0.09200000000000008,"PAC":0.05054429824561404,"POD":0.008079999999999999,"MSNF":0.09120000000000009},\
"Sour Cream":{"Water":0.7306999999999999,"Fat":0.1935,"Sugar":0.0341,"kcal":1.98,"Solids":0.2693000000000001,"MSNF":0.075,"PAC":0.032,"POD":0.0051},\
"Strawberries":{"Water":0.9109999999999999,"Sugar":0.053399999999999996,"Solids":0.08900000000000008,"PAC":0.10055716666666667,"POD":0.098,"kcal":0.31,"Fat":0.0022},\
"Sucrose":{"Sugar":1,"Solids":1,"PAC":1,"POD":1,"kcal":3.85},\
"Trehalose":{"Sugar":0.45,"Solids":1,"PAC":1,"POD":0.45,"kcal":3.62},\
"Vanilla Extract":{"Water":0.5257999999999999,"Fat":0.0006,"Sugar":0.1265,"kcal":2.88,"Solids":0.1302000000000001,"PAC":0.127,"POD":0.127},\
"Water":{"Water":1},\
"Whole Milk 3.3%":{"Water":0.8809999999999999,"Sugar":0.0481,"Fat":0.032,"Solids":0.1190000000000001,"MSNF":0.087,"PAC":0.0481,"kcal":0.61,"POD":0.0077},\
"Whole Milk 3.5%":{"Water":0.8813,"Sugar":0.050499999999999996,"Fat":0.035,"Solids":0.11870000000000003,"MSNF":0.087,"PAC":0.04,"kcal":0.61,"POD":0.0077},\
"Xanthan Gum":{"Solids":1,"kcal":0.54, "Stabilizer":1},\
"Yogurt 3.5%":{"Water":0.86,"Sugar":0.035,"Fat":0.035,"Solids":0.14,"MSNF":0.142,"PAC":0.071,"POD":0.0048,"kcal":0.59}}');
        /*INGREDIENTS_END_MARKER*/

        for (const key in Ingredients)
            Ingredients[key] = Object.assign(new cIngredient(), Ingredients[key]);


        function IngredientNames() {
            return Object.keys(Ingredients);
        }
        function SortIngredients() {
            const keys = Object.keys(Ingredients).sort();
            var tmp = {};
            for (const key of keys) {
                tmp[key] = Ingredients[key];
            }
            Ingredients = tmp;
        }
        SortIngredients();

        class cTargetValue {
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
        class cTarget {
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
        var Targets = {};

        // Based on: https://www.sciencedirect.com/topics/food-science/frozen-dessert
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



        // This method must be located below the ingredient markers to ensure they are located properly with the string search
        document.getElementById("btnDownload").onclick = () => {

            const start_marker = "/*INGREDIENTS_START_MARKER*/";
            const end_marker = "/*INGREDIENTS_END_MARKER*/";

            const pos_start = docBackup.indexOf(start_marker);
            const pos_end = docBackup.indexOf(end_marker);
            if (pos_start < 0 || pos_end < 0 || pos_start >= pos_end) {
                ErrorMsg("Failed to locate ingredient markers in document. Download aborted.");
                return;
            }

            const string = docBackup.slice(0, pos_start + start_marker.length)
                + "\nIngredients = JSON.parse('\\\n" + JSON.stringify(Ingredients, (key, value) => { return value == 0.0 ? undefined : value; }).replaceAll('},', "},\\\n") + "');\n"
                + docBackup.slice(pos_end);
            var link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(new Blob([string], { type: 'text/html' })));
            link.setAttribute('download', "IceEd.html");
            clickOn(link);
        };







        // --- Recipe -----------------------------------------------------------


        var RecipeBackup = []; // backups recipe states on optimization
        var RecipeStack = {};  // keeps previous recipes when loading or creating new recipes
        var sortBy = null;
        var sortAsc = false;

        document.getElementById("JavscriptWarning").style = "display: none;";
        var slServingTemperature = document.getElementById("slServingTemperature");
        slServingTemperature.value = -18;
        slServingTemperature.oninput = function () {
            document.getElementById("lbServingTemperature").innerHTML = this.value + "&nbsp;°C";
            Recipe.ServingTemperature = toFloat(this.value);
            SetRecipeModified();
            UpdateRecipeSums();
        };
        var slHardness = document.getElementById("slHardness");
        slHardness.value = 75;
        slHardness.oninput = function () {
            document.getElementById("lbHardness").innerHTML = this.value + "&nbsp;%";
            Recipe.Hardness = toFloat(this.value) / 100.0;
            SetRecipeModified();
            UpdateRecipeSums();
        };
        var slOverrun = document.getElementById("slOverrun");
        slOverrun.value = 0.3;
        slOverrun.oninput = function () {
            var overrun = toFloat(this.value) / this.max;
            overrun *= overrun * 1.5;
            document.getElementById("lbOverrun").innerHTML = Math.round(overrun * 100.) + "&nbsp;%";
            Recipe.Overrun = overrun;
            SetRecipeModified();
            UpdateRecipeInfo();
        };

        var scoopSizes = [];
        const sccopsPerQuart = [4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 30, 36, 40, 50, 60, 70, 100];
        const scoopsPerLiter = [4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 22, 24, 30, 36, 40, 45, 50, 55, 60, 65, 70, 85, 100];
        for (const v of scoopsPerLiter) {
            const ccmm = 1000000. / v;
            scoopSizes.push({
                Size: 2. * Math.cbrt(6. * ccmm / (4. * Math.PI)),
                ML: ccmm * 0.002,
                LabelHTML: "<sup>1</sup>&frasl;<sub>" + v + "</sub>&nbsp;L"
            });
        }
        for (var v of sccopsPerQuart) {
            const ccmm = 0.946353 * 1000000. / v;
            scoopSizes.push({
                Size: 2. * Math.cbrt(6. * ccmm / (4. * Math.PI)),
                ML: ccmm * 0.002,
                LabelHTML: "<sup>1</sup>&frasl;<sub>" + v + "</sub>&nbsp;qt"
            });
        }
        scoopSizes.sort((a, b) => { return a.Size > b.Size ? 1 : -1; });

        var slScoopSize = document.getElementById("slScoopSize");
        slScoopSize.max = scoopSizes.length - 1;
        slScoopSize.value = 24;
        slScoopSize.oninput = () => {
            const index = toFloat(slScoopSize.value);
            document.getElementById("lbScoopSize").innerHTML =
                '<table class="layout" style="display:inline;""><tbody><tr>'
                + '<td style="width: 3.75em; padding-top: 0px; text-align: left;">' + scoopSizes[index].LabelHTML + '</td>'
                + '<td style="color: var(--mid-grey); padding-top: 0px;">' + Math.round(scoopSizes[index].Size) + "&nbsp;mm&ensp;" + Math.round(scoopSizes[index].ML) + '&nbsp;ml</td>'
                + '</tr></tbody></table>';

            UpdateRecipeInfo();
        };

        var tgtSelection = document.getElementById('tgtSelection');
        for (const key in Targets) {
            var option = document.createElement('option');
            option.value =
                option.text = key;
            tgtSelection.appendChild(option);
        }
        tgtSelection.onchange = () => {
            Recipe.Type = tgtSelection.value;
            UpdateRecipeSums();
            SetRecipeModified();
        };

        class cRecipe {
            constructor(name = "", notes = "") {
                this.Name = name;
                this.Notes = notes;
                this.Type = tgtSelection.value;
                this.ServingTemperature = slServingTemperature.value;
                this.Hardness = slHardness.value / 100.0;
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
                const columns = RecipeDataColumns.concat("kcal");
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
        var Recipe = new cRecipe();

        document.getElementById("edRecipeName").oninput = (event) => {
            Recipe.Name = event.target.value;
            SetRecipeModified();
        };
        document.getElementById('taRecipeNotes').oninput = (event) => {
            if (event.target.innerHTML === "<br>") // remove the remaining line break, so the field is empty and css placeholder is displayed again
                event.target.innerHTML = "";
            Recipe.Notes = event.target.innerHTML;
            SetRecipeModified();
        };

        // select first tabs
        clickOn(document.getElementById("tabbar").firstElementChild);
        clickOn(document.getElementById("ToolTabBar").firstElementChild);

        SetRecipeModified(false);
        slScoopSize.oninput();

        function SetRecipeModified(modified = true) {
            const changed = SetRecipeModified.modified != modified;
            SetRecipeModified.modified = modified;
            if (changed) {
                document.getElementById("ModifiedIndicator").style = "display: " + (modified ? "inline-block;" : "none;");
            }
        }

        function IsRecipeModified() {
            return SetRecipeModified.modified;
        }

        function BackupCurrentRecipe() {
            if (BackupRecipe(Recipe))
                DisplayBackupList();
        }
        function BackupRecipe(recipe) {
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
        function DisplayBackupList() {
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
        function RestoreBackup(recipeName) {
            BackupRecipe(Recipe);
            sortBy = null;

            Recipe = cRecipe.copyFrom(RecipeStack[recipeName].Recipe);
            DisplayRecipe();
            SetRecipeModified(RecipeStack[recipeName].Modified);
            delete RecipeStack[recipeName];
            DisplayBackupList();
        }

        function SortRecipe(event = null) {
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

        function CreateRecipeRow(ingredientNames = null) {
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
            option = document.createElement('option');
            select.appendChild(option);
            select.value = "";
            select.onchange = onIngredientChanged;
            cell.appendChild(select);
            row.appendChild(cell);

            cell = document.createElement('td');
            input = document.createElement('input');
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
            btn = document.createElement('button');
            btn.title = "Delete";
            btn.innerText = "🗑️";
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

        function DisplayRecipe() {
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
            row = document.createElement('tr');
            for (const columnName of RecipeColumns) {
                var cell = document.createElement('th');
                cell.innerHTML = columnName;
                if (columnName === sortBy)
                    cell.innerHTML += '<span class="noprint">' + (sortAsc ? " ▲" : " ▼") + '</span>';
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

        function UpdateRecipeRow(row, index = undefined) {
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
                        //} else {
                        //    cell.textContent = "–";
                        //    cell.style = "color: var(--mid-grey)";
                    }
                }
            }
        }

        function onIngredientChanged(element) {
            var row = this.closest('tr');
            var recipeIngredient = Recipe.Ingredients[row.rowIndex - 1];
            var amountInput = element.target.parentNode.nextSibling.firstChild;
            if (isNaN(amountInput.value) || amountInput.value == "")
                amountInput.value = 0;

            row.Name = element.target.value;
            if (recipeIngredient !== undefined) { // current ingredinet changed -> changed in recipe data
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

        function onIngredientAmountEdited() {
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

        function onRecipeIngredientDeleted() {
            const row = this.closest('tr');
            const rowcount = this.closest('tbody').getElementsByTagName('tr').length;
            if (row.rowIndex >= rowcount)
                return;

            Recipe.Ingredients.splice(row.rowIndex - 1, 1); // delete ingredient from array
            this.closest('tr').remove();

            UpdateRecipeSums();
            SetRecipeModified();
        }

        function onRecipeScaled() {
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

        function onScaleInputKeyUp(event) {
            if ((event.which ? event.which : event.keyCode) === 13) {
                event.preventDefault(); // Cancel the default action, if needed
                document.getElementById("btnScale").click();
                return false;
            }
        }

        function UpdateRecipeSums() {
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
            DrawFreezingGraph(sums.Water, sums.PAC, sums.MSNF);
        }

        function Normalize(sums, num) {
            if (sums.Amount > 0) return Math.round(1000 / sums.Amount * num);
            else return 0;
        }

        function UpdateRecipeInfo(sums = null) {
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

        function CheckRecipe(sums) {
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

        function ToggleIngredientScale(event) {
            document.getElementById('edTargetWeight').disabled = event.srcElement.checked;
            document.getElementById('selTargetWeightMode').disabled = event.srcElement.checked;
            document.getElementById('RecipeData').querySelectorAll('tr>*:nth-child(3)').forEach(cell => {
                cell.hidden = !event.srcElement.checked;
            });
        }

        function Fitness(Candidate, tgtType, fitnessFields, OptimizeForMean = true) {
            var fitness = 0.0;
            const sums = Candidate.Sums;
            const pac_value = GetIdealPAC(Recipe, tgtType, sums) / sums.Amount; // adjust required PAC to current recipe
            tgtType.PAC = new cTargetValue(pac_value * 0.95, pac_value * 1.05); // +/- 5%
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

        function OptimizeRecipe(OptimizeForMean = true) {
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

            const originalFitness = Fitness(localBackup, tgtType, fitnessFields, OptimizeForMean);

            var recipeFitness = originalFitness;

            var step = 0.1;
            var outerImproved = 0;
            do {
                var improved = 0;

                // test variations and apply the ones that gain improvement
                for (const i of adjustmentIndizes) {
                    for (const factor of [1.0 + step, 1.0 - step]) {
                        var candidate = cRecipe.copyFrom(Recipe);
                        candidate.Ingredients[i].Amount *= factor;
                        const candidateFitness = Fitness(candidate, tgtType, fitnessFields, OptimizeForMean);
                        if (candidateFitness < recipeFitness) {
                            Recipe = cRecipe.copyFrom(candidate);
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
                scaledAmount += Recipe.Ingredients[i].Amount;
            const unscaledAmount = Recipe.Amount - scaledAmount;
            const targetAmount = localBackup.Amount - unscaledAmount;
            const factor = targetAmount / scaledAmount;
            var changedIndizes = [];
            for (const i of adjustmentIndizes) {
                Recipe.Ingredients[i].Amount *= factor;

                if (Math.abs(localBackup.Ingredients[i].Amount - Recipe.Ingredients[i].Amount) > Number.EPSILON)
                    changedIndizes.push(i)
            }
            const rowCount = changedIndizes.length;


            if (rowCount > 0)
                RecipeBackup.push(cRecipe.copyFrom(localBackup));

            document.getElementById("btnRestoreRecipe").disabled = RecipeBackup.length == 0;


            // display comparision table
            if (rowCount > 0) {
                SetRecipeModified();

                var table = document.createElement("table");
                var th = document.createElement("thead");
                var tr = document.createElement('tr');
                for (name of ["Name", "Original", "Optimized"]) {
                    var cell = document.createElement('th');
                    cell.innerText = name;
                    tr.appendChild(cell);
                }
                th.appendChild(tr);
                table.appendChild(th);
                var tbody = document.createElement("tbody");
                for (const i of changedIndizes) {
                    const old = localBackup.Ingredients[i].Amount;
                    const changed = Recipe.Ingredients[i].Amount;

                    tr = document.createElement('tr');
                    var cells = [...nGenerator(3, () => { return document.createElement('td'); })];
                    cells[0].innerText = Recipe.Ingredients[i].Name;
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

        function RestoreRecipe() {
            if (!RecipeBackup.length)
                return;
            Recipe = cRecipe.copyFrom(RecipeBackup.pop());
            DisplayRecipe();
            document.getElementById("btnRestoreRecipe").disabled = RecipeBackup.length == 0;
        }

        function CategorizeRecipe() {
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

        // Calculate Freezing Point Depression
        // according to https://www.uoguelph.ca/foodscience/sites/default/files/FreezingCurveCalculation.pdf
        // all parameters are expected as absolute/non-normalized weight
        function CalcFDP(Water, PAC, MSNF) {
            const se_concentration = PAC / Water;
            const fdp_se = -SE_to_FPD(se_concentration);
            const fdp_sa = -MSNF * 2.37 / Water;
            const fdp_total = fdp_se + fdp_sa;
            return fdp_total;
        }

        // returns absolute required SE in g that gains desired hardness at serving temperature
        function GetIdealPAC(Recipe, Target, Sums = null) {
            if (Sums == null)
                Sums = Recipe.Sums;
            const water = Sums.Water * (1.0 - Recipe.Hardness);
            const ideal_fdp_sa = Target.MSNF.Mean * Sums.Amount * 2.37 / water;
            const ideal_fdp_se = Recipe.ServingTemperature + ideal_fdp_sa;
            const se_concentration = FDP_to_SE(-ideal_fdp_se);
            return se_concentration * water;
        }

        // all parameters are expected as absolute/non-normalized weight
        function DrawFreezingGraph(Water, PAC, MSNF) {
            const temperatureForTgtHardness = -CalcFDP(Water * (1.0 - Recipe.Hardness), PAC, MSNF);
            const step = Water / 20.0;
            var points = [];
            for (var i = 0; i < 20; i++) {
                points.push({ x: i / 20.0, y: -CalcFDP(Water, PAC, MSNF) });
                Water -= step;
            }

            // draw marks at serving temperature and current 75% frozen temperature
            const offX = 32;
            const offY = 36;
            const tempRange = 40.0;

            var canvas = document.getElementById('cvFreezingGraph');
            canvas.width = 600;
            canvas.height = 400;
            if (!DrawFreezingGraph.NotesInitialized) // set only on first execution
            {
                DrawFreezingGraph.NotesInitialized = true;
                document.getElementById('taRecipeNotes').style = "width: " + (canvas.width - 2 * offX) + "px; margin-top: " + (offY - 1) + "px;";
            }

            var ctx = canvas.getContext('2d');
            ctx.font = getCSS(canvas, 'font-size') + " " + getCSS(canvas, 'font-family');

            const scaleX = (canvas.width - 2.0 * offX);
            const scaleY = (canvas.height - 2.0 * offY);
            function tx(x) { return x * scaleX + offX; }
            function ty(y) { return y * scaleY + offY; }
            function line(x1, y1, x2, y2) {
                ctx.beginPath();
                ctx.moveTo(tx(x1), ty(y1));
                ctx.lineTo(tx(x2), ty(y2));
                ctx.stroke();
            }

            // draw axes
            line(0, 0, 0, 1); // Y
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("°C", tx(0), ty(0) - 4);
            ctx.textAlign = "end";
            ctx.textBaseline = "middle";
            for (var i = 0.0; i <= tempRange; i += 5.0) {
                const y = i / tempRange;
                line(0, y, 0.01, y);
                // if( !(i%10))
                {
                    ctx.strokeStyle = '#ccc';
                    line(0.01, y, 1.0, y);
                    ctx.strokeStyle = '#000';
                }
                ctx.fillText("-" + i + " ", offX - 4, ty(y));
            }
            line(0, 1, 1, 1); // X
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            for (var i = 0; i <= 100; i += 5) {
                const x = i / 100.0;
                if (!(i % 10)) {
                    line(x, 1.0, x, 1.0 - 0.02);
                    ctx.fillText(i, tx(x), ty(1) + 4);
                }
                else
                    line(x, 1.0, x, 1.0 - 0.01);
            }
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.fillText("% Water frozen", tx(1) + offX, ty(1) + offY);

            // draw serving temperature and hardness lines
            const servingTemp = -Recipe.ServingTemperature / tempRange;
            const hardnessPoint = temperatureForTgtHardness / tempRange;
            //console.log('hardnessPoint:', hardnessPoint);
            ctx.strokeStyle =
                ctx.fillStyle = getCSS(canvas, '--contrast');
            line(0, servingTemp, 1, servingTemp);
            ctx.textBaseline = hardnessPoint < servingTemp ? "top" : "bottom";
            ctx.fillText("Serving Temperature", tx(1), ty(servingTemp) + (hardnessPoint < servingTemp ? 4 : -4));

            ctx.strokeStyle =
                ctx.fillStyle = getCSS(canvas, '--accent');
            line(0, hardnessPoint, 1, hardnessPoint);
            // vertical line at hardness percentage on X-axis
            line(Recipe.Hardness, 0, Recipe.Hardness, 1);
            ctx.textBaseline = hardnessPoint > servingTemp ? "top" : "bottom";
            ctx.fillText("Hardness " + Math.round(Recipe.Hardness * 100) + "%", tx(1), ty(hardnessPoint) + (hardnessPoint > servingTemp ? 4 : -4));


            // draw curve
            ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--accent2');
            ctx.beginPath();
            ctx.moveTo(tx(points[0].x), ty(points[0].y / tempRange));
            for (var i = 1; i < points.length; ++i) {
                //console.log(tx(points[i].x) + " / " + ty(points[i].y));
                ctx.lineTo(tx(points[i].x), ty(points[i].y / tempRange));
            }
            ctx.stroke();
        }

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
        function SE_to_FPD(se) {
            return 0.7592693269656435 * se * se + 6.5366647596977 * se - 0.1876732904734074;
        }
        // inverse function of SE_to_FPD
        function FDP_to_SE(fdp) {
            const a = 0.7592693269656435;
            const b = 6.5366647596977;
            const c = 0.1876732904734074;
            return (0.5 * (Math.sqrt(4.0 * a * fdp + b * b + 4.0 * a * c) - b)) / a;
        }

        document.getElementById('btnNewRecipe').onclick = () => {
            BackupCurrentRecipe();
            Recipe = new cRecipe("");
            RecipeBackup = [];
            sortBy = null;
            DisplayRecipe();
            document.getElementById("edRecipeName").focus();
            SetRecipeModified(false);
        };
        document.getElementById('btnStoreAsIngredient').onclick = () => {
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
        };
        document.getElementById('btnSaveRecipe').onclick = () => {
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
        };
        document.getElementById('btnLoadRecipe').onclick = (event) => { clickOn(document.getElementById("inputLoadRecipe")); };
        document.getElementById('inputLoadRecipe').onchange = (event) => {
            var reader = new FileReader();
            reader.onload = function () {
                var dataObj = JSON.parse(reader.result);

                if (!dataObj.hasOwnProperty('id') || !dataObj.hasOwnProperty('version') || !dataObj.hasOwnProperty('data')
                    || dataObj.id != 'IER' || dataObj.version != 1) {
                    ErrorMsg("Invalid file format in: " + event.target.files[0].name);
                    return;
                }

                function loadRecipe() {
                    importIngredients(dataObj.data.Ingredients);

                    RecipeBackup = [];
                    Recipe = new cRecipe("");
                    sortBy = null;

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
        };
        document.getElementById('btnPrintRecipe').onclick = () => {
            window.print();
        };
        document.getElementById('btnCategorizeRecipe').onclick = CategorizeRecipe;

        document.getElementById('edTargetWeight').onkeyup = onScaleInputKeyUp;
        document.getElementById('edTargetWeight').onkeypress = filterPosNumberInput;

        document.getElementById('selTargetWeightMode').onchange = () => {
            var sel = document.getElementById('edTargetWeight');
            sel.focus();
            sel.select();
        };


        document.getElementById('btnOptimizeMean').onclick = OptimizeRecipe;
        document.getElementById('btnOptimizeRange').onclick = () => { OptimizeRecipe(false) };
        document.getElementById('btnRestoreRecipe').onclick = RestoreRecipe;
        document.getElementById('btnRestoreRecipe').disabled = true;




        // --- Ingredients -----------------------------------------------------------

        document.getElementById('btnSaveIngredients').onclick = () => {
            const headerObj = {
                id: "IEI",
                version: 1,
                data: "$DATA$"
            };
            const content = JSON.stringify(Ingredients, (key, value) => { return value == 0.0 ? undefined : value; }, " ").replaceAll('\n', '').replaceAll('},', "},\n");
            var link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(new Blob([JSON.stringify(headerObj, null, '\t').replace("\"$DATA$\"", '\n' + content)], {
                type: 'application/octet-stream'
            })));
            link.setAttribute('download', 'Ingredients.iei');
            clickOn(link);

        };
        document.getElementById('btnLoadIngredients').onclick = (event) => { clickOn(document.getElementById("inputLoadIngredients")); };
        document.getElementById('inputLoadIngredients').onchange = (event) => {
            var reader = new FileReader();
            reader.onload = function () {
                const overrideExisting = document.getElementById('cbxOverrideIngredients').value == "on";
                var dataObj = JSON.parse(reader.result);
                if (dataObj.hasOwnProperty('id') && dataObj.hasOwnProperty('version') && dataObj.hasOwnProperty('data')
                    && dataObj.id == 'IEI' && dataObj.version == 1) {
                    importIngredients(dataObj.data);
                    DisplayIngredients();
                } else {
                    ErrorMsg("Invalid file format in: " + event.target.files[0].name);
                }
            };
            reader.readAsText(event.target.files[0]);
        };

        document.getElementById('edIngredientFilter').oninput = onIngredientFilterEdit;
        document.getElementById('btnClearIngredientsFilter').onclick = () => {
            document.getElementById('edIngredientFilter').value = "";
            onIngredientFilterEdit();
            document.getElementById("edIngredientFilter").focus();
        };

        function diffIngredients(A, B) {
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

        function importIngredients(dataObj, overrideExisting = false, mergeMessageMtml = null) {
            var mergeList = {};
            for (const [key, data] of Object.entries(dataObj)) {
                dataObj[key] = Object.assign(new cIngredient(), dataObj[key]);

                if (overrideExisting || !Ingredients.hasOwnProperty(key)) {
                    Ingredients[key] = dataObj[key];
                } else {
                    const diff = diffIngredients(Ingredients[key], dataObj[key]);// diff ingredient and add to merge list if not equal
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
                for (name of ["Ingredient", "Current", "Imported"]) {
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
                buttons[0].innerText = multi ? "Keep All" : "Keep";
                buttons[0].onclick = hideModal;
                buttons[1].innerText = multi ? "Replace All" : "Replace";
                buttons[1].onclick = function () { // merge all
                    for (const [key, data] of Object.entries(mergeList))
                        Ingredients[key] = dataObj[key];
                    hideModal();
                    DisplayRecipe();
                    DisplayIngredients();
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
                    };
                }

                for (const button of buttons)
                    buttonBar.appendChild(button);
                showModal(div, buttonBar);
            } else {
                DisplayRecipe();
                DisplayIngredients();
            }
        }

        function onIngredientFilterEdit() {
            filterIngredients.ignored = null;
            filterIngredients();
        }

        function filterIngredients() {
            var rows = document.getElementById("tblIngredientsList").getElementsByTagName('tr');
            const filter = document.getElementById('edIngredientFilter').value.toLowerCase();
            const doFilter = filter.length > 0;
            for (var row of rows)
                row.style.display = (doFilter && row.hasOwnProperty('name') && row.name != "" && !(row.name.toLowerCase().includes(filter) || row.name == filterIngredients.ignored)) ? 'none' : '';
        }
        filterIngredients.ignored = null;

        function onIngredientEdit(element) {
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
        }

        function isIngredientUsed(ingredientName) {
            console.assert(ingredientName.length > 0);

            var result = {
                IsUsed: false,
                IsUsedBy: ""
            }
            function CheckUsage(Recipe) {
                const used = Recipe.Ingredients.some(ingredient => ingredient.Name === ingredientName);
                if (used)
                    result.IsUsedBy = Recipe.Name;
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

        function onIngredientDeleted(element) {
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
        }

        function onDownloadIngredientData(element) {
            const ingredientName = element.currentTarget.parentNode.parentNode.firstChild.firstChild.value;
            if (ingredientName == "")
                return;

            requestData(ingredientName);

            function requestData(ingredientName) {
                var httpRequest = new XMLHttpRequest();
                httpRequest.onreadystatechange = resultHandler;

                const searchParams = {
                    query: ingredientName,
                    dataType: ["Foundation", "Survey (FNDDS)", "SR Legacy"]/*,
            sortBy: "fdcId",
            sortOrder: "desc"*/
                };
                httpRequest.open('POST', "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=wiMzQqoyJ2hgzPsDdUsubCjltt6djhCjG6phgSLT");
                httpRequest.setRequestHeader('Content-type', 'application/json');
                httpRequest.send(JSON.stringify(searchParams));
            }

            function resultHandler() {
                if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                    var dataObj = JSON.parse(this.responseText);
                    var query = dataObj.foodSearchCriteria.query;

                    if (dataObj.totalHits == 0) // search again
                    {
                        query = query.substring(0, query.lastIndexOf(" "));
                        if (query.length > 1)
                            requestData(query);
                        else
                            Info("No data found for " + ingredientName);
                        return;
                    }

                    // filter results
                    var distances = [];
                    for (const food of dataObj.foods)
                        distances.push(DamerauLevenshteinDistance(food.description, ingredientName));
                    distances.sort();
                    const minDistance = distances[Math.min(12, distances.length - 1)];
                    dataObj.foods = dataObj.foods.filter(food => {
                        return food.dataType == "Foundation" /* || food.description.includes( ingredientName )*/
                            || (DamerauLevenshteinDistance(food.description, ingredientName) <= minDistance);
                    });

                    // display search results for selection
                    var items = [];
                    for (const food of dataObj.foods)
                        items.push(food.description);
                    items = items.filter((value, index, self) => { // make unique
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
                            // find indices first instead of adding foods directly to result array to allow them to be pushed in the desired order
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

                            var ethanol = Math.max(getNutritionValue("Alcohol, ethyl"), 0.); // no alcohol for Foundation
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
                                if (fat >= 0 && sugars.Lactose > 0) // check for lactose to identify dairy products
                                {
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
                            filterIngredients.ignored = ingredientName;
                            importIngredients(lib, false, (notFound.length > 0 ? ("Please check values manually for: " + notFound.join(", ")) : null));
                        } else {
                            console.assert(false);
                            return;
                        }


                    }
                }
            }
        }

        function createIngredientRow(name = "", ingredient = null) {
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
                    btn = document.createElement('button');
                    btn.title = "Try to download values from FoodData Central";
                    btn.innerText = "🌐";
                    btn.onclick = onDownloadIngredientData;
                    btn.style = "margin-left: 7px;";
                    cell.appendChild(btn);


                    btn = document.createElement('button');
                    btn.title = "Delete";
                    btn.innerText = "🗑️";
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

        function DisplayIngredients() {
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






        // --- Tools ------------------------------------------------------------------
        const Sugars = {            // g/mol     POD
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

        {
            var pacPodCalc = document.getElementById("PacPodCalculator");
            var pacPodTable = document.createElement('table');
            pacPodTable.id = "pacPodTable";

            var th = document.createElement("thead");
            var tr = document.createElement('tr');
            for (name of ["Name", "%", "PAC", "POD"]) {
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



            var eggTypes = {};
            eggTypes["Bulk"] = 100;
            eggTypes["CD/US Jumbo"] = 70;
            eggTypes["CD/US XL"] = 63;
            eggTypes["CD/US L"] = 56;
            eggTypes["CD/US M"] = 49;
            eggTypes["CD/US S"] = 42;
            eggTypes["EU XL"] = 78;
            eggTypes["EU L"] = 68;
            eggTypes["EU M"] = 58;
            eggTypes["EU S"] = 48;
            eggTypes["GOST В"] = 80;
            eggTypes["GOST О"] = 70;
            eggTypes["GOST 1"] = 60;
            eggTypes["GOST 2"] = 50;
            eggTypes["GOST 3"] = 40;
            eggTypes["AU King-Size"] = 73;
            eggTypes["AU Jumbo"] = 68;
            eggTypes["AU XL"] = 60;
            eggTypes["AU L"] = 52;
            eggTypes["AU M"] = 43;
            eggTypes["NZ Jumbo"] = 68;
            eggTypes["NZ Large"] = 62;
            eggTypes["NZ Standard"] = 53;
            eggTypes["NZ Medium"] = 44;
            eggTypes["NZ Pullet"] = 35;
            eggTypes["BRA Jumbo"] = 70;
            eggTypes["BRA Extra"] = 62.5;
            eggTypes["BRA L"] = 57.5;
            eggTypes["BRA M"] = 52.5;
            eggTypes["BRA S"] = 47.5;
            eggTypes["BRA Industrial"] = 42.5;

            class cEgg {
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


            var yolkCalc = document.getElementById("YolkCalculator");
            var yolkTable = document.createElement('table');
            yolkTable.id = "yolkTable";

            var tbody = document.createElement("tbody");

            tr = document.createElement('tr');
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

            var Egg = new cEgg(selEggType.value);
            for (const key in Egg.Factors) {
                tr = document.createElement('tr');
                var cells = [...nGenerator(2, () => { return document.createElement('td'); })];
                cells[0].innerText = key;

                input = document.createElement('input');
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
                        Egg.Set("Mixture", Recipe.Sums.Amount);
                        UpdateEggYolkValues();
                    };
                    btn.style = "margin-right: 0.66em;";
                    cell.appendChild(btn);
                    btn = document.createElement('button');
                    btn.innerText = "To Recipe";
                    btn.onclick = () => {
                        const value = Egg.Get("Mixture");
                        Recipe.Amount = value;
                        Info("Recipe scaled to " + round(value) + " g");
                    };
                    cell.appendChild(btn);

                    tr.appendChild(cell);
                }

                tbody.appendChild(tr);
            }
            yolkTable.appendChild(tbody);
            yolkCalc.appendChild(yolkTable);

            function InitYolkTable() {
                var inputs = yolkTable.getElementsByTagName("input");
                // for( const input of [...inputs])
                //     console.log( input.value );
                if ([...inputs].every(input => { return input.value == ""; })) {
                    //var Mixture = yolkTable.querySelector( "input[name='Mixture']");
                    Egg.Set("Mixture", Recipe.Sums.Amount);
                    UpdateEggYolkValues();
                }

            }

            selEggType.onchange = function (event) {
                const total = Egg.Get("Total");
                Egg.m_Weight = toFloat(event.target.value);
                Egg.Set("Total", total);
                UpdateEggYolkValues();
            };
            function EggValueChanged(event) {
                Egg.Set(event.target.name, event.target.value);
                UpdateEggYolkValues()

            }
            function UpdateEggYolkValues() {
                for (var input of yolkTable.getElementsByTagName("input"))
                    input.value = round(Egg.Get(input.name));
            }

        }





        // --- Links ------------------------------------------------------------------
        // Build up link list
        {
            const linkData = {
                'Online Books': {
                    'Corvitto, Angelo: Secrets of Ice-Cream. Ice-Cream without Secrets [pdf] 43MB': 'http://www.coquinaria.it/Il_gelato_senza_segreti-Angelo_Corvitto.pdf',
                    'Goff, Douglas: The Ice Cream eBook': 'https://www.uoguelph.ca/foodscience/book-page/ice-cream-ebook'
                },
                'Blogs & Recipes': {
                    'David Lebovitz': 'https://www.davidlebovitz.com/category/recipes/ice-creams-and-sorbets/',
                    'Dream Scoops': 'https://www.dreamscoops.com',
                    'Gelatologist': 'https://medium.com/@gelatologist',
                    'Ice Cream Geek': 'https://www.icecreamgeek.com',
                    'Ice Cream Science': 'http://icecreamscience.com/',
                    'Underbelly': 'https://under-belly.org/category/blog/'
                },
                'Papers': {
                    'Goff, Douglas: Freezing Curve Calculation': 'https://www.uoguelph.ca/foodscience/sites/default/files/FreezingCurveCalculation.pdf',
                    'Mullan, Michael: Controlling the hardness of ice cream, gelato and similar frozen desserts': 'https://fstjournal.org/features/controlling-hardness-ice-cream-gelato-and-similar-frozen-desserts',
                    'Mullan, Michael: Perfect ice cream or gelato. Getting the hardness or "scoopability" just right..': 'https://www.dairyscience.info/index.php/ice-cream/228-ice-cream-hardness.html'

                },
                'Other resourcess for recipe calculation': {
                    'Francisco Borges': 'https://docs.google.com/spreadsheets/d/1fKilMlLa5IFT_kN1hVjlRWHdJ2v2NX5uGIxxYqJA_pQ/edit#gid=1524679757',
                    'Dream Scoops': 'https://www.dreamscoops.com/ice-cream-science/ice-cream-calculator/',
                    'Ice Cream Calculator': 'https://icecreamcalc.com',
                    'Ice Cream Geek Butterfat Calculator': 'https://www.icecreamgeek.com/?page_id=817',
                    'Sandro de Castro': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQPDGPvGa1JusNu8eKJXB3rG8Zc0hCkqeLo_knfOt-gKz2JrM7ZUAB1UrnLpIPbS0gQwQAjonezs77/pubhtml?gid=2133567944#',
                    'FoodData Central a service of the U.S. Department of Agriculture': 'https://fdc.nal.usda.gov/index.html'
                },
                'German': {
                    'Eis machen': 'https://www.eis-machen.de',
                    'H. Kierey': 'https://www.hkierey.de/category/suses-backen/eis/',
                    'Kleine Eisfibel [pdf] 308KB': 'https://www.mueller-gastro.com/images/Eisfibel/Eisfibel.pdf'
                }
            };
            document.getElementById("Links").appendChild(function () {
                var linkList = document.createElement('div');
                for (const section in linkData) {
                    var sectionHeading = document.createElement('h4');
                    sectionHeading.innerText = section;
                    linkList.appendChild(sectionHeading);
                    var ul = document.createElement('ul');
                    for (const item in linkData[section]) {
                        var link = document.createElement('a');
                        link.setAttribute('href', linkData[section][item]);
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'external noopener');
                        link.text = item;

                        var li = document.createElement('li');
                        li.appendChild(link);
                        ul.appendChild(li);
                    }
                    linkList.appendChild(ul);

                }
                return linkList;
            }());
        }





        // --- About ------------------------------------------------------------------
        document.getElementById("Version").innerText = "Version: " + VERSION;

        document.getElementById("btnCheckUpdate").onclick = function (event) {
            class cVersion {
                constructor(versionStr) {
                    versionStr = versionStr.split(/ (.+)/);
                    this.Suffix = versionStr.length > 1 ? versionStr[1] : "";
                    this.Valid = RegExp("^[0-9]+\.[0-9]+\.[0-9]+$").test(versionStr[0]);
                    this.Version = versionStr[0].split('.');
                }
                isNewerThan(other) {
                    return this.Valid && other.Valid
                        && (this.Version[0] > other.Version[0]
                            || (this.Version[0] == other.Version[0] && this.Version[1] > other.Version[1])
                            || (this.Version[0] == other.Version[0] && this.Version[1] == other.Version[1] && this.Version[2] > other.Version[2]));
                }
                isEqual(other) {
                    return this.Valid && other.Valid
                        && (this.Version[0] == other.Version[0] && this.Version[1] == other.Version[1] && this.Version[2] == other.Version[2]);
                }
            }


            if (event.target.innerText === "Download" && typeof event.target.downloadLink === "string") {
                httpRequest = new XMLHttpRequest();
                httpRequest.onreadystatechange = () => {
                    if (httpRequest.readyState === XMLHttpRequest.DONE && httpRequest.status === 200) {
                        var link = document.createElement('a');
                        link.setAttribute('href', URL.createObjectURL(new Blob([httpRequest.responseText], {
                            type: 'text/html'
                        })));
                        link.setAttribute('download', "Ice-Ed.html");
                        clickOn(link);
                    }
                };
                httpRequest.open('GET', event.target.downloadLink);
                httpRequest.send();
            } else {
                httpRequest = new XMLHttpRequest();
                httpRequest.onreadystatechange = () => {
                    if (httpRequest.readyState === XMLHttpRequest.DONE) {
                        if (httpRequest.status === 200) {
                            const releaseInfo = JSON.parse(httpRequest.responseText);
                            const current = new cVersion(VERSION);
                            const latest = new cVersion(releaseInfo.name);
                            if (latest.isNewerThan(current)) {
                                event.target.innerText = "Download";
                                event.target.downloadLink = "https://raw.githubusercontent.com/JoernMueller/Ice-Ed/" + releaseInfo.tag_name + "/IceEd.html";
                                document.getElementById("VersionInfo").innerHTML = 'A newer version <strong>' + releaseInfo.name + '</strong> is available since ' + (new Date(releaseInfo.published_at)).toLocaleDateString()
                                    + '. <a target="_blank" rel="noopener noreferrer" href="' + releaseInfo.html_url + '">Release Info</a>';
                            } else if (latest.isEqual(current)) {
                                document.getElementById("VersionInfo").innerHTML = "You are using the latest release.";
                            }
                        } else
                            ErrorMsg("Failed to get data. HTTP Status: " + httpRequest.status);
                    }

                };
                httpRequest.open('GET', "https://api.github.com/repos/JoernMueller/Ice-Ed/releases/latest");
                httpRequest.send();
            }

        };

        {   // add TOC
            var content = document.getElementById("AboutContent");
            for (var heading of document.getElementById("About").getElementsByTagName("h3")) {
                var link = document.createElement('a');
                link.onclick = function () { heading.scrollIntoView() };
                link.innerText = heading.innerText;
                content.appendChild(link);
                content.appendChild(document.createElement('br'));
            }
        }


        // --- Helper Methods -----------------------------------------------------------

        function gToL(value) { return value / 1100.; }
        function LToG(value) { return 1100. * value; }

        function saveToFile(jsObject, fileName, fileId, fileVersion, replacerFunction = null) {
            var link = document.createElement('a');
            const obj = { id: fileId, version: fileVersion, data: jsObject };
            link.setAttribute('href', URL.createObjectURL(new Blob([JSON.stringify(obj, replacerFunction, '\t')], {
                type: 'application/octet-stream'
            })));
            link.setAttribute('download', fileName);

            clickOn(link);
        }

        function filterPosNumberInput(event) {
            const acceptSeparator = !this.value.includes(decimalSeparator) && !this.value.includes('.');
            const ASCIICode = event.which ? event.which : event.keyCode;
            const isSeparator = String.fromCharCode(ASCIICode) === decimalSeparator || String.fromCharCode(ASCIICode) === '.';
            return (acceptSeparator && isSeparator)
                || (ASCIICode >= 48 && ASCIICode <= 57);
        }
        function filterNumberInput(event) {
            const acceptSeparator = !this.value.includes(decimalSeparator) && !this.value.includes('.');
            const ASCIICode = event.which ? event.which : event.keyCode;
            const isSeparator = String.fromCharCode(ASCIICode) === decimalSeparator || String.fromCharCode(ASCIICode) === '.';
            return (acceptSeparator && isSeparator)
                || (ASCIICode >= 48 && ASCIICode <= 57)
                || (ASCIICode === 45 && event.target.selectionStart === 0); // allow '-' at first position
        }

        function showModal(content, buttons = null) {
            console.assert(content != null && ["string", "object"].includes(typeof content));

            var modal = document.getElementById("Modal");
            modal.style.display = "block";


            var buttonEl = document.getElementById("ModalButtons");
            buttonEl.innerHTML = "";
            if (buttons == null) {
                var closeButton = document.createElement("button");
                closeButton.innerText = "Close";
                closeButton.style = "width: 100%;";
                closeButton.onclick = hideModal;
                buttonEl.appendChild(closeButton);
                window.onclick = function (event) {
                    if (event.target == modal)
                        hideModal();
                };
            } else {
                buttonEl.appendChild(buttons);
            }

            var conentEl = document.getElementById("ModalContent");

            switch (typeof content) {
                case "string":
                    conentEl.innerHTML = content;
                    break;
                case "object":
                    conentEl.innerHTML = ""; // remove current content
                    conentEl.appendChild(content);
                    break;
            }


        }
        function hideModal() {
            document.getElementById("Modal").style.display = "none";
            window.onclick = null;
        }

        function getCSS(element, property) {
            return getComputedStyle(element).getPropertyValue(property);
        }

        function Info(message, timeout = 3) { SetStatusBarMessage("💡 " + message, timeout); }
        function Warning(message, timeout = 6) { SetStatusBarMessage("⚠️ " + message, timeout, "var(--contrast)"); }
        function ErrorMsg(message, timeout = 10) { SetStatusBarMessage("⛔ " + message, timeout, "red"); }
        function SetStatusBarMessage(message, timeout = 5, color = '') {
            var statusbar = document.getElementById("statusBar");
            statusbar.style = color == "" ? "" : ("background-color: " + color + ";");
            statusbar.innerText = message;
            if (timeout > 0) {
                if (SetStatusBarMessage.timeOutID !== undefined && SetStatusBarMessage.timeOutID !== 0)
                    clearTimeout(SetStatusBarMessage.timeOutID);
                SetStatusBarMessage.timeOutID = setTimeout(() => {
                    SetStatusBarMessage.timeOutID = 0;
                    statusbar.innerText = " ";
                    statusbar.style = "";
                }, timeout * 1000);
            }

        }

        function round(value) {
            if (value == 0)
                return 0;
            const precision = 2;
            const decimalShift = Math.max(Math.pow(10, Math.min(precision - Math.floor(Math.log10(Math.abs(value))), 2)), 1);
            return Math.round(value * decimalShift) / decimalShift;
        }

        function* nGenerator(count, functor) {
            var i = 0;
            for (; i < count; ++i) {
                yield functor(i);
            }
            return i;
        }

        function objIsEmpty(obj) {
            return Object.keys(obj).length === 0 && obj.constructor === Object;
        }

        function DamerauLevenshteinDistance(a, b) {
            var i, j;
            const m = a.length, n = b.length;
            if (!m)
                return n;
            if (!n)
                return m;

            var d = [(m + 1) * (n + 1)];

            for (i = 0; i <= m; ++i)
                d[i] = i;
            for (j = 0; j <= n; ++j)
                d[j * (m + 1)] = j;

            for (i = 0; i != m; ++i)
                for (j = 0; j != n; ++j)
                    d[(i + 1) + (j + 1) * (m + 1)] = Math.min(
                        d[i + (j + 1) * (m + 1)] + 1, //deletion
                        d[(i + 1) + j * (m + 1)] + 1,  //insertion
                        d[i + j * (m + 1)] + ((a[i] != b[j]) ? 1 : 0), // substitution                    
                        (i && j && a[i] == b[j - 1] && a[i - 1] == b[j]) ? d[(i - 1) + (j - 1) * (m + 1)] + 1 : Number.MAX_SAFE_INTEGER // transposition
                    );
            return d[m + n * (m + 1)];
        }

        const pickerOpts = {
            types: [
                {
                    description: "Images",
                    accept: {
                        "application/json": [".ier"],
                    },
                },
            ],
            excludeAcceptAllOption: true,
            multiple: false,
        };

        async function getTheFile() {
            // Open file picker and destructure the result the first handle
            const [fileHandle] = await window.showOpenFilePicker(pickerOpts);

            // get file contents
            const fileData = await fileHandle.getFile();
        }

