/**
 * The canvas. Cytoscape owns the rendering; React owns the state. The bridge between them is
 * deliberately one-way: a change in the render model rebuilds the elements, and Cytoscape
 * events call back into the store. Cytoscape's own internal state is never read as truth,
 * except for positions, which only it knows.
 */
import cytoscape, { type Core, type ElementDefinition, type EventObject, type NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import { useEffect, useMemo, useRef } from 'react';

import { contextKey, type GraphNode } from '@map/shared';

import { buildRenderModel, type RenderModel } from '../graph/viewModel.js';
import { EDGE_COLORS, buildStylesheet } from '../graph/style.js';
import { useStore } from '../store.js';

cytoscape.use(dagre);
cytoscape.use(fcose);

export type LayoutName = 'dagre' | 'fcose' | 'concentric' | 'grid';

/**
 * FR-24: layouts must be stable — the same level must lay out the same way every time it is
 * opened. Both dagre and fcose are seeded/deterministic here for that reason.
 */
function layoutOptions(name: LayoutName): cytoscape.LayoutOptions {
  const common = { animate: false as const, fit: true, padding: 40 };
  switch (name) {
    case 'dagre':
      return { name: 'dagre', rankDir: 'LR', nodeSep: 40, rankSep: 90, ...common } as cytoscape.LayoutOptions;
    case 'fcose':
      return {
        name: 'fcose',
        quality: 'proof',
        randomize: false,
        nodeSeparation: 120,
        idealEdgeLength: 140,
        nestingFactor: 0.2,
        ...common,
      } as cytoscape.LayoutOptions;
    case 'concentric':
      return { name: 'concentric', minNodeSpacing: 40, ...common } as cytoscape.LayoutOptions;
    default:
      return { name: 'grid', avoidOverlap: true, ...common } as cytoscape.LayoutOptions;
  }
}

function detailLabel(node: GraphNode): string {
  const bits = [node.label, node.type];
  const owner = node.properties.owner;
  if (owner) bits.push(String(owner));
  return bits.join('\n');
}

function toElements(model: RenderModel, context: string | null): ElementDefinition[] {
  const key = contextKey(context);
  const elements: ElementDefinition[] = [];

  for (const item of model.nodes) {
    const saved = item.node.positions[key];
    elements.push({
      group: 'nodes',
      data: {
        id: item.node.id,
        label: item.node.label,
        detailLabel: detailLabel(item.node),
        type: item.node.type,
        view: item.node.view,
        level: item.node.level,
        hasChildren: !item.isLeaf,
        isLeaf: item.isLeaf,
        isExpanded: item.isExpanded,
        parent: item.compoundParent ?? undefined,
        showDetail: false,
      },
      // FR-25: a manually placed node opens where it was left.
      position: saved ? { x: saved.x, y: saved.y } : undefined,
      classes: item.dimmed ? 'dimmed' : undefined,
    });
  }

  for (const edge of model.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        aggregated: edge.aggregated && edge.count > 1,
        count: edge.count,
        countLabel: edge.count > 1 ? `${edge.count}×` : '',
        color: EDGE_COLORS[edge.type] ?? EDGE_COLORS['depends-on'],
        width: Math.min(6, 1.4 + Math.log2(edge.weight + 1)),
      },
    });
  }

  return elements;
}

export interface GraphCanvasProps {
  layout: LayoutName;
  /** Bumped by the toolbar to force a re-layout of the current level. */
  layoutNonce: number;
  onReady?: (cy: Core) => void;
}

