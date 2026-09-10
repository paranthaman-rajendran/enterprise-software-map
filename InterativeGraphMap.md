# Enterprise Software Map — Requirements

## 1. Purpose

A web UI for visualizing an **enterprise software product** as an interactive graph that covers both
sides of the product at once:

- **Functional** — what the product does: business capabilities, features, user journeys, actors,
  business rules.
- **Technical** — how it is built: systems, services, APIs, data stores, integrations, infrastructure.

The defining behavior is **progressive disclosure**. A user starts at a single high-level picture of
the whole product, drills down level by level into the areas they care about, and can deep-dive into
one specific area without loading or being distracted by the rest. The two sides are linked, so a
user can move from a business capability to the services that implement it — and back.

**Primary audiences:** architects and engineers onboarding onto an unfamiliar system; product and
business stakeholders who need the functional picture; anyone doing impact analysis before a change.

## 2. Core concepts

### 2.1 Levels of abstraction

Every node sits at a **level**. The canvas shows one level at a time by default, and drilling into a
node reveals its children at the next level down.

| Level               | Functional view                                | Technical view                                |
| ------------------- | ---------------------------------------------- | --------------------------------------------- |
| L0 — Landscape      | The product and the products it interacts with | The product and its external systems          |
| L1 — Domain         | Business domains / capability areas            | Systems and major subsystems                  |
| L2 — Building block | Capabilities, features                         | Services, applications, data stores           |
| L3 — Detail         | User journeys, journey steps                   | Components, modules, APIs, topics, schemas    |
| L4 — Deep dive      | Business rules, acceptance criteria            | Endpoints, tables, jobs, config, source files |

A node's children may be sparse: not every branch needs to reach L4. Depth is populated where detail
exists, and the UI must make clear when a node has no deeper detail.

### 2.2 The two views

Functional and technical nodes live in **one graph**, not two. They are connected by traceability
edges (`realizes`, `implemented-by`, `depends-on`), which is what makes questions like "which
services break if this capability changes?" answerable. The user can view either side alone or both
together.

## 3. Primary user stories

- **US-1** — As a newcomer, I open the map and see one uncluttered L0 picture of the whole product,
  not a hairball of every node.
- **US-2** — As an architect, I drill from a domain into its services and then into one service's
  components, and a breadcrumb shows where I am and lets me climb back.
- **US-3** — As an engineer, I deep-dive into a single service and see only it and its immediate
  neighbours, with everything else out of the way.
- **US-4** — As a product stakeholder, I switch to the functional view and read the map as
  capabilities and journeys, with no infrastructure showing.
- **US-5** — As an analyst, I select a business capability and see exactly which services, APIs, and
  data stores implement it.
- **US-6** — As an engineer planning a change, I select a service and see everything upstream and
  downstream of it, so I can judge blast radius.
- **US-7** — As a maintainer, I point the app at our architecture markdown docs and the map is
  populated from them, including levels and parent/child structure.
- **US-8** — As a user, I edit the map directly — add a missing service, correct a dependency, fill
  in properties — and my work persists.
- **US-9** — As a user, I search for anything by name and jump straight to it at its own level,
  wherever it sits in the hierarchy.
- **US-10** — As a user, I share a link or an export that reopens the exact view I was looking at.

## 4. Functional requirements

### 4.1 Levels, drill-down, and deep dive

| ID    | Requirement            | Acceptance criteria                                                                                                                  |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| FR-1  | Open at the top        | The map opens at L0 showing only L0 nodes                                                                                            |
| FR-2  | Drill down             | Activating a node (double-click or a control) reveals its children and makes that node the current context                           |
| FR-3  | Drill up               | A control and the breadcrumb both return to the parent level                                                                         |
| FR-4  | Breadcrumb             | The current path from L0 to the current context is always visible, and each segment is clickable                                     |
| FR-5  | Leaf indication        | A node with no children is visually distinct from one that can be expanded                                                           |
| FR-6  | Expand in place        | A node's children can be revealed inside it without leaving the current level, so a user can compare siblings at mixed depth         |
| FR-7  | Deep-dive / focus mode | Focusing a node shows only that node, its descendants, and its direct neighbours; everything else is hidden until focus is cleared   |
| FR-8  | Neighbourhood depth    | In focus mode the user chooses how many hops of neighbours to include (1, 2, …)                                                      |
| FR-9  | Cross-level edges      | An edge between nodes at different levels is drawn against the nearest visible ancestor of the deeper node, and marked as aggregated |
| FR-10 | Edge roll-up           | Several edges between two subtrees collapse into one edge at the higher level, labelled with how many underlying edges it represents |
| FR-11 | Expand aggregated edge | Selecting an aggregated edge lists the underlying edges it stands for                                                                |

