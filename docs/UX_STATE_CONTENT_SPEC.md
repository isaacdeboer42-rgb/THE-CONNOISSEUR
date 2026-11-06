# State and content specification

## State transitions

| Domain | From | Event | To | User feedback/recovery |
| --- | --- | --- | --- | --- |
| Ice | unknown | choose Yes/Not now | available/unavailable | Live recommendation count; change later in Setup/My Bar. |
| Inventory | absent | manual/recognised/private add | on hand | Named confirmation plus 30-second Undo. |
| Inventory | on hand | Mark empty | out of stock | Recommendation refresh; Restock remains visible. |
| Inventory | out of stock | scan/restock | on hand | “Back on hand”; no duplicate record. |
| Scan | detecting | valid code | lookup | Pause repeated handling; show progress. |
| Scan | lookup | known | added/duplicate/overlap | Product result; overlap requires Replace generic or Keep both. |
| Scan | lookup | unknown/failure | manual recovery | Preserve barcode; Add as new is immediate. |
| Private product | draft | Save | private usable | Save before any optional share/extraction. |
| Submission | submitted | extraction failure | submitted + error | Private item remains; Retry. |
| Submission | processing | strict result | pending review | Explicitly not published. |
| Recommendation | availability | choose Taste-led | taste order | Status/missing evidence unchanged. |
| Quick Select | ready set empty | request pick | expansion prompt | User may include one-away or cancel. |
| Make | none | Start | preflight | Pin recipe version, units and servings. |
| Make | unfinished | Start same servings | resume | Existing step/timer restored. |
| Make | unfinished | Start different servings | reset preflight | New amounts; prior timer cleared. |
| Make | active | Exit/interrupt | unfinished | “Progress saved”; resume from recipe. |
| Make | last step | Finish | complete | Feedback options; no inventory depletion. |
| Save | active recipe | content withdrawn | retained unavailable reference | Explain reason and allow removal. |
| Guest import | idle | create preview | confirmed/failed | Counts on success; Retry without duplicate on failure. |
| Guest | populated | confirm reset | empty guest | Account/sample snapshots unchanged. |

## Undo contract

Undo is operation-scoped, lasts 30 seconds and is independent of the five-second informational notice. It stores the complete snapshot before an undoable mutation. A second mutation invalidates that snapshot; undo-specific copy must disappear at the same time. Expiry clears the action and its copy. Undo returns the prior snapshot and confirms “Change undone”. In production, server mutations need an idempotency key and revision check; if the entry changed elsewhere, do not overwrite it—explain that Undo is unavailable and link to the current inventory row.

## Loading, error and offline content

| Situation | Message | Primary action | Preservation |
| --- | --- | --- | --- |
| Local hydration | “Opening your bar…” | None | Do not render an empty snapshot as final. |
| Local restore failure | “Saved data could not be restored; a fresh local bar is open.” | Account/data | Keep app usable; log no private payload. |
| Camera permission primer | “Scan a bottle barcode to add it to My Bar.” | Continue | Manual entry remains visible. |
| Permission denied | “Camera access is off. Enter the barcode or add the bottle manually.” | Add manually | Preserve any typed data. |
| Provider timeout/offline | “Lookup is taking too long. Your bar has not changed.” | Add as new / Retry | Preserve canonical barcode. |
| Invalid barcode | “That code does not pass its checksum.” | Edit code | Keep field focused and value selected. |
| Unknown barcode | “We couldn’t find this bottle. You can still save it privately.” | Add as new | Carry barcode into form. |
| Upload failure | “The label photo did not upload. The bottle details are still here.” | Retry photo / Save without photo | Preserve form. |
| AI failure | “We couldn’t read the label. Your private bottle is saved and usable.” | Retry / Continue | Never roll back private save. |
| No Quick Select result | “Nothing is ready with your current bar.” | Include one-away | Do not silently relax eligibility. |
| Account import conflict | “Some availability differed. We kept the safer out-of-stock state.” | Review My Bar | Preserve source and audit count. |
| Make version unavailable | “The pinned recipe version could not be restored.” | Back to Tonight | Inventory unchanged. |
| Withdrawn recipe | “This recipe is being re-reviewed.” | Remove saved reference | Retain name, timestamp and reason. |

## Language rules

Use Australian English, My Bar, On hand, Out of stock, Scan bottle, Add manually, Quick Select, Ready to make, Ready with a substitution, One ingredient away, Optional garnish, Make this and Add to shopping list. Use millilitres by default. Avoid “strong” when spirit-forward is meant. Feedback is “saved privately”, not “training recommendations”. Do not use consumption streaks, urgency or celebratory frequency language.

## Accessibility contract

- Primary controls are at least 44 logical units; no essential swipe-only action.
- Text and icon accompany colour for every availability state.
- Make instructions begin at 18 units and reflow vertically at large text sizes.
- Icon controls have outcome-based names; ingredient actions include the ingredient name.
- Live regions announce additions, scan results, errors and timer completion without repeating continuously.
- Reduced Motion replaces nonessential slides/fades; haptics are supplementary.
- Browser/admin tab order is native and visible; modals trap semantic focus and expose Cancel.
- Test VoiceOver, TalkBack, keyboard, 200% browser zoom and platform accessibility text sizes on release devices.

## Persistence and privacy

Local snapshot persists inventory, ice, measurement system, taste preferences, saves, shopping, Quick Select history, version-pinned Make sessions, private feedback/products and operation/import IDs. Search queries, modal state and Tonight sort choice are ephemeral. Production free text and photos are owner-private; sharing requires explicit consent and immutable submitted evidence.
