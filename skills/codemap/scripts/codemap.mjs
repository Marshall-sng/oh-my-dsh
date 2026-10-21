#!/usr/bin/env node
// Codemap state tool for the omo-dsh `codemap` skill.
//
// Commands:
//   init    --root <dir> [--include <glob>]... [--exclude <glob>]...
//   changes --root <dir>
//   update  --root <dir>
//
// State file: <root>/.dsh/codemap.json — per-file content hashes plus the
// folder list that owns a codemap.md. No third-party dependencies: Node
// built-ins only, so it runs wherever the harness runs Node.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const STATE_DIR = '.dsh';
const STATE_FILE = 'codemap.json';
const CODEMAP_FILE = 'codemap.md';
const ALWAYS_IGNORE = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out', 'target', 'vendor'];

function parseArgs(argv) {
  const args = { root: '.', include: [], exclude: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--root') args.root = argv[++i] ?? '.';
    else if (token === '--include') args.include.push(argv[++i] ?? '');
    else if (token === '--exclude') args.exclude.push(argv[++i] ?? '');
    else if (!token.startsWith('--')) args.root = token;
  }
  return args;
}

function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') out += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) out += '\\' + c;
    else out += c;
  }
  return new RegExp('^' + out + '$');
}

function isIgnoredDir(name) {
  return ALWAYS_IGNORE.includes(name) || name.startsWith('.') && name !== '.dsh';
}

function walk(root, include, exclude) {
  const includeRes = include.map(globToRegExp);
  const excludeRes = exclude.map(globToRegExp);
  const files = [];
  const folders = new Set();

  const visit = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(root, full).split(sep).join('/');
      if (entry.isDirectory()) {
        if (isIgnoredDir(entry.name)) continue;
        folders.add(rel);
        visit(full);
      } else if (entry.isFile()) {
        if (isIgnoredDir(entry.name)) continue;
        const matched = includeRes.length === 0 || includeRes.some((r) => r.test(rel));
        const blocked = excludeRes.some((r) => r.test(rel));
        if (matched && !blocked) files.push(rel);
      }
    }
  };

  visit(root);
  return { files: files.sort(), folders: [...folders].sort() };
}

function hashFile(root, rel) {
  try {
    const buf = readFileSync(join(root, rel));
    return createHash('sha256').update(buf).digest('hex').slice(0, 16);
  } catch {
    return 'unreadable';
  }
}

function collect(root, args) {
  const { files, folders } = walk(root, args.include, args.exclude);
  const hashes = {};
  for (const rel of files) hashes[rel] = hashFile(root, rel);
  return { version: 1, files: hashes, folders };
}

function loadState(root) {
  const path = join(root, STATE_DIR, STATE_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(root, state) {
  const dir = join(root, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, STATE_FILE), JSON.stringify(state, null, 2) + '\n');
}

function diff(oldState, newState) {
  const oldFiles = oldState?.files ?? {};
  const newFiles = newState.files;
  const added = [];
  const removed = [];
  const modified = [];
  for (const rel of Object.keys(newFiles)) {
    if (!(rel in oldFiles)) added.push(rel);
    else if (oldFiles[rel] !== newFiles[rel]) modified.push(rel);
  }
  for (const rel of Object.keys(oldFiles)) {
    if (!(rel in newFiles)) removed.push(rel);
  }
  const affected = new Set();
  for (const rel of [...added, ...removed, ...modified]) {
    const parts = rel.split('/');
    parts.pop();
    for (let i = 1; i <= parts.length; i++) affected.add(parts.slice(0, i).join('/'));
  }
  return { added, removed, modified, affectedFolders: [...affected].sort() };
}

function ensureEmptyCodemaps(root, folders) {
  const created = [];
  for (const folder of folders) {
    const dir = join(root, folder);
    if (!existsSync(dir)) continue;
    const target = join(dir, CODEMAP_FILE);
    if (!existsSync(target)) {
      writeFileSync(target, '');
      created.push(`${folder}/${CODEMAP_FILE}`);
    }
  }
  return created;
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const root = args.root;

  if (command === 'init') {
    const state = collect(root, args);
    saveState(root, state);
    const created = ensureEmptyCodemaps(root, state.folders);
    console.log(`Initialized codemap state at ${join(root, STATE_DIR, STATE_FILE)}`);
    console.log(`Tracked files: ${Object.keys(state.files).length}`);
    console.log(`Tracked folders: ${state.folders.length}`);
    console.log(`Empty codemap files created: ${created.length}`);
    for (const c of created.slice(0, 20)) console.log(`  ${c}`);
    if (created.length > 20) console.log(`  ... and ${created.length - 20} more`);
    return;
  }

  if (command === 'changes') {
    const oldState = loadState(root);
    if (!oldState) {
      console.error('No codemap state found. Run `init` first.');
      process.exitCode = 1;
      return;
    }
    const newState = collect(root, args);
    const { added, removed, modified, affectedFolders } = diff(oldState, newState);
    console.log(`Added: ${added.length}`);
    for (const f of added) console.log(`  + ${f}`);
    console.log(`Removed: ${removed.length}`);
    for (const f of removed) console.log(`  - ${f}`);
    console.log(`Modified: ${modified.length}`);
    for (const f of modified) console.log(`  ~ ${f}`);
    console.log(`Affected folders: ${affectedFolders.length}`);
    for (const f of affectedFolders) console.log(`  > ${f}`);
    return;
  }

  if (command === 'update') {
    const oldState = loadState(root);
    if (!oldState) {
      console.error('No codemap state found. Run `init` first.');
      process.exitCode = 1;
      return;
    }
    const newState = collect(root, args);
    const { added, removed, modified } = diff(oldState, newState);
    saveState(root, newState);
    console.log(`Codemap state updated. added=${added.length} removed=${removed.length} modified=${modified.length}`);
    return;
  }

  console.error('Usage: codemap.mjs <init|changes|update> --root <dir> [--include <glob>]... [--exclude <glob>]...');
  process.exitCode = 2;
}

main();
