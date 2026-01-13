        //=====================================================================================================================================================================
        // Import modules
        import { toFloat, clickOn, decimalSeparator, round, nGenerator, objIsEmpty, filterPosNumberInput, filterNumberInput, DamerauLevenshteinDistance } from './utils/helpers.js';
        import { GetIdealPAC, Fitness } from './features/calculations.js';
        import { DrawFreezingGraph } from './ui/graph.js';
        import { saveToFile, saveIngredientsToFile, parseRecipeFile, parseIngredientsFile } from './utils/file-io.js';
        import {
            cIngredient,
            Ingredients,
            IngredientDataFields,
            loadIngredients,
            IngredientNames,
            SortIngredients,
            isIngredientUsed,
            onIngredientEdit,
            onIngredientDeleted,
            onIngredientFilterEdit,
            filterIngredients,
            createIngredientRow,
            DisplayIngredients,
            diffIngredients,
            importIngredients,
            onDownloadIngredientData,
            initIngredients
        } from './features/ingredients.js';
        import {
            initUIComponents,
            initTabs,
            showModal,
            hideModal,
            Info,
            Warning,
            ErrorMsg,
            getCSS
        } from './ui/components.js';
        import { initTools, initPACPODCalculator, initGMolCalculator, initYolkCalculator, Sugars, eggTypes, cEgg } from './utils/tools.js';
        import { initModels, cTargetValue, cTarget, Targets, cRecipe } from './models/core.js';
        import {
            initRecipeManager,
            SetRecipeModified,
            IsRecipeModified,
            DisplayRecipe,
            CreateRecipeRow,
            UpdateRecipeRow,
            DisplayBackupList,
            SortRecipe,
            BackupCurrentRecipe,
            BackupRecipe,
            RestoreBackup,
            getRecipeBackup,
            setRecipeBackup,
            getRecipeStack,
            clearSortBy,
            UpdateRecipeSums,
            UpdateRecipeInfo,
            onRecipeScaled,
            ToggleIngredientScale,
            gToL,
            LToG
        } from './features/recipe-manager.js';

        const VERSION = "0.4.0 beta";

        // Variable to hold InitYolkTable function from tools module
        // Initialized after Recipe is defined
        let InitYolkTable = null;



        const RecipeDataColumns = ["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer"];
        const RecipeColumns = ["Name", "Amount", "Scale to", ""].concat(RecipeDataColumns);
        // IngredientDataFields is now imported from ingredients.js

        // Initialize models module with RecipeDataColumns dependency
        initModels({ getRecipeDataColumns: () => RecipeDataColumns });

        // replaceAll is currently not everywhere available. Use this polyfill from https://stackoverflow.com/a/14822579
        String.prototype.replaceAll = String.prototype.replaceAll || function (find, replace) {
            return this.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
        };

        // Init tab handlers with callback for tab-specific actions
        initUIComponents({
            onTabSwitch: (tabId) => {
                switch (tabId) {
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
        });
        initTabs();

        // cIngredient, Ingredients, loadIngredients, IngredientNames, SortIngredients
        // are now imported from features/ingredients.js

        var temperatureForTgtHardness = 0;

        // Load ingredients before continuing (top-level await)
        await loadIngredients();

        // cTargetValue, cTarget, and Targets are now imported from models/core.js


        // --- Recipe -----------------------------------------------------------
        // RecipeBackup, RecipeStack, sortBy, sortAsc moved to recipe-manager.js

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

        // cRecipe class is now imported from models/core.js
        // Initialize with DOM defaults
        var Recipe = new cRecipe("", "", {
            Type: tgtSelection.value,
            ServingTemperature: toFloat(slServingTemperature.value),
            Hardness: toFloat(slHardness.value) / 100.0
        });

        // Initialize recipe manager with dependencies
        initRecipeManager({
            getRecipe: () => Recipe,
            setRecipe: (r) => { Recipe = r; },
            getIngredients: () => Ingredients,
            getRecipeDataColumns: () => RecipeDataColumns,
            getRecipeColumns: () => RecipeColumns,
            sliders: { slServingTemperature, slHardness, slOverrun, slScoopSize },
            scoopSizes,
            tgtSelection,
            showModal,
            hideModal,
            Info,
            Warning,
            ErrorMsg
        });

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

        // SetRecipeModified, IsRecipeModified, BackupCurrentRecipe, BackupRecipe,
        // DisplayBackupList, RestoreBackup, SortRecipe, CreateRecipeRow, DisplayRecipe,
        // UpdateRecipeRow, onIngredientChanged, onIngredientAmountEdited, onRecipeIngredientDeleted,
        // UpdateRecipeSums, UpdateRecipeInfo, onRecipeScaled, ToggleIngredientScale, gToL, LToG
        // are now imported from features/recipe-manager.js

        // Fitness function is now imported from calculations.js

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

            const originalFitness = Fitness(localBackup, Recipe, tgtType, fitnessFields, cTargetValue, OptimizeForMean);

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
                        const candidateFitness = Fitness(candidate, Recipe, tgtType, fitnessFields, cTargetValue, OptimizeForMean);
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
                getRecipeBackup().push(cRecipe.copyFrom(localBackup));

            document.getElementById("btnRestoreRecipe").disabled = getRecipeBackup().length == 0;


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
            const RecipeBackup = getRecipeBackup();
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

        document.getElementById('btnNewRecipe').onclick = () => {
            BackupCurrentRecipe();
            Recipe = new cRecipe("");
            setRecipeBackup([]);
            clearSortBy();
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
                var dataObj = parseRecipeFile(reader.result);

                if (!dataObj) {
                    ErrorMsg("Invalid file format in: " + event.target.files[0].name);
                    return;
                }

                function loadRecipe() {
                    importIngredients(dataObj.data.Ingredients);

                    setRecipeBackup([]);
                    Recipe = new cRecipe("");
                    clearSortBy();

                    for (const key in Recipe) {
                        if (dataObj.data.Recipe.hasOwnProperty(key)) {
                            Recipe[key] = dataObj.data.Recipe[key];
                        }
                    }
                    DisplayRecipe();
                    SetRecipeModified(false);
                }

                BackupCurrentRecipe();
                const RecipeStack = getRecipeStack();
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

        document.getElementById('edTargetWeight').onkeyup = (event) => {
            if ((event.which ? event.which : event.keyCode) === 13) {
                event.preventDefault();
                document.getElementById("btnScale").click();
                return false;
            }
        };
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
        document.getElementById('cbxScaleByIngredient').addEventListener('change', ToggleIngredientScale);




        // --- Ingredients -----------------------------------------------------------

        document.getElementById('btnSaveIngredients').onclick = () => {
            saveIngredientsToFile(Ingredients);
        };
        document.getElementById('btnLoadIngredients').onclick = (event) => { clickOn(document.getElementById("inputLoadIngredients")); };
        document.getElementById('inputLoadIngredients').onchange = (event) => {
            var reader = new FileReader();
            reader.onload = function () {
                var dataObj = parseIngredientsFile(reader.result);
                if (dataObj) {
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

        // Ingredient functions (diffIngredients, importIngredients, filterIngredients,
        // onIngredientEdit, isIngredientUsed, onIngredientDeleted, onDownloadIngredientData,
        // createIngredientRow, DisplayIngredients) are now imported from features/ingredients.js


        // --- Tools ------------------------------------------------------------------
        // Tools are now imported from utils/tools.js
        // Initialize tools module with Recipe dependency
        initTools({ getRecipe: () => Recipe });

        // Initialize calculator UIs
        initPACPODCalculator();
        initGMolCalculator();
        ({ InitYolkTable } = initYolkCalculator());





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

        // gToL, LToG are now imported from recipe-manager.js
        // filterPosNumberInput, filterNumberInput are now imported from helpers.js
        // showModal, hideModal, getCSS, Info, Warning, ErrorMsg, SetStatusBarMessage are now imported from ui/components.js
        // round, nGenerator, objIsEmpty, DamerauLevenshteinDistance are now imported from helpers.js

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

        // Initialize ingredients module with UI dependencies
        initIngredients({
            showModal,
            hideModal,
            Warning,
            Info,
            DisplayRecipe,
            getRecipeContext: () => ({ Recipe, RecipeBackup: getRecipeBackup(), RecipeStack: getRecipeStack() }),
            Sugars
        });

        // Expose additional objects to window for testing
        // Note: Ingredients, IngredientNames, SortIngredients, isIngredientUsed,
        // diffIngredients, onDownloadIngredientData, DamerauLevenshteinDistance
        // are now exposed by the ingredients module
        window.Recipe = Recipe;

