# Churn Log Audit — 29 Binder Pages

**Source:** 29 photographed printout sheets from Mark's own Ice Ed app (`IMG_2453`–`IMG_2481`), Aug 2024 – Apr 2026 (print timestamps). **The print format evolved across the period** — see 2.6, where that turns out to matter.
**Purpose:** derive the real schema for a churn sheet, the process variables that matter, the actual outcome vocabulary, a completeness test on the paper record, and the prose-vs-marks ratio that determines how much of the return path is worth building.

**Method:** every page read at full resolution; printed table data and handwritten ink transcribed separately. Quotes below are verbatim, including spelling, strikeouts, and punctuation. Anything not in quotes and not on the page is my inference and is marked *(inferred)*.

**Three corrections to the brief up front, before the findings:**

1. **It's 29 batches, not 20.** Confirmed with Mark: **every one of these 29 recipes was churned.** No sheet here is a draft.

2. **Which makes the headline finding this: 14 of the 29 batches you churned produced no recorded result.** Not 14 formulas you never made — 14 evenings of work whose outcome is gone. Another one (Strawberry V2) recorded only how the *base* tasted and never the finished ice cream. **Fifteen of 29 batches — 52 % — have a verdict.** Everything in Part 2.4 follows from that number.

3. **One page per recipe version is not one page per batch.** Mexican Chocolate v1 says "Double Recipe" — the printed table is half the mass actually made. Six pages carry handwritten overwrites of the printed gram amounts. On those pages, the printed formula is *not* the as-made formula. Reconstructability depends on reading the ink, not the table.

**And one thing that is now permanently unrecoverable.** Asked what was happening on the silent sheets — batch was fine and unremarkable, or the evening just ended and it never got written — the answer was *a mix of both, can't tell now.* That is the correct answer and it's also the most expensive one, because it means **silence in this binder carries no information in either direction.** You can't mine the 14 blanks for weak positives, and you can't treat them as known losses. They're just holes. This constrains the sheet design more than anything else in the audit: see 2.4.

---

## Part 1 — Page-by-page

Format per page: **recipe/version** · what changed & whether the page says so · process variables written down · **outcome, verbatim** · reconstructable? · marks-vs-prose call.

---

### 1. IMG_2453 — Mexican Chocolate v1
*Printed 12/12/25 11:20 PM · handwritten date "12/13/2025"*

**Spec:** Gelato · Serving Temp −15 °C · Hardness 75 % · Overrun 30 % · 793 g · 166 kcal/100 g · 262 PAC (target 220–230) · 151 POD (110–120) · 1.74 PAC:POD · 38.4 % solids · 5.6 % fat · 10.7 % MSNF · 0.35 % stabilizer. Stabilizer error flagged **50.2 %**.

**Change from previous:** none — first version. Page says so implicitly (v1).

**Process written down:** printed "1 Pinch of Cayenne Pepper / Sous Vide for ~~45~~ **60** minutes @ ~~75C~~ **176F**" (both handwritten overwrites) · "Chill Base Overnight. Very Thick in morning. 40+ minutes to Churn." · "Double Recipe"

> ⚠️ **75 °C ≠ 176 °F.** 176 °F is 80 °C. The overwrite silently moved the sous vide target 5 °C, and the unit flipped mid-line.

**Outcome, verbatim:**
> "Sweetness Good"
> "Hard straight from Freezer"
> "But scoopable"

**Next-version delta, verbatim:**
> "To fix: lower Stabilizer to 2.5g/Kg / increase fat to 8%, 9-11% optimal. / Dextrose 86g →55g / Allulose +30g"

**Reconstructable today?** Formula yes. Batch **no** — "Double Recipe" means the as-made mass is 1586 g, and nothing records draw temp, churn end point, or which machine.

**Marks vs prose:** "Sweetness Good" = scale. "Hard straight from Freezer / But scoopable" = two independent marks (hardness, scoopability) — the "But" is redundant once both are separate fields. The four "To fix" lines are neither marks nor prose: they're **structured next-version deltas** (ingredient, direction, target value). All mark-able.

---

### 2. IMG_2454 — Mexican Chocolate v3
*Printed 1/13/26 7:06 PM · zero handwriting*

**Spec:** Gelato · −16 °C · 75 % · Overrun **20 %** (down from 30) · 772 g · 146 kcal · 290 PAC · 149 POD · 36.2 % solids · 6.0 % fat.

**Change from previous:** cocoa 30→16.1, sucrose 50→46.2, dextrose **86→45**, DSMP 39→34.6, cream 67→77.4, stabilizer 5→1.96, **allulose 36.8 g added**. The page *does* say so — the v1 fix-list was typed into the tool's notes field. **v2 is missing from the binder.**

**Process written down (all printed):** "1 Pinch of Cayenne Pepper / Sous Vide for 60 minutes @ 75C / Chill Base overnight / (very thick in morning) / 40+ minutes to churn"

**Outcome, verbatim:**
> "Observations:
> sweetness is good
> hard straight from freezer"

**⚠️ These are v1's observations, retyped.** They are not a v3 result.

**This is the single most dangerous page in the binder.** The batch was churned. The sheet has a field labelled "Observations:" and that field is *populated* — so the page reads as though it has a result. But the text in it belongs to a batch made a month earlier, on a formula with 2× the cocoa, no allulose, and 86 g of dextrose instead of 45. Nothing marks it as stale. Every other silent page at least admits it's silent; this one lies.

**Reconstructable?** Formula yes. **Result: lost, and actively impersonated.**

**Marks vs prose:** the migration from ink to typed field is the signal here — when he retyped his own handwriting, he dropped "But scoopable" and dropped "Double Recipe." **Free-text round-tripping loses data.**

---

### 3. IMG_2455 — Strawberry V1
*Printed 9/2/24 11:07 AM*

**Spec:** Gelato · −15 °C · 75 % · 10 % · 1400 g · 151 kcal · 1.27 L base → 1.4 L ice cream.

**Change from previous:** first version. Printed header: "based on stabilizer mix from Mocha recipe / cream has Gellan gum: reducing guar gum / target 0.28% stabilizers / water weight: 2.64 / 947 = 0.28% / target 40% fruit weight / total weight: 518 / 1400 = 37%"

**Process:** "Sous Vide for 45 minutes @ 77C" (printed) · "• Blend all strawberries after cooking down with All Dry (Except SMP) • Blend 2 minutes" · "mixin Frozen Strawberries"

**Outcome, verbatim:**
> "Not very sweet. Could be sweeter."
> "Strawberry flavor is good. Could use more."
> "Flaky, not creamy, Dry. (maybe cooked too much water?)"
> "Coming out of Fridge/Freezer Temp = ⁻18°c  Too hard to scoop"

**Reconstructable?** Formula yes. Process mostly yes. Missing: churn time, draw temp, machine.

**Marks vs prose:** 9 mark-able ("not very sweet," "could be sweeter," "flavor is good," "could use more," "flaky," "not creamy," "dry," "too hard to scoop," −18 °C as a number). **1 irreducibly prose: "(maybe cooked too much water?)"** — a hedged causal hypothesis. That single parenthetical is what produced V2's "Don't Cook Fruit." **The checkbox-able parts described the failure; the prose parenthetical caused the fix.**

Note the doubling: "flavor is good" *and* "could use more" are about the same ingredient on two different axes (quality vs. intensity). A single 1–5 "strawberry flavor" field collapses them and loses the actionable half.

---

### 4. IMG_2456 — Strawberry V2

**Spec:** Gelato · −15 °C · 75 % · 10 % · 982 g · 156 kcal.

**Change from previous:** strawberries 518→100 fresh **plus 56 g dried strawberry** (new ingredient); milk 400→500; cream 208→140; dextrose 112→71; DSMP 120→57; all four gums removed, lecithin 1→2.5. **Massive rebuild — and the page does not say so.** No printed change note, no "based on" line. Only the handwritten "Don't Cook Fruit." hints at the reason, and only if you've read V1.