export function GraphCanvas({ layout, layoutNonce, onReady }: GraphCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const map = useStore((s) => s.map);
  const index = useStore((s) => s.index);
  const spec = useStore((s) => s.spec);
  const selection = useStore((s) => s.selection);
  const pathHighlight = useStore((s) => s.pathHighlight);

  const model = useMemo(() => {
    if (!map || !index) return null;
    return buildRenderModel(map, spec, index);
  }, [map, index, spec]);

  // --- create the instance once -------------------------------------------
  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: buildStylesheet(),
      wheelSensitivity: 0.25,
      minZoom: 0.1,
      maxZoom: 4,
      boxSelectionEnabled: true, // FR-30: rubber-band select
      selectionType: 'additive',
    });
    cyRef.current = cy;

    const store = useStore.getState;

    cy.on('tap', 'node', (event: EventObject) => {
      store().select({ kind: 'node', id: (event.target as NodeSingular).id() });
    });

    cy.on('tap', 'edge', (event: EventObject) => {
      store().select({ kind: 'edge', id: event.target.id() });
    });

    cy.on('tap', (event: EventObject) => {
      if (event.target === cy) store().select(null);
    });

    // FR-2: double-click drills in, which is the gesture the spec calls out.
    cy.on('dbltap', 'node', (event: EventObject) => {
      const node = event.target as NodeSingular;
      if (node.data('hasChildren')) store().drillInto(node.id());
    });

    /**
     * FR-5: the cursor is the second half of the affordance. Cytoscape draws to a canvas, so
     * there is no element to attach a CSS cursor to — the container's cursor is swapped on
     * hover instead. `zoom-in` over a node that can be opened matches what a double-click does.
     */
    const container = cy.container();
    const setCursor = (value: string): void => {
      if (container) container.style.cursor = value;
    };
    cy.on('mouseover', 'node', (event: EventObject) => {
      setCursor((event.target as NodeSingular).data('hasChildren') ? 'zoom-in' : 'pointer');
    });
    cy.on('mouseover', 'edge', () => setCursor('pointer'));
    // Note the comma: `node, edge` is "either"; `node edge` would be a descendant selector and
    // would never match, leaving the cursor stuck on whatever it last hovered.
    cy.on('mouseout', 'node, edge', () => setCursor('default'));
    // Dragging a node should not keep the "you can open this" cursor.
    cy.on('grab', 'node', () => setCursor('grabbing'));
    cy.on('free', 'node', () => setCursor('default'));

    cy.on('select unselect', () => {
      store().setMultiSelection(cy.$('node:selected').map((n) => n.id()));
    });

    // FR-25: persist a dragged position against the current context.
    cy.on('dragfree', 'node', (event: EventObject) => {
      const node = event.target as NodeSingular;
      const { x, y } = node.position();
      void store().savePosition(node.id(), x, y);
    });

    /**
     * FR-22: semantic zoom. Below the threshold nodes carry their name only; above it they
     * add type and owner. Toggled by a data flag so the stylesheet stays declarative.
     */
    const applyZoomDetail = (): void => {
      const showDetail = cy.zoom() > 1.15;
      cy.batch(() => {
        cy.nodes().forEach((n) => {
          if (n.data('showDetail') !== showDetail) n.data('showDetail', showDetail);
        });
      });
    };
    cy.on('zoom', applyZoomDetail);

    /**
     * Cytoscape measures its container once. If the first layout runs before the pane has been
     * given a size — which happens on a reload, and whenever the panel is mounted hidden — every
     * position is computed against a zero-sized viewport and the map lands off screen, leaving an
     * apparently blank canvas until the user presses Fit.
     *
     * Watching the container fixes the dimensions as soon as they are real, and re-frames once
     * on the transition out of zero size. Later resizes only call `resize()`, so a user who has
     * panned somewhere deliberately is not yanked back.
     */
    let lastWidth = containerRef.current.clientWidth;
    let lastHeight = containerRef.current.clientHeight;
    const observer = new ResizeObserver(() => {
      const element = containerRef.current;
      if (!element) return;
      const { clientWidth, clientHeight } = element;
      if (clientWidth === 0 || clientHeight === 0) return;

      const wasUnsized = lastWidth === 0 || lastHeight === 0;
      lastWidth = clientWidth;
      lastHeight = clientHeight;

      cy.resize();
      if (wasUnsized && cy.nodes().length > 0) cy.fit(undefined, 40);
    });
    observer.observe(containerRef.current);

    onReady?.(cy);

    return () => {
      observer.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [onReady]);

  // --- push the render model in -------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !model) return;

    const elements = toElements(model, spec.contextId);
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });

    // Nodes with a saved position keep it; only the rest need placing (FR-24 + FR-25).
    const key = contextKey(spec.contextId);
    const unpositioned = cy.nodes().filter((n) => {
      const node = model.index.nodes.get(n.id());
      return !node || node.positions[key] === undefined;
    });

    if (unpositioned.length === cy.nodes().length) {
      cy.layout(layoutOptions(layout)).run();
    } else if (unpositioned.length > 0) {
      unpositioned.layout(layoutOptions(layout)).run();
      cy.fit(undefined, 40);
    } else {
      cy.fit(undefined, 40);
    }
  }, [model, spec.contextId, layout]);

  // --- explicit re-layout request ------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || layoutNonce === 0) return;
    cy.layout(layoutOptions(layout)).run();
  }, [layoutNonce, layout]);

  // --- selection and path highlight ----------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().unselect();
      if (selection) cy.getElementById(selection.id).select();
    });
  }, [selection, model]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('path-highlight');
      if (!pathHighlight) return;
      for (const id of [...pathHighlight.nodes, ...pathHighlight.edges]) {
        cy.getElementById(id).addClass('path-highlight');
      }
    });
  }, [pathHighlight, model]);

  if (model?.contextIsEmpty) {
    // NFR-7: an empty area must read as "nothing recorded here", not as "nothing exists".
    return (
      <div className="canvas-wrap">
        <div ref={containerRef} className="canvas" />
        <div className="canvas-empty">
          <strong>No detail recorded at this level.</strong>
          <span>This node has no children in the map. Add one, or climb back up.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-wrap">
      <div ref={containerRef} className="canvas" />
    </div>
  );
}
