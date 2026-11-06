'use strict';
// Retain all Node/TLS code and licenses; move known non-runtime files to backup.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..', 'node_modules');
let backup;
let bytes = 0;
function size(file) {
  const stat = fs.lstatSync(file);
  return stat.isDirectory() ? fs.readdirSync(file).reduce((n, p) => n + size(path.join(file, p)), 0) : stat.size;
}
function move(relative) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  backup ||= fs.mkdtempSync(path.join(os.tmpdir(), 'daly-dependency-backup-'));
  const target = path.join(backup, relative);
  bytes += size(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
}
function maps(relative) {
  const dir = path.join(root, relative);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const child = path.join(relative, name);
    const stat = fs.lstatSync(path.join(root, child));
    if (stat.isDirectory()) maps(child);
    else if (name.endsWith('.map') || name.endsWith('.d.ts')) move(child);
  }
}
function version(name) {
  try { return JSON.parse(fs.readFileSync(path.join(root, name, 'package.json'))).version; }
  catch { return null; }
}
if (version('mqtt') === '4.3.7') {
  for (const item of ['dist', 'doc', 'types', 'README.md', 'CONTRIBUTING.md']) move('mqtt/' + item);
}
if (version('js-sdsl') === '4.3.0') {
  for (const item of ['dist/esm', 'dist/umd']) move('js-sdsl/' + item);
  maps('js-sdsl/dist/cjs');
}
console.log(backup ? `Daly cleanup: ${bytes} bytes moved to ${backup}` : 'Daly cleanup: nothing to trim');
