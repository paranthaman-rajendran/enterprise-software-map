/**
 * The map of this product, built from PRODUCT.md. It ships with the app, opens by default, and is
 * locked so it reads the same for everyone.
 *
 * It is here partly as a worked example of a real map on both sides, and partly because a tool for
 * mapping software ought to be able to show its own shape. When the product changes, change this
 * alongside PRODUCT.md — it is re-seeded on every server start, so it is never stale for long.
 */
import type { GraphEdge, GraphNode } from '@map/shared';

import type { MapRepository, MapSummary } from './repository.js';
import { buildContents, type EdgeSpec, type Spec } from './seed.js';

export const PRODUCT_MAP_ID = 'enterprise-software-map';

const nodeSpecs: Spec[] = [
  // ==== FUNCTIONAL =========================================================
  // ---- L0 -----------------------------------------------------------------
  {
    id: 'cap:product',
    label: 'Enterprise Software Map',
    type: 'capability',
    parent: null,
    description:
      'One map of an enterprise product, covering what it does and how it is built, revealed one level at a time.',
    properties: { owner: 'Product', criticality: 'critical', status: 'active' },
  },
  { id: 'actor:onboarding-engineer', label: 'Engineer Onboarding', type: 'actor', parent: null, description: 'Arrives asking how any of this fits together.', properties: { owner: 'Engineering' } },
  { id: 'actor:architect', label: 'Architect', type: 'actor', parent: null, description: 'Needs to show other people the shape of the system.', properties: { owner: 'Architecture' } },
  { id: 'actor:changing-engineer', label: 'Engineer Making a Change', type: 'actor', parent: null, description: 'Arrives asking what they are about to break.', properties: { owner: 'Engineering' } },
  { id: 'actor:stakeholder', label: 'Product Stakeholder', type: 'actor', parent: null, description: 'Wants the business picture without the infrastructure.', properties: { owner: 'Product' } },
  { id: 'actor:maintainer', label: 'Map Maintainer', type: 'actor', parent: null, description: 'Keeps the map true as the system moves.', properties: { owner: 'Architecture' } },

  // ---- L1: capability areas ----------------------------------------------
  { id: 'cap:explore', label: 'Explore the Map', type: 'capability', parent: 'cap:product', description: 'Read a large system without being shown all of it at once.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'cap:analyse', label: 'Analyse Dependencies', type: 'capability', parent: 'cap:product', description: 'Answer what depends on what, and how far the consequences travel.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'cap:two-views', label: 'Cross the Two Views', type: 'capability', parent: 'cap:product', description: 'Move between what the product does and how it is built.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'cap:author', label: 'Author the Map', type: 'capability', parent: 'cap:product', description: 'Get the map in, and keep it honest.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },
  { id: 'cap:share', label: 'Share and Export', type: 'capability', parent: 'cap:product', description: 'Hand a view to someone else.', properties: { owner: 'Product', criticality: 'medium', status: 'active' } },

  // ---- L2: capabilities and features --------------------------------------
  { id: 'cap:drill-down', label: 'Progressive Drill-down', type: 'capability', parent: 'cap:explore', description: 'One level on screen at a time, with a breadcrumb back up.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'cap:focus', label: 'Focus Mode', type: 'capability', parent: 'cap:explore', description: 'One node, its insides, and its neighbours to a chosen depth.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },
  { id: 'feature:edge-rollup', label: 'Relationship Roll-up', type: 'feature', parent: 'cap:explore', description: 'Deeper relationships drawn against visible ancestors, labelled with a count.', properties: { owner: 'Product', status: 'active' } },
  { id: 'feature:canvas-navigation', label: 'Canvas Navigation', type: 'feature', parent: 'cap:explore', description: 'Pan, zoom, fit, stable automatic layout, and positions you set yourself.', properties: { owner: 'Product', status: 'active' } },
  { id: 'feature:semantic-zoom', label: 'Semantic Zoom', type: 'feature', parent: 'cap:explore', description: 'Detail density follows the zoom level.', properties: { owner: 'Product', status: 'active' } },
  { id: 'feature:minimap', label: 'Minimap', type: 'feature', parent: 'cap:explore', description: 'Overview of a large level. Not built.', properties: { owner: 'Product', status: 'planned' } },

  { id: 'cap:impact', label: 'Impact Analysis', type: 'capability', parent: 'cap:analyse', description: 'What a node affects and what it relies on, dimming the rest.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'cap:path-finding', label: 'Path Finding', type: 'capability', parent: 'cap:analyse', description: 'How, if at all, two things are connected.', properties: { owner: 'Product', criticality: 'medium', status: 'active' } },
  { id: 'cap:global-search', label: 'Global Search', type: 'capability', parent: 'cap:analyse', description: 'Every level at once, each hit carrying the path that locates it.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },
  { id: 'feature:filtering', label: 'Filtering', type: 'feature', parent: 'cap:analyse', description: 'By node type, relationship type, level, and property.', properties: { owner: 'Product', status: 'active' } },

  { id: 'cap:view-switching', label: 'View Switching', type: 'capability', parent: 'cap:two-views', description: 'Functional, technical, or both together.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },
  { id: 'cap:traceability', label: 'Traceability', type: 'capability', parent: 'cap:two-views', description: 'Capabilities joined to the services that realize them, many-to-many.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'cap:blind-spots', label: 'Blind Spots', type: 'capability', parent: 'cap:two-views', description: 'What the map does not know, said out loud.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },

  { id: 'cap:hand-editing', label: 'Hand Editing', type: 'capability', parent: 'cap:author', description: 'Add, edit, and delete nodes, relationships, and properties.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },
  { id: 'cap:markdown-import', label: 'Markdown Import', type: 'capability', parent: 'cap:author', description: 'Build the map from documents the team already maintains.', properties: { owner: 'Product', criticality: 'high', status: 'active' } },
  { id: 'cap:model-integrity', label: 'Model Integrity', type: 'capability', parent: 'cap:author', description: 'Incoherent states are refused at the point of writing, with the reason.', properties: { owner: 'Product', criticality: 'critical', status: 'active' } },
  { id: 'feature:undo', label: 'Undo', type: 'feature', parent: 'cap:author', description: 'Reversible edits. Redo is not built.', properties: { owner: 'Product', status: 'active' } },
  { id: 'feature:read-only-maps', label: 'Read-only Maps', type: 'feature', parent: 'cap:author', description: 'A locked map is reference material and refuses every write.', properties: { owner: 'Product', status: 'active' } },

  { id: 'cap:view-links', label: 'Shareable View Links', type: 'capability', parent: 'cap:share', description: 'The URL reproduces the exact screen, not just the map.', properties: { owner: 'Product', criticality: 'medium', status: 'active' } },
  { id: 'feature:json-export', label: 'JSON Export and Import', type: 'feature', parent: 'cap:share', description: 'The whole map, round-tripping without loss.', properties: { owner: 'Product', status: 'active' } },
  { id: 'feature:image-export', label: 'Image Export', type: 'feature', parent: 'cap:share', description: 'Export the visible map as a picture. Not built.', properties: { owner: 'Product', status: 'planned' } },

  // ---- L3: journeys and rules ---------------------------------------------
  { id: 'journey:onboard', label: 'Onboard onto an unfamiliar system', type: 'journey', parent: 'cap:drill-down', description: 'Open at the landscape, drill into a domain, follow relationships outward.', properties: { owner: 'Product', criticality: 'high' } },
  { id: 'journey:blast-radius', label: 'Judge the blast radius of a change', type: 'journey', parent: 'cap:impact', description: 'Find the service, look upstream, then trace to anything surprising.', properties: { owner: 'Product', criticality: 'critical' } },
  { id: 'journey:build-from-docs', label: 'Build the map from existing documents', type: 'journey', parent: 'cap:markdown-import', description: 'Point at a folder, preview, fix what the report names, import.', properties: { owner: 'Product', criticality: 'high' } },

  { id: 'rule:one-level-down', label: 'A child sits exactly one level below its parent', type: 'business-rule', parent: 'cap:model-integrity', description: 'Levels are derived from the hierarchy, never taken from the client.', properties: { owner: 'Product', criticality: 'critical' } },
  { id: 'rule:no-cycles', label: 'The hierarchy is a tree', type: 'business-rule', parent: 'cap:model-integrity', description: 'No cycles, and nothing below L0 without a parent.', properties: { owner: 'Product', criticality: 'critical' } },
  { id: 'rule:no-dangling', label: 'Relationships must connect things that exist', type: 'business-rule', parent: 'cap:model-integrity', description: 'A map with a dangling relationship cannot be saved.', properties: { owner: 'Product', criticality: 'critical' } },
  { id: 'rule:import-preserves', label: 'Import never destroys manual work', type: 'business-rule', parent: 'cap:markdown-import', description: 'Positions, hand-made nodes and edges, and unmentioned properties all survive re-import.', properties: { owner: 'Product', criticality: 'critical' } },
  { id: 'rule:missing-is-shown', label: 'Missing detail is shown as missing', type: 'business-rule', parent: 'cap:blind-spots', description: 'Never render absence as emptiness.', properties: { owner: 'Product', criticality: 'high' } },

  // ==== TECHNICAL ==========================================================
  // ---- L0 -----------------------------------------------------------------
  {
    id: 'system:app',
    label: 'Map Application',
    type: 'system',
    parent: null,
    description: 'A local web application: a Node API over SQLite, and a browser client.',
    properties: { owner: 'Engineering', criticality: 'critical', status: 'active', technology: 'TypeScript' },
  },
  { id: 'system:browser', label: 'Web Browser', type: 'system', parent: null, description: 'Where the client runs.', properties: { owner: 'External', status: 'active' } },
  { id: 'system:node-runtime', label: 'Node.js Runtime', type: 'system', parent: null, description: 'Hosts the API and supplies the embedded SQLite driver.', properties: { owner: 'External', status: 'active', technology: 'Node 22' } },
  { id: 'integration:doc-folder', label: 'Architecture Documents', type: 'integration', parent: null, description: 'A folder of markdown the importer reads. External to the app and read-only to it.', properties: { owner: 'External', status: 'active', technology: 'Markdown' } },

  // ---- L1: the three workspaces -------------------------------------------
  { id: 'app:shared', label: 'Shared Model', type: 'application', parent: 'system:app', description: 'The model and everything that reasons about it. No storage, no rendering.', properties: { owner: 'Engineering', criticality: 'critical', status: 'active', technology: 'TypeScript' } },
  { id: 'app:server', label: 'Map API', type: 'application', parent: 'system:app', description: 'Fastify over SQLite. Every write validates the whole map before committing.', properties: { owner: 'Engineering', criticality: 'critical', status: 'active', technology: 'Fastify' } },
  { id: 'app:web', label: 'Web Client', type: 'application', parent: 'system:app', description: 'React and Cytoscape.js. Renders whatever the view model returns.', properties: { owner: 'Engineering', criticality: 'critical', status: 'active', technology: 'React + Vite' } },

  // ---- L2: shared ---------------------------------------------------------
  { id: 'component:model', label: 'Model & Vocabulary', type: 'component', parent: 'app:shared', description: 'Levels, views, node and edge types.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'model.ts' } },
  { id: 'component:validator', label: 'Invariant Checker', type: 'component', parent: 'app:shared', description: 'The rules a map must satisfy, and subtree re-parenting.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'validate.ts' } },
  { id: 'component:graph-queries', label: 'Graph Queries', type: 'component', parent: 'app:shared', description: 'Hierarchy walks, edge roll-up, traversal, path-finding, coverage.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'graph.ts' } },
  { id: 'component:search', label: 'Search', type: 'component', parent: 'app:shared', description: 'Scored linear scan across every node, sized for hundreds.', properties: { owner: 'Engineering', criticality: 'high', technology: 'search.ts' } },
  { id: 'component:md-parser', label: 'Markdown Parser', type: 'component', parent: 'app:shared', description: 'Frontmatter, wikilinks, and heading context into nodes and links.', properties: { owner: 'Engineering', criticality: 'high', technology: 'markdown.ts' } },
  { id: 'component:import-planner', label: 'Import Planner', type: 'component', parent: 'app:shared', description: 'Merges parsed documents with the existing map. Where FR-52 lives.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'markdown.ts' } },
  { id: 'component:wire-schema', label: 'Wire Schema', type: 'component', parent: 'app:shared', description: 'Zod schemas shared by client and server, so drift is a compile error.', properties: { owner: 'Engineering', criticality: 'high', technology: 'zod' } },

  // ---- L2: server ---------------------------------------------------------
  { id: 'api:rest', label: 'REST API', type: 'api', parent: 'app:server', description: 'Maps, nodes, edges, queries, import and export.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'Fastify' } },
  { id: 'service:repository', label: 'Map Repository', type: 'service', parent: 'app:server', description: 'Read, apply, validate, commit. The only write path, and the lock gate.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'TypeScript' } },
  { id: 'datastore:sqlite', label: 'SQLite Store', type: 'datastore', parent: 'app:server', description: 'One file, via the runtime’s built-in driver. No native build.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'node:sqlite' } },
  { id: 'service:md-importer', label: 'Markdown Importer', type: 'service', parent: 'app:server', description: 'Walks a folder and hands the text to the parser. The only filesystem access.', properties: { owner: 'Engineering', criticality: 'high', technology: 'node:fs' } },
  { id: 'component:seeds', label: 'Seed Data', type: 'component', parent: 'app:server', description: 'The demo map, and this map of the product itself.', properties: { owner: 'Engineering', status: 'active' } },

  // ---- L2: web ------------------------------------------------------------
  { id: 'component:view-model', label: 'View Model', type: 'component', parent: 'app:web', description: 'Decides what is on screen as a pure function of map and view state.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'viewModel.ts' } },
  { id: 'component:canvas', label: 'Graph Canvas', type: 'component', parent: 'app:web', description: 'The Cytoscape bridge. Renders; decides nothing.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'Cytoscape.js' } },
  { id: 'component:store', label: 'App Store', type: 'component', parent: 'app:web', description: 'Map data, view state, selection, and the undo stack.', properties: { owner: 'Engineering', criticality: 'critical', technology: 'Zustand' } },
  { id: 'component:api-client', label: 'API Client', type: 'component', parent: 'app:web', description: 'Typed calls; edits go to the server before the local map changes.', properties: { owner: 'Engineering', criticality: 'high', technology: 'fetch' } },
  { id: 'component:details-panel', label: 'Details Panel', type: 'component', parent: 'app:web', description: 'What a selection is, and everything it connects to.', properties: { owner: 'Engineering', criticality: 'high' } },
  { id: 'component:search-panel', label: 'Search Panel', type: 'component', parent: 'app:web', description: 'Results with their paths, and the jump to a node at its own level.', properties: { owner: 'Engineering', criticality: 'high' } },
  { id: 'component:import-panel', label: 'Import Panel', type: 'component', parent: 'app:web', description: 'Preview first, then import, with the report.', properties: { owner: 'Engineering', criticality: 'medium' } },
  { id: 'component:toolbar', label: 'Toolbar', type: 'component', parent: 'app:web', description: 'View switching, focus, impact, filters, layout, share, export.', properties: { owner: 'Engineering', criticality: 'medium' } },

  // ---- L3: detail ---------------------------------------------------------
  { id: 'table:maps', label: 'maps', type: 'table', parent: 'datastore:sqlite', description: 'One row per map, carrying the read-only lock.', properties: { owner: 'Engineering' } },
  { id: 'table:nodes', label: 'nodes', type: 'table', parent: 'datastore:sqlite', description: 'Properties and per-context positions stored as JSON.', properties: { owner: 'Engineering' } },
  { id: 'table:edges', label: 'edges', type: 'table', parent: 'datastore:sqlite', properties: { owner: 'Engineering' } },
  { id: 'table:saved-views', label: 'saved_views', type: 'table', parent: 'datastore:sqlite', description: 'Named views. Allowed even on a locked map — they are the reader’s own state.', properties: { owner: 'Engineering' } },

  { id: 'endpoint:map-crud', label: 'Map & content endpoints', type: 'endpoint', parent: 'api:rest', description: 'Nodes, edges, positions, re-parenting, deletion.', properties: { owner: 'Engineering' } },
  { id: 'endpoint:queries', label: 'Query endpoints', type: 'endpoint', parent: 'api:rest', description: 'Search, impact, path, coverage, facets, validate.', properties: { owner: 'Engineering' } },
  { id: 'endpoint:import', label: 'Import & export endpoints', type: 'endpoint', parent: 'api:rest', description: 'Markdown import with dry run, and JSON round-trip.', properties: { owner: 'Engineering' } },
];

const edgeSpecs: EdgeSpec[] = [
  // ---- functional: who uses what ------------------------------------------
  { source: 'actor:onboarding-engineer', target: 'cap:explore', type: 'depends-on', weight: 3 },
  { source: 'actor:onboarding-engineer', target: 'cap:analyse', type: 'depends-on' },
  { source: 'actor:architect', target: 'cap:two-views', type: 'depends-on', weight: 2 },
  { source: 'actor:architect', target: 'cap:share', type: 'depends-on' },
  { source: 'actor:changing-engineer', target: 'cap:analyse', type: 'depends-on', weight: 3 },
  { source: 'actor:stakeholder', target: 'cap:view-switching', type: 'depends-on' },
  { source: 'actor:maintainer', target: 'cap:author', type: 'depends-on', weight: 3 },
  { source: 'actor:maintainer', target: 'cap:blind-spots', type: 'depends-on' },

  // ---- functional: how the capabilities relate -----------------------------
  { source: 'cap:global-search', target: 'cap:drill-down', type: 'precedes' },
  { source: 'cap:drill-down', target: 'cap:focus', type: 'precedes' },
  { source: 'cap:impact', target: 'cap:path-finding', type: 'precedes' },
  { source: 'cap:markdown-import', target: 'cap:model-integrity', type: 'depends-on' },
  { source: 'cap:hand-editing', target: 'cap:model-integrity', type: 'depends-on' },
  { source: 'cap:blind-spots', target: 'cap:traceability', type: 'depends-on' },
  { source: 'cap:impact', target: 'cap:traceability', type: 'depends-on' },
  { source: 'journey:build-from-docs', target: 'rule:import-preserves', type: 'depends-on' },

  // ---- technical: runtime ---------------------------------------------------
  { source: 'component:canvas', target: 'component:view-model', type: 'calls', weight: 3 },
  { source: 'component:view-model', target: 'component:graph-queries', type: 'calls', weight: 4 },
  { source: 'component:store', target: 'component:api-client', type: 'calls', weight: 4 },
  { source: 'component:store', target: 'component:graph-queries', type: 'calls', weight: 2 },
  { source: 'component:details-panel', target: 'component:store', type: 'reads', weight: 2 },
  { source: 'component:search-panel', target: 'component:search', type: 'calls', weight: 2 },
  { source: 'component:search-panel', target: 'component:store', type: 'reads' },
  { source: 'component:import-panel', target: 'component:api-client', type: 'calls' },
  { source: 'component:toolbar', target: 'component:store', type: 'writes' },
  { source: 'component:canvas', target: 'system:browser', type: 'depends-on' },

  { source: 'component:api-client', target: 'api:rest', type: 'calls', weight: 5 },
  { source: 'api:rest', target: 'endpoint:map-crud', type: 'contains' },
  { source: 'api:rest', target: 'endpoint:queries', type: 'contains' },
  { source: 'api:rest', target: 'endpoint:import', type: 'contains' },
  { source: 'endpoint:map-crud', target: 'service:repository', type: 'calls', weight: 4 },
  { source: 'endpoint:queries', target: 'component:graph-queries', type: 'calls', weight: 2 },
  { source: 'endpoint:import', target: 'service:md-importer', type: 'calls' },

  { source: 'service:repository', target: 'component:validator', type: 'calls', weight: 5 },
  { source: 'service:repository', target: 'datastore:sqlite', type: 'writes', weight: 5 },
  { source: 'service:md-importer', target: 'component:md-parser', type: 'calls', weight: 2 },
  { source: 'service:md-importer', target: 'component:import-planner', type: 'calls', weight: 2 },
  { source: 'service:md-importer', target: 'service:repository', type: 'calls' },
  { source: 'service:md-importer', target: 'integration:doc-folder', type: 'reads', weight: 2 },
  { source: 'component:seeds', target: 'service:repository', type: 'calls' },

  { source: 'component:validator', target: 'component:model', type: 'depends-on', weight: 3 },
  { source: 'component:graph-queries', target: 'component:model', type: 'depends-on', weight: 3 },
  { source: 'component:search', target: 'component:model', type: 'depends-on' },
  { source: 'component:md-parser', target: 'component:model', type: 'depends-on' },
  { source: 'component:import-planner', target: 'component:validator', type: 'depends-on' },
  { source: 'component:import-planner', target: 'component:md-parser', type: 'depends-on' },
  { source: 'component:wire-schema', target: 'component:model', type: 'depends-on' },
  { source: 'api:rest', target: 'component:wire-schema', type: 'depends-on', weight: 2 },
  { source: 'component:api-client', target: 'component:wire-schema', type: 'depends-on' },

  { source: 'datastore:sqlite', target: 'table:maps', type: 'contains' },
  { source: 'datastore:sqlite', target: 'table:nodes', type: 'contains' },
  { source: 'datastore:sqlite', target: 'table:edges', type: 'contains' },
  { source: 'datastore:sqlite', target: 'table:saved-views', type: 'contains' },
  { source: 'datastore:sqlite', target: 'system:node-runtime', type: 'depends-on' },
  { source: 'table:nodes', target: 'table:maps', type: 'depends-on' },
  { source: 'table:edges', target: 'table:nodes', type: 'depends-on' },

  // ---- traceability: capability -> what implements it ----------------------
  { source: 'cap:drill-down', target: 'component:view-model', type: 'realizes' },
  { source: 'cap:drill-down', target: 'component:canvas', type: 'realizes' },
  { source: 'cap:focus', target: 'component:view-model', type: 'realizes' },
  { source: 'feature:edge-rollup', target: 'component:graph-queries', type: 'realizes' },
  { source: 'feature:canvas-navigation', target: 'component:canvas', type: 'realizes' },
  { source: 'feature:semantic-zoom', target: 'component:canvas', type: 'realizes' },
  { source: 'cap:impact', target: 'component:graph-queries', type: 'realizes' },
  { source: 'cap:path-finding', target: 'component:graph-queries', type: 'realizes' },
  { source: 'cap:global-search', target: 'component:search', type: 'realizes' },
  { source: 'cap:global-search', target: 'component:search-panel', type: 'realizes' },
  { source: 'feature:filtering', target: 'component:view-model', type: 'realizes' },
  { source: 'cap:view-switching', target: 'component:toolbar', type: 'realizes' },
  { source: 'cap:traceability', target: 'component:model', type: 'realizes' },
  { source: 'cap:blind-spots', target: 'component:graph-queries', type: 'realizes' },
  { source: 'cap:hand-editing', target: 'component:details-panel', type: 'realizes' },
  { source: 'cap:hand-editing', target: 'endpoint:map-crud', type: 'realizes' },
  { source: 'cap:markdown-import', target: 'service:md-importer', type: 'realizes' },
  { source: 'cap:markdown-import', target: 'component:import-panel', type: 'realizes' },
  { source: 'rule:import-preserves', target: 'component:import-planner', type: 'realizes' },
  { source: 'cap:model-integrity', target: 'component:validator', type: 'realizes' },
  { source: 'rule:one-level-down', target: 'component:validator', type: 'realizes' },
  { source: 'rule:no-cycles', target: 'component:validator', type: 'realizes' },
  { source: 'rule:no-dangling', target: 'component:validator', type: 'realizes' },
  { source: 'feature:undo', target: 'component:store', type: 'realizes' },
  { source: 'feature:read-only-maps', target: 'service:repository', type: 'realizes' },
  { source: 'feature:read-only-maps', target: 'table:maps', type: 'realizes' },
  { source: 'cap:view-links', target: 'component:store', type: 'realizes' },
  { source: 'feature:json-export', target: 'endpoint:import', type: 'realizes' },
  // feature:minimap and feature:image-export are deliberately unrealized — they are the
  // planned features, and the blind spots panel is meant to show them as such.
];

export function productMapContents(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return buildContents(nodeSpecs, edgeSpecs);
}

/**
 * Creates the product map if it is missing and refreshes it if it is not, then locks it. Safe to
 * run on every start: the map is read-only, so there is never user work in it to overwrite.
 */
export function ensureProductMap(repo: MapRepository): MapSummary {
  const exists = repo.listMaps().some((m) => m.id === PRODUCT_MAP_ID);
  if (!exists) {
    repo.createMap({
      id: PRODUCT_MAP_ID,
      name: 'Enterprise Software Map (this product)',
      description:
        'A read-only map of this product itself, built from PRODUCT.md — the functional side, the technical side, and the traceability between them.',
      locked: true,
    });
  }

  repo.replaceContents(PRODUCT_MAP_ID, productMapContents(), { allowLocked: true });
  repo.setLocked(PRODUCT_MAP_ID, true);

  return repo.listMaps().find((m) => m.id === PRODUCT_MAP_ID)!;
}
