import { Chess } from '../vendor/chess.js';

const FILES = 'abcdefgh';
export const PIECE_NAMES = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
const GLYPHS = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
export const pieceAsset = (color, type) => new URL(`../assets/pieces/${color}${type}.svg`, import.meta.url).href;
const coordinate = (x, y, orientation) => orientation === 'b' ? `${FILES[7 - x]}${y + 1}` : `${FILES[x]}${8 - y}`;
const point = (square, orientation) => orientation === 'b' ? { x: 7 - FILES.indexOf(square[0]), y: +square[1] - 1 } : { x: FILES.indexOf(square[0]), y: 8 - +square[1] };

function paintPiece(node, piece, style) {
  const key = `${style}:${piece.color}${piece.type}`;
  if (node.dataset.visual === key) return;
  node.dataset.visual = key;
  node.dataset.code = piece.color + piece.type;
  node.className = `piece ${piece.color === 'w' ? 'white' : 'black'}${style === 'type' ? ' type-piece' : ''}`;
  node.replaceChildren();
  if (style === 'type') node.textContent = GLYPHS[piece.color][piece.type];
  else {
    const img = document.createElement('img');
    img.src = pieceAsset(piece.color, piece.type); img.alt = ''; img.draggable = false;
    node.append(img);
  }
}

