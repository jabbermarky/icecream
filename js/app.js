        //=====================================================================================================================================================================
        // Import modules
        import { toFloat, clickOn, decimalSeparator, round, objIsEmpty, filterPosNumberInput, filterNumberInput, DamerauLevenshteinDistance } from './utils/helpers.js';
        import { saveIngredientsToFile, parseIngredientsFile } from './utils/file-io.js';
        import {
            Ingredients,
            loadIngredients,
            loadIngredientsFromStorage,
            saveIngredientsToStorage,
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
        import { createLibraryRecipeLoader } from './features/recipe-library-load.js';
        import {
            initRecipeManager,
            initRecipeButtons,
            setCurrentRecipeIdentity,
            SetRecipeModified,
            IsRecipeModified,
            DisplayRecipe,
            DisplayBackupList,
            getRecipeBackup,
            setRecipeBackup,
            getRecipeStack,
            UpdateRecipeSums,
            UpdateRecipeInfo
        } from './features/recipe-manager.js';
        import { initIndexedDBStorage } from './storage/indexeddb-storage.js';
        import { initCloudSync, setSyncStatus } from './ui/cloud-sync.js';
        import { initSyncManager, pushRecipe, pushIngredients, deleteRecipeFromCloud } from './storage/sync-manager.js';
        import { APP_VERSION, collectBuildInfo, buildInfoVerdict } from './features/build-info.js';
        import { migrateLegacyRecipes, migrationVerdict, MIGRATION_SUMMARY_KEY } from './features/legacy-migration.js';

        // Single source is package.json; build-info.js re-exports it and a unit
        // test pins the two together. This was "0.4.0 beta" while package.json
        // said 0.5.0 -- two releases of silent drift.
        const VERSION = APP_VERSION;

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

        // Initialize recipe storage (IndexedDB) - needs to be ready for ingredient loading
        recipeStorage = await initIndexedDBStorage();

        // Load ingredients: try library first, fall back to JSON
        const loadedFromLibrary = await loadIngredientsFromStorage(recipeStorage);
        if (!loadedFromLibrary) {
            // First run: load from JSON and bootstrap library
            await loadIngredients();
            await saveIngredientsToStorage(recipeStorage);
        }

        // Initialize sync manager with local storage (listens for auth changes)
        initSyncManager(recipeStorage, {
            onSyncStatusChange: setSyncStatus,
            // Sync skip/refusal warnings (SYNC_WARNINGS vocabulary) are
            // user-actionable — each message says what was left untouched
            // and how to resolve it by hand. The status bar is a single
            // slot (each Warning replaces the previous), so batch multiple
            // warnings into one message and put the full list on the
            // console where nothing overwrites it.
            onSyncWarnings: (warnings) => {
                warnings.forEach(w => console.warn(`Sync warning [${w.code}] ${w.name}: ${w.message}`));
                if (warnings.length === 1) {
                    Warning(warnings[0].message);
                } else {
                    Warning(`${warnings.length} recipes need attention after sync — ` +
                        `first: ${warnings[0].message} (all ${warnings.length} in the browser console)`);
                }
            }
        });

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
            btnExportRecipe: document.getElementById('btnExportRecipe'),
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
            edRecipeName: document.getElementById('edRecipeName'),
            storage: recipeStorage,
            pushRecipe  // Cloud sync callback
        });

        // Initialize cloud sync UI
        initCloudSync({
            btnCloudSync: document.getElementById('btnCloudSync'),
            syncStatus: document.getElementById('syncStatus'),
            Info,
            Warning,
            ErrorMsg,
            showModal,
            hideModal
        });

        // Wire up Recipe Library button
        document.getElementById('btnRecipeLibrary').onclick = () => {
            showRecipeLibrary(recipeStorage, {
                // The handler itself lives in js/features/recipe-library-load.js
                // so the unit lane can drive it — this wiring had zero coverage
                // while guarding the silent-truncation path (P0.5, item 16).
                onLoad: createLibraryRecipeLoader({
                    storage: recipeStorage,
                    setRecipe: (r) => { Recipe = r; },
                    setRecipeIdentity: setCurrentRecipeIdentity,
                    clearRecipeBackup: () => {
                        setRecipeBackup([]);
                        const btn = document.getElementById("btnRestoreRecipe");
                        if (btn) btn.disabled = true;
                    },
                    importIngredients,
                    DisplayRecipe,
                    SetRecipeModified,
                    Info,
                    Warning,
                    ErrorMsg
                }),
                onDelete: async (name) => {
                    const success = await recipeStorage.deleteRecipe(name);
                    if (success) {
                        // Also delete from cloud (fire-and-forget)
                        deleteRecipeFromCloud(name);
                        Info(`Deleted "${name}" from library`);
                    } else {
                        ErrorMsg('Failed to delete recipe.');
                    }
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

        {   // Build + data diagnostics. Answers "what am I actually running, and
            // is my data in the shape this build expects" -- which a deployed app
            // could not previously tell you.
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = String(value);
            };

            const migrateBtn = document.getElementById("btnMigrateLegacy");

            const refreshBuildInfo = async () => {
                setText("BuildVerdict", "Checking…");
                const info = await collectBuildInfo({
                    storage: recipeStorage,
                    getIngredients: () => Ingredients,
                });
                const verdict = buildInfoVerdict(info);

                setText("biVersion", info.version);
                setText("biSchema", info.schemaVersion);
                setText("biIngredients", info.ingredients === null ? "unknown" : info.ingredients);

                const unknown = info.listingFailed || !info.storageAvailable;
                setText("biTotal", unknown ? "unknown" : info.recipes.total);
                setText("biIdentified", unknown ? "unknown" : info.recipes.identified);
                setText("biLegacy", unknown ? "unknown" : info.recipes.legacy);
                setText("biUnreadable", unknown ? "unknown" : info.recipes.unreadable);
                setText("biNewer", unknown ? "unknown" : info.recipes.newer);

                const v = document.getElementById("BuildVerdict");
                if (v) {
                    v.textContent = verdict.message;
                    v.style.color = verdict.level === "warn" ? "#a5342b"
                        : verdict.level === "ok" ? "#2f7a55" : "";
                }

                // The migration has something to do only when this device
                // actually holds legacy records, and only when the counts are
                // real -- offering it against an "unknown" listing would invite
                // a write on a device whose storage just failed to read.
                if (migrateBtn) migrateBtn.disabled = unknown || info.recipes.legacy === 0;
            };

            const setVerdictText = (id, verdict) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.textContent = verdict.message;
                el.style.color = verdict.level === "warn" ? "#a5342b"
                    : verdict.level === "ok" ? "#2f7a55" : "";
            };

            // textContent only, and one <li> per skip built with createElement:
            // record names are user input, and this panel must not become the
            // injection surface issue #13 already tracks elsewhere.
            const renderMigration = (summary) => {
                setVerdictText("MigrationResult", migrationVerdict(summary));
                const list = document.getElementById("MigrationSkipped");
                if (!list) return;
                list.replaceChildren();
                for (const s of (summary.skipped || [])) {
                    const li = document.createElement("li");
                    li.textContent = `${s.name}: ${s.reason}`;
                    list.appendChild(li);
                }
            };

            // A summary parked by the pre-reload stash below. Read once and
            // cleared, so it reports the migration that just happened and not
            // one from an earlier visit.
            try {
                const parked = sessionStorage.getItem(MIGRATION_SUMMARY_KEY);
                if (parked) {
                    sessionStorage.removeItem(MIGRATION_SUMMARY_KEY);
                    renderMigration(JSON.parse(parked));
                }
            } catch { /* no sessionStorage, or unparseable: nothing to report */ }

            const runMigration = async () => {
                // The reload below is unconditional once anything is written, so
                // unsaved edits would go with it. Refuse rather than warn: this
                // is a maintenance action with no deadline, and "your edits are
                // gone" is not a trade the user should be asked to make in a
                // confirm dialog they are already skimming.
                if (IsRecipeModified()) {
                    setVerdictText("MigrationResult", {
                        level: "warn",
                        message: "The open recipe has unsaved changes, and this finishes with a page reload. " +
                            "Save it (or start a new recipe) first, then run this.",
                    });
                    return;
                }

                const proceed = confirm(
                    "Give every older recipe on this device an identity?\n\n" +
                    "SYNC FIRST. This mints a fresh identity for each older recipe, so if " +
                    "a recipe's synced copy already has a different one, the two stop " +
                    "merging until you fix it by hand. Syncing first lets those copies " +
                    "arrive already identified, and they are then left alone.\n\n" +
                    "Run this on the device whose recipes are the current ones. " +
                    "The page reloads afterwards.");
                if (!proceed) return;

                if (migrateBtn) migrateBtn.disabled = true;
                setVerdictText("MigrationResult", { level: "", message: "Working…" });

                const summary = await migrateLegacyRecipes({ storage: recipeStorage });

                if (summary.migrated.length === 0) {
                    // Nothing was written, so the open recipe's identity cannot
                    // be stale: report in place and leave the page alone.
                    renderMigration(summary);
                    await refreshBuildInfo();
                    return;
                }

                // RELOAD IS REQUIRED, not cosmetic. The open recipe's in-memory
                // identity is still null for a record that just gained one, and
                // a save from that state would mint a SECOND id for it. Park the
                // summary first so the reload does not eat the only report of
                // what happened -- including which records were skipped.
                try {
                    sessionStorage.setItem(MIGRATION_SUMMARY_KEY, JSON.stringify(summary));
                } catch { /* the reload still matters more than the report */ }
                location.reload();
            };

            const btn = document.getElementById("btnRefreshBuildInfo");
            if (btn) btn.onclick = () => { refreshBuildInfo().catch(err => console.error(err)); };
            if (migrateBtn) migrateBtn.onclick = () => {
                runMigration().catch(err => {
                    console.error(err);
                    setVerdictText("MigrationResult",
                        { level: "warn", message: "The migration could not be run. Nothing was changed." });
                    // Re-enable, or a transient failure would leave the only way
                    // to retry behind the unrelated Recheck button.
                    refreshBuildInfo().catch(e => console.error(e));
                });
            };
            // Storage initialises asynchronously, so the first pass runs after it
            // settles rather than at script time -- otherwise every count reads
            // "unknown" on a cold load.
            refreshBuildInfo().catch(err => console.error(err));
            window.refreshBuildInfo = refreshBuildInfo;
        }

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
            Sugars,
            storage: recipeStorage,
            pushIngredients  // Cloud sync callback
        });

        // Expose Recipe and storage to window for testing
        window.Recipe = Recipe;
        window.getRecipeStorage = getRecipeStorage;
