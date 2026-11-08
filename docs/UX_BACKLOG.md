# Prioritised developer backlog

Tickets describe remaining production work; prototype-complete behaviour is noted where relevant.

## P0 — before moderated usability

### UX-101 · Physical camera and permission flow — implemented, device evidence pending

**Outcome:** participants can complete recognised and unknown scan tasks on phones. **Implemented:** contextual primer after Scan bottle; explicit system camera permission; rear-camera viewfinder guidance; UPC-A/EAN-13 filtering; pause/lock after detection; torch; settings recovery; manual path always visible. **Dependencies:** `expo-camera`, supported iOS/Android matrix. **Data:** permission state, symbology, original/canonical code, operation ID. **Remaining acceptance evidence:** denied permission reaches manual entry on physical devices; repeated frames create one operation; background/resume does not duplicate; VoiceOver/TalkBack announce result.

### UX-102 · Provider adapter and offline recovery

**Outcome:** lookup failure never blocks private inventory. **Specification:** server-side provider adapter with timeout/cache; known/unknown/error typed results; Add as new above any suggested matches. **Dependencies:** supplier/coverage/budget decision. **Data:** canonical barcode, provider/model/version, response status, cache time. **Acceptance:** timeout is actionable in under the agreed limit; offline preserves barcode and fields; no provider secret ships in the client.

### UX-103 · Native accessibility and large-text pass

**Outcome:** core tasks work with assistive technology and wet-hand constraints. **Specification:** test screen-reader order, 44-unit targets, large text, reduced motion, contrast and Make controls on release builds. **Dependencies:** device matrix. **Data:** test evidence only. **Acceptance:** all ten usability journeys complete without clipped essential text or unnamed controls; defects recorded with device/OS/build.

### UX-104 · Usability research execution

**Outcome:** select a primary audience and validate organisation/language. **Specification:** recruit across occasional, enthusiast and host groups; run the supplied neutral tasks; compare Availability vs Taste-led without leading. **Dependencies:** recruitment and consent. **Data:** anonymised observations and task outcomes. **Acceptance:** no invented results; decisions link to observed evidence and sample limitations.

## P1 — production foundation

### UX-201 · Supabase identity and guest conversion

**Outcome:** optional account creates real backup/synchronisation without losing guest work. **Specification:** real register/sign-in/recovery/deletion; idempotent import; conflict explanation and retry. **Dependencies:** Supabase project/region, privacy policy, email delivery. **Data:** user-owned snapshots, import ID/report, audit timestamps. **Acceptance:** concurrent/repeated/expired flows are safe; cross-user access denied by policy tests; source guest remains until confirmed.

### UX-202 · Cloud persistence and private label storage

**Outcome:** personal inventory and photos sync securely. **Specification:** row ownership; private object bucket; upload allow-list/limits; short-lived URLs; deletion/retention. **Dependencies:** schema, storage and backup policy. **Acceptance:** user A cannot read user B; expired URL fails; upload failure preserves form; restore rehearsal passes.

### UX-203 · Brand and ingredient inventory views

**Outcome:** enthusiasts can understand specific bottles while recipes match categories. **Specification:** switch/filter between Bottles and Ingredients; show supplying products; homemade entry maps to an approved category; overlap Replace/Keep both. **Dependencies:** product taxonomy. **Data:** product/private product → ingredient mapping. **Acceptance:** multiple bottles do not inflate coverage; removing one supplier keeps category available when another is on hand.

### UX-204 · Production catalogue breadth and rights

**Outcome:** browsing/ranking research is credible beyond four fixtures. **Specification:** expand reviewed, source-rights-cleared variants across families, substitutions and equipment; run editorial gate. **Dependencies:** content rights and editorial owner. **Acceptance:** every version passes validation; published-only reads; withdrawn saves remain coherent; enough variety exercises filters and repeat avoidance.

### UX-205 · Recipe-specific serving limits

**Outcome:** scaling remains physically credible. **Specification:** replace global 1–8 with min/max/batch size metadata per recipe; preserve chosen measurement system; explain batch boundaries. **Dependencies:** editorial review. **Data:** minServings, maxServings, maxPerBatch. **Acceptance:** controls stop at limits; quantities and discrete ingredients remain correct; Make restart behavior is tested.

### UX-206 · Durable server undo

**Outcome:** recognised additions can be safely reversed across sync. **Specification:** persistent confirmation until dismissed/expired; revision-aware inverse operation; if changed elsewhere, route to inventory correction. **Dependencies:** server revision/idempotency. **Acceptance:** toast dismissal does not remove Undo; later conflicting edit prevents destructive rollback and explains why.

## P2 — evidence and refinement

### UX-301 · Shopping evidence drill-down

**Outcome:** users can audit every unlock count. **Specification:** category suggestion opens exact newly ready families, saved recipes and still-missing ingredients; bottle examples secondary. **Acceptance:** list IDs reconcile with deduplicated counts; already-owned and duplicate-add states are explicit.

### UX-302 · Feedback-informed ranking decision

**Outcome:** interface language matches actual learning. **Specification:** either keep feedback as private history or define transparent, reversible scoring effects. **Dependencies:** product/research decision. **Acceptance:** no learning claim unless a deterministic effect and reset control exist.

### UX-303 · Aqua/gold visual migration

**Outcome:** apply brand direction without reducing clarity. **Specification:** aqua for interaction/state, gold for brand/primary emphasis, text/icon status redundancy, dark-first system support. **Dependencies:** approved mark/assets. **Acceptance:** WCAG contrast and large-text/device checks pass; no colour-only meaning.

### UX-304 · Responsible-product and store review

**Outcome:** Australian launch copy and store metadata are appropriate. **Specification:** ABAC/legal review, age/store rating, privacy/data-safety declarations, no consumption gamification. **Dependencies:** legal/privacy owners and deployed SDK list. **Acceptance:** signed review and public policy URL before submission.
