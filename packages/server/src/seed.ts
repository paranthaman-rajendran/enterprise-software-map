/**
 * A demo map: a fictional commerce platform, mapped on both sides down to L3, with the
 * traceability edges that connect them. It exists so the UI has something honest to render on
 * first run, and so drill-down, edge roll-up, focus, and coverage gaps are all exercised by
 * real data rather than by a handful of placeholder boxes.
 *
 * A few capabilities are deliberately left with no implementing service, and a few services
 * with no capability — those are the FR-15 blind spots the coverage panel is meant to surface.
 */
import type { EdgeType, GraphEdge, GraphNode, Level, NodeType, PropertyValue, View } from '@map/shared';
import { NODE_TYPE_VIEW, edgeId } from '@map/shared';

import type { MapRepository, MapSummary } from './repository.js';

export interface Spec {
  id: string;
  label: string;
  type: NodeType;
  parent: string | null;
  description?: string;
  properties?: Record<string, PropertyValue>;
}

const nodeSpecs: Spec[] = [
  // ---- functional: L0 --------------------------------------------------------
  {
    id: 'cap:orion-commerce',
    label: 'Orion Commerce',
    type: 'capability',
    parent: null,
    description: 'Everything the business does to sell, fulfil, and support a customer order.',
    properties: { owner: 'Commerce', criticality: 'critical', status: 'active' },
  },
  {
    id: 'actor:shopper',
    label: 'Shopper',
    type: 'actor',
    parent: null,
    description: 'An external customer browsing and buying.',
    properties: { owner: 'Commerce' },
  },
  {
    id: 'actor:merchandiser',
    label: 'Merchandiser',
    type: 'actor',
    parent: null,
    description: 'Internal user curating catalogue, pricing, and promotions.',
    properties: { owner: 'Merchandising' },
  },

  // ---- functional: L1 domains -------------------------------------------------
  { id: 'cap:browse-discover', label: 'Browse & Discover', type: 'capability', parent: 'cap:orion-commerce', description: 'Finding the right product.', properties: { owner: 'Merchandising', criticality: 'high', status: 'active' } },
  { id: 'cap:ordering', label: 'Ordering', type: 'capability', parent: 'cap:orion-commerce', description: 'Turning a basket into a committed order.', properties: { owner: 'Orders', criticality: 'critical', status: 'active' } },
  { id: 'cap:payments', label: 'Payments', type: 'capability', parent: 'cap:orion-commerce', description: 'Taking and reconciling money.', properties: { owner: 'Payments', criticality: 'critical', status: 'active' } },
  { id: 'cap:fulfilment', label: 'Fulfilment', type: 'capability', parent: 'cap:orion-commerce', description: 'Getting goods to the customer.', properties: { owner: 'Supply Chain', criticality: 'high', status: 'active' } },
  { id: 'cap:customer-care', label: 'Customer Care', type: 'capability', parent: 'cap:orion-commerce', description: 'Support, returns, and goodwill.', properties: { owner: 'Care', criticality: 'medium', status: 'active' } },

  // ---- functional: L2 capabilities / features --------------------------------
  { id: 'cap:search', label: 'Product Search', type: 'capability', parent: 'cap:browse-discover', properties: { owner: 'Merchandising', criticality: 'high', status: 'active' } },
  { id: 'feature:faceted-filters', label: 'Faceted Filters', type: 'feature', parent: 'cap:browse-discover', properties: { owner: 'Merchandising', status: 'active' } },
  { id: 'feature:recommendations', label: 'Recommendations', type: 'feature', parent: 'cap:browse-discover', description: 'Personalised "you may also like" placements.', properties: { owner: 'Data Science', status: 'planned' } },

  { id: 'cap:basket', label: 'Basket Management', type: 'capability', parent: 'cap:ordering', properties: { owner: 'Orders', criticality: 'high', status: 'active' } },
  { id: 'cap:checkout', label: 'Checkout', type: 'capability', parent: 'cap:ordering', properties: { owner: 'Orders', criticality: 'critical', status: 'active' } },
  { id: 'cap:order-lifecycle', label: 'Order Lifecycle', type: 'capability', parent: 'cap:ordering', properties: { owner: 'Orders', criticality: 'critical', status: 'active' } },

  { id: 'cap:authorisation', label: 'Payment Authorisation', type: 'capability', parent: 'cap:payments', properties: { owner: 'Payments', criticality: 'critical', status: 'active' } },
  { id: 'cap:refunds', label: 'Refunds', type: 'capability', parent: 'cap:payments', properties: { owner: 'Payments', criticality: 'high', status: 'active' } },
  { id: 'cap:reconciliation', label: 'Reconciliation', type: 'capability', parent: 'cap:payments', description: 'Matching settlement files against orders.', properties: { owner: 'Finance', criticality: 'medium', status: 'active' } },

  { id: 'cap:inventory', label: 'Inventory Availability', type: 'capability', parent: 'cap:fulfilment', properties: { owner: 'Supply Chain', criticality: 'high', status: 'active' } },
  { id: 'cap:shipping', label: 'Shipping', type: 'capability', parent: 'cap:fulfilment', properties: { owner: 'Supply Chain', criticality: 'high', status: 'active' } },
  { id: 'cap:returns', label: 'Returns', type: 'capability', parent: 'cap:customer-care', properties: { owner: 'Care', criticality: 'medium', status: 'active' } },
  { id: 'cap:case-management', label: 'Case Management', type: 'capability', parent: 'cap:customer-care', description: 'Support tickets and escalations.', properties: { owner: 'Care', status: 'active' } },

  // ---- functional: L3 journeys and steps -------------------------------------
  { id: 'journey:place-order', label: 'Place an order', type: 'journey', parent: 'cap:checkout', description: 'From a filled basket to a confirmed order.', properties: { owner: 'Orders', criticality: 'critical' } },
  { id: 'journey:return-item', label: 'Return an item', type: 'journey', parent: 'cap:returns', properties: { owner: 'Care' } },
  { id: 'rule:auth-before-commit', label: 'Authorise before committing stock', type: 'business-rule', parent: 'cap:authorisation', description: 'Stock is only reserved once payment authorisation succeeds.', properties: { owner: 'Payments', criticality: 'critical' } },
  { id: 'rule:refund-window', label: 'Refunds within 30 days', type: 'business-rule', parent: 'cap:refunds', properties: { owner: 'Finance' } },

  // ---- technical: L0 ---------------------------------------------------------
  {
    id: 'system:orion-platform',
    label: 'Orion Platform',
    type: 'system',
    parent: null,
    description: 'The commerce platform itself.',
    properties: { owner: 'Platform', criticality: 'critical', status: 'active', technology: 'polyglot' },
  },
  { id: 'system:stripe', label: 'Stripe', type: 'system', parent: null, description: 'External payment service provider.', properties: { owner: 'Payments', criticality: 'critical', status: 'active', technology: 'SaaS' } },
  { id: 'system:sap-erp', label: 'SAP ERP', type: 'system', parent: null, description: 'Finance and stock system of record.', properties: { owner: 'Finance', criticality: 'critical', status: 'active', technology: 'SAP' } },
  { id: 'system:zendesk', label: 'Zendesk', type: 'system', parent: null, description: 'Support ticketing.', properties: { owner: 'Care', status: 'active', technology: 'SaaS' } },

  // ---- technical: L1 subsystems ----------------------------------------------
  { id: 'system:storefront', label: 'Storefront', type: 'system', parent: 'system:orion-platform', description: 'Customer-facing web and mobile experience.', properties: { owner: 'Storefront', criticality: 'critical', status: 'active', technology: 'Next.js' } },
  { id: 'system:oms', label: 'Order Management', type: 'system', parent: 'system:orion-platform', properties: { owner: 'Orders', criticality: 'critical', status: 'active', technology: 'Java' } },
  { id: 'system:payments-platform', label: 'Payments Platform', type: 'system', parent: 'system:orion-platform', properties: { owner: 'Payments', criticality: 'critical', status: 'active', technology: 'Go' } },
  { id: 'system:supply-chain', label: 'Supply Chain', type: 'system', parent: 'system:orion-platform', properties: { owner: 'Supply Chain', criticality: 'high', status: 'active', technology: 'Java' } },
  { id: 'system:catalog-platform', label: 'Catalog Platform', type: 'system', parent: 'system:orion-platform', properties: { owner: 'Merchandising', criticality: 'high', status: 'active', technology: 'Node.js' } },

  // ---- technical: L2 services and stores -------------------------------------
  { id: 'service:web-bff', label: 'Web BFF', type: 'service', parent: 'system:storefront', description: 'Backend-for-frontend aggregating catalogue, basket, and pricing.', properties: { owner: 'Storefront', criticality: 'high', status: 'active', technology: 'Node.js' } },
  { id: 'service:basket-service', label: 'Basket Service', type: 'service', parent: 'system:storefront', properties: { owner: 'Storefront', criticality: 'high', status: 'active', technology: 'Node.js' } },
  { id: 'datastore:basket-redis', label: 'Basket Cache', type: 'datastore', parent: 'system:storefront', properties: { owner: 'Storefront', status: 'active', technology: 'Redis' } },

  { id: 'service:order-service', label: 'Order Service', type: 'service', parent: 'system:oms', properties: { owner: 'Orders', criticality: 'critical', status: 'active', technology: 'Java 21' } },
  { id: 'service:order-orchestrator', label: 'Order Orchestrator', type: 'service', parent: 'system:oms', description: 'Saga coordinator across payment, stock, and shipping.', properties: { owner: 'Orders', criticality: 'critical', status: 'active', technology: 'Java 21' } },
  { id: 'datastore:orders-db', label: 'Orders DB', type: 'datastore', parent: 'system:oms', properties: { owner: 'Orders', criticality: 'critical', status: 'active', technology: 'PostgreSQL' } },
  { id: 'integration:order-events', label: 'Order Events', type: 'integration', parent: 'system:oms', description: 'Kafka topic carrying order state transitions.', properties: { owner: 'Orders', criticality: 'high', status: 'active', technology: 'Kafka' } },

  { id: 'service:payment-service', label: 'Payment Service', type: 'service', parent: 'system:payments-platform', properties: { owner: 'Payments', criticality: 'critical', status: 'active', technology: 'Go' } },
  { id: 'service:refund-service', label: 'Refund Service', type: 'service', parent: 'system:payments-platform', properties: { owner: 'Payments', criticality: 'high', status: 'active', technology: 'Go' } },
  { id: 'datastore:payments-db', label: 'Payments DB', type: 'datastore', parent: 'system:payments-platform', properties: { owner: 'Payments', criticality: 'critical', status: 'active', technology: 'PostgreSQL' } },
  { id: 'service:settlement-batch', label: 'Settlement Batch', type: 'service', parent: 'system:payments-platform', description: 'Nightly reconciliation job against the PSP settlement file.', properties: { owner: 'Finance', status: 'active', technology: 'Python' } },

  { id: 'service:inventory-service', label: 'Inventory Service', type: 'service', parent: 'system:supply-chain', properties: { owner: 'Supply Chain', criticality: 'high', status: 'active', technology: 'Java 21' } },
  { id: 'service:shipping-service', label: 'Shipping Service', type: 'service', parent: 'system:supply-chain', properties: { owner: 'Supply Chain', criticality: 'high', status: 'active', technology: 'Java 21' } },
  { id: 'datastore:inventory-db', label: 'Inventory DB', type: 'datastore', parent: 'system:supply-chain', properties: { owner: 'Supply Chain', status: 'active', technology: 'PostgreSQL' } },

  { id: 'service:catalog-service', label: 'Catalog Service', type: 'service', parent: 'system:catalog-platform', properties: { owner: 'Merchandising', criticality: 'high', status: 'active', technology: 'Node.js' } },
  { id: 'service:search-service', label: 'Search Service', type: 'service', parent: 'system:catalog-platform', properties: { owner: 'Merchandising', criticality: 'high', status: 'active', technology: 'Elasticsearch' } },
  { id: 'service:pricing-service', label: 'Pricing Service', type: 'service', parent: 'system:catalog-platform', properties: { owner: 'Merchandising', criticality: 'high', status: 'active', technology: 'Node.js' } },
  { id: 'datastore:catalog-db', label: 'Catalog DB', type: 'datastore', parent: 'system:catalog-platform', properties: { owner: 'Merchandising', status: 'active', technology: 'MongoDB' } },
  { id: 'service:legacy-promo-engine', label: 'Legacy Promo Engine', type: 'service', parent: 'system:catalog-platform', description: 'Nothing on the functional map claims this any more.', properties: { owner: 'Merchandising', status: 'deprecated', technology: 'Perl' } },

  // ---- technical: L3 components and APIs -------------------------------------
  { id: 'api:orders-api', label: 'Orders API', type: 'api', parent: 'service:order-service', description: 'REST API for order creation and retrieval.', properties: { owner: 'Orders', criticality: 'critical', technology: 'OpenAPI 3.1' } },
  { id: 'component:order-validator', label: 'Order Validator', type: 'component', parent: 'service:order-service', properties: { owner: 'Orders' } },
  { id: 'table:orders', label: 'orders', type: 'table', parent: 'datastore:orders-db', properties: { owner: 'Orders' } },
  { id: 'table:order-lines', label: 'order_lines', type: 'table', parent: 'datastore:orders-db', properties: { owner: 'Orders' } },
  { id: 'api:payments-api', label: 'Payments API', type: 'api', parent: 'service:payment-service', properties: { owner: 'Payments', criticality: 'critical', technology: 'gRPC' } },
  { id: 'component:psp-adapter', label: 'PSP Adapter', type: 'component', parent: 'service:payment-service', description: 'Wraps the Stripe SDK behind our own interface.', properties: { owner: 'Payments' } },
  { id: 'api:catalog-api', label: 'Catalog API', type: 'api', parent: 'service:catalog-service', properties: { owner: 'Merchandising', technology: 'GraphQL' } },
  { id: 'component:stock-reserver', label: 'Stock Reserver', type: 'component', parent: 'service:inventory-service', properties: { owner: 'Supply Chain' } },
];

