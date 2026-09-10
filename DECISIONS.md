# Decisions

Resolutions to the open questions in [InterativeGraphMap.md](InterativeGraphMap.md) §9. Six were
decided by the project owner; the rest follow from those, and are marked as such — revisit any of
them freely, they were chosen to be cheap to change.

| ID    | Question                     | Decision                                                    | Decided by  |
| ----- | ---------------------------- | ----------------------------------------------------------- | ----------- |
| OQ-1  | C4 / ArchiMate or our own?   | Our own vocabulary, C4-compatible levels                     | Implied     |
| OQ-2  | D3 or Cytoscape?             | **Cytoscape.js**                                             | Owner       |
| OQ-3  | How big is the map?          | **Hundreds of nodes** (low thousands at the outside)         | Owner       |
| OQ-4  | Backend or not?              | **Node.js backend**, SQLite storage                          | Owner       |
| OQ-5  | Where do source docs live?   | **Server reads a folder path**                               | Owner       |
| OQ-6  | Markdown conventions?        | **Frontmatter + `[[wikilinks]]`**                            | Owner       |
| OQ-7  | Import-led or hand-authored? | **Both; hand-authoring built first**                         | Owner       |
| OQ-8  | Fixed or extensible types?   | Fixed node/edge vocabulary, free-form properties             | Implied     |
| OQ-9  | One map or many?             | Many — the schema and API are multi-map from the start       | Implied     |
| OQ-10 | Many-to-many traceability?   | Yes                                                          | Implied     |

## The six that were chosen

### OQ-2 — Cytoscape.js

Compound (nested) nodes, a dozen layout algorithms, and graph traversal are built in, and all three
map directly onto requirements here: nesting is FR-6, layouts are FR-24, traversal is FR-17/FR-18.
D3 would mean hand-building each of those.

