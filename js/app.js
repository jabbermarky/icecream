        //=====================================================================================================================================================================
        // Import modules
        import { toFloat, clickOn, decimalSeparator, round, objIsEmpty, filterPosNumberInput, filterNumberInput, DamerauLevenshteinDistance } from './utils/helpers.js';
        import { saveIngredientsToFile, parseIngredientsFile } from './utils/file-io.js';
        import {
            Ingredients,
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
            ErrorMsg
        } from './ui/components.js';
        import { showRecipeLibrary } from './ui/recipe-library.js';
        import { initTools, initPACPODCalculator, initGMolCalculator, initYolkCalculator, Sugars, eggTypes, cEgg } from './utils/tools.js';
        import { initModels, Targets, cRecipe } from './models/core.js';
        import {
            initRecipeManager,
            initRecipeButtons,
            SetRecipeModified,
            DisplayRecipe,
            DisplayBackupList,
            getRecipeBackup,
            getRecipeStack,
            UpdateRecipeSums,
            UpdateRecipeInfo
        } from './features/recipe-manager.js';
        import { initIndexedDBStorage } from './storage/indexeddb-storage.js';

        const VERSION = "0.4.0 beta";

        // Module-level variable to hold storage instance
        let recipeStorage = null;

        /**
         * Get the recipe storage instance for other modules
         * @returns {Object|null} Storage instance or null if not initialized
         */
        export function getRecipeStorage() {
            return recipeStorage;
        }

        // Variable to hold InitYolkTable function from tools module
        // Initialized after Recipe is defined
        let InitYolkTable = null;



        const RecipeDataColumns = ["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer"];
        const RecipeColumns = ["Name", "Amount", "Scale to", ""].concat(RecipeDataColumns);
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

        // Load ingredients before continuing (top-level await)
        await loadIngredients();

        // Initialize recipe storage (IndexedDB)
        recipeStorage = await initIndexedDBStorage();

        // --- Recipe -----------------------------------------------------------
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

        // Initialize Recipe with DOM defaults
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

        // Initialize recipe button handlers
        initRecipeButtons({
            btnNewRecipe: document.getElementById('btnNewRecipe'),
            btnStoreAsIngredient: document.getElementById('btnStoreAsIngredient'),
            btnSaveRecipe: document.getElementById('btnSaveRecipe'),
            btnLoadRecipe: document.getElementById('btnLoadRecipe'),
            inputLoadRecipe: document.getElementById('inputLoadRecipe'),
            btnPrintRecipe: document.getElementById('btnPrintRecipe'),
            btnCategorizeRecipe: document.getElementById('btnCategorizeRecipe'),
            btnOptimizeMean: document.getElementById('btnOptimizeMean'),
            btnOptimizeRange: document.getElementById('btnOptimizeRange'),
            btnRestoreRecipe: document.getElementById('btnRestoreRecipe'),
            btnScale: document.getElementById('btnScale'),
            cbxScaleByIngredient: document.getElementById('cbxScaleByIngredient'),
            edTargetWeight: document.getElementById('edTargetWeight'),
            selTargetWeightMode: document.getElementById('selTargetWeightMode'),
            edRecipeName: document.getElementById('edRecipeName')
        });

        // Wire up Recipe Library button
        document.getElementById('btnRecipeLibrary').onclick = () => {
            showRecipeLibrary(recipeStorage, {
                onLoad: (name) => {
                    recipeStorage.loadRecipe(name).then(data => {
                        if (data) {
                            // Import ingredients from stored recipe
                            importIngredients(data.data.Ingredients);
                            // Create new recipe and copy properties
                            const newRecipe = new cRecipe("");
                            for (const key in newRecipe) {
                                if (data.data.Recipe.hasOwnProperty(key)) {
                                    newRecipe[key] = data.data.Recipe[key];
                                }
                            }
                            Recipe = newRecipe;
                            DisplayRecipe();
                            SetRecipeModified(false);
                            Info(`Loaded "${name}" from library`);
                        }
                    });
                },
                onDelete: (name) => {
                    // Delete callback will be fully wired in 13-02
                    console.log('Delete requested for:', name);
                }
            });
        };

        // Target weight input handlers (remain here as they affect DOM elements outside recipe-manager)
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

        // --- Tools ------------------------------------------------------------------
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

        // Expose Recipe and storage to window for testing
        window.Recipe = Recipe;
        window.getRecipeStorage = getRecipeStorage;
