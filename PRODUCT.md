# Enterprise Software Map — Product Document

**Status:** working product, v0.1 · **Last updated:** 10 September 2026

This is the product view: what the thing is for, who it serves, and what it deliberately does not
do. For the numbered requirements see [InterativeGraphMap.md](InterativeGraphMap.md); for how to use
it, [USER_MANUAL.md](USER_MANUAL.md); for how it is built, [README.md](README.md).

The product ships with a read-only map **of itself**, built from this document. Open the app and it
is the first thing you see.

---

## 1. The problem

Large enterprise products are understood in fragments. The business knows what the product does; the
engineers know how it is built; almost nobody holds both, and the link between them lives in
people's heads.

The artefacts that try to bridge this fail in predictable ways:

| Artefact                  | How it fails                                                      |
| ------------------------- | ------------------------------------------------------------------ |
| The big architecture poster | Unreadable. Everything at once is the same as nothing.            |
| A folder of diagrams      | Each is legible; together they contradict each other and go stale.  |
| The wiki                   | Prose cannot answer "what breaks if I change this?"                |
| A CMDB                     | Technical only. No idea which capability a service serves.          |

The cost is paid in onboarding that takes months, in changes that break something nobody predicted,
and in the recurring meeting where five people reconstruct the same picture on a whiteboard.

## 2. What this is

**One map of an enterprise product, covering what it does and how it is built, revealed one level at
a time.**

Three commitments follow from that sentence, and they are the whole product:

**One map, not two.** Business capabilities and technical services live in the same graph, joined by
traceability links. This is what makes "which services implement this capability?" and "which
capabilities break if this service changes?" answerable at all. Two separate diagrams cannot answer
either question, however good each one is.

**Progressive disclosure.** The map opens as a single uncluttered picture and you drill into what you
care about. You are never shown everything at once, because everything at once is the failure mode of
every architecture poster ever printed.

**Honest about what it does not know.** A node with no detail inside says so. Capabilities that no
service implements are listed, not hidden. A map that quietly implies completeness is worse than no
map, because people act on it.

## 3. Who it is for

| User                     | The question they arrive with              | What they use                          |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| **Engineer onboarding**  | "How does any of this fit together?"        | Drill-down, breadcrumb, search           |
| **Architect**            | "Let me show you the shape of this."        | View switching, focus, shareable links   |
| **Engineer making a change** | "What will I break?"                    | Impact, tracing a connection             |
| **Product / business**   | "What does the product actually do?"        | Functional view                          |
| **Analyst**              | "What implements this capability?"          | Traceability, combined view              |
| **Whoever owns the map** | "Where is this wrong or missing?"           | Markdown import, blind spots, editing    |

Single-user and local by design (see §7). The unit of collaboration is a **link**, not a login.

## 4. What it does

### Explore
Open at the landscape, drill in level by level, climb back by breadcrumb. Node type is legible at a
glance — colour for which side, shape for what kind of thing — and a chevron badge marks every node
with something inside, so where it is worth going is obvious without clicking. A node can also be
expanded in place, opening its children inside it while its siblings stay put, for comparing parts
of a system at mixed depth. Relationships whose real endpoints are deeper roll up into one line
labelled with how many they stand for, so nothing is silently dropped.

### Focus
Reduce the map to one node, its insides, and its neighbours to a chosen number of hops. Everything
else goes away. This is the "explain one service to me" mode.

### Understand impact
Select a node and see what depends on it and what it depends on, to a chosen depth, in either
direction. Out-of-scope nodes dim rather than disappear, so you keep your bearings. Separately, pick
any two nodes and see how — or whether — they are connected.

### Cross the two sides
Switch between the functional view, the technical view, and both together. In the combined view,
traceability links join capabilities to the services that realize them, many-to-many in both
directions.

### Find anything
Search spans every level, not the one on screen. Each result carries its path from the top, which is
what tells two identically named nodes apart. Selecting one navigates to its level and selects it.

### See the gaps
Capabilities that nothing implements, and technical nodes tied to no capability, are listed as blind
spots. This is the map reporting on its own incompleteness.

### Build it from documents you already have
Point the importer at a folder of markdown: one file per node, frontmatter for type and properties,
`[[wikilinks]]` for relationships, folder nesting for hierarchy. Preview first — it reports exactly
what it would do without writing. Re-import updates in place and never destroys hand-made nodes,
hand-drawn relationships, or your layout.