export class BoardView {
  constructor(root, { onSquare = () => {}, onMove = () => {}, canDrag = () => false } = {}) {
    this.root = root;
    this.onSquare = onSquare; this.onMove = onMove; this.canDrag = canDrag;
    this.nodes = new Map(); this.squares = []; this.orientation = 'w'; this.drag = null; this.suppressClick = false;
    for (let i = 0; i < 64; i++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `square${(Math.floor(i / 8) + i % 8) % 2 ? ' dark' : ''}`;
      button.tabIndex = i === 56 ? 0 : -1;
      const rank = document.createElement('span'); rank.className = 'coordinate rank-coordinate'; rank.setAttribute('aria-hidden', 'true');
      const file = document.createElement('span'); file.className = 'coordinate file-coordinate'; file.setAttribute('aria-hidden', 'true');
      button.append(rank, file); this.squares.push(button); root.append(button);
    }
    this.layer = document.createElement('div'); this.layer.className = 'pieces-layer'; this.layer.setAttribute('aria-hidden', 'true'); root.append(this.layer);
    root.addEventListener('click', event => {
      if (this.suppressClick) { this.suppressClick = false; return; }
      const button = event.target.closest('.square');
      if (button) this.onSquare(button.dataset.square);
    });
    root.addEventListener('keydown', event => {
      const button = event.target.closest('.square'); if (!button) return;
      const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
      if (event.key in steps) {
        event.preventDefault(); const index = this.squares.indexOf(button), next = index + steps[event.key];
        if (next >= 0 && next < 64 && (Math.abs(steps[event.key]) !== 1 || Math.floor(index / 8) === Math.floor(next / 8))) {
          this.squares.forEach(b => b.tabIndex = -1); this.squares[next].tabIndex = 0; this.squares[next].focus();
        }
      }
    });
    root.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const square = this.squareAt(event.clientX, event.clientY);
      if (!square || !this.canDrag(square) || !this.nodes.has(square)) return;
      this.drag = { from: square, x: event.clientX, y: event.clientY, pointer: event.pointerId, started: false, node: this.nodes.get(square) };
    });
    root.addEventListener('pointermove', event => {
      const drag = this.drag; if (!drag || event.pointerId !== drag.pointer) return;
      if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      if (!drag.started) {
        drag.started = true; root.setPointerCapture(event.pointerId); this.onSquare(drag.from); drag.node.classList.add('dragging');
      }
      const bounds = root.getBoundingClientRect(), size = bounds.width / 8;
      drag.node.style.transform = `translate(${event.clientX - bounds.left - size / 2}px, ${event.clientY - bounds.top - size / 2}px)`;
    });
    const release = event => {
      const drag = this.drag; if (!drag || event.pointerId !== drag.pointer) return;
      this.drag = null;
      if (!drag.started) return;
      drag.node.classList.remove('dragging'); this.place(drag.node, drag.from);
      this.suppressClick = true;
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      const destination = this.squareAt(event.clientX, event.clientY);
      if (event.type !== 'pointercancel' && destination && destination !== drag.from) this.onMove(drag.from, destination);
      // A drag may end outside the board and produce no click.
      setTimeout(() => { this.suppressClick = false; }, 0);
    };
    root.addEventListener('pointerup', release); root.addEventListener('pointercancel', release);
  }
  squareAt(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / (rect.width / 8)), y = Math.floor((clientY - rect.top) / (rect.height / 8));
    return x >= 0 && x < 8 && y >= 0 && y < 8 ? coordinate(x, y, this.orientation) : null;
  }
  place(node, square) {
    const p = point(square, this.orientation); node.style.transform = `translate(${p.x * 100}%, ${p.y * 100}%)`;
  }
  render(fen, { orientation = 'w', style = 'classic', selected = null, legal = [], lastMove = null, move = null } = {}) {
    const chess = new Chess(fen), pieces = new Map();
    chess.board().flat().filter(Boolean).forEach(piece => pieces.set(piece.square, piece));
    this.orientation = orientation;
    const old = new Map(this.nodes), next = new Map(), used = new Set();
    const mover = move && old.get(move.from);
    if (mover && pieces.get(move.to)?.color === move.color) { next.set(move.to, mover); used.add(mover); }
    for (const [square, piece] of pieces) {
      if (next.has(square)) continue;
      const same = old.get(square);
      if (same && !used.has(same) && same.dataset.code === piece.color + piece.type) { next.set(square, same); used.add(same); }
    }
    for (const [square, piece] of pieces) {
      if (next.has(square)) continue;
      // Nearest matching piece keeps transitions coherent when reviewing several plies.
      const candidates = [...old].filter(([, node]) => !used.has(node) && node.dataset.code === piece.color + piece.type);
      const target = point(square, 'w');
      candidates.sort(([a], [b]) => { const pa = point(a, 'w'), pb = point(b, 'w'); return Math.hypot(pa.x-target.x,pa.y-target.y)-Math.hypot(pb.x-target.x,pb.y-target.y); });
      let node = candidates[0]?.[1];
      if (!node) {
        node = document.createElement('div'); node.style.transition = 'none'; this.layer.append(node);
        requestAnimationFrame(() => { if (node.isConnected) node.style.removeProperty('transition'); });
      }
      next.set(square, node); used.add(node);
    }
    for (const node of this.nodes.values()) if (!used.has(node)) {
      node.classList.add('captured'); setTimeout(() => node.remove(), 190);
    }
    for (const [square, node] of next) { paintPiece(node, pieces.get(square), style); this.place(node, square); }
    this.nodes = next;
    const destinations = new Set(legal.map(m => typeof m === 'string' ? m : m.to));
    for (let i = 0; i < 64; i++) {
      const square = coordinate(i % 8, Math.floor(i / 8), orientation), button = this.squares[i], piece = pieces.get(square);
      button.dataset.square = square;
      button.setAttribute('aria-label', `${square}${piece ? `, ${PIECE_NAMES[piece.type]} ${piece.color === 'w' ? 'branco' : 'preto'}` : ', vazia'}`);
      button.setAttribute('aria-pressed', String(square === selected));
      button.classList.toggle('selected', square === selected);
      button.classList.toggle('last-move', square === lastMove?.from || square === lastMove?.to);
      button.classList.toggle('legal', destinations.has(square));
      button.classList.toggle('capture', destinations.has(square) && !!piece);
      button.classList.toggle('check', !!piece && piece.type === 'k' && piece.color === chess.turn() && chess.isCheck());
      const [rank, file] = button.children;
      rank.textContent = i % 8 === 0 ? square[1] : '';
      file.textContent = i >= 56 ? square[0] : '';
    }
  }
}

export function renderMiniBoard(root, fen, style = 'classic') {
  const fullFen = fen.includes(' ') ? fen : `${fen} w - - 0 1`;
  const chess = new Chess(fullFen), board = document.createElement('div'); board.className = 'mini-board';
  chess.board().forEach((row, y) => row.forEach((piece, x) => {
    const cell = document.createElement('span'); cell.className = `mini-square${(x + y) % 2 ? ' dark' : ''}`;
    if (piece) {
      if (style === 'type') { const glyph = document.createElement('span'); glyph.className = 'mini-type-piece'; glyph.textContent = GLYPHS[piece.color][piece.type]; cell.append(glyph); }
      else { const img = document.createElement('img'); img.src = pieceAsset(piece.color, piece.type); img.alt = ''; img.draggable = false; cell.append(img); }
    }
    board.append(cell);
  }));
  root.replaceChildren(board);
}
