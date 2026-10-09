# chess.io

### Chess puzzles, Stockfish practice, opening study, and LAN multiplayer — in your browser.

**[Play chess.io](https://arthurandrealmeida.github.io/chess-io/)**

## Product tour

Watch a 25-second silent tour of the main features.

<video src="https://github.com/user-attachments/assets/acd8ab44-381e-438f-8529-0e108e18069c" controls width="100%"></video>

**chess.io** is a free, open-source chess training web app built with JavaScript. Play chess against Stockfish, solve **1,000,000 chess puzzles**, learn aggressive chess openings, explore annotated historical games, and challenge a friend on the same local network.

The app runs as a static website, including on GitHub Pages. Visitors need a compatible browser, with no account, subscription, or desktop installation. Chess rules, engine analysis, and puzzle training run locally in the browser; the project serves its own engine, data, and assets without a runtime CDN.

> The current app interface is in Brazilian Portuguese. This README is written in English.

**[Features](#features)** · **[Run locally](#run-locally)** · **[Chess puzzles](#chess-puzzles)** · **[LAN multiplayer](#lan-multiplayer)** · **[GitHub Pages](#github-pages)** · **[Development](#development)**

## Features

| Area | What you can do |
| --- | --- |
| **Chess with Stockfish** | Play against Stockfish 19 Lite with 20 difficulty levels, choose your side, and use timed or untimed games. |
| **Chess puzzles and tactics** | Train with 1 million Lichess puzzles across 73 themes, filter by difficulty, get hints, and review solutions. |
| **Opening study** | Learn plans and main reference lines in five aggressive opening repertoires, with three variations each. |
| **Historical games** | Replay nine classic chess games with move-by-move navigation, key-moment commentary, and PGN downloads. |
| **Post-game analysis** | Review your moves with local Stockfish evaluations, move classifications, and suggested alternatives. |
| **LAN chess** | Play browser-to-browser on the same network using WebRTC and a manual invitation/response exchange. |
| **Personalization** | Switch between light and dark themes, choose green, wood, or blue boards, and control animations. |
| **Accessible interaction** | Click or drag pieces, choose promotions, use keyboard navigation, and respect reduced-motion preferences. |

## Run locally

### Requirements

- **Node.js 20 or later** and npm for development and the local server.
- A modern browser with JavaScript, WebAssembly, Web Workers, and WebRTC for LAN play.

```sh
git clone https://github.com/Arthurandrealmeida/chess-io.git
cd chess-io
npm ci --ignore-scripts
npm run build
npm start
```

Open **http://localhost:3000**.

The build prepares local copies of the chess rules library and Stockfish engine, then writes the static website to `dist/`. Once dependencies and vendor files are ready, use `npm start` to run the project again.

Serve the app over HTTP locally or HTTPS when deployed. Opening `index.html` directly with `file://` does not provide a reliable environment for modules, puzzle loading, workers, and WebRTC.

## Play chess against Stockfish

Choose a difficulty, your color, and a time control: **1, 3, 5, or 10 minutes without increment**, **3 + 2**, or **untimed**. Starting a game replaces the setup panel with a larger, centered board.

- Move pieces by clicking or dragging. Highlighted destinations are legal moves.
- Choose a queen, rook, bishop, or knight when promoting a pawn.
- Review earlier moves without changing the live game. The clock keeps running during review.
- Undo your last move and the engine reply, when applicable, restoring the earlier clock state.
- Export the game as PGN and revisit the win, loss, or draw screen.

Difficulty adjusts Stockfish's UCI skill setting and thinking time. It is not a guaranteed Elo rating.

### Post-game move analysis

After a game ends, start analysis from the result screen. A separate Stockfish worker evaluates positions and labels moves as best, excellent, good, inaccuracy, mistake, or blunder. Select a move to inspect its position and a legal suggested alternative.

Evaluations are shown from White's perspective: positive values favor White and negative values favor Black. This is a quick local analysis, currently using 250 ms per position; deeper analysis can produce different evaluations. It is not an official accuracy score from another chess platform.

## Chess puzzles

The bundled collection contains **1,000,000 validated Lichess chess puzzles** and **73 tactical themes**, including forks, pins, sacrifices, endgames, and checkmates. The opponent's setup move is applied automatically, so you start directly from the position to solve.

- Filter by difficulty and theme, or use mixed training.
- Find the complete sequence while the opponent replies automatically.
- Get a hint, reveal the solution, or retry the position.
- See a green check mark when you complete a puzzle.
- Use the sticky **Skip / Next puzzle** controls without scrolling to the bottom.
- Enable **automatic next puzzle** to advance after a short success animation. The choice is saved in your browser; reviewing a solution or switching it off cancels the pending advance.
- Review the solution with the buttons or keyboard arrows and open the original Lichess puzzle when desired.

Progress is stored in your browser. Hints, revealed solutions, and retries count as assisted attempts; solving a position after an error does not retroactively become an unassisted success. If persistent storage is unavailable, training and session counters still work.

### Efficient puzzle delivery

The collection occupies approximately **44.9 MB**, divided into **509 compressed data packages** plus an index. The app loads a small package on demand and reuses it for multiple exercises. Opening the play screen does not download the entire puzzle collection.

Each exercise stores only the position, solution moves, rating, and themes. The full preceding game, unused source columns, raw CSV, and intermediate databases are excluded from the deployed website. The static build is approximately **47.3 MB** with this collection.

The puzzle data is available under **CC0** from the [Lichess open database](https://database.lichess.org/#puzzles). See the [import report](data/puzzles/import-report.json) for the bundled dataset.

## Learn chess openings

Study five attacking repertoires through reference lines, explanations, and key-move comments:

| Side | Opening |
| --- | --- |
| White | King's Gambit |
| White | Evans Gambit |
| White | Scotch Gambit |
| Black | Sicilian Defense — Najdorf Variation |
| Black | King's Indian Defense |

Each repertoire includes three variations. Choose a line, step through its moves, read the accompanying plans, and download its PGN. Black repertoires are shown from Black's side. These are educational reference continuations, not guarantees of an advantage against every response.

## Explore historical chess games

Replay nine annotated classics:

1. The Opera Game — Morphy vs. the Duke of Brunswick and Count Isouard.
2. The Immortal Game — Anderssen vs. Kieseritzky.
3. The Evergreen Game — Anderssen vs. Dufresne.
4. The Game of the Century — Donald Byrne vs. Fischer.
5. Kasparov's Immortal — Kasparov vs. Topalov.
6. The King Walk — Short vs. Timman.
7. Rubinstein's Immortal — Rotlewi vs. Rubinstein.
8. The Double Bishop Sacrifice — Lasker vs. Bauer.
9. The Gold Coins Game — Levitsky vs. Marshall.

Search by title, player, opening, or year. Use autoplay, move selection, or **Left / Right arrow keys** to navigate. Key moments include explanatory comments, and each game provides sources and a complete PGN. Player portraits are stored locally as small thumbnails, with attributions in [CREDITS.md](CREDITS.md).

## LAN multiplayer

LAN chess connects two browsers directly over **WebRTC**, without an external signaling service, STUN server, or TURN relay. GitHub Pages can serve the website; players manually exchange the connection information needed to establish the local peer connection.

### Connect two players

1. Both players open the same deployed website while connected to the same Wi-Fi or wired network.
2. The host creates a game and sends the generated invitation, including the site link and connection code, to the other player.
3. The guest opens the site, pastes the invitation, generates a response, and sends it back to the host.
4. The host pastes the response and connects. The game starts when the peer connection opens.

The site link alone cannot establish a connection: the invitation and response exchange is required. Codes belong to the current attempt; reloading or closing a tab ends the session. Share connection codes only with your opponent, since they may include local network addresses.

**Connection depends on the network.** Router client isolation, firewalls, VPNs, browser restrictions, or denied local-network permissions can prevent play. There is no relay fallback. Internet matchmaking and reliable play between different networks are outside this mode's scope. Real connections between two physical devices must be checked on the players' network.

## Controls and preferences

On a live board, arrow keys move square focus and **Enter / Space** selects a square. In historical games, opening study, completed puzzles, and post-game review, **Left / Right** steps backward and forward through moves. Shortcuts do not interfere with text fields or selectors.

Theme, board colors, animation settings, game preferences, and automatic puzzle advancement are stored locally. The responsive interface adapts to mobile screens, and motion can be disabled both in the app and through the operating system's reduced-motion preference.

## GitHub Pages

The app can be hosted as static files. It does not require a Node.js server for the deployed play, puzzles, opening study, historical games, analysis, or manual WebRTC LAN modes.

1. Run `npm ci --ignore-scripts` and `npm run build`.
2. Publish the **contents of `dist/`** to the root of a publishing branch, a configured `docs/` directory, or a GitHub Pages artifact through your own workflow.
3. Keep `.nojekyll` and all generated assets, including the puzzle packages and vendor files.
4. Serve over HTTPS and check the site under its actual repository subdirectory.

`dist/` and `node_modules/` are intentionally ignored by Git. Running the local build does not deploy automatically. Alternatively, a branch-root deployment can serve the already bundled `index.html`, stylesheet, `src/`, `data/`, `assets/`, and `vendor/` files committed to this repository.

Relative asset paths and LAN invitations preserve a repository subdirectory. The [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) lists hosting limits and [HTTPS requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Development

```sh
npm run check  # Validate JavaScript syntax
npm test       # Run the Node.js test suite
npm run build  # Generate the static website
```

Tests cover chess rules and special moves, clocks, undo and review, engine cancellation, puzzle loading and progress, automatic advancement, historical PGNs, opening lines, and LAN signaling/game protocol behavior. Server integration tests open local loopback ports. Automated engine and WebRTC tests use controlled workers and connections; they do not replace cross-browser or physical-device testing.

### Project structure

```text
index.html             Application shell and screens
estiloXadrez.css        Themes, board layout, and responsive styles
src/                   Game state, Stockfish integration, puzzles, and WebRTC
  app.js               Navigation and application controls
  game.js              Rules, clocks, and game history
  board.js             Accessible board rendering and interaction
  engine.js            UCI protocol through a Web Worker
  puzzles.js           Puzzle training interface and automatic advancement
  peer-lan.js          Manual WebRTC signaling and LAN game protocol
data/                  Opening lines, historical games, and puzzle packages
assets/                Chess piece SVGs and small historical portraits
vendor/                Bundled dependencies and their licenses
scripts/               Static build, validation, and puzzle import tools
tests/                 Automated regression tests
legacy/                Original project preserved for reference
dist/                  Generated static deployment output (ignored by Git)
```

The interface uses **HTML, CSS, and vanilla JavaScript**, with no frontend framework. [chess.js](https://github.com/jhlywa/chess.js) supplies legal move validation; [Stockfish.js](https://github.com/nmrugg/stockfish.js) supplies the local WebAssembly engine.

### Refresh the puzzle collection

Puzzle conversion is an offline developer task requiring Python 3, zstd, and Node.js. Players do not install these tools. Download the Lichess CC0 archive outside the repository and generate a separate output directory:

```sh
python3 scripts/import-puzzles.py \
  --source /path/to/lichess_db_puzzle.csv.zst \
  --output /tmp/chess-puzzles-next \
  --limit 1000000 \
  --workers 4 \
  --last-modified 'SOURCE_HTTP_LAST_MODIFIED'
node scripts/check-puzzle-data.js /tmp/chess-puzzles-next
```

Omit `--limit` to process the complete source collection. Limited selection is deterministic by puzzle ID hash and scans the full source rather than taking only its first rows. The importer validates every selected position and solution with chess.js and reports invalid records or duplicate IDs.

Replace `data/puzzles/` with the verified output, run the checks and build, then validate the published copy:

```sh
npm run check
npm test
npm run build
node scripts/check-puzzle-data.js data/puzzles dist
```

Do not commit the source CSV, temporary SQLite database, or obsolete collections. The data checker verifies hashes, indexes, counts, and the project's 750 MB safety budget. The normal build copies the prepared collection without downloading or importing puzzles.

## Contributing

Bug reports and focused improvements are welcome. Include the browser, steps to reproduce, and expected behavior when reporting a problem. Run the relevant tests and build before submitting a change. Keep assets local, document data sources, and preserve dependency licenses and attributions.

## License and credits

Original application code is licensed under the [MIT License](LICENSE), with the original copyright retained. Dependencies and datasets have their own licenses: Stockfish is GPL-3.0-or-later, chess.js is BSD-2-Clause, and Lichess puzzle data is CC0. Chess piece artwork and historical portraits retain their respective licenses.

See [CREDITS.md](CREDITS.md) and the bundled license files for complete attribution and corresponding Stockfish source links.

Created by **Arthur Andre Almeida Santos** · [Arthurandrealmeida](https://github.com/Arthurandrealmeida).