### Or build it by hand
Add nodes and relationships, edit properties, delete, undo. The model refuses anything incoherent —
a child at the wrong level, a cycle, a relationship to a node that does not exist — and says
precisely why.

### Share exactly what you are looking at
The URL encodes the level, the view, focus, filters, and selection. One link reopens your screen, not
just your map. The whole map exports as JSON and round-trips back without loss.

## 5. Principles

1. **Progressive disclosure over completeness on screen.** The map may be large; the screen never is.
2. **Missing is shown as missing.** Never render absence as emptiness.
3. **The model refuses incoherence.** Invalid states are rejected at the point of writing, with the
   specific reason, not repaired silently later.
4. **Import never destroys manual work.** Positions, hand-made nodes and edges, and properties a
   document does not mention all survive re-import. Nothing is deleted without being asked for.
5. **A link is the unit of collaboration.** No accounts, no sharing model — just a URL that
   reproduces a view.
6. **Explain, don't just display.** A rolled-up edge says how many it stands for; a rejected edit
   says which rule it broke; an import says what it did and what it could not.

## 6. What it deliberately is not

Naming these is part of the product, because each is a plausible thing to expect:

- **Not a live discovery tool.** It does not watch running systems or telemetry. The map says what
  someone recorded, and is honest that this is what it says.
- **Not a diagramming tool.** You cannot draw an arbitrary picture. Everything on the canvas is a
  node or relationship in a validated model.
- **Not a documentation system.** Import is one-way. The app never writes back to your documents;
  they stay the source of truth for what they describe.
- **Not multi-user.** No accounts, no permissions, no real-time collaboration.
- **Not a graph analytics platform.** Dependency traversal and path-finding, yes. Centrality,
  clustering, community detection, no.

## 7. Shape of the thing

A local web application: a Node API over SQLite, and a browser client rendering with Cytoscape.js.
One command starts both.

Sized deliberately for **hundreds of nodes**, which is what an enterprise product's architecture
actually is when recorded at these five levels. That assumption buys a great deal of simplicity: the
client holds the whole map, so navigation never waits on the network; search is instant across every
level; and every write validates the entire map before committing, which makes the model rules exact
rather than approximate.

Five levels, L0 Landscape to L4 Deep dive, close enough to C4 that a C4 diagram maps on without
translation — but with first-class types for the functional side, which C4 has no way to express.

## 8. Where it stands

**Working:** exploration with drill-down and expand-in-place, focus, impact, path-finding, search
across every level, filtering by type, depth, property and relationship weight, blind spots, hand
editing with undo, markdown import with preview and safe re-import, JSON export/import, shareable
view links that reproduce the whole screen, and a locked reference map of the product itself.

**Not yet built**, in rough order of how much they are missed:

| Gap                          | Note                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| Redo                         | Undo works; redo is not wired up                             |
| Importers beyond markdown    | The seam exists — OpenAPI, IaC, CMDB do not                  |
| Image export                 | JSON export works; images and partial exports do not          |
| Minimap                      | Pan, zoom and fit cover most of the need at this size         |
| Bulk property editing        | Bulk delete works                                             |
| Drag-to-reparent             | The API and re-levelling logic are done and tested            |
| Watching a documents folder  | Import is a button, not a subscription                        |

## 9. What would make it succeed

Honest measures, not vanity ones:

- A new engineer answers "what talks to what" without asking a person.
- Someone planning a change finds a dependency they did not know about.
- The blind spots list gets shorter over time — the map is being maintained, not abandoned.
- Re-import is run repeatedly rather than once, which means people trust it not to destroy their
  work.

The failure mode to watch for is the map going stale and quietly lying. Import from documents people
already maintain is the main defence; blind spots are the second.

## 10. Open risks

- **Staleness.** A hand-maintained map decays. Mitigated by import, not solved by it.
- **Import conventions are a commitment.** Frontmatter and wikilinks now shape how teams write
  documents. Changing them later is a migration.
- **Single-user is a real ceiling.** The moment two people need to edit one map, the architecture
  needs revisiting — there is no merge story.
- **The hundreds-of-nodes assumption.** Well inside the target, but a map an order of magnitude
  larger would need lazy loading and a different search.
