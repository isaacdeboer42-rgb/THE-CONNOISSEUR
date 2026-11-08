# Annotated screen specification

The running Expo app is the connected prototype. This specification states the contract a production implementation must preserve.

## Welcome and setup

**Goal:** reach a trustworthy recommendation with minimal setup. **Entry:** cold launch or sample Exit. **Hierarchy:** value statement → Build my bar → Explore sample → three product promises. Setup prioritises starter, search/manual additions, then the two ice decisions and live match count. **Validation:** both ice answers must be Yes or Not now; no brand or taste questionnaire is required. **Failure/loading:** hydration shows a loading state; corrupt storage opens a fresh bar with an explanation. **Back:** retains local selections. **Persists:** guest inventory, basics, onboarding state. **Accessibility:** labelled checkboxes, live result count, ≥44-unit controls, no colour-only selection. **Acceptance:** starter plus confirmed ice produces the reference one-away results; sample is labelled and isolated.

## Tonight

**Goal:** choose an understandable drink. **Entry:** setup completion, tab, Make exit. **Hierarchy:** bar status/actions → temporary preferences → sort control → recommendation(s) → Quick Select. **Primary:** open recipe. **Secondary:** scan, add, preference, sort, Quick Select. **States:** empty inventory; ice unconfirmed; no ready; taste-led; sample; account prompt. **Persists:** temporary preferences for current snapshot, Quick Select history; sort is session-local. **Accessibility:** radio semantics for sort, status text on every card, ingredient-specific quick-add labels. **Acceptance:** taste-led crosses groups without hiding readiness; featured recipe never repeats.

## My Bar

**Goal:** understand and correct what supplies recipe matching. **Entry:** tab. **Hierarchy:** scan/add → summary → bottle/ingredient rows → kitchen basics. **Actions:** edit private product, Mark empty, Restock, Remove, edit ice. **States:** empty shelf still shows ice; product rows show brand/private/verified and mapped category; multiple products may map to one ingredient without inflating coverage. **Persists:** inventory status and revision. **Acceptance:** changing stock immediately changes Tonight; removing one of two supplying bottles does not remove category availability.

## Scan and unknown recovery

**Goal:** add a bottle even if provider/AI paths fail. **Entry:** My Bar or Tonight Scan. **Hierarchy:** camera privacy/permission context → live camera or manual barcode → result → next actions. **Required unknown fields:** name and matching category. Optional: brand, size, label reference, share consent. **Validation:** UPC-A/EAN-13 format and checksum; positive size; name/category present. **Loading:** camera, lookup and extraction expose progress; repeated detection is locked before resolution and again by operation ID. **Errors:** camera mount failure, denied permission, invalid code, provider failure, unknown, upload/AI failure all retain a manual path. **Back:** before mutation cancels; after mutation preserves. **Accessibility:** live results/errors, labelled viewfinder and controls, manual path always visible. **Acceptance:** repeated frames and scans do not duplicate; unknown private item survives extraction failure.

## Discover

**Goal:** browse reviewed content independently of current readiness. **Entry:** tab. **Hierarchy:** search → result count → recipe cards. **States:** no query matches and active catalogue. **Persists:** no search persistence required. **Acceptance:** published content only; filters must not imply ownership.

## Recipe detail

**Goal:** decide whether and how to make a reviewed variant. **Entry:** Tonight, Discover, Saved, Quick Select. **Hierarchy:** version/save → availability → missing actions → servings/ingredients → equipment/glassware → steps/source → Make. **Inputs:** 1–8 servings; persistent ml/fl oz preference lives in Preferences. **States:** ready, substitution, one-away, explore, withdrawn/unavailable. **Back:** source route. **Persists:** save/shopping and Make session; stepper is route-local until Make starts. **Acceptance:** garnish optional, equipment separate, substitutions disclosed, >4 serves shows batch guidance.

## Make mode

**Goal:** complete a round with interrupted attention and wet hands. **Entry:** recipe Make. **Hierarchy:** progress/exit → one instruction → optional tip/timer → large Previous/Next. Preflight keeps ingredients and equipment available. **Behaviour:** keep screen awake while mounted; version and servings pinned; changed servings reset to preflight; timer target is wall-clock time. **Completion:** Liked, Not for me and private note; inventory is not depleted. **Failure:** missing or changed recipe version explains that inventory is unaffected. **Accessibility:** step body 18 units, labelled exit, live timer completion, 44-unit actions, vertical reflow. **Acceptance:** kill/relaunch resumes version, count and step; completion stops the active flow on exit.

## Saved

**Goal:** return to shortlisted recipes with current availability. **Entry:** tab. **Hierarchy:** grouped families → current status. **States:** empty, active, withdrawn retained reference. **Actions:** open active, remove withdrawn. **Persists:** save timestamp independent of liked feedback. **Acceptance:** availability changes with bar; missing content is never silently dropped.

## Shopping

**Goal:** choose the most useful category to add. **Entry:** My Bar or missing action. **Hierarchy:** explicit list → purchase suggestions → unlock evidence. **Actions:** add, remove, mark owned. **States:** empty, already owned, duplicate add, still requires other items. **Acceptance:** family and saved counts are deduplicated and evidence IDs reconcile with counts.

## Preferences

**Goal:** set durable taste and measurement choices. **Entry:** My Bar or Tonight. **Hierarchy:** measurement system → optional flavour dimensions. **Inputs:** ml/fl oz radio; enable/clear dimension; intensity and importance. **States:** neutral by default. **Persists:** profile snapshot. **Acceptance:** sample values map to visible choices; taste never changes ownership.

## Account and catalogue review

**Goal:** understand local data boundaries and test conversion/review states. **Entry:** My Bar. **Hierarchy:** explicit local-preview notice → account/import status → catalogue review → About/privacy → reset. **Reset:** custom confirmation works on web/native; cancel is non-destructive. **Catalogue:** empty, processing, error/retry, pending and decision states; no real publication. **Accessibility:** keyboard reachable admin actions and focus-visible browser controls. **Acceptance:** no password or cloud-backup implication; reset clears guest only.