### 4.2 Functional / technical views

| ID    | Requirement    | Acceptance criteria                                                                                                                              |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-12 | View switch    | The user switches between Functional, Technical, and Combined views                                                                              |
| FR-13 | View filtering | A view shows only its own node types; the combined view shows both plus the traceability edges between them                                      |
| FR-14 | Traceability   | Selecting a functional node can reveal the technical nodes that implement it, and vice versa                                                     |
| FR-15 | Coverage gaps  | Functional nodes with no implementing technical node, and technical nodes tied to no capability, can be listed — these are the map's blind spots |
| FR-16 | Type styling   | Node type is distinguishable at a glance (shape, colour, or icon), with a legend                                                                 |

### 4.3 Impact and relationships

| ID    | Requirement           | Acceptance criteria                                                                                       |
| ----- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| FR-17 | Upstream / downstream | For a selected node, highlight what it depends on and what depends on it, transitively, to a chosen depth |
| FR-18 | Path between nodes    | The user picks two nodes and sees how they are connected, if at all                                       |
| FR-19 | Highlight, don't hide | Impact highlighting dims unrelated nodes rather than removing them, so context is kept                    |

### 4.4 Canvas navigation

| ID    | Requirement        | Acceptance criteria                                                                                                         |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| FR-20 | Pan                | Drag on empty canvas moves the viewport                                                                                     |
| FR-21 | Zoom               | Scroll / pinch / controls, centered on the cursor                                                                           |
| FR-22 | Semantic zoom      | Zoom level controls label and detail density: at low zoom nodes show name only, at high zoom key properties appear          |
| FR-23 | Fit-to-view        | A control frames everything currently visible                                                                               |
| FR-24 | Automatic layout   | Each level is laid out readably without overlap, and layout is stable — reopening the same level gives the same arrangement |
| FR-25 | Manual positioning | A dragged node keeps its position, per level, and that position persists                                                    |
| FR-26 | Minimap            | An overview minimap is available for large levels                                                                           |

### 4.5 Selection and properties

| ID    | Requirement              | Acceptance criteria                                                                                                                  |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| FR-27 | Single select            | Selecting a node or edge opens a details panel                                                                                       |
| FR-28 | Details panel            | Shows type, level, parent, description, arbitrary properties, source document link, and lists of incoming and outgoing relationships |
| FR-29 | Navigate by relationship | Clicking a relationship in the panel selects and reveals the node at the other end, even if it sits on another level                 |
| FR-30 | Multi-select             | Shift-click adds to the selection; rubber-band drag selects an area                                                                  |
| FR-31 | Bulk operations          | Delete and property edits apply to the whole selection                                                                               |

### 4.6 Editing

| ID    | Requirement     | Acceptance criteria                                                                                                                         |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-32 | Add node        | Creates a node at a chosen position, at the current level, parented to the current context                                                  |
| FR-33 | Add edge        | Dragging node-to-node creates an edge; the user picks its relationship type                                                                 |
| FR-34 | Re-parent       | A node can be moved to a different parent, and its level updates accordingly                                                                |
| FR-35 | Delete          | Deleting a node deletes its incident edges, and asks what to do with its descendants                                                        |
| FR-36 | Edit properties | Built-in fields and arbitrary key/value properties are editable                                                                             |
| FR-37 | Undo / redo     | All structural and property edits are reversible                                                                                            |
| FR-38 | Validation      | The app refuses edits that break the model: cycles in the parent hierarchy, edges to nonexistent nodes, a child at a level above its parent |