**Process:** "Sous Vide 45min @ 77" · "Age Overnight"

**Outcome, verbatim:**
> "Don't Cook Fruit."
> "Good Flavor in Sweet Cream"
> "Sweet cream is thick"

**Reconstructable?** Formula yes. **Rationale no** — without V1 in hand you cannot tell why the fruit strategy changed.

**Marks vs prose:** 2 mark-able, but both need a **stage** dimension ("in Sweet Cream" = pre-churn, not finished product). There is no finished-product observation on this page at all. He tasted the base and never wrote down how the ice cream came out.

---

### 5. IMG_2457 — Strawberry V2.1
*Printed 9/14/24 12:04 PM*

**Spec:** Gelato · −17 °C · Hardness **70 %** · 10 % · 869 g · 166 kcal.

**Change from previous:** sucrose 40→12, dextrose 71→**119**, dried strawberry 56→28, fresh 100→106, cream 140→100, DSMP 57→50, salt added; milk **447 overwritten to 449** in ink. Serving temp −15→−17, hardness target 75→70. The page does not say why.

**Process:** "77°c 45 minutes / 4hr. Aging"

**Outcome, verbatim:**
> "Medium Hard,
> Dry.
> Not as Hard as Strawberry V2
> Not as Soft as Mocha"

**Reconstructable?** Formula yes (read the ink: 449 not 447).

**Marks vs prose:** "Medium Hard" and "Dry" are marks. **"Not as Hard as Strawberry V2 / Not as Soft as Mocha" is the clearest prose-required item in the binder** — it's a *paired comparison against two other named batches*, and it's how he actually calibrates. No 1–5 scale captures it; a "harder than / softer than [batch]" relation field would. This is the single strongest argument for a comparison primitive in the schema.

---

### 6. IMG_2458 — Mango on Light Base
*Printed 8/11/24 2:10 PM*

**Spec:** Gelato · −15 °C · 75 % · 10 % · 1125 g · 175 kcal. Fat error **20.5 %**, POD error 9.65 %. Vanilla Extract struck through on the page.

**Change from previous:** first mango version.

**Process written down — the most complete process log in the whole binder:**
> "Cook mango ~10 minutes on low with ½ Sucrose
> Blend mix with mango 1 ½ minutes.
> Sous Vide 75°C 1 hour, 55 minutes
> Homogenize 1 minute
> Ice Bath: 15 minutes 40°
> Aging 4 hrs 15 min.
> Churn ~20 minutes
> freeze overnight"

**Outcome, verbatim:** *none.* The faint writing on the right of this photo is show-through from the Mango 2 sheet behind it, not writing on this page.

**Reconstructable?** Process fully. **Result not at all.** This is a complete method with no verdict attached — the batch happened and the evaluation vanished.

**Marks vs prose:** zero outcome statements. All eight lines are structured process fields (step, duration, temp). Every one is a form field, not prose.

---

### 7. IMG_2459 — Mango 2 on Light Base
*Printed 8/14/24 9:39 PM*

**Spec:** Gelato · −15 °C · 75 % · 10 % · 1377 g · 164 kcal.

**Change from previous:** mango **200→401** (doubled), cream 220→240, sucrose 42→30, dextrose 76→100, DSMP 70→84. Page doesn't state the deltas; you have to diff the tables.

**Process:** "Sous vide 1 hr. / Age overnight 8 hrs. / All sucrose with mango, heat for ~15 minutes on 5 / Churn ~20 minutes / Freeze 8 hrs."

**Outcome, verbatim:**
> "Really Good Texture — Best yet."
> "Not too sweet. Good Mango flavor. could have more Mango."
> "Try Stabilizer mix from Mocha + 77°C sous vide"

**Reconstructable?** Yes — formula, method, and next step are all present. **This is the most complete page in the binder.**

**Marks vs prose:** 4 mark-able; **1 prose: "Best yet."** — a ranking claim over the whole prior history, not a value on an axis. Capturable as a "personal best so far" flag, but only if the system knows the ordering.

---

### 8. IMG_2460 — Mango V3

**Spec:** Gelato · −14 °C · 75 % · 10 % · 1380 g · 152 kcal.

**Change from previous:** the four-gum stabilizer system reintroduced (LBG 0.52, guar 0.42→**0.5** in ink, carrageenan 0.26, lecithin 1.3); mango 401→518; cream 240→208; milk 433→**436** in ink; dextrose 86.4→**86** in ink. Printed header states it: "based on stabilizer mix from Mocha recipe + more mango / cream has Gellan gum - reduce Guar gum to 0.2 / Sous Vide for 45 minutes @ 77C"

**Process:** "Blend 1 minute high."

**Outcome, verbatim:**
> "A little Hard, Mixture was really thick before Churning.
> Flavor Good. Sugar Good."
> "Less Guar — remember Gellan from Cream."

**Reconstructable?** Formula yes if you read ink (guar 0.5, not 0.42). **Contradiction on the page:** the printed header says "reduce Guar gum to 0.2," the table says 0.42, and the ink says 0.5. Three values, no resolution.

**Marks vs prose:** 4 mark-able (hardness, pre-churn viscosity + stage, flavor, sweetness). **1 prose: "Less Guar — remember Gellan from Cream."** — a note-to-self about a *hidden ingredient in a purchased ingredient*. It's not an observation about this batch at all; it's ingredient metadata he keeps re-learning. Belongs in the ingredient record, not the churn sheet.

---

### 9. IMG_2461 — Banana Cream Pie v1

**Spec:** Gelato · −14 °C · 75 % · 30 % · 1086 g · 166 kcal · 268 PAC · 133 POD · 7.2 % fat. Stabilizer set to **0** with error flagged 216 %.

**Change from previous:** first version.

**Process:** "Sous Vide 176 :45" — that is the entire handwritten content of the page.

**Outcome, verbatim:** *none.*

**Reconstructable?** Formula yes. Everything else no.

**Marks vs prose:** one number pair. Nothing else.

---

### 10. IMG_2462 — Banana Cream Pie v2B

**Spec:** **Premium** (type changed from Gelato) · −14 °C · 75 % · 30 % · 771 g · 211 kcal · 12.9 % fat (up from 7.2). Printed header: "Based on Pistachio V2."

**Change from previous:** batch halved; cream 200→250 vs milk 512→250 (fat nearly doubled); stabilizer 0→3.2; salt added; sucrose 60→43, dextrose 77→44. The "Based on Pistachio V2" line explains the *architecture* change. **v2 (non-B) is missing from the binder** — the "B" implies at least one sibling variant that isn't here.

**Process:** none. **Outcome:** none.

Handwriting on this page: checkmarks, and milk/cream **250 overwritten to 249** on both lines. Everything else legible in the photo is **bleed-through from the v3 sheet stacked behind it.**

**Reconstructable?** Formula yes (249/249). **Result: none recorded.**

**Marks vs prose:** nothing to classify. This batch was churned and left no trace beyond two ink corrections — which is itself informative: you were at the bench, pen in hand, adjusting amounts as you weighed. The pen was there. The result still didn't get written.

---

### 11. IMG_2463 — Banana Cream Pie v3
*Printed 12/12/25 9:42 PM · handwritten "12/13/2025"*

**Spec:** Premium · −14 °C · 75 % · 30 % · 775 g · 213 kcal · 252 PAC · 130 POD.

**Change from previous:** sucrose 43→46, dextrose 44→43, banana 139→135, **6 g vanilla added**. Printed header now carries the method: "Based on Pistachio V2 / convection roast bananas at 350 F, 20 - 30 minutes / mix the bananas into the sweet cream base before sous vide / sous vide at 176F for 45 minutes"

**Outcome, verbatim:**
> "Hard from freezer, notscoopable
> Consistency smooth
> Sweetness ~~Good~~ Perfect
> −17C out of Freezer, try increase Serving Temp"

