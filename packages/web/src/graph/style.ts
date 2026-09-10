/**
 * Canvas styling. FR-16 asks that a node's type be readable at a glance, so shape carries the
 * broad category (capability vs journey vs store vs interface) and hue carries the view:
 * functional nodes are warm, technical nodes cool. That way the combined view stays legible
 * without the reader consulting the legend for every node.
 */
import type { StylesheetStyle } from 'cytoscape';
import type { NodeType } from '@map/shared';

export const VIEW_COLORS = {
  functional: { fill: '#f5e6d3', border: '#b5762e', text: '#4a2f10' },
  technical: { fill: '#dde8f5', border: '#2c5f95', text: '#12283f' },
} as const;

/** Shape says what kind of thing it is; the mapping is deliberately small enough to remember. */
export const NODE_SHAPES: Record<NodeType, string> = {
  // functional
  capability: 'round-rectangle',
  feature: 'round-rectangle',
  journey: 'round-diamond',
  'journey-step': 'round-diamond',
  'business-rule': 'round-tag',
  actor: 'ellipse',
  // technical
  system: 'round-rectangle',
  service: 'round-rectangle',
  application: 'round-rectangle',
  datastore: 'barrel',
  component: 'round-hexagon',
  api: 'round-tag',
  endpoint: 'round-tag',
  table: 'barrel',
  integration: 'round-hexagon',
  infrastructure: 'round-octagon',
};

/** Edge types that are structural rather than runtime get a lighter, dashed treatment. */
export const EDGE_COLORS: Record<string, string> = {
  'depends-on': '#5b6470',
  calls: '#2c5f95',
  reads: '#3f7f6f',
  writes: '#8a5a2b',
  publishes: '#6b4a9b',
  subscribes: '#6b4a9b',
  realizes: '#a8442a',
  'implemented-by': '#a8442a',
  contains: '#9aa2ad',
  precedes: '#7a7f88',
  mixed: '#5b6470',
};

/**
 * FR-5: the badge that says "there is more inside this one".
 *
 * A border weight alone is too quiet — a reader scanning a level should not have to compare
 * borders to work out which nodes are worth opening. A chevron in the corner is unmissable, and
 * it doubles as the affordance for the drill-in gesture: down means "go deeper", up means
 * "this is already open, close it".
 *
 * Drawn as a data URI rather than a DOM overlay because Cytoscape renders to canvas — a real
 * element would not stay glued to the node through pan and zoom.
 */
function chevronBadge(direction: 'down' | 'up'): string {
  const path =
    direction === 'down'
      ? 'M5 6.75 L9 10.75 L13 6.75'
      : 'M5 10.75 L9 6.75 L13 10.75';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18">',
    '<circle cx="9" cy="9" r="8" fill="#2c3440" stroke="#ffffff" stroke-width="1.5"/>',
    `<path d="${path}" fill="none" stroke="#ffffff" stroke-width="2" `,
    'stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const BADGE_MORE_INSIDE = chevronBadge('down');
export const BADGE_EXPANDED = chevronBadge('up');

/** Shared placement for both badges: bottom-right corner, spilling slightly over the border. */
const badgePlacement = {
  'background-width': '15px',
  'background-height': '15px',
  'background-position-x': '100%',
  'background-position-y': '100%',
  'background-offset-x': '6px',
  'background-offset-y': '6px',
  'background-repeat': 'no-repeat',
  'background-fit': 'none',
  'background-clip': 'none',
  'background-image-containment': 'over',
  'background-image-opacity': 1,
} as const;

export function buildStylesheet(): StylesheetStyle[] {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-size': 11,
        'font-family': 'Inter, "Segoe UI", system-ui, sans-serif',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '120px',
        width: 'label',
        height: 'label',
        padding: '12px',
        'border-width': 1.5,
        shape: 'round-rectangle',
        'transition-property': 'opacity, border-width, background-color',
        'transition-duration': 120,
      },
    },

    { selector: 'node[view = "functional"]', style: { 'background-color': VIEW_COLORS.functional.fill, 'border-color': VIEW_COLORS.functional.border, color: VIEW_COLORS.functional.text } },
    { selector: 'node[view = "technical"]', style: { 'background-color': VIEW_COLORS.technical.fill, 'border-color': VIEW_COLORS.technical.border, color: VIEW_COLORS.technical.text } },

    ...Object.entries(NODE_SHAPES).map(
      (entry): StylesheetStyle => ({
        selector: `node[type = "${entry[0]}"]`,
        style: { shape: entry[1] as 'round-rectangle' },
      }),
    ),

    /**
     * FR-5: a node with children carries a chevron badge and a heavier double border, so
     * "there is more inside this" is obvious at a glance rather than on inspection.
     */
    {
      selector: 'node[?hasChildren]',
      style: {
        'border-width': 3,
        'border-style': 'double',
        'background-image': BADGE_MORE_INSIDE,
        ...badgePlacement,
      },
    },
    {
      selector: 'node[?isLeaf]',
      style: { 'border-style': 'solid', 'border-width': 1.5 },
    },

    // FR-6: expanded nodes become compound containers, drawn as a labelled frame.
    {
      selector: 'node:parent',
      style: {
        'text-valign': 'top',
        'text-halign': 'center',
        'font-size': 12,
        'font-weight': 600,
        padding: '22px',
        'background-opacity': 0.35,
        'border-style': 'dashed',
        'border-width': 2,
      },
    },

    // An expanded node flips the chevron: it now offers to close rather than to open.
    {
      selector: 'node[?isExpanded]',
      style: { 'background-image': BADGE_EXPANDED, ...badgePlacement },
    },

    // FR-22: semantic zoom adds a second line of detail once nodes are big enough to read it.
    {
      selector: 'node[?showDetail]',
      style: {
        label: 'data(detailLabel)',
        'text-wrap': 'wrap',
        'font-size': 10,
        'text-max-width': '160px',
      },
    },

    {
      selector: 'node:selected',
      style: { 'border-color': '#c0392b', 'border-width': 4, 'border-style': 'solid' },
    },

    // FR-19: out-of-scope nodes fade instead of disappearing.
    { selector: 'node.dimmed', style: { opacity: 0.18 } },
    { selector: 'edge.dimmed', style: { opacity: 0.08 } },
    { selector: 'node.impact-origin', style: { 'border-color': '#c0392b', 'border-width': 4 } },

    {
      selector: 'edge',
      style: {
        width: 'data(width)',
        'line-color': 'data(color)',
        'target-arrow-color': 'data(color)',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        'curve-style': 'bezier',
        'font-size': 9,
        'font-family': 'Inter, "Segoe UI", system-ui, sans-serif',
        color: '#4a5058',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'transition-property': 'opacity, width',
        'transition-duration': 120,
      },
    },

    // FR-10: a rolled-up edge is dashed and carries the count of what it stands for.
    {
      selector: 'edge[?aggregated]',
      style: { 'line-style': 'dashed', label: 'data(countLabel)' },
    },
    { selector: 'edge[type = "realizes"], edge[type = "implemented-by"]', style: { 'line-style': 'dotted', width: 2 } },
    { selector: 'edge:selected', style: { 'line-color': '#c0392b', 'target-arrow-color': '#c0392b', width: 4 } },
    { selector: 'edge.path-highlight', style: { 'line-color': '#c0392b', 'target-arrow-color': '#c0392b', width: 4, opacity: 1 } },
  ];
}