export interface EdgeSpec {
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
}

const edgeSpecs: EdgeSpec[] = [
  // functional: actors and journey ordering
  { source: 'actor:shopper', target: 'cap:browse-discover', type: 'depends-on' },
  { source: 'actor:shopper', target: 'cap:ordering', type: 'depends-on' },
  { source: 'actor:merchandiser', target: 'cap:browse-discover', type: 'depends-on' },
  { source: 'cap:basket', target: 'cap:checkout', type: 'precedes' },
  { source: 'cap:checkout', target: 'cap:authorisation', type: 'precedes' },
  { source: 'cap:authorisation', target: 'cap:order-lifecycle', type: 'precedes' },
  { source: 'cap:order-lifecycle', target: 'cap:shipping', type: 'precedes' },
  { source: 'cap:returns', target: 'cap:refunds', type: 'precedes' },
  { source: 'cap:checkout', target: 'cap:inventory', type: 'depends-on' },

  // technical: runtime dependencies
  { source: 'service:web-bff', target: 'service:catalog-service', type: 'calls', weight: 3 },
  { source: 'service:web-bff', target: 'service:search-service', type: 'calls', weight: 2 },
  { source: 'service:web-bff', target: 'service:pricing-service', type: 'calls', weight: 2 },
  { source: 'service:web-bff', target: 'service:basket-service', type: 'calls', weight: 4 },
  { source: 'service:basket-service', target: 'datastore:basket-redis', type: 'writes' },
  { source: 'service:basket-service', target: 'service:pricing-service', type: 'calls' },
  { source: 'service:web-bff', target: 'api:orders-api', type: 'calls', weight: 2 },

  { source: 'api:orders-api', target: 'component:order-validator', type: 'calls' },
  { source: 'service:order-service', target: 'datastore:orders-db', type: 'writes', weight: 5 },
  { source: 'service:order-service', target: 'integration:order-events', type: 'publishes' },
  { source: 'service:order-orchestrator', target: 'integration:order-events', type: 'subscribes' },
  { source: 'service:order-orchestrator', target: 'api:payments-api', type: 'calls', weight: 3 },
  { source: 'service:order-orchestrator', target: 'service:inventory-service', type: 'calls', weight: 3 },
  { source: 'service:order-orchestrator', target: 'service:shipping-service', type: 'calls' },
  { source: 'service:order-service', target: 'service:catalog-service', type: 'calls' },

  { source: 'api:payments-api', target: 'component:psp-adapter', type: 'calls' },
  { source: 'component:psp-adapter', target: 'system:stripe', type: 'calls', weight: 2 },
  { source: 'service:payment-service', target: 'datastore:payments-db', type: 'writes', weight: 4 },
  { source: 'service:refund-service', target: 'datastore:payments-db', type: 'writes' },
  { source: 'service:refund-service', target: 'system:stripe', type: 'calls' },
  { source: 'service:settlement-batch', target: 'datastore:payments-db', type: 'reads' },
  { source: 'service:settlement-batch', target: 'system:sap-erp', type: 'writes' },

  { source: 'service:inventory-service', target: 'datastore:inventory-db', type: 'writes', weight: 3 },
  { source: 'service:inventory-service', target: 'component:stock-reserver', type: 'calls' },
  { source: 'service:inventory-service', target: 'system:sap-erp', type: 'reads', weight: 2 },
  { source: 'service:shipping-service', target: 'datastore:inventory-db', type: 'reads' },
  { source: 'service:shipping-service', target: 'integration:order-events', type: 'subscribes' },

  { source: 'service:catalog-service', target: 'datastore:catalog-db', type: 'reads', weight: 4 },
  { source: 'service:search-service', target: 'datastore:catalog-db', type: 'reads' },
  { source: 'service:pricing-service', target: 'datastore:catalog-db', type: 'reads' },
  { source: 'api:catalog-api', target: 'datastore:catalog-db', type: 'reads' },
  { source: 'system:zendesk', target: 'api:orders-api', type: 'calls' },

  { source: 'table:order-lines', target: 'table:orders', type: 'depends-on' },

  // traceability: the bridge between the two sides
  { source: 'cap:search', target: 'service:search-service', type: 'realizes' },
  { source: 'cap:search', target: 'service:catalog-service', type: 'realizes' },
  { source: 'feature:faceted-filters', target: 'service:search-service', type: 'realizes' },
  { source: 'cap:basket', target: 'service:basket-service', type: 'realizes' },
  { source: 'cap:checkout', target: 'service:web-bff', type: 'realizes' },
  { source: 'cap:checkout', target: 'service:order-service', type: 'realizes' },
  { source: 'cap:order-lifecycle', target: 'service:order-orchestrator', type: 'realizes' },
  { source: 'cap:order-lifecycle', target: 'service:order-service', type: 'realizes' },
  { source: 'cap:authorisation', target: 'service:payment-service', type: 'realizes' },
  { source: 'rule:auth-before-commit', target: 'service:order-orchestrator', type: 'realizes' },
  { source: 'cap:refunds', target: 'service:refund-service', type: 'realizes' },
  { source: 'cap:reconciliation', target: 'service:settlement-batch', type: 'realizes' },
  { source: 'cap:inventory', target: 'service:inventory-service', type: 'realizes' },
  { source: 'cap:shipping', target: 'service:shipping-service', type: 'realizes' },
  { source: 'journey:place-order', target: 'service:web-bff', type: 'realizes' },
  // Deliberately unrealized: feature:recommendations, cap:case-management, cap:returns,
  // journey:return-item, rule:refund-window — these are the FR-15 gaps.
];

