/**
 * The filesystem half of markdown import (OQ-5): find the documents and hand their text to the
 * parser in `@map/shared`. All the reasoning about what the documents *mean* lives there; this
 * file only knows how to walk a directory.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import {
  parseDocument,
  planImport,
  type DocumentFailure,
  type ImportOptions,
  type ImportPlan,
  type ParsedDocument,
} from '@map/shared';

import type { MapRepository } from './repository.js';

/** Directories never worth walking into. */
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next', '.cache']);

const MAX_FILES = 5000;

export class ImportPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportPathError';
  }
}

/**
 * Confines imports to `MAP_IMPORT_ROOT` when it is set. The app is single-user and local (see the
 * spec's platform section), so this is off by default — but it exists because "the server reads
 * any absolute path you send it" deserves a switch for anyone who exposes this beyond localhost.
 */
export function resolveImportRoot(requested: string): string {
  if (requested.trim() === '') throw new ImportPathError('No folder given.');

  const confineTo = process.env.MAP_IMPORT_ROOT;
  const resolved = isAbsolute(requested)
    ? resolve(requested)
    : resolve(confineTo ?? process.cwd(), requested);

  if (confineTo) {
    const root = resolve(confineTo);
    const rel = relative(root, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new ImportPathError(`Imports are confined to ${root} by MAP_IMPORT_ROOT.`);
    }
  }

  return resolved;
}

export interface FoundDocument {
  /** Path relative to the import root, with POSIX separators — this is the node's identity. */
  path: string;
  text: string;
}

/** Walks `root` for markdown files, deepest paths and all, in a stable order. */
export async function readMarkdownTree(root: string): Promise<FoundDocument[]> {
  let rootStat;
  try {
    rootStat = await stat(root);
  } catch {
    throw new ImportPathError(`"${root}" does not exist or cannot be read.`);
  }
  if (!rootStat.isDirectory()) throw new ImportPathError(`"${root}" is not a folder.`);

  const found: FoundDocument[] = [];

  const walk = async (dir: string): Promise<void> => {
    if (found.length >= MAX_FILES) return;
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (found.length >= MAX_FILES) return;
      if (entry.name.startsWith('.')) continue;

      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;

      found.push({
        path: relative(root, full).split(sep).join('/'),
        text: await readFile(full, 'utf8'),
      });
    }
  };

  await walk(root);
  return found;
}

export interface MarkdownImportRequest extends ImportOptions {
  /** Folder to read, absolute or relative to MAP_IMPORT_ROOT / the server's working directory. */
  path: string;
  /** FR-53: produce the report without writing anything. */
  dryRun?: boolean;
}

export interface MarkdownImportResult {
  root: string;
  documentsFound: number;
  dryRun: boolean;
  report: ImportPlan['report'];
}

/**
 * Reads a folder, plans the merge, and — unless this is a dry run — commits it through the
 * repository, which validates the whole resulting map before it is written (FR-38).
 */
export async function importMarkdownFolder(
  repo: MapRepository,
  mapId: string,
  request: MarkdownImportRequest,
): Promise<MarkdownImportResult> {
  const root = resolveImportRoot(request.path);
  const files = await readMarkdownTree(root);

  const parsed: Array<ParsedDocument | DocumentFailure> = files.map((file) =>
    parseDocument(file.text, file.path),
  );

  const existing = repo.getMap(mapId);
  const plan = planImport(parsed, existing, { prune: request.prune ?? false });

  if (!request.dryRun) {
    repo.replaceContents(mapId, { nodes: plan.nodes, edges: plan.edges });
  }

  return {
    root,
    documentsFound: files.length,
    dryRun: request.dryRun ?? false,
    report: plan.report,
  };
}