Two layout extensions are registered: `dagre` (the default, "Flow layout" — deterministic, and
dependency direction reads left-to-right) and `fcose` (organic, seeded with `randomize: false` so
FR-24's stability requirement holds).

### OQ-3 — hundreds of nodes

This is the decision the whole architecture leans on. Because the map is small:

- the client loads the **whole** map and re-renders one level at a time from memory, so drill-down
  and view switching have no network round trip (NFR-2);
- search is a scored linear scan rather than an index (NFR-3), and runs client-side as you type;
- every server write reads the map, applies the change, validates the **entire** prospective state,
  and commits in one transaction — which is what makes FR-38 exact rather than approximate.

None of that survives a jump to tens of thousands of nodes. The places that would have to change are
marked in the source: `searchNodes` in `packages/shared/src/search.ts` and `MapRepository`'s
read-apply-validate-commit pattern.

### OQ-4 — Node.js backend

Fastify + SQLite via Node's built-in `node:sqlite`. That last choice deserves a note: `node:sqlite`
is still flagged experimental by Node, and it prints a warning on startup. It was chosen over
`better-sqlite3` because it needs no native compilation on any developer machine, which on Windows is
a meaningful saving. If the experimental status becomes a problem, swapping in `better-sqlite3` is a
change to `packages/server/src/db.ts` alone — the API is near-identical.

### OQ-5 / OQ-6 — a folder of markdown, frontmatter and wikilinks

The importer reads a folder path given by the user, on the machine the server runs on. A browser
file picker cannot watch a directory or resolve relative links between documents, and there is a
backend anyway, so the server does the reading. `MAP_IMPORT_ROOT` optionally confines imports to one
subtree; it is unset by default because the app is single-user and local.

The conventions, in full, are documented for users in USER_MANUAL.md §14. In brief: one file is one
node; frontmatter supplies identity, type, parent and properties; a frontmatter key named after a
relationship type turns its `[[wikilinks]]` into edges of that type; `[[wikilinks]]` in the body take
their type from the heading they sit under, defaulting to `depends-on`; and folder nesting supplies
the hierarchy unless a `parent` field overrides it.

Three index conventions are accepted for "the document that stands for this folder", because teams
write all three: `payments/index.md`, `payments/payments.md`, and the sibling form `payments.md` next
to a `payments/` folder.

### OQ-7 — hand-authoring first

The editor was built first and the importer second. That ordering paid off: the merge rules in
FR-52 were designed against a working model with real manual edits to preserve, rather than in the
abstract.

## The four that follow

### OQ-1 — our own vocabulary

The spec's §5 type list is used as written. The five levels line up with C4 closely enough that a C4
diagram maps onto L0–L3 without translation, but the type list stays ours because C4 has no
first-class way to express the functional side — capability, journey, business rule.

### OQ-8 — fixed types, free-form properties

`NODE_TYPES` and `EDGE_TYPES` are closed unions, which is what lets the canvas style every node
consistently (FR-16) and lets filters be built from a known list (FR-42/FR-45). Organisation-specific
variation goes in `properties`, which is free-form and drives the property filter (FR-44) and its
facets. A type-definition UI is a v2 concern if it is ever needed.

### OQ-9 — many maps

The schema is keyed by `map_id` throughout and the API is `/api/maps/:mapId/...`. This cost almost
nothing to build in and would have been invasive to retrofit.

### OQ-10 — many-to-many traceability

Confirmed by construction: `realizes` / `implemented-by` are ordinary edges, so one capability may be
realized by several services and one service may realize several capabilities. The demo map exercises
this — `cap:search` realizes both the search and catalog services.

## Decisions not in the spec

**Positions are stored per context.** A node can appear on more than one screen (its own level, or
inside an expanded parent). FR-25 says a dragged node keeps its position, so a node carries a map of
positions keyed by context rather than a single x/y. See `contextKey()`.

**Level is derived, never trusted.** The API accepts a `level` on node creation because the schema
requires one, and then ignores it — the level is computed from the parent. A client cannot create a
node at a level its parent contradicts.

**Cross-view edges warn rather than fail.** §5 says only `realizes` / `implemented-by` should cross
between the functional and technical views. Enforcing that as an error would make the tool refuse to
record something a real architecture contains, which NFR-7 argues against. It is a warning.

**Imported ids come from the file path, not the label or type.** FR-51 needs ids stable across
re-import. Deriving the id from the path (`payments/api.md` becomes `payments:api`) means renaming a
heading or fixing a type updates the node in place. The trade-off is that *moving* a file reads as a
delete plus a create — which is honest, since the folder tree is the hierarchy, so moving a file
really is a structural change.

**Re-import never deletes by default.** A document that disappears leaves its node in place, listed
in the report as orphaned; removing it takes an explicit `prune`. Deleting a user's work because a
path was mistyped is a worse failure than leaving a stale node visible. A document that fails to
parse likewise leaves last run's node alone, so a syntax error cannot destroy the map.

**A map can be locked, and the lock is enforced in the repository.** The product ships with a map
of itself, which has to read the same for everyone. `assertWritable` sits inside `MapRepository`
rather than in the routes, so a future write path cannot reach storage without passing it — the same
reasoning that puts `validateGraph` there. Refusals come back as 403.

Three deliberate consequences:

- **There is no endpoint to clear the lock.** Seeding sets it; nothing reachable over HTTP unsets
  it. An unlock endpoint would defeat the point of shipping a reference map. The cost is that a user
  cannot lock a map of their own.
- **Saved views are still allowed on a locked map.** A named view is the reader's own working state,
  not the map's content, so locking it would be pointless friction.
- **Locked maps sort first**, which is what makes the product's own map the one the client opens by
  default. The alternative — an explicit "default map" column — was more machinery for the same
  outcome.

**The drill-in affordance is a badge and a cursor, not a border weight.** FR-5 asks only that a
node with children be "visually distinct" from a leaf, and a heavier border satisfies that literally
while failing it in practice — a reader scanning a level should not have to compare borders to work
out what is worth opening. Nodes that can be opened carry a chevron badge and switch the cursor to
`zoom-in` on hover.

The badge is an SVG data URI rather than a DOM overlay because Cytoscape renders to a canvas; a real
element would not stay glued to the node through pan and zoom. `Legend.tsx` imports the same data
URIs the stylesheet uses, so the key and the canvas cannot disagree.

**The canvas re-frames itself when its container is first given a size.** Cytoscape measures its
container once. If the first layout runs before the pane has been laid out — which happens on
reload, and whenever the canvas is mounted hidden — every position is computed against a zero-sized
viewport and the map lands off screen, looking like an empty canvas. A `ResizeObserver` fixes the
dimensions as soon as they are real and re-frames once on the transition out of zero size. Later
resizes only call `resize()`, so a user who has deliberately panned somewhere is not yanked back.

**The product map is re-seeded on every server start.** It is read-only, so there is never user work
in it to overwrite, and re-seeding means it cannot drift from the code that describes it. It lives in
`productMap.ts` and should change alongside PRODUCT.md.

**On re-import the document wins for its own fields, and only those.** Label, type, description and
document-declared properties are overwritten. Manual positions, properties the document does not
mention, hand-made nodes, and hand-drawn relationships are all left alone (FR-52).
