/**
 * Id generation. Ids must be stable across save/load and re-import (§5), so imported nodes get
 * a deterministic id derived from their source path, not a random one — that is what makes
 * FR-51 (idempotent re-import) work without a separate mapping table.
 */

const SLUG_MAX = 60;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-|-$/g, '');
}

/** A readable, deterministic id: `service:payments-api`. Falls back to the type when empty. */
export function deterministicId(kind: string, name: string, taken?: ReadonlySet<string>): string {
  const base = `${kind}:${slugify(name) || 'unnamed'}`;
  if (!taken || !taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function edgeId(source: string, target: string, type: string): string {
  return `${source}|${type}|${target}`;
}
