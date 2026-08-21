(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InscriptionCore = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  function rotatedSize(width, height, degrees) {
    const r = Math.abs(degrees * Math.PI / 180), c = Math.cos(r), s = Math.sin(r);
    return { width: Math.ceil(width * c + height * s), height: Math.ceil(width * s + height * c) };
  }
  function readingOrder(rows, cols, direction) {
    const out = [];
    if (direction === 'vertical') for (let col = cols - 1; col >= 0; col--) for (let row = 0; row < rows; row++) out.push({ row, col });
    else for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) out.push({ row, col });
    return out;
  }
  function splitGraphemes(value) {
    const text = String(value).replace(/\s/g, '');
    return typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(x => x.segment) : Array.from(text);
  }
  function parseSizes(value) {
    const seen = new Set();
    return String(value).split(',').map(x => x.trim().toLowerCase()).filter(x => {
      const valid = x === 'original' || (/^\d+$/.test(x) && Number(x) >= 16 && Number(x) <= 8192);
      if (!valid || seen.has(x)) return false; seen.add(x); return true;
    });
  }
  function safeFilename(value) { return String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '') || 'untitled'; }
  function renderTemplate(template, values) { return safeFilename(String(template || '').replace(/\{(char|page|book|row|col|seq|note|size)\}/g, (_, k) => values[k] ?? '')); }
  function csvEscape(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function exportMetadata(value) { return { title: String(value.title || ''), book: String(value.book || ''), page: String(value.page || '') }; }
  function resizeGrid(xs, ys, corner, x, y, canvasWidth, canvasHeight, minCell = 2) {
    const oldLeft = xs[0], oldRight = xs.at(-1), oldTop = ys[0], oldBottom = ys.at(-1), minWidth = (xs.length - 1) * minCell, minHeight = (ys.length - 1) * minCell;
    let left = oldLeft, right = oldRight, top = oldTop, bottom = oldBottom;
    if (corner === 'tl') { left = Math.max(0, Math.min(oldRight - minWidth, x)); top = Math.max(0, Math.min(oldBottom - minHeight, y)); }
    if (corner === 'tr') { right = Math.max(oldLeft + minWidth, Math.min(canvasWidth, x)); top = Math.max(0, Math.min(oldBottom - minHeight, y)); }
    if (corner === 'bl') { left = Math.max(0, Math.min(oldRight - minWidth, x)); bottom = Math.max(oldTop + minHeight, Math.min(canvasHeight, y)); }
    if (corner === 'br') { right = Math.max(oldLeft + minWidth, Math.min(canvasWidth, x)); bottom = Math.max(oldTop + minHeight, Math.min(canvasHeight, y)); }
    return { xs: xs.map(v => left + (v - oldLeft) / (oldRight - oldLeft) * (right - left)), ys: ys.map(v => top + (v - oldTop) / (oldBottom - oldTop) * (bottom - top)) };
  }
  function cellBounds(xs, ys, localX, localY, row, col) { return { left: xs[col] + localX[row][col], right: xs[col + 1] + localX[row][col + 1], top: ys[row] + localY[col][row], bottom: ys[row + 1] + localY[col][row + 1] }; }
  function scaleOffsets(localX, localY, scaleX, scaleY) { return { localX: localX.map(row => row.map(value => value * scaleX)), localY: localY.map(col => col.map(value => value * scaleY)) }; }
  function scaleGridFromCorner(xs, ys, localX, localY, corner, x, y, canvasWidth, canvasHeight, minCell = 2) {
    const raw = resizeGrid(xs, ys, corner, x, y, canvasWidth, canvasHeight, minCell), oldWidth = xs.at(-1) - xs[0], oldHeight = ys.at(-1) - ys[0];
    let minWidth = Infinity, minHeight = Infinity;
    for (let row = 0; row < localX.length; row++) for (let col = 0; col < localY.length; col++) { const b = cellBounds(xs, ys, localX, localY, row, col); minWidth = Math.min(minWidth, b.right - b.left); minHeight = Math.min(minHeight, b.bottom - b.top); }
    const scaleX = Math.max((raw.xs.at(-1) - raw.xs[0]) / oldWidth, minCell / minWidth), scaleY = Math.max((raw.ys.at(-1) - raw.ys[0]) / oldHeight, minCell / minHeight);
    const fixedX = corner === 'tl' || corner === 'bl' ? xs.at(-1) : xs[0], fixedY = corner === 'tl' || corner === 'tr' ? ys.at(-1) : ys[0];
    const nextXs = xs.map(value => fixedX + (value - fixedX) * scaleX), nextYs = ys.map(value => fixedY + (value - fixedY) * scaleY), offsets = scaleOffsets(localX, localY, scaleX, scaleY);
    return { xs: nextXs, ys: nextYs, ...offsets };
  }
  return { rotatedSize, readingOrder, splitGraphemes, parseSizes, safeFilename, renderTemplate, csvEscape, exportMetadata, resizeGrid, cellBounds, scaleOffsets, scaleGridFromCorner };
});
