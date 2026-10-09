const moveLists = new WeakMap();
export const escapeHTML = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

export function downloadPGN(pgn, filename) {
  const blob = new Blob([pgn + '\n'], { type: 'application/x-chess-pgn;charset=utf-8' }),
    url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function renderMoves(root, moves, cursor, onSelect) {
  const signature = moves.map((move) => move.san).join(' ');
  let entry = moveLists.get(root);
  if (!entry || entry.signature !== signature || entry.moves !== moves) {
    root.replaceChildren();
    entry = { signature, moves, onSelect, buttons: [] };
    moveLists.set(root, entry);
    if (!moves.length) {
      const paragraph = document.createElement('p');
      paragraph.className = 'empty-state';
      paragraph.textContent = 'Os lances aparecerão aqui.';
      root.append(paragraph);
    }
    for (let index = 0; index < moves.length; index += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';
      const number = document.createElement('span');
      number.className = 'move-number';
      number.textContent = `${index / 2 + 1}.`;
      row.append(number);
      for (let offset = 0; offset < 2; offset++)
        if (moves[index + offset]) {
          const ply = index + offset + 1,
            button = document.createElement('button');
          button.type = 'button';
          button.textContent = moves[index + offset].san;
          button.setAttribute(
            'aria-label',
            `Revisar lance ${index / 2 + 1}, ${offset ? 'pretas' : 'brancas'}: ${button.textContent}`,
          );
          button.addEventListener('click', () => entry.onSelect(ply));
          row.append(button);
          entry.buttons.push(button);
        }
      root.append(row);
    }
  }
  entry.onSelect = onSelect;
  for (const [index, button] of entry.buttons.entries()) {
    const current = cursor === index + 1;
    button.classList.toggle('current-move', current);
    if (current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
}
