# Enterprise Software Map

A web UI for exploring an enterprise product as an interactive graph — the functional side (what it
does) and the technical side (how it is built) in one map, linked by traceability, and revealed one
level at a time.

| Document                                       | What it is for                                          |
| ---------------------------------------------- | -------------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)                       | What the product is for, who it serves, where it stands  |
| [USER_MANUAL.md](USER_MANUAL.md)               | How to use it                                            |
| [InterativeGraphMap.md](InterativeGraphMap.md) | The numbered requirements (FR-1..FR-60, NFR-1..NFR-7)    |
| [DECISIONS.md](DECISIONS.md)                   | Stack choices, and the answers to the spec's open questions |
| This file                                      | How it is built, and how to work on it                   |

## Running it

```bash
npm install && npm run dev
```

The API comes up on `http://127.0.0.1:5174` and the UI on `http://localhost:5173`.

```bash
npm test          # 108 tests across the three packages
npm run typecheck # includes the test files, which no build config covers
npm run build     # typecheck + build the client
```

The database is a file at `packages/server/data/map.db` (override with `MAP_DB`). Deleting it and
restarting rebuilds everything below.

## What ships in the box

**A read-only map of this product itself** — 74 nodes across four levels on both sides, built from
[PRODUCT.md](PRODUCT.md). It is listed first, so it is what opens by default, and it is locked: the
server refuses every write to it. Re-seeded on every start, so it cannot drift from the code. Change
it in `packages/server/src/productMap.ts`, alongside PRODUCT.md.

**An editable demo map** — a fictional commerce platform, 61 nodes, seeded once on an empty
database. Somewhere to experiment without touching anything real.

**A sample document set** — `examples/architecture-docs`, twelve markdown files exercising every
import convention. Point the importer at it to see what a working document set looks like.

## Layout

```
packages/
  shared/   the model, its invariants, every graph query, and the markdown parser + import planner
  server/   Fastify + SQLite; all writes validate the whole map before committing
  web/      Vite + React + Cytoscape.js
```

`shared` is where the interesting logic lives, deliberately: the level rules, edge roll-up, focus and
impact traversal, search, and the import merge all run identically on the server and in the browser.

## How it works

**One level at a time.** The canvas draws the children of the current context and nothing else.
Double-click a node to drill in, `Backspace` or the breadcrumb to climb back out.

**The affordance is explicit.** A node with something inside carries a chevron badge in its corner
and a heavier double border, and hovering it turns the cursor into a magnifier; a leaf has neither.
The badge is an SVG data URI in `graph/style.ts` that the Legend imports too, so the canvas and its
key cannot drift apart. FR-5 asks only that the two be "visually distinct" — a border weight alone
turned out to be too quiet to scan.

**Expand in place.** *Expand here* in the details panel opens a node's children inside it without
leaving the level, so siblings at mixed depth can be compared. The chevron flips to point up, and
the node is drawn as a labelled container (FR-6).

**Edges roll up.** When a relationship's real endpoints are deeper than the level on screen, it is
drawn against the nearest visible ancestor and marked with a count — `4×` means four real
relationships between those two subtrees. Selecting one lists them.

**Focus** shows a single node, everything under it, and its neighbours to a chosen number of hops.
**Impact** dims everything outside a node's blast radius rather than hiding it, so the surroundings
stay legible.

**Search spans every level**, not just the visible one, and each result carries its path from L0 —
which is what tells two identically named nodes apart. Selecting one navigates to its level and
selects it there.

**Filters** cover node type, relationship type, depth, property value, and relationship weight. The
property dropdowns are built from `/facets`, so they only ever offer values the map actually
contains.

**Blind spots** (in the left sidebar) lists capabilities that no service implements and technical
nodes tied to no capability. These are the gaps in the map, surfaced rather than hidden.

**The URL is the view.** Context, view mode, expansions, focus, impact, every filter — including
property clauses and the weight range — and the selection are all encoded in it, so *Share* copies a
link that reopens exactly what you were looking at.