**Reconstructable?** Yes — this is the second-most-complete page.

**Marks vs prose:** all 4 mark-able, plus one measured number (−17 °C). **The strikeout is data**: he wrote "Good," rejected it, and upgraded to "Perfect." A dropdown that only stores the final value loses the fact that he deliberated. Minor, but it tells you his scale has a level above "Good" that he uses sparingly.

---

### 12. IMG_2464 — Mocha

**Spec:** Gelato · −14 °C · 75 % · 30 % · 853 g · 163 kcal. Solids error 6.95 %.

**Change from previous:** first version. Ink overwrites: milk 500→**502**, guar 0.5→**0.2**, cream 67→**70**, coffee beans 30→**15**.

**Process:** "Sous vide @ 77°c for 45 minutes" · "* Cream has Guar 0.5%"

**Outcome, verbatim:**
> "Base is Potent! maybe too much cocoa + coffee"
> "Really strong cocoa.
> Very smooth.
> Not Hard."

**Reconstructable?** Formula only with the ink (coffee 15 g, not 30 g — a 2× error if you trust the table).

**Marks vs prose:** 3 mark-able (cocoa intensity, smoothness, hardness). **1 prose: "Base is Potent! maybe too much cocoa + coffee"** — a hedged attribution across *two* ingredients simultaneously. This one line drove Mocha v2's simultaneous cocoa 60→30 and coffee 15→8. A per-ingredient intensity scale would have captured "cocoa too strong" but not the joint hypothesis or the hedge.

---

### 13. IMG_2465 — Mocha v2

**Spec:** Gelato · **−16 °C** · 75 % · 30 % · 795 g · 164 kcal.

**Change from previous:** printed and explicit — "updated 12/23/2024 / reduced Coffee from 15g to 8g, reduced Cocoa from 60g to 30g / cream has Gellan gum - reduce Guar gum to 0.2, Sous Vide for 45 minutes @ 75C". Also sucrose 42→46, dextrose 105→89, DSMP 33→39, fructose added.

**Handwriting:** checkmarks and a carrageenan edit to "0.5". Nothing else.

**Process:** printed only. **Outcome:** none.

**Reconstructable?** Formula yes. **This is the best change-documentation on any page in the binder** — and it's typed, not handwritten. Note it also references the *previous* value ("from 15g to 8g"), which no handwritten page ever does.

**Marks vs prose:** no outcome. The change note is a clean structured delta: `{ingredient, from, to}` ×2.

---

### 14. IMG_2466 — Mocha v3

**Spec:** Gelato · −15 °C · 75 % · 30 % · 794 g · 164 kcal · 261 PAC · 150 POD · 38.5 % solids · 5.6 % fat.

**Change from previous:** printed — "updated 12/23/2024 / reduced Coffee from 8g to 6g / cream has Gellan gum - reduce Guar gum to 0.2 / Sous Vide for 45 minutes @ 75C". Plus sucrose 46→50, dextrose 89→86, guar 0.5→0.5, coffee 8→6.

**Zero handwriting. No outcome.**

**Reconstructable?** Formula yes. **Result: none recorded.**

**The Mocha arc is the clearest case of an outcome surviving only as a formula delta.** Coffee goes 30 → 15 → 8 → 6 across four churned batches; cocoa goes 60 → 30. Exactly one of those four batches (v1) has a verdict: "Base is Potent! maybe too much cocoa + coffee." You can *infer* that v2 was still too strong, because v3 cut the coffee again. But that inference lives in the shape of the next formula, not in any note. **The binder encodes results implicitly, in deltas, and only a reader who diffs consecutive sheets can recover them.**

---

### 15. IMG_2467 — Cherry Garcia

**Spec:** Gelato · −15 °C · 75 % · 10 % · 930 g · 181 kcal.

**Change from previous:** first version. Printed header is **wrong/stale** — "based on stabilizer mix from Mocha recipe + more mango" — copied from Mango V3 and never edited. Ink overwrites: guar 0.48→**0.23**, dark chocolate 88→**48**, and a **handwritten ingredient row added: "Vanilla | 5"** (not in the printed table, so not in any of the computed totals).

**Process:** "Cooked Cherries, Strained Juice into cream, Chill fruit / Bath @ 77°c 45 min"

**Outcome, verbatim:**
> "Too much Vanilla"

**Reconstructable?** **No.** The vanilla that ruined it was added by hand outside the model; the sums, PAC, POD, and solids on this page all exclude it. The page records a defect caused by an ingredient the page's own math doesn't know about.

**Marks vs prose:** 1 mark ("Too much Vanilla" = per-ingredient, signed direction). But it only means something if the ingredient list is right, which it isn't. **The strongest completeness failure in the binder.**

---

### 16. IMG_2468 — Cherry Garcia v2

**Spec:** Gelato · −14 °C · 75 % · 10 % · 971 g · 167 kcal · 269 PAC · 121 POD · 2.22 PAC:POD. POD error 21.5 %, stabilizer error 247 %.

**Change from previous:** **vanilla 5→3** (now a real table row — the handwritten row got formalized), cream 50→**150**, dark chocolate removed from the base entirely and moved to a mix-in, sucrose 26→30, dextrose 80→86, guar 0.48→0.25, carrageenan 0.29→0.1. Printed: "Sous Vide for 45 minutes @ 80C / add chocolate chunks while churning". The vanilla reduction is visible in the tables but **the page never says it was in response to "Too much Vanilla."**

**Process:**
> "1 cherry w/out Pit = ~10g
> mixin ¼ C chocolate chips, chopped
> Pre-Chill Bowl 15 minutes
> added Mixins @ 45 minutes (too late)"

**Outcome, verbatim:**
> "Good sweetness..
> Not enough ~~enough~~ cherry Flavor
> Cook fruit next time."

**Reconstructable?** Yes, mostly. "1 cherry w/out Pit = ~10g" is a genuinely reusable measurement — a unit-conversion fact, not a batch observation.

**Marks vs prose:** 2 mark-able. **1 prose-ish: "added Mixins @ 45 minutes (too late)"** — a timestamp plus a graded process critique. The number is a field; "(too late)" is a judgment relative to an unrecorded correct time. A "mix-in added at [min]" field plus a "too early / right / too late" mark captures it exactly.

---

### 17. IMG_2469 — Peppermint on UBLB v1

**Spec:** Gelato · −15 °C · 75 % · 10 % · 504 g (smallest batch) · 186 kcal · 259 PAC · 138 POD. Fat error **52.8 %**, MSNF error **74.2 %** — both large and both ignored. Two "Peppermint Candy" rows, one at 0.

**Change from previous:** first version. "UBLB" = presumably an unnamed base recipe *(inferred)*; the base isn't in the binder.

**Process:**
> "No Sousvide. 43 minutes in Whynter from room temp Base."

**Outcome, verbatim:**
> "A Tad too strong on Peppermint. A tad too Sweet."

**Reconstructable?** Formula yes. **Base no** — "UBLB" is undefined anywhere in the binder.

**Marks vs prose:** 2 mark-able, but note the form: **"a tad too X" — a signed magnitude, not a quality rating.** This is the only page that names the machine ("Whynter") and the only one that records the *starting* temperature of the base ("from room temp").

---

### 18. IMG_2470 — Peppermint v2
*Printed 1/26/25 3:17 PM · handwritten "1/26/2025"*

**Spec:** Gelato · −14 °C · 75 % · 10 % · 947 g · 160 kcal · 256 PAC · 131 POD · 8.0 % fat · 12.0 % MSNF. Stabilizer error 242 %.

**Change from previous:** all four gums replaced by "Stabilizer Mix 4421" 2.7 g; batch nearly doubled 504→947; peppermint candy 23→47; peppermint extract 2.0→3.1; vanilla 6→14; sucrose 23→40.

**⚠️ This page nearly fooled me, and the reason is a finding.** In grams, the extract went *up* 55 % and sucrose *up* 74 % — which reads as ignoring v1's "A Tad too strong on Peppermint. A tad too Sweet." In concentration, both came **down**:

