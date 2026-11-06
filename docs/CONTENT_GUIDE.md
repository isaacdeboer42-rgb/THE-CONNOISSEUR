# Catalogue and editorial guide

`validateRecipeContent` is the publication gate for the active catalogue. A published recipe version must have a stable recipe ID, unique version ID, positive version/base servings/preparation time, family and variant description, source, reviewer and review timestamp.

Every requirement needs a unique ID, known ingredient, positive amount, unit and scaling policy. Substitutions are ordered alternatives and must be editorially approved. Garnishes are optional and never block readiness. Ice used for shaking/stirring is `standard-ice`; a serving cube is `large-ice`; ordinary water is implicit and never asks the user for confirmation.

Every version needs ordered, uniquely identified steps with titles and instructions, named equipment, and six flavour values between 0 and 1. Timers are optional but positive. Changing quantities, requirements, substitutions or steps creates a new immutable version so an open Make session stays pinned.

Publication lifecycle is draft → reviewed → published → withdrawn. Only published versions enter recommendations. Withdrawal never silently erases a save: the saved reference remains with its name, last version and a clear unavailable reason until the user removes it. Re-publication requires a new reviewed version.

Product catalogue submissions remain private unless the owner explicitly opts in. Reviewers inspect the submitted evidence, make approve/merge/reject decisions, correct mappings and aliases, and retain model/version, decision and audit timestamps. Private edits after submission do not rewrite submitted evidence.

Source and image rights must be documented outside the recipe source label before public launch.