**Markdown import.** Point it at a folder and the map is built from the documents: one file per
node, frontmatter for type/parent/properties, `[[wikilinks]]` for relationships, folder nesting for
the hierarchy. *Preview* runs the whole thing and reports what it would do without writing. Re-import
updates in place and leaves your positions, hand-made nodes, and hand-drawn edges alone. Conventions
are in USER_MANUAL.md §14.

**Read-only maps.** A map can be locked. `MapRepository.assertWritable` gates every write path, so
the refusal lives in one place rather than being repeated per route, and the client reads the
`locked` flag to hide editing affordances instead of offering actions guaranteed to 403. Saved views
still work on a locked map — they are the reader's own state, not the map's content.

### Keyboard

| Key           | Action                        |
| ------------- | ----------------------------- |
| `Enter`       | Drill into the selected node  |
| `Backspace`   | Go up one level               |
| `Escape`      | Clear focus, then selection   |
| `Delete`      | Delete the selection          |
| `Ctrl/Cmd+Z`  | Undo                          |

## The model

Nodes sit at levels L0 (landscape) to L4 (deep dive) and form a tree. Three rules are enforced on
every write, and a map that breaks them cannot be saved:

- a child's level is exactly one more than its parent's;
- the parent hierarchy has no cycles and no orphans below L0;
- every edge references nodes that exist.

Violations come back as HTTP 422 with the specific reason, which the UI shows verbatim. A write to a
locked map comes back as 403.

Functional and technical nodes live in **one** graph, joined by `realizes` / `implemented-by` edges.
That is what makes "which services break if this capability changes?" answerable, and it is
many-to-many in both directions.

## Storage and migrations

SQLite through Node's built-in `node:sqlite`, so there is no native module to compile. The schema is
`CREATE TABLE IF NOT EXISTS`, which means a column added after the fact needs an explicit,
idempotent `ALTER TABLE` — see `ADDED_COLUMNS` in `packages/server/src/db.ts`. That list is the whole
migration story, and it is enough at this size.

## What is not built yet

Ordered roughly by how much they are missed:

- **Redo (half of FR-37).** Undo works and is a real inverse-operation stack; redo needs the inverse
  of each undo captured at undo time, which is not wired up. The button says so rather than lying.
- **Minimap (FR-26).** Cytoscape has no built-in minimap and the extension is unmaintained; pan/zoom
  and fit-to-view cover most of the need at this map size.
- **Image export (half of FR-60).** JSON export of the whole map works; exporting the visible
  subgraph, and exporting as an image, do not.
- **Rubber-band multi-select** is enabled on the canvas and bulk delete works, but bulk *property*
  editing (the rest of FR-31) is not built.
- **Re-parenting from the UI.** The API and the subtree re-levelling logic are done and tested;
  there is no drag-to-reparent gesture yet.
- **Importers other than markdown (FR-50).** The seam is there — `source.kind` is open and the merge
  logic in `planImport` takes parsed documents, not files — but OpenAPI, IaC and CMDB importers are
  not written.
- **Watching the documents folder.** Import is a button, not a subscription; re-run it after the
  documents change.

## Known rough edges

- `node:sqlite` is experimental and prints a warning on every server start. See OQ-4 in DECISIONS.md
  for why it was chosen anyway and how to swap it out.
- Actors show up in the "capabilities nothing implements" list. Arguably an actor is never
  implemented by a service, so it may deserve exclusion from that check — left as-is pending a view
  on whether that is noise or a genuine prompt.
- **The lock has no UI.** It is set by seeding only, and there is deliberately no endpoint to clear
  it — an endpoint that unlocks a map would defeat the point of shipping reference maps. The
  consequence is that a user cannot lock a map of their own, which is a gap if that is ever wanted.
- Dragging a node on a read-only map moves it on screen but is not saved, and says nothing. Failing
  loudly on every drag would be worse, but the silence is a small surprise.