### 4.7 Search and filter

| ID    | Requirement                    | Acceptance criteria                                                                                      |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| FR-39 | Global search                  | Free-text over labels, descriptions, and property values across **all** levels, not just the visible one |
| FR-40 | Result context                 | Each result shows its type and its path from L0, so identically named nodes are distinguishable          |
| FR-41 | Jump to result                 | Selecting a result navigates to that node's level, drilling down as needed, and selects it               |
| FR-42 | Filter by type                 | Show only chosen node types                                                                              |
| FR-43 | Filter by level                | Show only nodes at or above a chosen level                                                               |
| FR-44 | Filter by property             | Filter on property values — for example owning team, lifecycle status, criticality, technology           |
| FR-45 | Filter by edge type and weight | Restrict which relationship types are drawn, and filter numeric weight by range                          |
| FR-46 | Non-destructive                | Filters affect visibility only; clearing a filter restores everything                                    |

### 4.8 Import from source data

| ID    | Requirement              | Acceptance criteria                                                                                            |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| FR-47 | Markdown import          | Each source file becomes a node; frontmatter supplies type, level, parent, and properties                      |
| FR-48 | Relationship extraction  | Links between documents become edges, with the relationship type taken from frontmatter or link context        |
| FR-49 | Hierarchy from structure | Folder nesting and/or an explicit `parent` field establishes the parent/child hierarchy                        |
| FR-50 | Pluggable importers      | Further sources (OpenAPI specs, service catalogues, IaC, CMDB exports) can be added without reworking the core |
| FR-51 | Idempotent re-import     | Re-importing a source updates existing nodes instead of duplicating them                                       |
| FR-52 | Preserve manual work     | Re-import does not discard manual edits, manual positions, or manually added nodes and edges                   |
| FR-53 | Import report            | Lists what was created, updated, skipped, and failed, with reasons                                             |
| FR-54 | Provenance               | Every imported node records the source document it came from, and the panel links back to it                   |

### 4.9 Persistence, sharing, and export

| ID    | Requirement         | Acceptance criteria                                                                                                       |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-55 | Save                | Nodes, edges, hierarchy, properties, and per-level positions are all written to storage                                   |
| FR-56 | Load                | A saved map is restored exactly, including positions                                                                      |
| FR-57 | View state          | The current context, view mode, filters, and focus are captured so a view can be restored — via URL or a saved named view |
| FR-58 | Export JSON         | A self-contained JSON document of the whole map, hierarchy included                                                       |
| FR-59 | Import JSON         | An exported file loads back and round-trips without loss                                                                  |
| FR-60 | Export current view | The visible subgraph can be exported on its own, as data and as an image                                                  |

## 5. Data model

```jsonc
{
  "nodes": [
    {
      "id": "string, stable, unique",
      "label": "string, displayed on canvas",
      "view": "functional | technical",
      "type": "capability | feature | journey | journey-step | business-rule | actor | system | service | application | datastore | component | api | endpoint | table | integration | infrastructure",
      "level": 0,
      "parent": "node id, or null at L0",
      "description": "string",
      "properties": {
        "owner": "team",
        "status": "planned | active | deprecated | retired",
        "criticality": "string",
        "technology": "string",
      },
      "positions": { "<contextKey>": { "x": 0, "y": 0 } },
      "source": {
        "kind": "markdown | openapi | manual | ...",
        "path": "origin document",
      },
    },
  ],
  "edges": [
    {
      "id": "string, stable, unique",
      "source": "node id",
      "target": "node id",
      "type": "depends-on | calls | reads | writes | publishes | subscribes | realizes | implemented-by | contains | precedes",
      "weight": 1.0,
      "properties": {},
      "source_ref": {
        "kind": "markdown | manual | ...",
        "path": "origin document",
      },
    },
  ],
}
```

Constraints:

- Ids are stable across save/load and across re-import, so shared view links, manual positions, and
  undo history stay valid.
