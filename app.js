const { rotatedSize, readingOrder, splitGraphemes, parseSizes, paddingColor, renderTemplate, csvEscape, exportMetadata, expandWorkspaceBounds, cellBounds, applyLockedOffsets, scaleGridFromCorner } = window.InscriptionCore;

const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d'), wrap = $('canvasWrap');
const state = { image: null, base: document.createElement('canvas'), aligned: document.createElement('canvas'), angle: 0, zoom: 1, imageZoom: 1, imageX: 0, imageY: 0, xs: [], ys: [], localX: [], localY: [], lockedX: [], lockedY: [], chars: [], drag: null, hover: null };
const status = message => $('status').textContent = message;
const metadataKey = 'inscription-grid-cutter.metadata.v1';
function restoreMetadata() {
  try { const value = JSON.parse(localStorage.getItem(metadataKey)); if (value) Object.entries(exportMetadata(value)).forEach(([key, text]) => $(key).value = text); } catch (_) { /* Storage is optional. */ }
}
function saveMetadata() {
  try { localStorage.setItem(metadataKey, JSON.stringify(exportMetadata({ title: $('title').value, book: $('book').value, page: $('page').value }))); } catch (_) { /* Storage is optional. */ }
}
const count = () => ({ rows: Number($('rows').value), cols: Number($('cols').value) });
const cellIndex = (row, col) => row * count().cols + col;
function sequenceMap(rows, cols) {
  return new Map(readingOrder(rows, cols, $('direction').value).map(({ row, col }, index) => [row * cols + col, index + 1]));
}

function makeGrid() {
  const { rows, cols } = count();
  const left = state.image ? state.imageX : 0, top = state.image ? state.imageY : 0, width = state.image ? state.base.width * state.imageZoom : canvas.width, height = state.image ? state.base.height * state.imageZoom : canvas.height;
  state.xs = Array.from({ length: cols + 1 }, (_, i) => left + width * i / cols);
  state.ys = Array.from({ length: rows + 1 }, (_, i) => top + height * i / rows);
  state.localX = Array.from({ length: rows }, () => Array(cols + 1).fill(0));
  state.localY = Array.from({ length: cols }, () => Array(rows + 1).fill(0));
  state.lockedX = Array.from({ length: rows }, () => Array(cols + 1).fill(null));
  state.lockedY = Array.from({ length: cols }, () => Array(rows + 1).fill(null));
  state.chars = Array.from({ length: rows * cols }, (_, i) => state.chars[i] || '');
  renderChars(); draw();
}

function renderImage(resetGrid = false) {
  if (!state.image) return;
  const { width, height } = rotatedSize(state.image.naturalWidth, state.image.naturalHeight, state.angle);
  state.base.width = state.aligned.width = canvas.width = width; state.base.height = state.aligned.height = canvas.height = height;
  const baseCtx = state.base.getContext('2d'); baseCtx.imageSmoothingEnabled = true; baseCtx.imageSmoothingQuality = 'high'; baseCtx.translate(width / 2, height / 2); baseCtx.rotate(state.angle * Math.PI / 180);
  baseCtx.drawImage(state.image, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2);
  if (resetGrid || !state.xs.length) makeGrid(); else draw();
}

function drawAlignedImage() {
  const aligned = state.aligned.getContext('2d'), width = canvas.width, height = canvas.height, zoom = state.imageZoom;
  aligned.clearRect(0, 0, width, height);
  aligned.drawImage(state.base, state.imageX, state.imageY, state.base.width * zoom, state.base.height * zoom);
}