function levelOf(spec: Spec, byId: Map<string, Spec>): Level {
  let level = 0;
  let cursor = spec.parent;
  while (cursor) {
    level += 1;
    cursor = byId.get(cursor)?.parent ?? null;
  }
  return level as Level;
}

/**
 * Turns declarative specs into a map, deriving each node's level from its parent chain so the
 * spec never has to state a level that could disagree with the hierarchy.
 */
export function buildContents(
  specs: Spec[],
  edgeSpecs: EdgeSpec[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const byId = new Map(specs.map((s) => [s.id, s]));

  const nodes: GraphNode[] = specs.map((spec) => {
    const view: View = NODE_TYPE_VIEW[spec.type];
    return {
      id: spec.id,
      label: spec.label,
      view,
      type: spec.type,
      level: levelOf(spec, byId),
      parent: spec.parent,
      description: spec.description ?? '',
      properties: spec.properties ?? {},
      positions: {},
      source: { kind: 'manual', path: null },
    };
  });

  const edges: GraphEdge[] = edgeSpecs.map((spec) => ({
    id: edgeId(spec.source, spec.target, spec.type),
    source: spec.source,
    target: spec.target,
    type: spec.type,
    weight: spec.weight ?? 1,
    properties: {},
    sourceRef: { kind: 'manual', path: null },
  }));

  return { nodes, edges };
}

export function demoMapContents(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return buildContents(nodeSpecs, edgeSpecs);
}

export function seedDemoMap(repo: MapRepository): MapSummary {
  const summary = repo.createMap({
    id: 'orion-commerce',
    name: 'Orion Commerce Platform',
    description: 'Demo map: a commerce platform mapped functionally and technically, L0 to L3.',
  });
  repo.replaceContents(summary.id, demoMapContents());
  return repo.listMaps().find((m) => m.id === summary.id) ?? summary;
}