- The `parent` relationships form a tree — no cycles, no orphans below L0.
- A child's `level` is exactly one greater than its parent's.
- Every edge's `source` and `target` must reference existing nodes; a map with dangling edges cannot
  be saved.
- `realizes` / `implemented-by` edges are the only ones expected to cross between the functional and
  technical views; all others normally stay within one view.

## 6. Non-functional requirements

| ID    | Requirement                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Because only one level is drawn at a time, on-screen node count stays modest even when the full map is large — size the renderer for the visible level, and the store for the whole map (see OQ-3) |
| NFR-2 | Drill-down, view switching, and focus feel immediate — no visible pause on interaction                                                                                                             |
| NFR-3 | Global search stays responsive across the entire map, not just the loaded level                                                                                                                    |
| NFR-4 | Unsaved changes are never lost silently — autosave, or warn on navigation away                                                                                                                     |
| NFR-5 | Navigation, drill-down, selection, and deletion are all reachable by keyboard                                                                                                                      |
| NFR-6 | Import handles malformed or incomplete source documents by reporting them, not by failing the whole import                                                                                         |
| NFR-7 | The map degrades honestly: missing detail is shown as missing, never as an empty area implying none exists                                                                                         |

## 7. Technology direction

Web front end (HTML/CSS/JavaScript) with a graph visualization library, plus storage and retrieval
behind it. Specific choices are **not yet decided** — see Section 9.

Candidates named so far — visualization: D3.js or Cytoscape.js; backend: Node.js or Django.

Note that the hierarchy, level-at-a-time rendering, and lazy loading of deeper levels matter more to
this choice than raw node count does.

## 8. Out of scope (v1)

- Real-time multi-user collaboration
- Authentication, per-user accounts, and per-node access control
- Automatic discovery of architecture from running systems or live telemetry
- Graph analytics beyond dependency traversal (centrality, clustering, community detection)
- Editing the underlying source documents from within the app — import stays one-way
- Round-tripping the map back into architecture documents
- Export formats beyond JSON and images

## 9. Open questions — decide before implementation

| ID    | Question                                                                                                                        | Why it matters                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1  | Adopt an existing framework for the levels — C4 (Context/Container/Component/Code) or ArchiMate — or define our own vocabulary? | Decides the node type list, the level semantics, and whether existing team diagrams can be imported as-is                                                |
| OQ-2  | D3.js or Cytoscape.js?                                                                                                          | Cytoscape brings graph semantics, compound (nested) nodes, and layouts out of the box — nesting matters a lot here; D3 gives full control at higher cost |
| OQ-3  | Total map size — hundreds of nodes, or tens of thousands across all levels?                                                     | Decides SVG vs. canvas/WebGL, and whether deeper levels must be lazy-loaded from a server                                                                |
| OQ-4  | Node.js or Django backend — or no backend at all (browser storage plus file import/export)?                                     | Determines whether v1 needs a server, a database, and a deployment story; shared view links need a backend or an encoded URL                             |
| OQ-5  | Where do the source documents live — user file picker, uploaded folder, or a repository path the server reads?                  | Browser file access is limited; reading a repo requires a backend                                                                                        |
| OQ-6  | Which markdown conventions define nodes and edges: frontmatter fields, `[[wikilinks]]`, relative links, headings?               | This is the entire import parser; it also decides how much existing documentation must be rewritten                                                      |
| OQ-7  | Is the map authored primarily by import or by hand in the UI?                                                                   | If import leads, conflict handling on re-import (FR-52) is the hardest part of the product                                                               |
| OQ-8  | Are the node and edge type vocabularies fixed, or extensible per organisation?                                                  | A fixed set gives consistent styling and simple filters; an extensible one needs a type-definition UI                                                    |
| OQ-9  | Single map per installation, or multiple products side by side?                                                                 | Changes the storage schema and adds map-management UI                                                                                                    |
| OQ-10 | Can one technical node realize several capabilities, and one capability be realized by several services (many-to-many)?         | Almost certainly yes in a real enterprise — confirm, because it rules out a simple tree and shapes the traceability UI                                   |