function expandWorkspaceToImage(drag = null) {
  const next = expandWorkspaceBounds(canvas.width, canvas.height, state.imageX, state.imageY, state.base.width * state.imageZoom, state.base.height * state.imageZoom);
  if (next.width === canvas.width && next.height === canvas.height) return next;
  const oldScrollLeft = wrap.scrollLeft, oldScrollTop = wrap.scrollTop, targetScrollLeft = oldScrollLeft + next.shiftX * state.zoom, targetScrollTop = oldScrollTop + next.shiftY * state.zoom;
  const width = Math.max(next.width, next.shiftX ? Math.ceil((targetScrollLeft + wrap.clientWidth + 1) / state.zoom) : 0), height = Math.max(next.height, next.shiftY ? Math.ceil((targetScrollTop + wrap.clientHeight + 1) / state.zoom) : 0);
  canvas.width = state.aligned.width = width; canvas.height = state.aligned.height = height;
  state.imageX += next.shiftX; state.imageY += next.shiftY;
  state.xs = state.xs.map(x => x + next.shiftX); state.ys = state.ys.map(y => y + next.shiftY);
  state.lockedX = state.lockedX.map(row => row.map(value => value == null ? null : value + next.shiftX));
  state.lockedY = state.lockedY.map(col => col.map(value => value == null ? null : value + next.shiftY));
  canvas.style.width = `${canvas.width * state.zoom}px`; canvas.style.height = `${canvas.height * state.zoom}px`;
  wrap.scrollLeft = targetScrollLeft; wrap.scrollTop = targetScrollTop;
  if (drag?.type === 'image') { drag.start.x += (wrap.scrollLeft - oldScrollLeft) / state.zoom; drag.start.y += (wrap.scrollTop - oldScrollTop) / state.zoom; drag.imageX += next.shiftX; drag.imageY += next.shiftY; }
  state.hover = null;
  return next;
}

