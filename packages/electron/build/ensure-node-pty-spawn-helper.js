#!/usr/bin/env node

/**
 * node-pty@1.1.0's npm tarball ships macOS spawn-helper files without the
 * executable bit. node-pty loads pty.node successfully, then fails every PTY
 * spawn with "posix_spawnp failed" when the helper cannot execute.
 *
 * Keep this idempotent so it can run from postinstall, build, and packaging
 * validation without touching anything when node-pty is absent or Windows is
 * the target.
 */

const fs = require('fs');
const path = require('path');

const packageDir = path.join(__dirname, '..');
const repoRoot = path.resolve(packageDir, '..', '..');

const targetPlatform = process.env.BUILD_PLATFORM || process.platform;

if (targetPlatform === 'win32') {
  console.log('[ensure-node-pty-spawn-helper] Windows target, skipping.');
  process.exit(0);
}

const candidateRoots = [
  path.join(repoRoot, 'node_modules', 'node-pty'),
  path.join(packageDir, 'node_modules', 'node-pty'),
];

function helperPaths(root) {
  const out = [
    path.join(root, 'build', 'Release', 'spawn-helper'),
    path.join(root, 'build', 'Debug', 'spawn-helper'),
  ];
  const prebuilds = path.join(root, 'prebuilds');
  if (fs.existsSync(prebuilds)) {
    for (const entry of fs.readdirSync(prebuilds, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        out.push(path.join(prebuilds, entry.name, 'spawn-helper'));
      }
    }
  }
  return out;
}

let changed = 0;
let checked = 0;

for (const root of candidateRoots) {
  if (!fs.existsSync(root)) continue;
  for (const helperPath of helperPaths(root)) {
    if (!fs.existsSync(helperPath)) continue;
    checked++;
    const stat = fs.statSync(helperPath);
    if ((stat.mode & 0o111) !== 0) continue;
    fs.chmodSync(helperPath, stat.mode | 0o755);
    changed++;
    console.log(`[ensure-node-pty-spawn-helper] Marked executable: ${helperPath}`);
  }
}

if (checked === 0) {
  console.log('[ensure-node-pty-spawn-helper] No node-pty spawn-helper files found.');
} else if (changed === 0) {
  console.log(`[ensure-node-pty-spawn-helper] ${checked} spawn-helper file(s) already executable.`);
} else {
  console.log(`[ensure-node-pty-spawn-helper] Updated ${changed}/${checked} spawn-helper file(s).`);
}