| | v1 | v2 | |
|---|---|---|---|
| Batch | 504 g | 947 g | +88 % |
| Peppermint extract | 0.397 %  | 0.327 % | **−18 %** |
| Sucrose | 4.56 % | 4.22 % | −7 % |
| Total sugar | 20.9 % | 19.8 % | −5 % |

**Both corrections were applied correctly.** They're invisible because the batch size moved at the same time, and the sheet records grams.

**Design consequence, and it's a real one:** across 29 pages, batch mass ranges from 504 g to 1709 g. **Any version-to-version comparison in absolute grams is meaningless**, and it will mislead you specifically when you scale a recipe — which you do often (Mexican Chocolate "Double Recipe," Peppermint 504→947, Pistachio v3.1→2L). The delta block in 2.1 must express changes in **% of batch or PAC/POD contribution, not grams**, or it will encode the opposite of what you did.

**Handwriting:** the date. Nothing else. **No process, no outcome.**

**Reconstructable?** Formula yes. **Result: none recorded** — so whether the −18 % peppermint landed at "right" or overshot to "not enough" is unrecoverable.

---

### 19. IMG_2471 — Coconut, Allrecipes.com

**Spec:** **Super-Premium** · −15 °C · 75 % · 30 % · 1292 g · 244 kcal · 41.9 % solids · **16.7 % fat, only 3.7 % milk fat** · 6.0 % MSNF.

**Change from previous:** first version, sourced externally (title names the source).

**Process:** none written.

**Outcome, verbatim:**
> "EPIC FAIL."
> "Coconut fat congealed and froze into hard blobs."
> "yeah!! ☺"

**Reconstructable?** Formula yes. Method: no. But the failure mechanism is fully diagnosed in one sentence, which is worth more than the method here.

**Marks vs prose:** 1 mark ("EPIC FAIL" = overall verdict, bottom of scale — though a 1–5 loses the emphasis). **1 irreducibly prose: "Coconut fat congealed and froze into hard blobs."** No checkbox anticipates this. It's a *novel failure mode* — a defect not on anyone's list until it happens. **This is the case that proves the sheet must always have an open field.** The "yeah!! ☺" is affect: unqueryable, photograph-only, and probably the most human thing in the binder.

---

### 20. IMG_2472 — Coconut v2

**Spec:** Super-Premium · −16 °C · 75 % · 30 % · 801 g · 175 kcal · 288 PAC · 136 POD · 13.8 % fat / **9.6 % milk fat** (up from 3.7). Fat error 4.49 %, solids error **68.2 %**.

**Change from previous:** **coconut cream 400 g → coconut milk 200 g** — the direct fix for the congealing; cream 88→190; shredded coconut removed from the formula (moved to a timed mix-in); milk 500→250. The page does not say this responds to v1, but the change is unmistakable.

**Process:**
> "Churned on Fast/Hard
> Warm Coconut Milk until Solids melt.
> @ 30 minutes, added ¼ C shredded Coconut (unsweetened)
> ~35 min. Churn Time
> −8C Draw Temp"

**Outcome, verbatim:** *none.*

**Reconstructable?** Process yes — and this page carries **the only recorded draw temperature in the binder** (−8 °C) alongside a churn time and a speed setting. Result: unrecorded.

**Marks vs prose:** zero outcome statements; five clean structured process fields including a machine-speed categorical.

---

### 21. IMG_2473 — Pistachio v1

**Spec:** Premium · −14 °C · 75 % · 30 % · 940 g · 207 kcal · 245 PAC · 130 POD · 12.3 % fat. Food splatter on the page.

**Change from previous:** first version.

**Process:**
> "*176° for 45min.
> Blanch ½ C Pistachios (Raw, unsalted) + remove husks. Do Before Churn.
> Add Blanched P. @ end of Churn."

**Outcome, verbatim:** *none.*

**Reconstructable?** Formula and method yes; result no.

---

### 22. IMG_2474 — Pistachio v2
*Printed 1/17/25 5:42 PM*

**Spec:** Premium · −14 °C · 75 % · 30 % · 945 g · 209 kcal · 243 PAC · 130 POD.

**Change from previous:** sucrose 52→51, dextrose 100→102, pistachio paste 41→45. Trivial deltas; the page doesn't flag them.

**Process:** "176 for :45"

**Outcome, verbatim:**
> "Good Sugar
> Good Texture
> Easy to Scoop
> Not Gummy
> Good Melt.
> Good Pistachio flavor"

**Also on the page — the stabilizer mix decoded:**
> "4 Lecithin  20
> 4 LBG       20
> 2 Guar      10
> 1 Carrageenan 5"

That's the "4421" recipe — a 4:4:2:1 ratio, with gram amounts for a batch. **This is reference data hiding on a batch page**, and it is the only place in the binder where "Stabilizer Mix 4421" is defined. Every later page that lists "Stabilizer Mix 4421" is uninterpretable without this sheet.

**Reconstructable?** Yes.

**Marks vs prose:** **six clean marks, zero prose.** The most checkbox-ready page in the binder — and, revealingly, the batch he was happiest with. When everything works he writes marks; when something fails he writes sentences.

---

### 23. IMG_2475 — Pistachio v3
*Printed 1/26/25 3:13 PM · handwritten "1/26/2025"*

**Spec:** Premium · −14 °C · 75 % · 30 % · 1044 g · 218 kcal · 245 PAC · 130 POD · 13.6 % fat. Solids error 12.7 %, stabilizer error 26.7 %.

**Change from previous:** four separate gums replaced by "Stabilizer Mix 4421" 2.76 g; batch 945→1044; cream 225→289; DSMP 19→22.

**Process:**
> "176 :45min.
> Boiled 1c water / Add ½ c Pistachio / Boil 3 minutes / Ice water Bath / Remove Husks
> Bake @ 350 for 15-30 min.
> Toasty Pistachios / Crack/Chop Coarse / Add in last 5 minutes."

**Outcome, verbatim:** *none.* — and this after v2, which he clearly liked. The method got substantially more elaborate and the result went unrecorded.

**Reconstructable?** Method yes, richly. Result no.

---

### 24. IMG_2476 — Pistachio v3.1
*Handwritten "2/7/2025"*

**Spec:** Premium · −14 °C · 75 % · 30 % · 1043 g · 218 kcal.

**Change from previous:** cream spec changed to "Cream, Heavy 0.5%" (i.e. cream containing 0.5 % stabilizer *(inferred)*), stabilizer mix 2.76→2. Nothing else.

**Handwriting:** the date. Nothing else. No process, no outcome.

**Reconstructable?** Formula yes. **Result: none recorded.** Note the position in the arc: v2 is the one batch you praised in six clean marks, and v3, v3.1, and the 2L scale-up that followed it are all silent. **Everything after your best result went unrecorded** — including the scale-up, which is the one batch where you'd most want to know whether the recipe survived doubling.

---

### 25. IMG_2477 — Pistachio v3.1 (2L)
*Printed 4/19/25 12:21 PM*

**Spec:** Premium · −14 °C · 75 % · 30 % · 1709 g · 216 kcal · 1.55 L base → 2.02 L ice cream. POD error row highlighted green (4.19 %).

**Change from previous:** straight 1.64× scale-up of v3.1. Printed: "½ c Pistachios, boiled for 3 minutes, dehusked, roasted @ 200 for 20 minutes" — note the roast changed from "350 for 15-30 min" to "200 for 20 minutes."

**Handwriting:** dots beside amounts (measured-off marks). No process, no outcome.

**Reconstructable?** Formula yes.

---

### 26. IMG_2478 — Cranberry v1.0

**Spec:** Gelato · −17 °C · Hardness **70 %** · 10 % · 1298 g · 168 kcal.

**Change from previous:** first version.