function draw() {
  if (!state.image) return;
  drawAlignedImage(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(state.aligned, 0, 0);
  ctx.save();
  ctx.lineWidth = 3.5 / state.zoom; ctx.strokeStyle = $('gridColor').value; ctx.globalAlpha = Number($('gridOpacity').value); ctx.setLineDash([8 / state.zoom, 4 / state.zoom]);
  ctx.fillStyle = $('gridColor').value; ctx.font = `800 ${22 / state.zoom}px system-ui`;
  const { rows, cols } = count();
  const labels = sequenceMap(rows, cols);
  ctx.beginPath();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const b = bounds(r, c), i = cellIndex(r, c), char = String(state.chars[i] || '').trim(); ctx.moveTo(b.left, b.top); ctx.lineTo(b.right, b.top); ctx.moveTo(b.left, b.top); ctx.lineTo(b.left, b.bottom); if (r === rows - 1) { ctx.moveTo(b.left, b.bottom); ctx.lineTo(b.right, b.bottom); } if (c === cols - 1) { ctx.moveTo(b.right, b.top); ctx.lineTo(b.right, b.bottom); } ctx.fillText(`${labels.get(i)}${char ? ` ${char}` : ''}`, b.left + 6 / state.zoom, b.top + 24 / state.zoom); }
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (state.hover?.kind === 'line') { const h = state.hover; ctx.strokeStyle = '#ffdf36'; ctx.lineWidth = 3 / state.zoom; ctx.beginPath(); if (h.axis === 'x') { ctx.moveTo(h.value, h.start); ctx.lineTo(h.value, h.end); } else { ctx.moveTo(h.start, h.value); ctx.lineTo(h.end, h.value); } ctx.stroke(); }
  if (state.hover?.kind === 'corner') { ctx.fillStyle = '#ffdf36'; ctx.beginPath(); ctx.arc(state.hover.x, state.hover.y, 7 / state.zoom, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function fit() {
  if (!canvas.width) return;
  state.zoom = Math.min(1, (wrap.clientWidth - 12) / canvas.width, (wrap.clientHeight - 12) / canvas.height);
  canvas.style.width = `${canvas.width * state.zoom}px`; canvas.style.height = `${canvas.height * state.zoom}px`; draw();
}

function renderChars() {
  const { rows, cols } = count(), body = $('charRows'), order = readingOrder(rows, cols, $('direction').value);
  body.innerHTML = '';
  for (const [sequence, { row: r, col: c }] of order.entries()) {
    const i = cellIndex(r, c), tr = document.createElement('tr'), input = document.createElement('input');
    input.value = state.chars[i] || ''; input.placeholder = '字头'; input.addEventListener('input', () => { state.chars[i] = input.value; tr.classList.toggle('missing', !input.value.trim()); draw(); });
    tr.classList.toggle('missing', !input.value.trim()); tr.innerHTML = `<td>${sequence + 1} · r${r + 1} c${c + 1}</td>`; const td = document.createElement('td'); td.append(input); tr.append(td); body.append(tr);
  }
}

function point(event) { const r = canvas.getBoundingClientRect(); return { x: (event.clientX - r.left) / state.zoom, y: (event.clientY - r.top) / state.zoom }; }
function bounds(row, col) { return cellBounds(state.xs, state.ys, state.localX, state.localY, row, col); }
function corners() { const { rows, cols } = count(); return { tl: bounds(0, 0), tr: bounds(0, cols - 1), bl: bounds(rows - 1, 0), br: bounds(rows - 1, cols - 1) }; }
function hitTest(p) {
  const near = 10 / state.zoom, { rows, cols } = count(), cs = corners();
  const points = { tl: [cs.tl.left, cs.tl.top], tr: [cs.tr.right, cs.tr.top], bl: [cs.bl.left, cs.bl.bottom], br: [cs.br.right, cs.br.bottom] };
  const cursors = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize' };
  for (const [corner, [x, y]] of Object.entries(points)) if (Math.hypot(p.x - x, p.y - y) <= near) return { kind: 'corner', corner, x, y, cursor: cursors[corner] };
  if (p.x >= state.xs[0] - near && p.x <= state.xs.at(-1) + near && p.y >= state.ys[0] - near && p.y <= state.ys.at(-1) + near && (Math.abs(p.x - state.xs[0]) <= near || Math.abs(p.x - state.xs.at(-1)) <= near || Math.abs(p.y - state.ys[0]) <= near || Math.abs(p.y - state.ys.at(-1)) <= near)) return { kind: 'move', cursor: 'move' };
  for (let row = 0; row < rows; row++) for (let line = 1; line < cols; line++) { const b = bounds(row, line - 1), x = b.right; if (Math.abs(p.x - x) <= near && p.y >= b.top - near && p.y <= b.bottom + near) return { kind: 'line', axis: 'x', line, row, value: x, start: b.top, end: b.bottom, cursor: 'col-resize' }; }
  for (let col = 0; col < cols; col++) for (let line = 1; line < rows; line++) { const b = bounds(line - 1, col), y = b.bottom; if (Math.abs(p.y - y) <= near && p.x >= b.left - near && p.x <= b.right + near) return { kind: 'line', axis: 'y', line, col, value: y, start: b.left, end: b.right, cursor: 'row-resize' }; }
  return null;
}
canvas.addEventListener('pointerdown', event => {
  if (!state.image) return; const hit = hitTest(point(event));
  if (hit?.kind === 'corner') state.drag = { type: 'scale', ...hit, xs: [...state.xs], ys: [...state.ys], localX: state.localX.map(row => [...row]), localY: state.localY.map(col => [...col]), lockedX: state.lockedX.map(row => [...row]), lockedY: state.lockedY.map(col => [...col]) };
  else if (hit?.kind === 'move') state.drag = { type: 'move', start: point(event), xs: [...state.xs], ys: [...state.ys], lockedX: state.lockedX.map(row => [...row]), lockedY: state.lockedY.map(col => [...col]) };
  else if (hit) state.drag = event.altKey ? { type: `${hit.axis}local`, ...hit } : { type: hit.axis, ...hit };
  else { const p = point(event); state.drag = { type: 'image', start: p, imageX: state.imageX, imageY: state.imageY }; canvas.style.cursor = 'grabbing'; }
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  const p = point(event); if (!state.drag) { state.hover = hitTest(p); canvas.style.cursor = state.hover?.cursor || 'grab'; draw(); return; }
  const d = state.drag;
  if (d.type === 'image') { state.imageX = d.imageX + p.x - d.start.x; state.imageY = d.imageY + p.y - d.start.y; expandWorkspaceToImage(d); draw(); return; }
  if (d.type === 'x') {
    if (state.lockedX[d.row][d.line] == null) { const limits = state.localX.map((offsets, row) => state.lockedX[row][d.line] == null ? [state.xs[d.line - 1] + offsets[d.line - 1] + 2 - offsets[d.line], state.xs[d.line + 1] + offsets[d.line + 1] - 2 - offsets[d.line]] : [-Infinity, Infinity]); state.xs[d.line] = Math.max(Math.max(...limits.map(x => x[0])), Math.min(Math.min(...limits.map(x => x[1])), p.x - state.localX[d.row][d.line])); state.localX = applyLockedOffsets(state.xs, state.localX, state.lockedX); }
  } else if (d.type === 'y') {
    if (state.lockedY[d.col][d.line] == null) { const limits = state.localY.map((offsets, col) => state.lockedY[col][d.line] == null ? [state.ys[d.line - 1] + offsets[d.line - 1] + 2 - offsets[d.line], state.ys[d.line + 1] + offsets[d.line + 1] - 2 - offsets[d.line]] : [-Infinity, Infinity]); state.ys[d.line] = Math.max(Math.max(...limits.map(x => x[0])), Math.min(Math.min(...limits.map(x => x[1])), p.y - state.localY[d.col][d.line])); state.localY = applyLockedOffsets(state.ys, state.localY, state.lockedY); }
  } else if (d.type === 'xlocal') { const lo = state.xs[d.line - 1] + state.localX[d.row][d.line - 1] + 2, hi = state.xs[d.line + 1] + state.localX[d.row][d.line + 1] - 2, value = Math.max(lo, Math.min(hi, p.x)); state.lockedX[d.row][d.line] = value; state.localX = applyLockedOffsets(state.xs, state.localX, state.lockedX); }
  else if (d.type === 'ylocal') { const lo = state.ys[d.line - 1] + state.localY[d.col][d.line - 1] + 2, hi = state.ys[d.line + 1] + state.localY[d.col][d.line + 1] - 2, value = Math.max(lo, Math.min(hi, p.y)); state.lockedY[d.col][d.line] = value; state.localY = applyLockedOffsets(state.ys, state.localY, state.lockedY); }
  else if (d.type === 'move') { const dx = Math.max(-Math.min(...d.xs), Math.min(canvas.width - Math.max(...d.xs), p.x - d.start.x)), dy = Math.max(-Math.min(...d.ys), Math.min(canvas.height - Math.max(...d.ys), p.y - d.start.y)); state.xs = d.xs.map(x => x + dx); state.ys = d.ys.map(y => y + dy); state.lockedX = d.lockedX.map(row => row.map(value => value == null ? null : value + dx)); state.lockedY = d.lockedY.map(col => col.map(value => value == null ? null : value + dy)); state.localX = applyLockedOffsets(state.xs, state.localX, state.lockedX); state.localY = applyLockedOffsets(state.ys, state.localY, state.lockedY); }
  else { const scaled = scaleGridFromCorner(d.xs, d.ys, d.localX, d.localY, d.corner, p.x, p.y, canvas.width, canvas.height), scaleX = (scaled.xs.at(-1) - scaled.xs[0]) / (d.xs.at(-1) - d.xs[0]), scaleY = (scaled.ys.at(-1) - scaled.ys[0]) / (d.ys.at(-1) - d.ys[0]), fixedX = d.corner === 'tl' || d.corner === 'bl' ? d.xs.at(-1) : d.xs[0], fixedY = d.corner === 'tl' || d.corner === 'tr' ? d.ys.at(-1) : d.ys[0]; state.xs = scaled.xs; state.ys = scaled.ys; state.lockedX = d.lockedX.map(row => row.map(value => value == null ? null : fixedX + (value - fixedX) * scaleX)); state.lockedY = d.lockedY.map(col => col.map(value => value == null ? null : fixedY + (value - fixedY) * scaleY)); state.localX = applyLockedOffsets(state.xs, scaled.localX, state.lockedX); state.localY = applyLockedOffsets(state.ys, scaled.localY, state.lockedY); }
  draw();
});
function endDrag(event) { state.drag = null; state.hover = state.image && event ? hitTest(point(event)) : null; canvas.style.cursor = state.hover?.cursor || (state.image ? 'grab' : 'default'); if (state.image) draw(); }
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', event => { if (!state.image) return; event.preventDefault(); const oldZoom = state.imageZoom, zoom = Math.max(.1, Math.min(4, oldZoom * (event.deltaY > 0 ? .9 : 1.1))); if (zoom === oldZoom) return; state.imageX += state.base.width * (oldZoom - zoom) / 2; state.imageY += state.base.height * (oldZoom - zoom) / 2; state.imageZoom = zoom; const drag = state.drag?.type === 'image' ? state.drag : null; if (drag) { drag.start = point(event); drag.imageX = state.imageX; drag.imageY = state.imageY; } expandWorkspaceToImage(drag); draw(); }, { passive: false });

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
function loadImageFile(file, displayName = file && file.name) {
  if (!file || !imageTypes.has(file.type)) return status('仅支持 PNG、JPEG 或 WebP 图片。');
  const url = URL.createObjectURL(file), image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); state.image = image; state.chars = []; $('paste').value = ''; $('note').value = ''; state.angle = 0; state.imageZoom = 1; state.imageX = state.imageY = 0; $('angle').value = $('angleRange').value = 0; renderImage(true); fit(); status(`已载入：${displayName || '粘贴图片'}（${image.naturalWidth}×${image.naturalHeight}）`); };
  image.onerror = () => { URL.revokeObjectURL(url); status('图片加载失败，请换一张 PNG、JPEG 或 WebP。'); };
  image.src = url;
}
$('file').addEventListener('change', event => loadImageFile(event.target.files[0]));
document.addEventListener('paste', event => {
  const item = [...(event.clipboardData?.items || [])].find(x => x.kind === 'file' && x.type.startsWith('image/'));
  if (!item) return;
  event.preventDefault(); loadImageFile(item.getAsFile(), '粘贴图片');
});
function hasFiles(event) { return [...(event.dataTransfer?.types || [])].includes('Files'); }
wrap.addEventListener('dragover', event => { if (hasFiles(event)) { event.preventDefault(); wrap.classList.add('dragover'); } });
wrap.addEventListener('dragleave', () => wrap.classList.remove('dragover'));
wrap.addEventListener('drop', event => { if (!hasFiles(event)) return; event.preventDefault(); wrap.classList.remove('dragover'); loadImageFile([...event.dataTransfer.files].find(file => imageTypes.has(file.type)) || event.dataTransfer.files[0]); });
function setAngle(value) { state.angle = Math.max(-15, Math.min(15, Number(value) || 0)); state.imageZoom = 1; state.imageX = state.imageY = 0; $('angle').value = $('angleRange').value = state.angle; renderImage(true); fit(); if (state.image) status('旋转已应用，网格已重置。'); }
$('angleRange').addEventListener('input', e => setAngle(e.target.value)); $('angle').addEventListener('change', e => setAngle(e.target.value)); document.querySelectorAll('[data-angle]').forEach(b => b.addEventListener('click', () => setAngle(Number(b.dataset.angle) ? state.angle + Number(b.dataset.angle) : 0)));
['rows', 'cols'].forEach(id => $(id).addEventListener('change', () => { $(id).value = Math.max(1, Math.min(30, Math.trunc(Number($(id).value)) || 1)); makeGrid(); }));
$('resetGrid').addEventListener('click', makeGrid); $('fit').addEventListener('click', fit);
function updateCustomBackground() { const custom = $('background').value === 'custom'; $('customBackgroundLabel').classList.toggle('hidden', !custom); $('customBackground').classList.toggle('hidden', !custom); }
$('background').addEventListener('change', updateCustomBackground); updateCustomBackground();
$('gridColor').addEventListener('input', draw); $('gridOpacity').addEventListener('input', draw);
$('direction').addEventListener('change', () => { renderChars(); draw(); });
$('title').addEventListener('input', saveMetadata); $('book').addEventListener('input', saveMetadata); $('page').addEventListener('input', saveMetadata); restoreMetadata();
$('fill').addEventListener('click', () => { const chars = splitGraphemes($('paste').value), order = readingOrder(count().rows, count().cols, $('direction').value); state.chars = Array(order.length).fill(''); order.forEach(({ row, col }, i) => { if (chars[i] != null) state.chars[cellIndex(row, col)] = chars[i]; }); renderChars(); draw(); const filled = Math.min(chars.length, order.length); status(chars.length === order.length ? `已填入 ${filled}/${order.length} 个字头。` : `已填入 ${filled}/${order.length} 个字头；${chars.length < order.length ? '其余格已清空并需填写' : '多余字头未填入'}。`); });

function cellCanvas(row, col, size) {
  const b = bounds(row, col), x = b.left, y = b.top, w = b.right - x, h = b.bottom - y;
  drawAlignedImage();
  const out = document.createElement('canvas');
  if (size === 'original') { out.width = Math.max(1, Math.round(w)); out.height = Math.max(1, Math.round(h)); out.getContext('2d').drawImage(state.aligned, x, y, w, h, 0, 0, out.width, out.height); }
  else { const n = Number(size), c = out.getContext('2d'); out.width = out.height = n; const background = paddingColor($('background').value, $('customBackground').value); if (background) { c.fillStyle = background; c.fillRect(0, 0, n, n); } const scale = Math.min(n / w, n / h), dw = w * scale, dh = h * scale; c.drawImage(state.aligned, x, y, w, h, (n - dw) / 2, (n - dh) / 2, dw, dh); }
  return { out, x, y, w, h };
}
async function fileExists(dir, name) { try { await dir.getFileHandle(name); return true; } catch (error) { if (error.name === 'NotFoundError') return false; throw error; } }
async function uniqueFilename(dir, base, extension, used) { let suffix = '', n = 1, name = `${base}${extension}`; while (used.has(name) || await fileExists(dir, name)) { name = `${base}_${++n}${extension}`; } used.add(name); return name; }
async function writeFile(dir, name, blob) { const handle = await dir.getFileHandle(name, { create: true }), writable = await handle.createWritable(); await writable.write(blob); await writable.close(); }

$('export').addEventListener('click', async () => {
  if (!state.image) return status('请先导入图片。');
  const missing = state.chars.map((x, i) => !String(x).trim() ? i : -1).filter(i => i >= 0); if (missing.length) { renderChars(); return status(`还有 ${missing.length} 个字头未填写，不能导出。`); }
  if (!$('book').value.trim() || !$('page').value.trim()) return status('请填写书名简称和页码后再导出。');
  const sizes = parseSizes($('sizes').value); if (!sizes.length) return status('分辨率需包含 original 或 16–8192 的数字。');
  if (!window.showDirectoryPicker) return status('请使用 Chrome 或 Edge 的安全页面/本地文件打开后导出。');
  try {
    const root = await window.showDirectoryPicker({ mode: 'readwrite' }), dirs = new Map(), used = new Map();
    for (const size of sizes) { const dir = await root.getDirectoryHandle(size, { create: true }); dirs.set(size, dir); used.set(size, new Set()); }
    const rows = ['path,char,row,col,seq,size,book_short,book_title,page,note,angle,x,y,width,height']; const { rows: rowCount, cols } = count(), labels = sequenceMap(rowCount, cols); let done = 0, total = rowCount * cols * sizes.length;
    for (let row = 0; row < rowCount; row++) for (let col = 0; col < cols; col++) for (const size of sizes) {
      const seq = labels.get(cellIndex(row, col));
      const char = state.chars[cellIndex(row, col)].trim(), values = { char, page: $('page').value.trim(), book: $('book').value.trim(), row: row + 1, col: col + 1, seq, note: $('note').value.trim(), size };
      const { out, x, y, w, h } = cellCanvas(row, col, size), base = renderTemplate($('template').value, values), dir = dirs.get(size);
      const plain = `${base}.png`, collision = used.get(size).has(plain) || await fileExists(dir, plain);
      const suffix = `r${String(row + 1).padStart(2, '0')}c${String(col + 1).padStart(2, '0')}`;
      const filename = await uniqueFilename(dir, collision ? `${base}_${suffix}` : base, '.png', used.get(size));
      const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('浏览器无法编码 PNG，请尝试较小的分辨率或图片。');
      await writeFile(dir, filename, blob);
      rows.push([`${size}/${filename}`, char, row + 1, col + 1, seq, size, $('book').value.trim(), $('title').value.trim(), $('page').value.trim(), $('note').value.trim(), state.angle, x, y, w, h].map(csvEscape).join(',')); done++; status(`正在导出 ${done}/${total}…`);
    }
    const manifest = await uniqueFilename(root, 'manifest', '.csv', new Set());
    await writeFile(root, manifest, new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })); status(`完成：${done} 张 PNG，已写入 ${manifest}。`);
  } catch (error) { if (error.name !== 'AbortError') status(`导出失败：${error.message}`); }
});
