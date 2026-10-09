import { createInterface } from 'node:readline';
import { validatePuzzle } from '../src/puzzle-session.js';
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  const batch = JSON.parse(line);
  const results = batch.map(([id, fen, moves, rating]) =>
    validatePuzzle({ id, fen, moves: moves.split(' '), rating }),
  );
  process.stdout.write(JSON.stringify(results) + '\n');
}
