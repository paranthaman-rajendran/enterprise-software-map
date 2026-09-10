import assert from 'node:assert/strict';
import { test } from 'node:test';

import { specFromSearchParams, specToSearchParams } from './store.ts';
import { defaultViewSpec, emptyFilters, type ViewSpec } from './graph/viewModel.ts';

/** FR-57: a link has to reopen the exact view, so this round trip is the whole feature. */
test('a view round-trips through the URL without loss', () => {
  const spec: ViewSpec = {
    ...defaultViewSpec,
    contextId: 'system:payments-platform',
    viewMode: 'technical',
    focusId: 'service:payment-service',
    focusDepth: 2,
    expandedIds: ['service:refund-service'],
    impactId: 'service:payment-service',
    filters: {
      ...emptyFilters,
      nodeTypes: ['service', 'datastore'],
      edgeTypes: ['calls'],
      maxLevel: 3,
      properties: [
        { key: 'owner', value: 'Payments' },
        { key: 'technology', value: 'Go' },
      ],
      weightMin: 2,
      weightMax: 5.5,
    },
  };
  const selection = { kind: 'node', id: 'datastore:payments-db' } as const;

  const restored = specFromSearchParams(new URLSearchParams(specToSearchParams(spec, selection)));

  assert.equal(restored.spec.contextId, spec.contextId);
  assert.equal(restored.spec.viewMode, spec.viewMode);
  assert.equal(restored.spec.focusId, spec.focusId);
  assert.equal(restored.spec.focusDepth, spec.focusDepth);
  assert.deepEqual(restored.spec.expandedIds, spec.expandedIds);
  assert.equal(restored.spec.impactId, spec.impactId);
  assert.deepEqual(restored.spec.filters.nodeTypes, spec.filters.nodeTypes);
  assert.deepEqual(restored.spec.filters.edgeTypes, spec.filters.edgeTypes);
  assert.equal(restored.spec.filters.maxLevel, 3);
  assert.deepEqual(restored.spec.filters.properties, spec.filters.properties);
  assert.equal(restored.spec.filters.weightMin, 2);
  assert.equal(restored.spec.filters.weightMax, 5.5);
  assert.deepEqual(restored.selection, selection);
});

test('a property value containing punctuation survives the round trip', () => {
  const spec: ViewSpec = {
    ...defaultViewSpec,
    filters: { ...emptyFilters, properties: [{ key: 'owner', value: 'Payments & Risk = core, EU' }] },
  };
  const restored = specFromSearchParams(new URLSearchParams(specToSearchParams(spec, null)));
  assert.deepEqual(restored.spec.filters.properties, spec.filters.properties);
});

test('the default view produces an empty query, so a plain link opens at L0', () => {
  assert.equal(specToSearchParams(defaultViewSpec, null), '');
});

test('an empty query restores the default view', () => {
  const restored = specFromSearchParams(new URLSearchParams(''));
  assert.equal(restored.spec.contextId, null);
  assert.equal(restored.spec.viewMode, 'combined');
  assert.equal(restored.spec.focusId, null);
  assert.deepEqual(restored.spec.expandedIds, []);
  assert.equal(restored.selection, null);
});

test('maxLevel 0 survives the round trip and is not confused with "no filter"', () => {
  const spec: ViewSpec = { ...defaultViewSpec, filters: { ...emptyFilters, maxLevel: 0 } };
  const restored = specFromSearchParams(new URLSearchParams(specToSearchParams(spec, null)));
  assert.equal(restored.spec.filters.maxLevel, 0);
});
