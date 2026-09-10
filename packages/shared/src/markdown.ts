/**
 * Markdown import: parsing documents into nodes and edges (FR-47, FR-48, FR-49).
 *
 * This module is pure — it takes document *text*, never touches a filesystem — so the whole
 * import can be tested without fixtures on disk, and so a future importer for some other source
 * (OQ-5 / FR-50) can reuse the merge logic without reusing the parser.
 *
 * The conventions are documented for users in USER_MANUAL.md; the short version:
 *
 *   - one file, one node;
 *   - frontmatter supplies identity, type, parent, properties, and typed relationships;
 *   - `[[wikilinks]]` in the body are relationships, typed by the heading they sit under;
 *   - folder nesting supplies the hierarchy unless frontmatter overrides it.
 */
import { parse as parseYaml } from 'yaml';

import {
  EDGE_TYPES,
  MAX_LEVEL,
  NODE_TYPES,
  NODE_TYPE_VIEW,
  type EdgeType,
  type GraphEdge,
  type GraphNode,
  type Level,
  type NodeType,
  type PropertyValue,
  type View,
} from './model.js';
import { edgeId as makeEdgeId, slugify } from './ids.js';

/** Frontmatter keys with a defined meaning; everything else becomes a property or a relationship. */
const RESERVED_KEYS = new Set(['id', 'label', 'title', 'type', 'view', 'level', 'parent', 'description']);

/** Filenames that make a document stand for its containing folder rather than sit inside it. */
const INDEX_BASENAMES = ['index', '_index', 'readme'];

const EDGE_TYPE_SET = new Set<string>(EDGE_TYPES);
const NODE_TYPE_SET = new Set<string>(NODE_TYPES);

/**
 * Heading text that names a relationship type, normalised. `## Calls` and `## Depends on` both
 * work, which is what FR-48 means by taking the type from link context.
 */
const HEADING_TO_EDGE_TYPE = new Map<string, EdgeType>(
  EDGE_TYPES.flatMap((type) => {
    const spaced = type.replace(/-/g, ' ');
    return [
      [type, type],
      [spaced, type],
      [`${spaced}s`, type],
    ] as Array<[string, EdgeType]>;
  }),
);

/** Relationship used for a wikilink with no type from frontmatter or a heading. */
export const DEFAULT_LINK_TYPE: EdgeType = 'depends-on';

/** Type given to a document that does not declare one. Reported as a warning, never silently. */
export const DEFAULT_NODE_TYPE: NodeType = 'system';

export interface ParsedLink {
  /** The raw target text inside the brackets, before resolution. */
  target: string;
  type: EdgeType;
  origin: 'frontmatter' | 'heading' | 'body';
}

export interface ParsedDocument {
  /** Path relative to the import root, POSIX separators, including the extension. */
  path: string;
  /** Explicit id from frontmatter, if given. */
  explicitId: string | null;
  label: string;
  type: NodeType;
  view: View;
  /** Explicit parent reference from frontmatter — an id, a path, or a label. */
  parentRef: string | null;
  description: string;
  properties: Record<string, PropertyValue>;
  links: ParsedLink[];
  /** Set when the document declared a level; used only to warn when it disagrees with the tree. */
  declaredLevel: number | null;
  warnings: string[];
}

export interface DocumentFailure {
  path: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Parsing one document
// ---------------------------------------------------------------------------

function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  // Tolerate a BOM and CRLF; documents come from wherever the team keeps them.
  const cleaned = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!cleaned.startsWith('---\n')) return { frontmatter: null, body: cleaned };
  const end = cleaned.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: cleaned };
  const afterFence = cleaned.indexOf('\n', end + 1);
  return {
    frontmatter: cleaned.slice(4, end),
    body: afterFence === -1 ? '' : cleaned.slice(afterFence + 1),
  };
}

function extractWikilinks(text: string): Array<{ target: string; type: EdgeType | null }> {
  const out: Array<{ target: string; type: EdgeType | null }> = [];
  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const inner = match[1] ?? '';
    const [rawTarget, rawSuffix] = inner.split('|', 2);
    const target = (rawTarget ?? '').trim();
    if (target === '') continue;
    // `[[Target|calls]]` types the link; anything else after the pipe is a display alias.
    const suffix = rawSuffix?.trim().toLowerCase();
    const type = suffix && EDGE_TYPE_SET.has(suffix) ? (suffix as EdgeType) : null;
    out.push({ target, type });
  }
  return out;
}

