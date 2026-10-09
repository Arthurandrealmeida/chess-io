import { cp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const resolve = name => new URL(name, new URL('../', import.meta.url));
await mkdir(resolve('vendor/stockfish'), { recursive: true });
await cp(resolve('node_modules/chess.js/dist/esm/chess.js'), resolve('vendor/chess.js'));
await cp(resolve('node_modules/chess.js/LICENSE'), resolve('vendor/CHESS-JS-LICENSE.txt'));
for (const extension of ['js', 'wasm']) {
  const name = `stockfish-19-lite-single.${extension}`;
  await cp(resolve(`node_modules/stockfish/bin/${name}`), resolve(`vendor/stockfish/${name}`));
}
// Vendor files also serve npm start directly. dist is a static deployment artifact.
await mkdir(resolve('dist'), { recursive: true });
for (const path of ['index.html', 'estiloXadrez.css', 'src', 'data', 'assets', 'vendor', 'LICENSE', 'CREDITS.md']) {
  await cp(resolve(path), resolve(`dist/${path}`), { recursive: true });
}
await writeFile(resolve('dist/.nojekyll'), '');
console.log(`Build concluído: ${root}dist (Stockfish local, sem CDN).`);