**Process:**
> "12 oz Cranberry / ¼ C water / ¼ Tsp Salt / Cooked down to thick sauce / Yields 335 G Cranberry, water boils away. / OJ = ~1 Orange"
> "Age overnight / 37°F when going into Churn. / Removed @ 20°F"

**Outcome, verbatim:**
> "Needs more sugar to be sweeter
> Consistency: strain the cranberry puree
> Scoopability is good.
> Flavor is good.
> Strain the OJ
> Less Dextrose, more Sucrose
> Keep PAC, ↓POD"

**Reconstructable?** Yes — and this page has the best temperature discipline in the binder: a *pre-churn* temperature (37 °F) and a *draw* temperature (20 °F). Note the units flip to Fahrenheit here while the spec block stays Celsius.

**Marks vs prose:** 3 marks ("needs more sugar," "scoopability good," "flavor good"). **2 prose:**
- **"Consistency: strain the cranberry puree"** — the *fix* is written, the *observation* is not. Nowhere does he say the texture was seedy or gritty. If you only had the marks, you'd read "scoopability is good" and never learn there was a texture problem. **A fix implies an unrecorded defect.**
- **"Less Dextrose, more Sucrose / Keep PAC, ↓POD"** — a two-ingredient swap constrained to hold one computed metric constant while moving another. Structured in principle, but no simple field expresses it.

---

### 27. IMG_2479 — Cranberry v1.1

**Spec:** Gelato · −16 °C · 70 % · 10 % · 1274 g · 169 kcal.

**Change from previous:** **sucrose 39→88, dextrose 175→128** — exactly the "less dextrose, more sucrose" instruction, executed. Cranberry 335→300, OJ 30→50, DSMP 94→89. Also new empty rows for Water and Orange Extract. The page does not say it's executing v1.0's note.

**Process:** "77°c for 45 min. / Age for ~~4 Hr~~ 2.5 hrs"

**Outcome, verbatim:**
> "Good Texture
> Scoopable
> Good Sweetness"

**Revised procedure, verbatim:**
> "Cook down Cranberry. No Salt
> Puree Cranberry
> Fold in Dry Ingredients as measured and remix
> Add milk and cream with dry ingredients and remix.
> No homogenization after Sousvide
> Filter OJ.
> Remove White/hard Cranberries
> After heating Cranberries, remove hard/solid Cranberries."

**Reconstructable?** Yes, best-in-binder for procedure.

**Marks vs prose:** 3 clean marks — the same "good/good/good" pattern as Pistachio v2, i.e. a success. All eight procedure lines are ordered structured steps, not prose. **Note the aging-time strikeout: 4 hr → 2.5 hr.** He planned 4 and did 2.5; only the ink tells you which.

---

### 28. IMG_2480 — Cranberry v1.2

**Spec:** Gelato · −16 °C · 70 % · 10 % · 1298 g · 168 kcal · **347 PAC against a 220–230 target** · 137 POD · 2.52 PAC:POD · 22.1 % sugar.

**Change from previous:** reverts to v1.0's sugars (sucrose 88→39, dextrose 128→175) while keeping v1.1's serving spec.

**Zero handwriting. No process, no outcome.**

**Confirmed with Mark: this was not a deliberate test.** It was a mistake, and it's the only silent regression in the binder — a churned batch that unwound the exact change v1.0 prescribed ("Less Dextrose, more Sucrose / Keep PAC, ↓POD") and v1.1 confirmed worked ("Good Texture / Scoopable / Good Sweetness").

**Three things made it possible, and all three are sheet-design failures rather than user error.**

**1. The version number lies about lineage.** Diff v1.2 against v1.0: milk 449, cream 169, sucrose 39, dextrose 175, fructose 3, DSMP 94, lecithin 2.5, cranberry 335, salt 1.5, OJ 30 — **identical, ingredient for ingredient, to two significant figures.** The only differences are the milk product (3.5 % → 3.3 %) and the serving spec. v1.2 is not a descendant of v1.1 at all; it is v1.0 re-opened and re-printed. The numbering says "the version after 1.1"; the formula says "a sibling of 1.0." Nothing on the page carries a parent pointer, so the sheet cannot tell you which.

**2. The guardrail is decorative.** The page prints "347 PAC (220 - 230)" in the Info block — a 50 % overshoot, the largest spec violation in the binder — and the Error row reads **0 % across every column**. Both are true. The Error row measures against a *stored per-recipe target*, which is whatever the recipe already was; the (220–230) range is the *type's* range and is never checked. So the number that looks authoritative agreed with you, and the number that was right sat two inches away in smaller type. The sheet had everything needed to stop this batch and stopped nothing.

**3. It's the first time the app ever showed you this recipe's PAC.** v1.0 printed on a Gen-1 layout whose Info block carries only kcal, L base, and L ice cream — **no normalized PAC, no target range.** The formula was already far out of range when you churned v1.0; you just couldn't see it. By v1.2 the app had gained the composition block, so the overshoot became visible for the first time — on a page you then didn't annotate.

**Reconstructable?** Formula yes. **Intent: now known — none. Result: none recorded.** Which makes this the most expensive page in the binder: a known mistake whose consequences went unmeasured, so it can't even serve as a negative control for the sugar swap.

**Design consequence:** a parent-version pointer and a type-range check are each about an hour of work and would have caught this twice over. Neither is a Tier 2 feature — both belong in the formula half you already consider finished.

---

### 29. IMG_2481 — Pineapple v1

**Spec:** Gelato · −14 °C · 75 % · 10 % · 1034 g · 156 kcal · 266 PAC · 122 POD · 32.6 % solids · 7.1 % fat. Solids error 23.2 %, PAC error 21 %, stabilizer error 237 %. DSMP 60.6 overwritten to **61**.

**Change from previous:** first pineapple version.

**Process:**
> "Filtering Pineapple was too much work.
> Cooked Pineapple in SousVide separate from Cream.
> Added ¼ cup cooked/crushed PA as mixin. increase."

**Outcome, verbatim:**
> "Good Texture
> Good Sweetness
> Could have more PA in Sweet Cream.
> Less Stabilizer, getting Chewy."

**Reconstructable?** Formula yes (DSMP 61). Method mostly.

**Marks vs prose:** 3 marks. **2 borderline:**
- **"Filtering Pineapple was too much work."** — an *effort* judgment about a prep step, with no sensory content at all. Nothing else in the binder records labour cost, but it's clearly a reason he'd change a method. A "prep effort: acceptable / too high" mark on a named step would capture it.
- **"Less Stabilizer, getting Chewy."** — defect + causal attribution + fix, in five words. "Chewy" is a mark; the attribution to stabilizer is the part that carries.
- **"Could have more PA in Sweet Cream"** needs a **location** dimension: pineapple *in the base* vs. pineapple *as a mix-in* are different fields, and he distinguishes them.

---

## Part 2 — The five outputs

### 2.1 The real schema for the churn sheet

The binder shows **four distinct kinds of writing**, not two. Every field below is derived from something actually written on at least one page.