/**
 * Pulls link targets out of a frontmatter value. Both quoted and unquoted forms work:
 * `calls: "[[A]]"` parses as a string, while `calls: [[A]]` is valid YAML flow syntax that
 * parses as a nested list — so anything that bottoms out in a string is treated as a target.
 */
function collectTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    const links = extractWikilinks(value);
    if (links.length > 0) return links.map((l) => l.target);
    const trimmed = value.trim();
    return trimmed === '' ? [] : [trimmed];
  }
  if (Array.isArray(value)) return value.flatMap(collectTargets);
  return [];
}

function toPropertyValue(value: unknown): PropertyValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return value.join(', ');
  }
  return undefined;
}

function humanise(stem: string): string {
  const spaced = stem.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function basename(path: string): string {
  const last = path.split('/').pop() ?? path;
  return last.replace(/\.md$/i, '');
}

function dirname(path: string): string {
  const at = path.lastIndexOf('/');
  return at === -1 ? '' : path.slice(0, at);
}

/** Strips fenced code blocks so a `[[…]]` in a code sample is not read as a relationship. */
function stripCodeFences(body: string): string {
  return body.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
}

function firstParagraph(body: string): string {
  for (const block of stripCodeFences(body).split(/\n\s*\n/)) {
    const text = block.trim();
    if (text === '' || text.startsWith('#') || text.startsWith('---')) continue;
    return text.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1').replace(/\s+/g, ' ');
  }
  return '';
}

function firstHeading(body: string): string | null {
  const match = stripCodeFences(body).match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

/**
 * Walks the body heading by heading so that wikilinks pick up the relationship type from the
 * section they appear in.
 */
function linksFromBody(body: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  let currentType: EdgeType | null = null;

  for (const line of stripCodeFences(body).split('\n')) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      const normalised = (heading[1] ?? '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      currentType = HEADING_TO_EDGE_TYPE.get(normalised) ?? null;
      continue;
    }
    for (const link of extractWikilinks(line)) {
      links.push({
        target: link.target,
        type: link.type ?? currentType ?? DEFAULT_LINK_TYPE,
        origin: link.type ?? currentType ? 'heading' : 'body',
      });
    }
  }
  return links;
}

/**
 * Parses one document. Returns a failure only when the document cannot yield a node at all;
 * anything else that is odd becomes a warning, because NFR-6 asks for a report rather than a
 * refusal.
 */
export function parseDocument(text: string, path: string): ParsedDocument | DocumentFailure {
  const { frontmatter, body } = splitFrontmatter(text);

  let data: Record<string, unknown> = {};
  if (frontmatter !== null) {
    try {
      const parsed: unknown = parseYaml(frontmatter);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      } else if (parsed !== null) {
        return { path, reason: 'Frontmatter is not a set of key/value pairs.' };
      }
    } catch (error) {
      return { path, reason: `Frontmatter is not valid YAML: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  const warnings: string[] = [];

  const rawType = typeof data.type === 'string' ? data.type.trim().toLowerCase() : null;
  let type: NodeType;
  if (rawType === null) {
    type = DEFAULT_NODE_TYPE;
    warnings.push(`No \`type\` in frontmatter; treated as \`${DEFAULT_NODE_TYPE}\`.`);
  } else if (NODE_TYPE_SET.has(rawType)) {
    type = rawType as NodeType;
  } else {
    return { path, reason: `Unknown type "${rawType}". Expected one of: ${NODE_TYPES.join(', ')}.` };
  }

  // The view follows from the type — the model requires them to agree, so the type wins.
  const view: View = NODE_TYPE_VIEW[type];
  const declaredView = typeof data.view === 'string' ? data.view.trim().toLowerCase() : null;
  if (declaredView !== null && declaredView !== view) {
    warnings.push(`\`view: ${declaredView}\` disagrees with type \`${type}\`; using \`${view}\`.`);
  }

  const explicitLabel = typeof data.label === 'string' ? data.label : typeof data.title === 'string' ? data.title : null;
  const label = explicitLabel?.trim() || firstHeading(body) || humanise(basename(path));

  const description =
    typeof data.description === 'string' && data.description.trim() !== ''
      ? data.description.trim()
      : firstParagraph(body);

  const properties: Record<string, PropertyValue> = {};
  const links: ParsedLink[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (RESERVED_KEYS.has(key)) continue;

    const normalisedKey = key.trim().toLowerCase();
    if (EDGE_TYPE_SET.has(normalisedKey)) {
      for (const target of collectTargets(value)) {
        links.push({ target, type: normalisedKey as EdgeType, origin: 'frontmatter' });
      }
      continue;
    }

    const propertyValue = toPropertyValue(value);
    if (propertyValue === undefined) {
      warnings.push(`Property \`${key}\` is a nested structure and was skipped.`);
      continue;
    }
    properties[key] = propertyValue;
  }

  links.push(...linksFromBody(body));

  const declaredLevel = typeof data.level === 'number' && Number.isInteger(data.level) ? data.level : null;
  // `parent` is written either bare (`parent: payments`) or as a wikilink (`parent: "[[Payments]]"`).
  const parentRef = typeof data.parent === 'string' ? (collectTargets(data.parent)[0] ?? null) : null;
  const explicitId = typeof data.id === 'string' && data.id.trim() !== '' ? data.id.trim() : null;

  return { path, explicitId, label, type, view, parentRef, description, properties, links, declaredLevel, warnings };
}

// ---------------------------------------------------------------------------
// Identity and hierarchy
// ---------------------------------------------------------------------------

/**
 * FR-51 depends entirely on this being stable. The id comes from the document's *path*, not its
 * label or type, so renaming a heading or correcting a type updates the node in place instead of
 * creating a second one. Moving a file is therefore a delete plus a create, which is honest —
 * the folder tree is the hierarchy, so moving a file really is a structural change.
 */
export function idForPath(path: string): string {
  const withoutExtension = path.replace(/\.md$/i, '');
  const segments = withoutExtension
    .split('/')
    .map((segment) => slugify(segment))
    .filter((segment) => segment !== '');
  if (segments.length === 0) return 'doc';
  // A folder's index document stands for the folder, so it should not repeat the last segment.
  const last = segments[segments.length - 1]!;
  if (segments.length > 1 && INDEX_BASENAMES.includes(last)) segments.pop();
  return segments.join(':');
}

function isIndexDocument(path: string): boolean {
  return INDEX_BASENAMES.includes(basename(path).toLowerCase());
}

/**
 * The document that stands for a directory. Three conventions are accepted, because teams write
 * all three: `payments/index.md` (or `_index.md` / `readme.md`), `payments/payments.md`, and the
 * sibling form `payments.md` sitting next to a `payments/` folder — which is how Obsidian and
 * most wiki-style vaults nest a page under its own note.
 */
function findDirectoryIndex(dir: string, byPath: Map<string, ParsedDocument>): ParsedDocument | null {
  const candidates = [
    ...INDEX_BASENAMES.map((name) => (dir === '' ? `${name}.md` : `${dir}/${name}.md`)),
  ];
  if (dir !== '') {
    candidates.push(`${dir}/${basename(dir)}.md`);
    const parent = dirname(dir);
    candidates.push(parent === '' ? `${basename(dir)}.md` : `${parent}/${basename(dir)}.md`);
  }

  for (const candidate of candidates) {
    for (const [path, doc] of byPath) {
      if (path.toLowerCase() === candidate.toLowerCase()) return doc;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Planning an import
// ---------------------------------------------------------------------------

export interface ImportOptions {
  /**
   * Remove nodes previously imported from documents that have since disappeared. Off by default:
   * deleting a user's data because a path was mistyped is the worse failure.
   */
  prune?: boolean;
}

export interface ImportReport {
  created: Array<{ id: string; label: string; path: string }>;
  updated: Array<{ id: string; label: string; path: string }>;
  failed: DocumentFailure[];
  /** Documents parsed but not turned into nodes, with the reason. */
  skipped: Array<{ path: string; reason: string }>;
  unresolvedLinks: Array<{ from: string; target: string; type: EdgeType; reason: string }>;
  warnings: Array<{ path: string; message: string }>;
  edgesCreated: number;
  edgesRemoved: number;
  /** Imported nodes whose document is gone: pruned when `prune` is set, kept and listed otherwise. */
  orphaned: Array<{ id: string; label: string; path: string | null }>;
  pruned: string[];
  /** Nodes and edges left alone because a person made them (FR-52). */
  manualNodesPreserved: number;
  manualEdgesPreserved: number;
}

export interface ImportPlan {
  /** The complete next state of the map, ready for the repository to validate and commit. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  report: ImportReport;
}

interface Resolved {
  doc: ParsedDocument;
  id: string;
  parentId: string | null;
  level: Level;
}

/**
 * Turns a set of parsed documents into the next state of the map, merged with what is already
 * there. Nothing is written here; the caller validates and commits, which is what lets the same
 * plan drive a dry run (FR-53).
 */
export function planImport(
  documents: Array<ParsedDocument | DocumentFailure>,
  existing: { nodes: GraphNode[]; edges: GraphEdge[] },
  options: ImportOptions = {},
): ImportPlan {
  const report: ImportReport = {
    created: [],
    updated: [],
    failed: [],
    skipped: [],
    unresolvedLinks: [],
    warnings: [],
    edgesCreated: 0,
    edgesRemoved: 0,
    orphaned: [],
    pruned: [],
    manualNodesPreserved: 0,
    manualEdgesPreserved: 0,
  };

  const parsed: ParsedDocument[] = [];
  for (const doc of documents) {
    if ('reason' in doc) report.failed.push(doc);
    else parsed.push(doc);
  }

  const byPath = new Map<string, ParsedDocument>();
  for (const doc of parsed) byPath.set(doc.path, doc);

  // --- ids, rejecting collisions rather than silently overwriting -----------
  const idToDoc = new Map<string, ParsedDocument>();
  const docToId = new Map<ParsedDocument, string>();
  for (const doc of parsed) {
    const id = doc.explicitId ?? idForPath(doc.path);
    const clash = idToDoc.get(id);
    if (clash) {
      report.skipped.push({
        path: doc.path,
        reason: `Id "${id}" is already used by ${clash.path}. Give one of them an explicit \`id\`.`,
      });
      continue;
    }
    idToDoc.set(id, doc);
    docToId.set(doc, id);
  }

  const included = parsed.filter((doc) => docToId.has(doc));

  // --- link and parent resolution indexes ----------------------------------
  const existingById = new Map(existing.nodes.map((n) => [n.id, n]));
  const byLabel = new Map<string, string[]>();
  const byStem = new Map<string, string[]>();
  const pathToId = new Map<string, string>();

  const addLookup = (map: Map<string, string[]>, key: string, id: string): void => {
    const lower = key.toLowerCase();
    const bucket = map.get(lower);
    if (bucket) bucket.push(id);
    else map.set(lower, [id]);
  };

  for (const doc of included) {
    const id = docToId.get(doc)!;
    const withoutExtension = doc.path.replace(/\.md$/i, '');
    pathToId.set(doc.path.toLowerCase(), id);
    pathToId.set(withoutExtension.toLowerCase(), id);
    addLookup(byLabel, doc.label, id);
    addLookup(byStem, basename(doc.path), id);
  }
  // Manually created nodes are linkable too, so a document can point at hand-made structure.
  for (const node of existing.nodes) {
    if (idToDoc.has(node.id)) continue;
    addLookup(byLabel, node.label, node.id);
  }

  const resolveRef = (ref: string): { id: string } | { error: string } => {
    const trimmed = ref.trim();
    if (idToDoc.has(trimmed)) return { id: trimmed };
    if (existingById.has(trimmed)) return { id: trimmed };

    const byPathHit = pathToId.get(trimmed.toLowerCase()) ?? pathToId.get(trimmed.toLowerCase().replace(/^\.\//, ''));
    if (byPathHit) return { id: byPathHit };

    for (const index of [byLabel, byStem]) {
      const hits = index.get(trimmed.toLowerCase());
      if (!hits || hits.length === 0) continue;
      if (hits.length > 1) return { error: `"${trimmed}" is ambiguous — it matches ${hits.length} nodes.` };
      return { id: hits[0]! };
    }
    return { error: `Nothing named "${trimmed}" was found.` };
  };

  // --- hierarchy (FR-49) ---------------------------------------------------
  const parentOf = new Map<string, string | null>();
  for (const doc of included) {
    const id = docToId.get(doc)!;

    if (doc.parentRef !== null) {
      const resolved = resolveRef(doc.parentRef);
      if ('error' in resolved) {
        report.warnings.push({ path: doc.path, message: `\`parent: ${doc.parentRef}\` could not be resolved — ${resolved.error} Falling back to folder structure.` });
      } else if (resolved.id === id) {
        report.warnings.push({ path: doc.path, message: 'A document cannot be its own parent; falling back to folder structure.' });
      } else {
        parentOf.set(id, resolved.id);
        continue;
      }
    }

    // Folder structure: a regular document belongs to its folder's index document; an index
    // document belongs to the index of the folder above it.
    let dir = dirname(doc.path);
    if (isIndexDocument(doc.path)) dir = dirname(dir);

    let parentId: string | null = null;
    while (true) {
      const index = findDirectoryIndex(dir, byPath);
      const indexId = index ? docToId.get(index) : undefined;
      if (indexId !== undefined && indexId !== id) {
        parentId = indexId;
        break;
      }
      if (dir === '') break;
      dir = dirname(dir);
    }
    parentOf.set(id, parentId);
  }

  // --- levels, refusing cycles and anything past L4 ------------------------
  const resolved: Resolved[] = [];
  const levelOf = new Map<string, Level>();

  const computeLevel = (id: string, seen: Set<string>): number | { error: string } => {
    const cached = levelOf.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return { error: 'Parent chain forms a cycle.' };
    seen.add(id);

    const parentId = parentOf.get(id) ?? null;
    if (parentId === null) return 0;

    // A parent that is a manual node already has a level; use it.
    const manualParent = !idToDoc.has(parentId) ? existingById.get(parentId) : undefined;
    if (manualParent) return manualParent.level + 1;

    const parentLevel = computeLevel(parentId, seen);
    if (typeof parentLevel !== 'number') return parentLevel;
    return parentLevel + 1;
  };

  for (const doc of included) {
    const id = docToId.get(doc)!;
    const level = computeLevel(id, new Set());
    if (typeof level !== 'number') {
      report.skipped.push({ path: doc.path, reason: level.error });
      continue;
    }
    if (level > MAX_LEVEL) {
      report.skipped.push({
        path: doc.path,
        reason: `Nesting puts this at L${level}; the map stops at L${MAX_LEVEL}. Flatten the folders or set an explicit \`parent\`.`,
      });
      continue;
    }
    levelOf.set(id, level as Level);
    resolved.push({ doc, id, parentId: parentOf.get(id) ?? null, level: level as Level });

    if (doc.declaredLevel !== null && doc.declaredLevel !== level) {
      report.warnings.push({
        path: doc.path,
        message: `\`level: ${doc.declaredLevel}\` disagrees with the hierarchy, which puts this at L${level}; the hierarchy wins.`,
      });
    }
    for (const warning of doc.warnings) report.warnings.push({ path: doc.path, message: warning });
  }

  // A skipped document must not be left as somebody's parent.
  const survivingIds = new Set(resolved.map((r) => r.id));
  const usable = resolved.filter((r) => {
    if (r.parentId === null) return true;
    if (survivingIds.has(r.parentId) || existingById.has(r.parentId)) return true;
    report.skipped.push({ path: r.doc.path, reason: 'Its parent document could not be imported.' });
    return false;
  });

  // --- build the node set --------------------------------------------------
  const importedPaths = new Set(included.map((doc) => doc.path));
  const nextNodes: GraphNode[] = [];
  const usableIds = new Set(usable.map((r) => r.id));

  for (const { doc, id, parentId, level } of usable) {
    const previous = existingById.get(id);
    const node: GraphNode = {
      id,
      label: doc.label,
      view: doc.view,
      type: doc.type,
      level,
      parent: parentId,
      description: doc.description,
      // FR-52: properties added by hand survive; the document is authoritative for its own keys.
      properties: { ...(previous?.properties ?? {}), ...doc.properties },
      // FR-52: manual layout is never touched by an import.
      positions: previous?.positions ?? {},
      source: { kind: 'markdown', path: doc.path },
    };
    nextNodes.push(node);
    if (previous) report.updated.push({ id, label: node.label, path: doc.path });
    else report.created.push({ id, label: node.label, path: doc.path });
  }

  // --- carry over what the import does not own -----------------------------
  for (const node of existing.nodes) {
    if (usableIds.has(node.id)) continue;

    if (node.source.kind !== 'markdown') {
      // FR-52: hand-made nodes are none of the importer's business.
      nextNodes.push(node);
      report.manualNodesPreserved += 1;
      continue;
    }

    // An imported node whose document did not come back in this run.
    const stillPresent = node.source.path !== null && importedPaths.has(node.source.path);
    if (stillPresent) {
      // Its document was parsed but skipped or failed; keeping it avoids destroying a node
      // because of a temporary syntax error.
      nextNodes.push(node);
      continue;
    }

    report.orphaned.push({ id: node.id, label: node.label, path: node.source.path });
    if (options.prune) report.pruned.push(node.id);
    else nextNodes.push(node);
  }

  // Pruning a parent would orphan its children, so keep any ancestor that is still needed.
  if (options.prune && report.pruned.length > 0) {
    const kept = new Set(nextNodes.map((n) => n.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of existing.nodes) {
        if (kept.has(node.id) || !report.pruned.includes(node.id)) continue;
        const neededBy = nextNodes.some((n) => n.parent === node.id);
        if (neededBy) {
          nextNodes.push(node);
          kept.add(node.id);
          report.pruned.splice(report.pruned.indexOf(node.id), 1);
          changed = true;
        }
      }
    }
  }

  const finalIds = new Set(nextNodes.map((n) => n.id));

  // --- edges ---------------------------------------------------------------
  const nextEdges = new Map<string, GraphEdge>();

  for (const edge of existing.edges) {
    if (edge.sourceRef.kind === 'markdown') {
      // Regenerated below if its document came back; otherwise it goes, which is how a link
      // deleted from a document disappears from the map.
      const fromReimported = edge.sourceRef.path !== null && importedPaths.has(edge.sourceRef.path);
      if (fromReimported) continue;
      if (options.prune && (!finalIds.has(edge.source) || !finalIds.has(edge.target))) continue;
      if (!finalIds.has(edge.source) || !finalIds.has(edge.target)) continue;
      nextEdges.set(edge.id, edge);
      continue;
    }
    // FR-52: hand-drawn relationships survive, unless an endpoint no longer exists.
    if (!finalIds.has(edge.source) || !finalIds.has(edge.target)) continue;
    nextEdges.set(edge.id, edge);
    report.manualEdgesPreserved += 1;
  }

  const edgesBefore = existing.edges.length;

  for (const { doc, id } of usable) {
    for (const link of doc.links) {
      const target = resolveRef(link.target);
      if ('error' in target) {
        report.unresolvedLinks.push({ from: doc.path, target: link.target, type: link.type, reason: target.error });
        continue;
      }
      if (target.id === id) {
        report.warnings.push({ path: doc.path, message: `Link to "${link.target}" points at this same document; ignored.` });
        continue;
      }
      if (!finalIds.has(target.id)) {
        report.unresolvedLinks.push({
          from: doc.path,
          target: link.target,
          type: link.type,
          reason: 'The target could not be imported.',
        });
        continue;
      }

      const edge: GraphEdge = {
        id: makeEdgeId(id, target.id, link.type),
        source: id,
        target: target.id,
        type: link.type,
        weight: 1,
        properties: {},
        sourceRef: { kind: 'markdown', path: doc.path },
      };
      // A duplicate link in a document is the same relationship, not two.
      if (!nextEdges.has(edge.id)) nextEdges.set(edge.id, edge);
    }
  }

  const edges = [...nextEdges.values()];
  const existingIds = new Set(existing.edges.map((e) => e.id));
  report.edgesCreated = edges.filter((e) => !existingIds.has(e.id)).length;
  report.edgesRemoved = edgesBefore - edges.filter((e) => existingIds.has(e.id)).length;

  return { nodes: nextNodes, edges, report };
}

/** True when the report describes an import that changed nothing and hit no problems. */
export function reportIsClean(report: ImportReport): boolean {
  return (
    report.failed.length === 0 &&
    report.skipped.length === 0 &&
    report.unresolvedLinks.length === 0 &&
    report.warnings.length === 0
  );
}
