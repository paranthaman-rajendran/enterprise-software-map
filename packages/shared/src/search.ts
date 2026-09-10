/**
 * FR-39..FR-41 / NFR-3: free-text search over every node in the map, not just the visible
 * level, returning each hit with the L0 path that disambiguates identically named nodes.
 *
 * At the scale settled on (hundreds to low thousands of nodes) a linear scan with scoring is
 * well inside NFR-3, and it keeps ranking behaviour obvious. Swap in an inverted index here if
 * the map ever grows past that; nothing outside this module needs to change.
 */
import { ancestorPath, buildIndex, type GraphIndex } from './graph.js';
import type { GraphMap, GraphNode, Level, NodeType, View } from './model.js';

export interface SearchHit {
  node: GraphNode;
  score: number;
  /** L0..node, node last — rendered as the result's path (FR-40). */
  path: GraphNode[];
  /** Which field the strongest match came from, so the UI can show why it matched. */
  matchedOn: 'label' | 'description' | 'property' | 'id';
  /** For a property match, the key that matched. */
  matchedKey?: string;
}

export interface SearchOptions {
  limit?: number;
  views?: View[];
  types?: NodeType[];
  maxLevel?: Level | null;
}

/**
 * Scores a single field. Exact match beats prefix beats substring, so searching "order"
 * surfaces the Order capability above "Reorder point rule".
 */
function scoreField(haystack: string, needle: string): number {
  if (!haystack) return 0;
  const value = haystack.toLowerCase();
  if (value === needle) return 100;
  if (value.startsWith(needle)) return 60;
  const at = value.indexOf(needle);
  if (at === -1) return 0;
  // A match on a word boundary reads as more relevant than one mid-word.
  return /[\s\-_/.]/.test(value[at - 1] ?? ' ') ? 40 : 20;
}

export function searchNodes(
  map: Pick<GraphMap, 'nodes' | 'edges'>,
  query: string,
  options: SearchOptions = {},
  index: GraphIndex = buildIndex(map),
): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const limit = options.limit ?? 50;
  const views = options.views && options.views.length > 0 ? new Set(options.views) : null;
  const types = options.types && options.types.length > 0 ? new Set(options.types) : null;
  const maxLevel = options.maxLevel ?? null;

  const hits: SearchHit[] = [];
  for (const node of map.nodes) {
    if (views && !views.has(node.view)) continue;
    if (types && !types.has(node.type)) continue;
    if (maxLevel !== null && node.level > maxLevel) continue;

    let score = scoreField(node.label, needle) * 3;
    let matchedOn: SearchHit['matchedOn'] = 'label';
    let matchedKey: string | undefined;

    const idScore = scoreField(node.id, needle) * 2;
    if (idScore > score) {
      score = idScore;
      matchedOn = 'id';
    }

    const descriptionScore = scoreField(node.description, needle);
    if (descriptionScore > score) {
      score = descriptionScore;
      matchedOn = 'description';
      matchedKey = undefined;
    }

    for (const [key, value] of Object.entries(node.properties)) {
      if (value === null) continue;
      const propertyScore = scoreField(String(value), needle) * 1.5;
      if (propertyScore > score) {
        score = propertyScore;
        matchedOn = 'property';
        matchedKey = key;
      }
    }

    if (score <= 0) continue;

    // Shallower nodes are the more useful answer to an ambiguous query.
    score += (4 - node.level) * 2;
    hits.push({ node, score, path: ancestorPath(index, node.id), matchedOn, matchedKey });
  }

  hits.sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label));
  return hits.slice(0, limit);
}

/**
 * FR-44: property filters. A node passes when every clause matches one of its properties;
 * values compare case-insensitively as strings so "Team: Payments" matches "payments".
 */
export function matchesPropertyFilters(
  node: GraphNode,
  clauses: ReadonlyArray<{ key: string; value: string }>,
): boolean {
  return clauses.every((clause) => {
    const actual = node.properties[clause.key];
    if (actual === undefined || actual === null) return false;
    return String(actual).toLowerCase() === clause.value.trim().toLowerCase();
  });
}

/** The distinct property keys and values in the map, to populate filter dropdowns. */
export function propertyFacets(
  map: Pick<GraphMap, 'nodes'>,
): Array<{ key: string; values: string[] }> {
  const facets = new Map<string, Set<string>>();
  for (const node of map.nodes) {
    for (const [key, value] of Object.entries(node.properties)) {
      if (value === null || value === '') continue;
      const bucket = facets.get(key) ?? new Set<string>();
      bucket.add(String(value));
      facets.set(key, bucket);
    }
  }
  return [...facets.entries()]
    .map(([key, values]) => ({ key, values: [...values].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
