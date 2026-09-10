# Enterprise Software Map — User Manual

A guide to using the map. For how the code is organised, see [README.md](README.md); for why the
stack was chosen, [DECISIONS.md](DECISIONS.md).

---

## Contents

1. [What this is](#1-what-this-is)
2. [Starting the application](#2-starting-the-application)
3. [A five-minute tour](#3-a-five-minute-tour)
4. [The screen at a glance](#4-the-screen-at-a-glance)
5. [Reading the map](#5-reading-the-map)
6. [Moving around](#6-moving-around)
7. [Functional, technical, or both](#7-functional-technical-or-both)
8. [Focus — one thing at a time](#8-focus--one-thing-at-a-time)
9. [Impact — what breaks if this changes](#9-impact--what-breaks-if-this-changes)
10. [Tracing a connection](#10-tracing-a-connection)
11. [Searching](#11-searching)
12. [Filters](#12-filters)
13. [Blind spots](#13-blind-spots)
14. [Building the map from markdown](#14-building-the-map-from-markdown)
15. [Inspecting and editing](#15-inspecting-and-editing)
16. [Sharing and exporting](#16-sharing-and-exporting)
17. [Keyboard reference](#17-keyboard-reference)
18. [Rules the map enforces](#18-rules-the-map-enforces)
19. [Troubleshooting](#19-troubleshooting)
20. [Glossary](#20-glossary)

---

## 1. What this is

A map of an enterprise software product, showing two things at once:

- **The functional side** — what the product does: capabilities, features, user journeys, actors,
  business rules.
- **The technical side** — how it is built: systems, services, data stores, APIs, integrations.

They are not two separate diagrams. They live in one graph, joined by *traceability* links, which is
what lets you start from a business capability and end up at the services that implement it — or go
the other way.

The map is **revealed one level at a time**. You open on a single uncluttered picture of the whole
product and drill into the parts you care about. You are never shown all of it at once, because all
of it at once is unreadable.

**Who it is for**

| If you are…                          | You will mostly use…                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| New to the system, finding your feet  | Drill-down, breadcrumb, search                                 |
| An architect explaining the shape     | View switching, expand-in-place, sharing a link                |
| An engineer going deep on one service | Focus mode, the details panel                                  |
| Planning a change                     | Impact, tracing a connection                                   |
| A product or business stakeholder     | The Functional view, blind spots                               |
| Keeping the map honest                | Editing, blind spots                                           |
| Building the map from existing docs   | Markdown import                                                |

---

## 2. Starting the application

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

Two processes start together: the API on port 5174 and the interface on 5173. Leave both running.

Two maps are there when you start:

- **Enterprise Software Map (this product)** — a map of the application you are using, on both
  sides. It opens by default and is marked **Read-only**: it ships with the app, so it reads the
  same for everyone and cannot be changed. Explore it freely; everything except editing works.
- **Orion Commerce Platform** — a fictional commerce platform, 61 nodes across four levels. A
  normal, editable map, there so you have somewhere to experiment.

Switch between them with the selector at the top.

Your work is saved automatically as you make it. There is no Save button and nothing to lose by
closing the tab.

---

## 3. A five-minute tour

Follow this once and the rest of the manual will make sense.

1. **Open the app.** You see a handful of boxes — the whole product at its highest level. Warm-toned
   boxes are business things, cool-toned boxes are technical things.
2. **Double-click a box with a chevron (⌄) badge in its corner.** That badge — and the magnifier
   cursor when you hover it — means there is more inside. You have drilled in. The trail at the top now
   reads `Landscape › …` and the right-hand corner tells you which level you are on.
3. **Click a node once.** The panel on the right fills with its type, description, properties, and
   every relationship it has. Click one of those relationships to jump to the thing at the other
   end.
4. **Press `Backspace`.** You are back up a level.
5. **Type into the search box** on the left — try three or four letters of anything. Results come
   from *every* level, each showing the path that locates it. Click one and the map navigates there.
6. **Select a node and click `Focus`** in the toolbar. Everything except that node, its insides, and
   its immediate neighbours disappears. Click `Clear focus` to bring it all back.
7. **Click `Functional`** in the toolbar. The technical half of the map vanishes and you are reading
   the business picture. `Both` brings it back.

That is the core of the tool. Everything else refines it.

---

## 4. The screen at a glance

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Enterprise Software Map        [ map selector ▾ ]                         │ header
├────────────────────────────────────────────────────────────────────────────┤
│ Functional Technical [Both]  Focus  Impact      Filters Layout▾ Fit Share  │ toolbar
├────────────────────────────────────────────────────────────────────────────┤
│ ↑  Landscape › Orion Platform › Payments Platform      showing L2 · Block  │ breadcrumb
├──────────────┬──────────────────────────────────────────┬──────────────────┤
│ Search       │                                          │                  │
│ Add a node   │                                          │   Details of     │
│ Add a rel'p  │              the  map                    │   whatever is    │
│ Connected?   │                                          │   selected       │
│ Import       │                                          │                  │
│ Legend       │                                          │                  │
│ Blind spots  │                                          │                  │
└──────────────┴──────────────────────────────────────────┴──────────────────┘
```

- **Header** — the application name and, if you have more than one map, a selector to switch between
  them.
- **Toolbar** — how the map is shown: which side, focus, impact, filters, layout, and the
  share/export actions.
- **Breadcrumb** — where you are, and the way back up. The right-hand end always states which level
  is on screen.
- **Left sidebar** — search, the editing forms, markdown import, the legend, and blind spots. The
  sections collapse; click a heading to open or close it.
- **The map** — the canvas.
- **Right panel** — details of the selected node or relationship. Empty until you select something.

Messages (confirmations, errors) appear briefly at the bottom of the screen. Errors stay until you
dismiss them with the `×`, so you can read the detail.

---

## 5. Reading the map

The visual language is small and worth learning once. The **Legend** section in the left sidebar
repeats it if you forget.

### Colour tells you which side

| Appearance          | Meaning                                            |
| ------------------- | -------------------------------------------------- |
| Warm / sand-coloured | **Functional** — a business thing                  |
| Cool / blue-grey    | **Technical** — a built thing                      |

### Shape tells you what kind of thing

| Shape             | Types                                     |
| ----------------- | ----------------------------------------- |
| Rounded rectangle | capability, feature, system, service, application |
| Diamond           | journey, journey step                     |
| Tag               | business rule, API, endpoint              |
| Ellipse           | actor                                     |
| Barrel            | data store, table                         |
| Hexagon           | component, integration                    |
| Octagon           | infrastructure                            |

### A chevron tells you there is more inside

This is the distinction to learn first, because it tells you where it is worth going.

| Appearance                                    | Meaning                                                    |
| --------------------------------------------- | ----------------------------------------------------------- |
| **Chevron badge (⌄) in the corner, thick doubled border** | There is more inside. Double-click to go in.    |
| **Up chevron (⌃)**                            | Already opened in place — collapse it from the details panel |
| No badge, thin single border                  | Nothing deeper is recorded. This is as far as the map goes.  |
| Red, heavy border                             | Currently selected.                                          |
| Dashed frame around other nodes               | An expanded container, showing its children in place.        |

**The cursor tells you the same thing.** Hover a node and the pointer becomes a magnifier (`zoom-in`)
when there is something inside to open, and an ordinary pointer when there is not. So you can tell
what is worth opening without reading the badge at all.

That distinction matters: no badge means *the map has no more detail here*, which is not the same as
*there is no more detail in reality*. The map only ever claims what has been recorded.

### Lines tell you about relationships

| Line                        | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| Solid, with an arrow        | A single real relationship, direction shown by the arrow        |
| **Dashed, labelled `4×`**   | Several relationships rolled into one — see below               |
| **Dotted, rust-coloured**   | Traceability between the functional and technical sides         |
| Thicker line                | Heavier weight (whatever weight means for your map)             |

Line colour varies by relationship type — calls, reads, writes, publishes and so on each have their
own hue — but the three distinctions above are the ones that carry structural meaning.

### Rolled-up lines

When you are looking at a high level, the real relationships are usually between things much deeper
down. Rather than hide them, the map draws them against the visible ancestors and **marks how many
it is standing for**.

A dashed line labelled `4×` between two domains means: *there are four actual relationships between
things inside these two domains*. Click the line and the right-hand panel lists all four, each end
clickable.

An internal relationship — one whose both ends are inside the same visible box — is not drawn at all.
It would be a loop from a box to itself, which says nothing useful. Drill in to see it.

---

## 6. Moving around

### Drilling down and up

| To…                    | Do this                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| Go into a node         | **Double-click** it, or select it and press `Enter`, or use **Drill in** in the details panel |
| Go up one level        | Press `Backspace`, or click the **↑** button in the breadcrumb   |
| Jump to any ancestor   | Click that segment of the breadcrumb                             |
| Open a node without leaving the level | Select it, then **Expand here** in the details panel |
| Return to the top      | Click **Landscape** in the breadcrumb                            |

Double-clicking a node with a thin border does nothing — there is nothing inside it. (Pressing
`Enter` on one will take you in and show a "no detail recorded at this level" message; use the
breadcrumb to come back.)

### Expanding a node in place

Drilling in replaces the screen. Sometimes you want the opposite: to open one node up *without*
leaving the level, so you can compare it against its siblings.

Select a node with children and click **Expand here** in the details panel. It becomes a labelled
frame containing its children, while everything else on the level stays where it was. Click
**Collapse** to close it again.

This is how you look at one subsystem's internals next to its neighbours, rather than in isolation.
Expansions are cleared when you drill somewhere else, and they travel in a shared link.

### The levels

The map has five levels. The breadcrumb states which one you are on.

| Level                 | Functionally                    | Technically                              |
| --------------------- | ------------------------------- | ---------------------------------------- |
| **L0 — Landscape**    | The product and its neighbours  | The product and its external systems     |
| **L1 — Domain**       | Business domains                | Systems and subsystems                   |
| **L2 — Building block** | Capabilities, features        | Services, applications, data stores      |
| **L3 — Detail**       | Journeys and their steps        | Components, APIs, topics, schemas        |
| **L4 — Deep dive**    | Business rules, acceptance criteria | Endpoints, tables, jobs, config       |

Not every branch goes all the way down. Depth exists where somebody recorded it.

### Panning and zooming

- **Pan** — drag on empty canvas.
- **Zoom** — scroll wheel or pinch, centred on the pointer.
- **Fit** — the toolbar button frames everything currently visible.

Zoom in past a certain point and nodes **grow a second and third line** showing their type and owning
team. Zoom back out and they return to names only. This is automatic; there is no setting.

### Arranging the map

The **layout** dropdown in the toolbar offers four arrangements:

| Layout          | Best for                                                       |
| --------------- | -------------------------------------------------------------- |
| **Flow** (default) | Following dependency direction — flows left to right         |
| **Organic**     | Seeing clusters and how tightly things are connected            |
| **Concentric**  | Emphasising the most-connected things in the middle             |
| **Grid**        | Reading a plain list of what is present                         |

**Re-layout** re-runs the current arrangement. **Fit** reframes without rearranging.

Both default layouts are stable: reopening the same level gives you the same arrangement, not a
fresh scramble.

### Moving nodes yourself

**Drag any node** and it stays where you put it, permanently. Positions are saved per level, so
placing a service inside its parent's view does not disturb where the same node sits elsewhere.

Once you have positioned some nodes, **Re-layout** only rearranges the ones you have not touched.

---

## 7. Functional, technical, or both

Three buttons at the left of the toolbar:

| Button        | Shows                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| **Functional** | Only the business side. No infrastructure at all.                          |
| **Technical**  | Only the built side. No capabilities or journeys.                          |
| **Both**       | Everything, plus the traceability links between the two sides.             |

Use **Functional** when walking a business audience through what the product does — the technical
half genuinely disappears rather than being greyed out, so there is nothing to distract.

Traceability links only appear in **Both**, because in a single-sided view they have nothing to
connect to.

### Following traceability

In **Both**, select a capability and look at the right-hand panel. Its outgoing relationships include
`realizes` links to the services that implement it. Click one to jump straight there.

This works in both directions and is many-to-many: one capability can be realized by several
services, and one service can realize several capabilities.

---

## 8. Focus — one thing at a time

When you want to understand a single service and nothing else:

1. Select the node.
2. Click **Focus** in the toolbar.

The map now shows only that node, everything inside it, and its immediate neighbours. The rest of the
map is gone, not dimmed — this is for concentrating, not for context.

A **hops** dropdown appears next to the button. `1` gives immediate neighbours; `2` gives the
neighbours of those neighbours, and so on. Increase it when one hop is too narrow to explain what is
going on.

Click **Clear focus**, or press `Escape`, to return.

Focus follows traceability too, so focusing a service will pull in the capabilities it realizes.

---

## 9. Impact — what breaks if this changes

Before changing something, see what depends on it.

1. Select the node.
2. Click **Impact**.

Everything within the blast radius stays lit; everything outside it **dims but stays visible**, so
you keep your bearings. Two dropdowns appear:

| Control       | Options                        | Use it to ask…                                   |
| ------------- | ------------------------------ | ------------------------------------------------- |
| **Direction** | both ways / downstream / upstream | What does this affect? What does it rely on? What is the whole neighbourhood? |
| **Depth**     | 1 to 5 hops                    | How far do the consequences travel?               |

**Downstream** follows the direction of the arrows — the things this node calls, reads, or publishes
to. **Upstream** is the reverse: the things that depend on this one, which is usually the more
alarming list.

Hierarchy is deliberately not counted as a dependency. A parent containing a child does not mean the
parent depends on it, so containment is excluded from the walk.

Click **Clear impact** to stop.

Focus and Impact can be used together: focus to strip the map down, then impact to highlight within
what is left.

---

## 10. Tracing a connection

To find out whether — and how — two things are connected, open **"How are two things connected?"**
in the left sidebar.

1. Pick a node in the first dropdown.
2. Pick another in the second.
3. Click **Trace**.

The shortest route between them is highlighted in red on the canvas, and written out beneath the form
as a chain of names. If nothing connects them, you are told so plainly rather than being left staring
at an unchanged map.

Both dropdowns list every node in the map at every level, so you can trace between things that are
never on screen together.

Click **Clear** to remove the highlight.

---

## 11. Searching

The search box at the top of the left sidebar searches the **whole map**, not the level you happen to
be looking at. Start typing — results appear after two characters.

Each result shows four things:

```
PSP Adapter                                   ← the name
COMPONENT   L3 Detail                         ← what it is and how deep
Orion Platform › Payments Platform › Payment Service   ← where it lives
matched on description                        ← why it matched, if not the name
```

That third line is the important one. Two things in a large map can easily share a name; the path is
what tells them apart.

Search covers names, descriptions, and property values. A result that matched on something other than
its name says so.

**Click any result** and the map navigates to that node's own level — drilling down through however
many levels are needed — and selects it there. The breadcrumb updates to show where you have landed.

Results are ranked with exact name matches first, then names beginning with your text, then matches
anywhere. Shallower nodes are preferred when scores are otherwise close.

---

## 12. Filters

Click **Filters** in the toolbar. Three groups:

| Group                     | Effect                                                       |
| ------------------------- | ------------------------------------------------------------ |
| **Node types**            | Show only the types you pick — say, only services and data stores |
| **Relationship types**    | Draw only the relationships you pick — say, only `calls`     |
| **Deepest level shown**   | Hide anything below a chosen level                            |
| **Properties**            | Show only nodes with a given owner, status, criticality, technology… |
| **Relationship weight**   | Draw only relationships whose weight falls in a range         |

The **Properties** dropdowns are built from what is actually in the map, so they only ever offer
values that exist. One value per key: choosing a new one replaces the last.

Selections are additive within a group: picking `service` and `datastore` shows both.

The button carries a count of how many filters are active, so a filtered map never silently looks
like an empty one. **Clear all filters** resets everything.

Filters only change what is drawn. Nothing is deleted, and clearing brings it all back.

---

## 13. Blind spots

Open **Blind spots** in the left sidebar. It lists two things:

- **Capabilities nothing implements** — business capabilities with no service traced to them. Either
  the map is incomplete, or the capability genuinely has nothing behind it. Both are worth knowing.
- **Technical nodes tied to no capability** — services and stores that no capability claims. Often
  these are legacy, or the traceability was never recorded.

Every entry is clickable and takes you to that node.

A parent counts as covered when anything inside it is traced, so a whole domain is not flagged merely
because the traceability hangs off its children.

This list is the map's honest account of its own gaps. It is expected to be non-empty early on, and
shrinking it is a good use of the editing features.

> **Note:** actors (Shopper, Merchandiser) currently appear in the first list. An actor is arguably
> never "implemented" by a service, so treat those entries as noise for now.

---

## 14. Building the map from markdown

If your architecture is already written down as markdown, the map can be built from it rather than
by hand. Open **Import from markdown** in the left sidebar.

### Running an import

1. Type the **folder path** — as seen by the machine running the API, not your own machine, if those
   differ.
2. Click **Preview**. Nothing is written. You get the full report of what *would* happen.
3. Read the report, fix anything it complains about, preview again.
4. Click **Import** when the report looks right.

Always preview first. An import rewrites the map, and the report is the only way to see what it is
about to do.

There is a worked example in `examples/architecture-docs` in the project folder — twelve documents
covering every convention below. Point the importer at it to see the shape of a working document set.

### One file, one node

Every `.md` file becomes one node. Everything else is detail.

```markdown
---
type: service
label: Order Service
owner: Orders
technology: Java 21
criticality: critical
---

# Order Service

Owns the order lifecycle from capture to fulfilment.
```

| Frontmatter key | Meaning                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `type`          | The node type — `service`, `capability`, `datastore`, and so on              |
| `label`         | Its name. Falls back to the first `# heading`, then the filename            |
| `description`   | Falls back to the first paragraph of the body                              |
| `parent`        | Overrides the folder structure — see below                                  |
| `id`            | An explicit id. Rarely needed; the path supplies one                        |
| *anything else* | Becomes a **property** — `owner`, `status`, `criticality`, `technology`, …  |

`view` is not something you set: it follows from the type, because a `capability` is functional and
a `service` is technical. Declaring one that disagrees gets a warning, and the type wins.

A file with no frontmatter at all still imports. It is treated as a `system` and the report warns
you, so a folder of plain documents gives you a rough map to correct rather than an error.

### Folders make the hierarchy

A folder's **index document** is the node that contains everything in that folder. Three naming
conventions are accepted, so whichever your team already uses will work:

```
docs/
  index.md                    ← "Acme Commerce"      L0
  platform.md                 ← "Runtime Platform"   L1   (sibling form)
  platform/
    orders.md                 ← "Orders System"      L2   (sibling form again)
    orders/
      order-service.md        ← "Order Service"      L3
      orders-db.md            ← "Orders DB"          L3
  business/
    index.md                  ← "Selling"            L1   (index form)
    checkout.md               ← "Checkout"           L2
```

- `business/index.md` — also `_index.md` or `readme.md`
- `payments/payments.md` — a file named after its own folder
- `payments.md` sitting *next to* a `payments/` folder — the wiki/Obsidian style

To place a document somewhere other than where its folder puts it, set `parent` explicitly:

```yaml
parent: "[[Payments System]]"
```

Nesting deeper than L4 is refused, and the report names the files that were too deep.

### Wikilinks make the relationships

**Typed in frontmatter** — any key named after a relationship type:

```yaml
calls:
  - "[[Payments API]]"
  - "[[Catalog Service]]"
writes: "[[Orders DB]]"
realizes: "[[Checkout]]"
```

**Typed by heading** — links under a heading named after a relationship type take that type:

```markdown
## Writes

- [[Orders DB]]

## Reads

- [[Catalog Service]]
```

**Typed inline** — `[[Ledger|writes]]`. Anything after the `|` that is not a relationship type is
treated as an ordinary display alias and ignored.

**Untyped** — any other `[[wikilink]]` in the body becomes `depends-on`.

Links inside code fences are ignored, so a `[[…]]` in a code sample is not mistaken for a
relationship.

A link target may be a node's **label**, its **file path** (`stores/orders-db.md`), or its
**filename** (`orders-db`). All three resolve to the same node.

To record traceability between the two sides, use `realizes` from a capability to a service. That is
what makes the functional and technical halves one map rather than two.

### What the report tells you

| Section                     | What it means                                                     |
| --------------------------- | ------------------------------------------------------------------ |
| **created** / **updated**   | Nodes made, and nodes matched to an existing one and refreshed      |
| **Could not be read**       | Broken frontmatter or an unknown type. That file only was skipped   |
| **Skipped**                 | Parsed, but unusable — nested too deep, or an id clash              |
| **Links that went nowhere** | A `[[wikilink]]` naming nothing, or something ambiguous             |
| **Warnings**                | Imported, but something was assumed — a missing `type`, say         |
| **document has gone**       | Nodes from a document that is no longer in the folder               |

One bad document never fails the import. Everything else still comes in, and the report names what
did not.

### Re-importing is safe

Run the import as often as you like. It updates in place rather than making a second copy of
everything — a node's identity comes from its file path, so renaming a heading or correcting a type
updates the node you already have.

**Your own work is kept.** Specifically:

| Kept                                       | Overwritten by the document       |
| ------------------------------------------ | ---------------------------------- |
| Nodes you added by hand                    | Label, type, description           |
| Relationships you drew by hand             | Properties the document declares   |
| Node positions you dragged                 | Relationships from that document   |
| Properties the document does not mention   |                                    |

So if you position the map, annotate a node with an `on-call` property, and add a node of your own,
none of that is disturbed by re-importing.

Deleting a link from a document *does* remove the relationship it created — the document is the
authority for its own links.

**Nothing is deleted by default.** If a document disappears, its node stays and is listed under
"document has gone". Tick **Remove nodes whose document has gone** and import again to clear them
out. A document that fails to parse also leaves last run's node alone, so a syntax error can never
destroy your map.

### One-way only

Import runs in one direction. Editing the map in the app never writes back to your documents, and a
later re-import will overwrite app-side edits to any field a document owns. Treat the documents as
the source of truth for anything they describe.

### Where the folder lives

The server reads the folder, so the path is the one the API process can see. If you want to confine
imports to a single directory tree, set `MAP_IMPORT_ROOT` before starting the server, and any path
outside it is refused.

---

## 15. Inspecting and editing

### Read-only maps

Some maps are locked. The header shows a **Read-only** badge next to the map's name, and the
editing tools are simply not there — no *Add a node*, no *Add a relationship*, no *Import*, no
*Delete*, no *Undo*, and the fields in the details panel are greyed and inert.

Everything else works exactly as normal: drilling, focus, impact, tracing, search, filters, blind
spots, sharing a link, and exporting the map as JSON. You can also save named views, because those
are your own working state rather than part of the map.

Dragging a node on a read-only map moves it on screen but is not saved; it returns to its laid-out
position next time.

The map of this product is locked because it ships with the application. To make changes of your
own, switch to another map.

### The details panel

Select any node and the right-hand panel shows everything known about it:

- Its type and level
- Name and description, both editable
- Its parent, with the full path back to the top — every segment clickable
- Its source document, if it came from one
- All its properties
- **Outgoing** and **Incoming** relationships, in full

Every relationship listed is clickable at both ends: click the type to select the relationship
itself, click the name to jump to the node at the other end — **even when it is on a different
level**. This is often the fastest way to walk a map: never touch the canvas, just follow
relationships in the panel.

Four buttons sit under the parent path:

- **Drill in (n)** — enter the node, with the number of children shown. Reads **No detail inside**
  when it is a leaf.
- **Expand here** — open its children inside it without leaving the level, as in section 6. Reads
  **Collapse** once it is open, and is absent for a leaf.
- **Focus** — as in section 8.
- **Delete** — see below.

### Editing text and properties

Change the name, type, or description and **click away from the field** — the edit saves when the
field loses focus. There is no save button.

Properties are free-form key/value pairs, used for things like owning team, lifecycle status,
criticality, and technology. Edit a value in place, remove one with the `×`, or add a new one with
the key/value boxes at the bottom of the section.

Property values are what the property filters work on, so keeping them consistent pays off.

### Adding a node

Open **Add a node** in the left sidebar. The form tells you where the node will go — *"It will be
created inside Payments Platform"* — which is always the level you are currently looking at.

Enter a name, choose a type, click **Add node**. The level is worked out from where you are; you do
not set it and cannot get it wrong.

To add a node somewhere else, navigate there first.

### Adding a relationship

Open **Add a relationship**. Pick a source, a type, and a target, then click **Add relationship**.

Both dropdowns list every node in the map, so relationships can cross levels and cross between the
functional and technical sides. If you have a node selected, it is offered as the source
automatically.

To record traceability, use type `realizes` from a capability to a service.

### Deleting

Delete a node from the details panel, or select it and press `Delete`.

If it has children, you are asked what to do with them:

- **OK** — delete the children too, and everything below them.
- **Cancel** — keep the children, moving them up to take the deleted node's place.

Relationships attached to anything deleted go with it. You are told afterwards exactly how many nodes
and relationships were removed.

Delete a relationship by selecting it and using the button in the details panel, or pressing
`Delete`.

### Selecting several at once

`Shift`-click to add nodes to the selection, or drag a box on empty canvas to select an area. Press
`Delete` to remove them all as a single undoable step.

### Undo

**Undo** in the toolbar, or `Ctrl+Z` (`Cmd+Z` on a Mac), reverses your last change — including bulk
deletes, which come back whole.

Undo covers structural and property edits. It does not cover node dragging; positions are saved
quietly and are not treated as edits.

There is no redo yet. The button will tell you so rather than doing nothing.

---

## 16. Sharing and exporting

### Share a view

**Share** copies a link to the clipboard that reopens **exactly what you are looking at** — the
level, which side is shown, any focus or impact highlighting, every active filter, and the current
selection.

Send it to a colleague and they see your screen, not just your map. This is the fastest way to answer
"which bit do you mean?".

The address bar updates continuously as you navigate, so browser bookmarks work the same way.

### Export

**Export** downloads the entire map as a JSON file — every node, relationship, property, position,
and provenance record. It loads back without loss, so it works as a backup, a way to move a map
between machines, or a way to hand the data to something else.

Exporting only the part you are looking at, and exporting as an image, are not available yet.

---

## 17. Keyboard reference

| Key            | Action                                            |
| -------------- | ------------------------------------------------- |
| `Enter`        | Drill into the selected node                      |
| `Backspace`    | Go up one level                                   |
| `Escape`       | Clear focus; if there is no focus, clear selection |
| `Delete`       | Delete the selection                              |
| `Ctrl/Cmd + Z` | Undo                                              |
| Double-click   | Drill into a node                                 |
| `Shift` + click | Add to the selection                             |
| Drag on canvas | Pan, or box-select                                |
| Scroll         | Zoom                                              |

Shortcuts are ignored while you are typing in a text box, so `Backspace` in the search field deletes
a character rather than navigating.

---

## 18. Rules the map enforces

The map refuses changes that would make it incoherent. If you see a red message, one of these is
why — the message names the specific problem.

- **A child sits exactly one level below its parent.** You cannot skip a level or invert one. This is
  why node creation derives the level from where you are instead of asking you.
- **The hierarchy is a tree.** No cycles, and nothing below the top level without a parent. You
  cannot move a node inside something that is already inside it.
- **Relationships must connect things that exist.** A map with a dangling relationship cannot be
  saved.
- **A node's type must match its side.** A `capability` is functional; a `service` is technical.
  Changing the type moves the node to the matching side automatically.
- **Depth stops at L4.** Nothing can be created below the deepest level, and no move may push
  existing nodes past it.

One rule is a *warning* rather than a refusal: relationships other than `realizes` and
`implemented-by` crossing between the functional and technical sides. It is unusual, so you are told,
but real architectures contain unusual things and the map will record it.

---

## 19. Troubleshooting

**The map is empty and says no map is loaded.**
The API is not running. Both processes start with `npm run dev`; check the terminal for the line
`Server listening at http://127.0.0.1:5174`.

**The canvas is blank but the breadcrumb shows a location.**
Either nothing is recorded inside the node you entered — the canvas says so in words — or your
filters have excluded everything. Check the count on the **Filters** button and clear them.

**Everything looks greyed out.**
Impact highlighting is on. Click **Clear impact**.

**Most of the map has vanished.**
Either Focus is on (click **Clear focus**) or you are in a single-sided view (click **Both**).

**The editing panels have disappeared.**
The map is read-only — look for the **Read-only** badge beside the map name at the top. Switch to
another map to make changes.

**An edit was rejected with a red message.**
The change would have broken one of the rules in section 18. The message names the exact problem.
Nothing was saved; the map is unchanged.

**A node will not let me drill into it.**
It has no children. A node with no chevron badge in its corner — and an ordinary pointer rather
than a magnifier when you hover it — means the map records nothing deeper.

**I dragged nodes into a good arrangement and Re-layout moved them.**
It should not — Re-layout leaves positioned nodes alone. If it happened, the drag may not have
registered; drag again and release over the canvas.

**The server prints a warning about SQLite being experimental.**
Expected and harmless. See OQ-4 in DECISIONS.md.

**An import says the folder does not exist, but it is right there.**
The *server* reads the folder, not your browser. If the API runs on another machine or in a
container, the path has to be valid there. If `MAP_IMPORT_ROOT` is set, paths outside it are refused.

**An import created far more nodes than expected.**
Every `.md` file under the folder becomes a node, however deep. Point the importer at the
architecture documents specifically rather than at the root of a repository.

**Everything imported as type `system`.**
None of the documents declared a `type`. The report warns per file; add `type:` to their frontmatter.

**A wikilink did not become a relationship.**
Check the report's "Links that went nowhere". Usually the target name matches no node's label, path,
or filename — or two nodes share a name, which makes it ambiguous, and the importer refuses to
guess.

---

## 20. Glossary

| Term                | Meaning                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Node**            | Anything on the map — a capability, a service, a data store, an actor.                       |
| **Relationship**    | A link between two nodes: calls, reads, writes, depends-on, realizes, precedes, and others.  |
| **Level**           | Depth, from L0 (the whole landscape) to L4 (the finest detail recorded).                     |
| **Context**         | The node whose contents are currently on screen. Shown by the breadcrumb.                    |
| **Leaf**            | A node with nothing recorded inside it. Drawn with no chevron badge and a thin single border. |
| **Chevron badge**   | The `⌄` in a node's corner meaning there is more inside; `⌃` when already expanded in place.   |
| **Functional view** | The business side: what the product does.                                                    |
| **Technical view**  | The built side: how it does it.                                                              |
| **Traceability**    | A `realizes` / `implemented-by` link joining the two sides.                                  |
| **Rolled-up relationship** | One line standing for several real relationships whose ends are deeper than the current level. Dashed, labelled with a count. |
| **Focus**           | Showing one node, its contents, and its neighbours, and hiding everything else.               |
| **Impact**          | Highlighting what a node affects or depends on, dimming the rest.                             |
| **Blind spot**      | A capability nothing implements, or a technical node no capability claims.                    |
| **Property**        | A free-form key/value fact about a node — owner, status, criticality, technology.             |
| **Read-only map**   | A map that ships with the app and refuses every change. Marked with a badge in the header.     |
