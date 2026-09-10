# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A web UI for exploring an enterprise product as an interactive graph, functional and technical sides
in one map, revealed one level at a time. Requirements are in `InterativeGraphMap.md` (numbered
FR-1..FR-60, NFR-1..NFR-7) and stack decisions in `DECISIONS.md`. Both are current; the requirements
document is the source of truth for behaviour, so when changing something, check whether an FR
covers it.

## Commands

```bash
npm install
npm run dev          # API on :5174, UI on :5173, both watched
npm test             # all three packages
npm run typecheck    # tsc -b across the project
npm run build        # typecheck + build the client

npm test -w @map/shared    # one package
node --import tsx --test packages/shared/src/validate.test.ts   # one file
```

Tests run through `tsx`, not Node's own type stripping — the source uses `.js` specifiers (correct
for Node ESM output) and Node's stripper will not resolve those back to `.ts`.

## Architecture

Three workspaces, and the dependency direction matters:

```
shared  <-  server
   ^
   +------  web
```

**`packages/shared`** holds the model and everything that reasons about it: level rules, the
invariant checker, hierarchy walks, edge roll-up, focus/impact traversal, search, and the markdown
importer's parser and merge planner. It knows nothing about storage or rendering, which is why the
same code runs on both sides. New graph logic belongs here by default.

`markdown.ts` is pure on purpose: it takes document *text* and returns a whole prospective map, so
the import is testable without fixtures on disk, and a future importer for another source (FR-50)
can reuse `planImport` without reusing the parser. Only `packages/server/src/importer.ts` touches
the filesystem.

**`packages/server`** is Fastify + SQLite (`node:sqlite`). Two patterns to preserve, both living in
`MapRepository` so that no route can bypass them: every write reads the map, applies the change in
memory, validates the **whole** prospective state with `validateGraph`, and commits in a transaction
(this is what makes FR-38 exact); and every write calls `assertWritable` first, which is what makes a
locked map genuinely read-only. Do not add a write path that skips either.

The schema uses `CREATE TABLE IF NOT EXISTS`, so a new column also needs an entry in `ADDED_COLUMNS`
in `db.ts` — otherwise existing databases silently lack it.

**`packages/web`** is Vite + React + Cytoscape.js. The important separation is that
`src/graph/viewModel.ts` decides what is on screen as a pure function of (map, view spec), and
`GraphCanvas` just renders whatever it returns. Progressive-disclosure behaviour goes in the view
model, where it is testable without a browser; Cytoscape wiring stays in the canvas component.

Two things in the canvas layer are easy to break by accident:

- The node badges are SVG data URIs exported from `graph/style.ts`, and `Legend.tsx` imports the
  same constants. Do not hand-draw a second copy in the legend — that is how a key starts lying.
- `GraphCanvas` keeps a `ResizeObserver` on its container. Cytoscape measures the container once, so
  without it a layout that runs before the pane has a size puts the whole map off screen and the
  canvas looks blank. Removing it brings that bug back.

## Constraints that are easy to break

- **A child's level is parent.level + 1**, always. The API derives level from the parent and ignores
  what the client sends. Re-parenting shifts the whole subtree (`reparent` in `validate.ts`).
- **Positions are keyed by context**, not one x/y per node — a node can be drawn on more than one
  screen. Use `contextKey()`.
- **Ids must be stable** across save/load and re-import; shared links, saved positions, and undo all
  depend on it. Imported nodes get deterministic ids from their source path, not random ones.
- **The client holds the whole map in memory.** This is a deliberate consequence of the map being
  small (OQ-3). If that assumption changes, `searchNodes` and the repository's read-apply-validate
  cycle are the two places that break.
- **Import must never destroy manual work** (FR-52). Positions, hand-made nodes, hand-drawn edges,
  and properties a document does not mention all survive a re-import; a document that fails to parse
  leaves its previous node intact; nothing is deleted without an explicit `prune`. The merge rules
  live in `planImport` and are covered by tests named after the FRs — change them deliberately.
- **Imported ids come from the file path.** That is what makes re-import idempotent. Deriving them
  from the label or type instead would duplicate nodes on every rename.
- **The product map (`productMap.ts`) is re-seeded on every start and locked.** Keep it in step with
  PRODUCT.md when the product changes. Its unbuilt features are deliberately left with no `realizes`
  edge so they show up as blind spots — do not "fix" that.

## Conventions

- Comments explain *why*, and cite the FR number when the reason is a requirement. The codebase is
  fairly heavily commented for this reason — the requirements are dense and the rationale is not
  recoverable from the code alone.
- Validation errors carry a stable `code` so callers can react to a specific violation instead of
  matching on message text.
- A feature is not done when its logic passes a test — it is done when a user can reach it. Three
  requirements (FR-6, FR-44, FR-45) once had working view-model support, passing tests, and no
  control anywhere in the UI. When adding behaviour, check the affordance exists too.
- New behaviour that an FR covers should get a test naming that FR, as the existing tests do.