**A. Identity & provenance** *(the binder is weakest here)*
- Recipe name · version string (v1, v2, v2B, v2.1, v1.0, v3.1, v3.1 (2L) — he uses at least four numbering conventions)
- **Churn date** — present on only 5 of 29 pages. The printed timestamp is the *print* date and is misleading; Mexican Chocolate v1 printed 12/12 and was made 12/13.
- **A verdict, or an explicit "no verdict."** All 29 were churned; 14 recorded nothing. Since silence here means *either* "it was fine" *or* "the evening ended" — and you can no longer tell which — the sheet must force that distinction at capture time. One tap, two values: `as expected, nothing to note` vs. `not evaluated`. They are completely different data and they currently look identical.
- **Staleness marking on carried-forward text.** Mexican Chocolate v3's "Observations:" field contains v1's observations. A notes field that silently persists across versions produces pages that *look* evaluated and aren't.
- Parent version / "based on" — appears on 5 pages, twice **stale and wrong** (Cherry Garcia's header still says "+ more mango")
- Batch multiplier ("Double Recipe") — as-made mass ≠ table mass on at least one page

**B. Formula (already solved by Ice Ed, with one gap)**
- Ingredient rows with grams — complete on every page
- Computed: PAC, POD, PAC:POD, %solids, %water, %sugar, %non-lactose sugar, %fat, %milk fat, %MSNF, %stabilizer, kcal, L base, L ice cream
- Spec: type (Gelato / Premium / Super-Premium), serving temp, hardness %, overrun %
- **Gap: as-made overrides.** Six pages carry ink corrections to printed amounts, and one page (Cherry Garcia v1) has a **hand-added ingredient row that the totals exclude**. The sheet needs an as-made column beside the as-planned column, or the math lies.
- **Gap: ingredient composition metadata.** "cream has Gellan gum," "Cream has Guar 0.5%," "Cream, Heavy 0.5%," "remember Gellan from Cream" — he re-derives this four separate times across the binder. It belongs to the ingredient, not the batch.
- **Gap: sub-recipe definitions.** "Stabilizer Mix 4421" appears on 8 pages and is defined on exactly one (Pistachio v2: 4 lecithin / 4 LBG / 2 guar / 1 carrageenan). "UBLB" is never defined.

**C. Process (the part no competitor models — see 2.2)**

**D. Outcome — three sub-kinds**
1. **Sensory marks** on named axes (see 2.3) — ~80 % of his outcome writing
2. **Diagnosis** — hedged, causal, sometimes novel. Irreducibly prose.
3. **Next-version delta** — `{ingredient | parameter, direction, target}`. Fully structured, and currently mixed in with the prose where it can't be queried. Examples that would slot straight into fields: "lower Stabilizer to 2.5g/Kg," "increase fat to 8%, 9-11% optimal," "Dextrose 86g →55g," "Allulose +30g," "vanilla 5→3," "Less Dextrose, more Sucrose."

**Design consequence:** the sheet needs a *delta block* that is separate from both the marks and the free field. Right now his most actionable writing — the fix list — is trapped in prose because there's nowhere else to put it.

---

### 2.2 The process variables that matter to you

Ranked by how often you wrote them down unprompted (out of 29 pages):

| Variable | Pages | Notes |
|---|---|---|
| Sous vide temp | 17 | **Three values in play: 75 °C, 77 °C, 80 °C / 176 °F.** The trend over time is upward, and the binder never states this |
| Sous vide duration | 17 | 45 min default; 60 min once; "1 hour, 55 minutes" once |
| Aging / chill duration | 9 | Wildly inconsistent units: "overnight," "8 hrs," "4 hrs 15 min," "~~4 Hr~~ 2.5 hrs," "4hr" |
| Fruit/nut prep method | 9 | Cook / don't cook / boil-dehusk-roast / blanch / strain — the highest-variance and most consequential process axis |
| Churn duration | 6 | "40+ minutes," "~20 minutes," "43 minutes," "~35 min," "45 minutes" |
| Mix-in timing | 4 | "@ 30 minutes," "@ 45 minutes (too late)," "add in last 5 minutes," "@ end of Churn" |
| Blend/homogenize | 5 | "Blend 2 minutes," "1½ minutes," "1 minute high," "Homogenize 1 minute," "No homogenization after Sousvide" |
| Base temp entering churn | 3 | "37°F when going into Churn," "from room temp Base," "Ice Bath: 15 minutes 40°" |
| **Draw temp** | **2** | −8 °C (Coconut v2), 20 °F (Cranberry v1.0) — **the variable most predictive of your #1 complaint, recorded twice** |
| Freezer/hardening | 4 | "freeze overnight," "Freeze 8 hrs." |
| Serving temp measured | 3 | −18 °C, −17 °C — measured at the point of the complaint |
| Machine | 1 | "Whynter" |
| Churn speed | 1 | "Churned on Fast/Hard" |
| Pre-chill bowl | 1 | "Pre-Chill Bowl 15 minutes" |
| Ambient / day conditions | **0** | never once |

**Three things this table says.**

**First: your dominant failure mode is hardness, and you are not recording the variable that explains it.** Hardness or scoopability appears in outcome notes on 9 pages. Draw temperature appears on 2. Churn time on 6. You have been trying to solve a texture problem by moving formula variables (fat, stabilizer, dextrose, allulose, serving temp) while leaving the churn-side variables largely unlogged. A sheet that makes draw temp and churn time as unmissable as sous vide temp would change what your record can tell you.

**Second: units are unstable and it has already cost you.** °C and °F alternate freely, sometimes on the same line — Mexican Chocolate v1 crosses out "75C" and writes "176F," which is 80 °C, a 5-degree move made by accident of unit. Sheet fields should be unit-tagged, not unit-free.

**Third: prep method deserves first-class status, not a margin.** "Don't Cook Fruit." "Cooked Cherries, Strained Juice into cream." "Boiled 1c water, Add ½ c Pistachio, Boil 3 minutes, Ice water Bath, Remove Husks, Bake @ 350." "Cooked Pineapple in SousVide separate from Cream." These are the changes that actually moved results — more than the sugar tuning did — and they live in unstructured margins where nothing can compare them.

---

### 2.3 Your actual outcome vocabulary

Every evaluative word you used, grouped. This is the controlled vocabulary, not one I invented.

**Texture / body**
`Hard` · `A little Hard` · `Medium Hard` · `Not Hard` · `Hard straight from Freezer` · `Hard from freezer` · `Too hard to scoop` · `notscoopable` · `scoopable` · `Scoopable` · `Easy to Scoop` · `Scoopability is good` · `smooth` · `Very smooth` · `Consistency smooth` · `Flaky` · `not creamy` · `Dry` · `Gummy` / `Not Gummy` · `Chewy` · `Good Melt` · `Good Texture` · `Really Good Texture` · `thick` (base) · `congealed and froze into hard blobs`

**Sweetness**
`Sweetness Good` · `Good sweetness` · `Good Sugar` · `Sugar Good` · `Sweetness Perfect` · `Not very sweet` · `Could be sweeter` · `Needs more sugar to be sweeter` · `Not too sweet` · `A tad too Sweet`

**Flavor**
`Flavor Good` · `Flavor is good` · `Good [X] flavor` · `Really strong cocoa` · `Base is Potent!` · `A Tad too strong on Peppermint` · `Too much Vanilla` · `Not enough cherry Flavor` · `could use more` · `could have more [X]` · `Could have more [X] in Sweet Cream`

**Overall**
`EPIC FAIL.` · `Best yet.` · `Perfect` · `yeah!! ☺`

**Modifiers, in your own hand**
`Good` (≈20 uses — your default positive) · `Very` · `Really` · `A little` · `A Tad` · `Medium` · `Not too` · `Not enough` · `Too much` · `Needs more` · `Could have more` · `Not as ___ as ___`

**The finding that should drive the whole mark design:**

> **Your native scale is bipolar and centred on "Good" — not a quality ladder.**

You almost never rate something *poor to excellent*. You rate it **too little ← Good → too much**, with a magnitude modifier. "A tad too sweet." "A little hard." "Not enough cherry flavor." "Could have more mango." "Too much vanilla." "Really strong cocoa."

A 1–5 quality scale would be the wrong instrument. It would force "a tad too sweet" and "not very sweet" onto the same low end of the same axis, when for you they point in opposite directions. What fits your handwriting is a signed 5-point scale per axis:

`−2 far too little · −1 slightly under · 0 right · +1 slightly over · +2 far too much`

with `0` labelled **Good**, because that's the word you actually use, and a rarely-used `Perfect` flag above it (you used it exactly once, and you crossed out "Good" to get there).

The axes your writing already names, and nothing more: **sweetness · hardness · scoopability · smoothness · dryness · gumminess/chewiness · melt · flavor intensity (per named ingredient) · overall.** Nine axes. Plus one free-standing note on prep effort, which you wrote once and which is clearly a real decision input.

---

### 2.4 Is the paper record as complete as it feels?

**No — and the gap is not where you'd expect.** The formula is over-recorded and the *result* is under-recorded.

| | Pages | |
|---|---|---|
| Full formula present | **29 / 29** | 100 % |
| Formula reconstructable *without reading ink corrections* | 23 / 29 | 6 pages have as-made overrides |
| Formula reconstructable *at all* | 28 / 29 | Cherry Garcia v1 fails — hand-added vanilla is excluded from every computed total, and the vanilla is what he complained about |
| Batches actually churned | **29 / 29** | confirmed with Mark |
| Any process notes | 21 / 29 | |
| Any outcome notes at all | 16 / 29 | |
| **Finished-product verdict recorded** | **15 / 29 — 52 %** | Strawberry V2 recorded only how the *base* tasted |
| Both process and finished-product verdict | 12 / 29 | |
| Churn date recorded | 5 / 29 | printed timestamps are *print* dates and mislead |
| Draw temperature recorded | 2 / 29 | |

**The five specific failures, in order of how much they cost you:**

1. **Nearly half the batches you made have no result — 14 of 29.** This is the whole finding; everything else is detail. It includes Mango on Light Base (eight process steps, a homogenise time, an ice-bath temperature, and no verdict), the entire Pistachio line after v2 — the version you liked best — and the 2 L scale-up, the one batch where you'd most want to know whether the recipe survived doubling. **And because you can no longer tell whether a blank means "fine" or "never got to it," those 14 can't even be read as weak positives.** They're not evidence of anything.

2. **Cherry Garcia v1 is unreconstructable.** You hand-wrote a "Vanilla | 5" row into the table. It's not in the sum, not in the PAC, not in the POD, not in the solids. Then the one thing you wrote about the batch was "Too much Vanilla." The page records a defect caused by an ingredient the page's own arithmetic doesn't know exists.

3. **Two pages actively mislead rather than merely omit.** Mexican Chocolate v3 has a *populated* "Observations:" field containing v1's observations — it reads as evaluated and isn't. Cranberry v1.2 walks back the sugar swap that v1.1 confirmed worked, lands PAC at 347 against a 220–230 target, shows 0 % errors anyway, and says nothing about why. A deliberate regression test and a mistake look identical on that page.

4. **Cross-page references break.** "based on stabilizer mix from Mocha recipe + more mango" appears verbatim on Cherry Garcia, copied from Mango V3 and never edited. "Stabilizer Mix 4421" appears on 8 pages and is defined on 1. "UBLB" is defined nowhere. "Based on Pistachio V2" points to a page that itself points nowhere.

5. **The reason for a change is almost never on the page that makes the change.** Strawberry V2 rebuilds the entire fruit strategy and says only "Don't Cook Fruit." Cherry Garcia v2 drops vanilla 5→3 and never mentions that v1 tasted of too much vanilla. Cranberry v1.1 executes "less dextrose, more sucrose" without saying so. The only pages that link cause to change are the ones where Ice Ed's typed note field was used — "reduced Coffee from 15g to 8g, reduced Cocoa from 60g to 30g." **The moment the app gave you a field, you filled it with a properly-formed delta including the previous value** — something you never once did by hand. See 2.6.

**The one thing the paper does better than you'd expect:** where you did write, you wrote precisely. "40+ minutes to Churn." "1 cherry w/out Pit = ~10g." "Yields 335 G Cranberry, water boils away." "−8C Draw Temp." Nothing is vague. The problem is coverage, not quality.

---

### 2.6 What the print format's own evolution already tells you

These 29 pages were printed by your Ice Ed app, and the print format changed across the two years. That variation isn't noise in the record — **it's two years of you iterating the sheet design already, in code, and it points somewhere.**

Three generations are visible:

| Gen | Tells | Pages | Info block |
|---|---|---|---|
| **1** | Form-widget artifacts printed into the table (⇕ spinners, stray `(` before ingredient names) | Strawberry V1–V2.1, Mango 1–V3, Mocha v1–v2, Cherry Garcia v1, Cranberry v1.0–v1.1, Pineapple | Short: kcal, L base, L ice cream only |
| **2** | Widgets still present, composition analysis added | Mocha v3, Peppermint v1, Coconut v1, Cranberry v1.2 | Full: PAC/POD **with target ranges**, % solids/water/sugar/fat/milk fat/MSNF/stabilizer |
| **3** | Clean print, no widgets; Stabilizer column; header/footer with timestamp and file path; typed notes region | Mexican Chocolate v1 & v3, BCP v1–v3, Cherry Garcia v2, Peppermint v2, Coconut v2, all Pistachio | Full, plus stabilizer as % of total and % of water |

This also gives you a **dating signal for the 24 pages without a handwritten date** — format generation orders them even where the print timestamp is absent or misleading. *(Inferred from format features; worth confirming against the app's own history.)*

**And chasing the Cranberry v1.2 mistake turned up something that affects every cross-generation comparison in the binder: the ingredient coefficients changed between app versions.**

Cranberry v1.0 and v1.2 contain **the same ingredient list at the same gram amounts**. Every row computes identically — sucrose, DSMP, lecithin, cranberry, salt, orange juice — **except dextrose**:

| Dextrose, 175 g | Sugar | Solids | PAC | POD |
|---|---|---|---|---|
| Gen 1 (Cranberry v1.0) | 160 | 175 | **333** | **122** |
| Gen 2 (Cranberry v1.2) | 153 | 175 | **291** | **107** |

Independently confirmed on a second, unrelated pair — Mocha v2 (Gen 1) vs Mocha v3 (Gen 3):

| Dextrose | Sugar | PAC | POD | per gram (solids / PAC / POD) |
|---|---|---|---|---|
| Mocha v2, 89 g | 81.4 | 169 | 62.3 | 0.915 / **1.903** / 0.700 |
| Mocha v3, 86 g | 75.3 | 143 | 52.5 | 0.876 / **1.663** / 0.610 |

Both pairs agree, and I read all four rows at high magnification to rule out a transcription error. **The same named ingredient at the same weight computes ~12.5 % less PAC and ~12.5 % less POD on a newer sheet than on an older one.**

The newer numbers look like the corrected ones: dividing through, the new model puts dextrose at 87.5 % solids with PAC 190 and POD 70 *on a solids basis* — the textbook values. The old model implied 208 / 76, which isn't standard for anything. *(That reading is my arithmetic off the printed tables, not something the app states.)*

**Why this matters more than a rounding footnote:** dextrose is your primary PAC lever — you use anywhere from 26 g to 183 g of it — and PAC is your proxy for the hardness problem that dominates your outcome notes. So **any PAC or POD comparison between an old-format page and a new-format page is confounded by a silent model change, in the exact variable you were tuning.** Mexican Chocolate v1's "262 PAC" and the Gen-1 Strawberry and Mango numbers are not on the same scale.

Two consequences for the build: **version the ingredient database and stamp that version on the sheet**, so a recipe can always be recomputed under the coefficients it was actually made with; and when you import this binder, **recompute every historical formula under one current model** rather than trusting the printed totals.

**But the point worth acting on is the direction of travel.** Every field the app gained across three generations was a **planning or diagnostic field**: target ranges, composition percentages, stabilizer as a fraction of water, error rows. You kept adding ways to see *how far the formula is from where you want it before you make it.*

> **In two years of iterating your own sheet, the outcome side never gained a single structured field.**

The "Observations:" text on the Gen-3 pages isn't an outcome feature — it's the generic notes textarea, the same one holding "1 Pinch of Cayenne Pepper" and "convection roast bananas at 350 F." It has no schema, it persists stale across versions (Mexican Chocolate v3), and it's the reason the result side of the binder is 52 % blank while the formula side is 100 % complete.

**That asymmetry is the argument for Tier 2 in one line, and it's an argument from your own behaviour, not from theory.** You have already demonstrated, repeatedly and unprompted, that when the sheet offers a field you fill it well — the Mocha change notes are the best-documented deltas in the binder precisely because Gen 2/3 gave you somewhere to type them. The outcome side is empty not because you don't care about outcomes — you clearly do, they're what every note is about — but because **that half of the sheet was never built.**

---

### 2.5 The prose-versus-marks ratio

Counting every discrete evaluative statement across the binder (process numbers excluded):

- **≈52 statements** would survive intact as a checkbox or a signed scale — **80 %**
- **≈13 statements** genuinely need prose — **20 %**

**But the ratio by volume is the wrong measure, and here is why.**

Sort by *which observations actually changed the next batch*:

| Observation | Type | What it caused |
|---|---|---|
| "(maybe cooked too much water?)" | **prose** | Strawberry V2's entire fruit rebuild |
| "Base is Potent! maybe too much cocoa + coffee" | **prose** | Mocha v2: cocoa 60→30 **and** coffee 15→8 |
| "Coconut fat congealed and froze into hard blobs" | **prose** | Coconut v2: coconut cream → coconut milk, warmed |
| "Consistency: strain the cranberry puree" | **prose** | Cranberry v1.1's revised 8-step procedure |
| "Less Dextrose, more Sucrose / Keep PAC, ↓POD" | **prose** | Cranberry v1.1: sucrose 39→88, dextrose 175→128 |
| "Less Guar — remember Gellan from Cream" | **prose** | Carried into three later printed headers |
| "Hard straight from Freezer" | mark | The fat/stabilizer/allulose fix list |
| "Too much Vanilla" | mark | Cherry Garcia v2: vanilla 5→3 |
| "Not enough cherry Flavor" | mark | "Cook fruit next time" |
| "A Tad too strong on Peppermint" | mark | Peppermint v2: extract **−18 % by concentration** (invisible in grams) |

**Six of the ten changes that mattered came from the 20 %.** The marks tell you *which axis failed*. The prose tells you *why* and *what to do about it*. They are not competing formats; they're doing different jobs, and the prose job is the rarer and more valuable one.

**There is a second pattern worth naming, and it's uncomfortable:**

> **You write marks when it worked and prose when it failed.**

Pistachio v2 (your happiest batch): six clean marks, zero prose. Cranberry v1.1 (worked): three clean marks. Coconut v1 (epic failure): one mark and a full mechanism description. Strawberry V1 (bad): seven marks and a causal hypothesis.

This means a marks-only sheet would be **best at recording the batches you learn least from.** It would compress your successes efficiently and gut your failures.

**What this means for Tier 2 — concretely:**

- **Build marks for the nine axes.** Signed −2…+2, centred on "Good." They cover ~80 % of statements, they're the part you write fastest, and they're the only part that can support "show me every batch where hardness was +1 or worse." That query is worth having; it covers your dominant complaint across 9 pages.
- **Build the delta block, and express it in concentration.** Your fix-lists are already structured — `{ingredient, direction, target}` — and they're the highest-value writing you produce. Include a `from` value: the pages that recorded "from 15g to 8g" are the only ones whose reasoning survives being read cold a year later. **And store the change as % of batch or PAC/POD contribution, not grams.** Peppermint v2 proves why: in grams it looks like you ignored your own note, in concentration you applied it correctly. With batch sizes ranging 504 g → 1709 g across this binder, a gram-based delta will regularly tell you the opposite of what you did.
- **Make "no verdict" a value, not an absence.** The 14 blanks are unrecoverable *because* silence was ambiguous — the sheet let "it was fine" and "I never got to it" produce identical pages. One tap distinguishing `as expected, nothing to note` from `not evaluated` costs nothing at the bench and is the difference between 14 weak data points and 14 holes. This is the cheapest high-value thing on the list.
- **Do not build a taxonomy of defects.** "Coconut fat congealed and froze into hard blobs" proves the list can never be complete. The open field is not a fallback for when the marks don't fit — **it is where the diagnoses live**, and diagnoses are where your version-to-version progress comes from.
- **Do not build a return path for the prose.** Six-to-thirteen irreducibly-prose statements across 29 batches is roughly one every two or three sheets. Parsing that back into structure is a large build serving a small, high-variance corpus, and the parse would flatten exactly the hedges ("maybe," "a tad," "not as X as Y") that carry the meaning. **Photograph it, attach it to the batch, make it searchable as text, and stop there.**
- **Build one comparison primitive.** "Not as Hard as Strawberry V2 / Not as Soft as Mocha" is how you actually calibrate, and it's the only prose pattern that recurs in a regular enough shape to be worth structuring: `[axis] [more/less] than [batch]`. It also happens to be the thing a paper sheet can never do and a database trivially can.

**The honest bottom line:** ~80 % of your record can become queryable marks, but that 80 % is the part that tells you what happened, not the part that tells you what to do next. Build the marks because they're cheap and they answer the hardness question. Keep the prose as a photograph because compressing it is where you'd lose the thing the binder is actually for.

---

## Verify before sharing

Things in this document I read off photographs and could have got wrong:

1. **Handwriting transcriptions.** Confirm the exact wording of: "Base is Potent! maybe too much cocoa + coffee" (Mocha), "yeah!! ☺" (Coconut v1), "Filtering Pineapple was too much work" (Pineapple), and the Mango V3 note "Less Guar — remember Gellan from Cream."
2. **The 176 °F / 75 °C discrepancy** on Mexican Chocolate v1. I read the crossed-out "75C" replaced with "176F." If it's actually "167F," there's no discrepancy and that finding drops.
3. **The "Ice Bath: 15 minutes 40°"** on Mango on Light Base — I could not tell whether the unit mark is °C or °F. 40 °C would be odd for an ice bath; 40 °F is plausible.
4. ~~Which sheets were actually churned.~~ **Resolved:** all 29 were churned, confirmed by Mark. My original inference that eight were unmade drafts was wrong, and correcting it roughly doubled the size of the central problem. The completeness numbers in 2.4 are the corrected ones.
5. **Mexican Chocolate v2, Banana Cream Pie v2, and the "UBLB" base recipe** are referenced or implied but not in these 29 photos. Confirm whether they exist elsewhere before treating the binder as the complete record.
6. **The counts (52 marks / 13 prose)** are my classification of your sentences, not a mechanical count. The boundary cases I judged as prose rather than marks: "added Mixins @ 45 minutes (too late)," "Filtering Pineapple was too much work," "Less Stabilizer, getting Chewy," "Best yet." Reclassifying all four as marks moves the ratio to 86 / 14 and does not change the conclusion.
7. **Cranberry v1.2's intent.** It was churned, but whether it was a deliberate test of whether the v1.0→v1.1 sugar swap actually mattered, or a mis-saved reversion, is my open question — not something the page answers.

8. **The three print generations in 2.6** are reconstructed from visual features (widget artifacts, Info-block contents, Stabilizer column, header/footer). If your app's actual release history disagrees, the dating-signal claim drops — though the "every added field was a planning field, none was an outcome field" observation holds regardless of how the versions are grouped.

9. **The Peppermint concentration table** is my arithmetic off the printed gram amounts and batch sums, not something written on either page. Worth re-checking: v1 extract 2.0 g / 504 g = 0.397 %; v2 3.1 g / 947 g = 0.327 %.

10. **The dextrose coefficient change in 2.6** is the claim here I'd most want you to confirm against the app's ingredient database, because the most is built on it. I verified the printed rows at high magnification across all four pages, and two independent recipe pairs agree, so the *printed numbers* aren't a misreading. What paper can't tell me is whether the cause is a revised coefficient, a switch between dextrose anhydrous and monohydrate under one label, or a units change. All three have the same consequence for cross-generation comparison.

11. **Cranberry v1.2's ingredient-level identity to v1.0** comes from my transcriptions of both tables. Spot-check two or three rows before relying on the "it's a re-print of v1.0, not a child of v1.1" reading.
