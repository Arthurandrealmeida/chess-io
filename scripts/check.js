import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const paths = ['src', 'data', 'tests', 'scripts'];
let count = 0;
for (const directory of paths) for (const filename of await readdir(directory)) {
  if (!filename.endsWith('.js')) continue;
  const check = spawnSync(process.execPath, ['--check', `${directory}/${filename}`], { stdio: 'inherit' });
  if (check.status) process.exit(check.status);
  count++;
}
const check = spawnSync(process.execPath, ['--check', 'server.js'], { stdio: 'inherit' });
if (check.status) process.exit(check.status);
console.log(`${count + 1} arquivos JavaScript validados.`);
