/* PARASAT: «живая» голограмма-сцена на canvas.
   Вступление: девушка собирается из частиц, включается экран и золотой шаңырақ.
   Дальше: губы открываются по реальному звуку голоса, глаза моргают,
   поднятая рука двигается, пока она говорит, снизу поднимаются искры. */

const W = 1536, H = 1024;
// разметка сцены 1536x1024 (пиксели исходной картинки)
const GIRL = { x: 613, y: 94 };                                     // где лежит вырезанная девушка
const HAND = { x: 606, y: 504, px: 782, py: 590 };
const BODY = { x: 688, y: 94, px: 1080, py: 800 };                // девушка без поднятой руки (для покачивания)                 // кисть и точка запястья
const MOUTH = { x0: 1055, y0: 284, cx: 1084, cy: 297, x1: 1113, y1: 286 }; // линия смыкания губ
const JAW = { x: 1043, y: 278, w: 82, h: 52 };
const UP = { x: 1048, y: 272, w: 72, h: 24 };
const EYES = [{ x: 1054, y: 222, rx: 15, ry: 6 }, { x: 1121, y: 224, rx: 15, ry: 6 }];
const SCREEN = { l: 35, r: 858, tl: 110, tr: 232, bl: 668, br: 640 }; // голо-экран
const RING = { x: 695, y: 95, rx: 330, ry: 95 };                    // шаңырақ
const T = { hall: [0, 900], fly: [450, 1700], girl: [2900, 3700], board: [3300, 4600], ring: [3900, 5000], end: 5200 };
const OPEN_PX = 11;                                                 // максимум раскрытия рта

const ease = k => 1 - Math.pow(1 - k, 3);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* ---------- живая голо-доска: глобус крутится, графики и диаграммы двигаются ---------- */
/* координаты — в пикселях сцены 1536x1024 */
function boardFx(c, now, alpha) {
  if (alpha <= 0) return;
  const s = now / 1000, TAU = Math.PI * 2;
  const cy = (r, g, b, a) => `rgba(${r},${g},${b},${(a * alpha).toFixed(3)})`;
  c.save();

  /* 1. глобус: вращающиеся меридианы, точки-города, дуги связи, спутник на орбите */
  const G = { x: 409, y: 365, r: 117 }, rot = s * .35;
  c.save();
  c.beginPath(); c.arc(G.x, G.y, G.r, 0, TAU); c.clip();
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = 1.1;
  for (let i = 0; i < 12; i++) {                         // меридианы
    const lon = rot + i * Math.PI / 12, k = Math.cos(lon);
    if (Math.sin(lon) < 0) continue;                    // только передняя сторона
    c.strokeStyle = cy(120, 235, 255, .22 + .2 * Math.sin(lon));
    c.beginPath(); c.ellipse(G.x, G.y, Math.abs(k) * G.r, G.r, 0, 0, TAU); c.stroke();
  }
  for (let j = -2; j <= 2; j++) {                         // параллели
    const yy = G.y + j * G.r * .36, w = Math.sqrt(1 - Math.pow(j * .36, 2)) * G.r;
    c.strokeStyle = cy(120, 235, 255, .16);
    c.beginPath(); c.ellipse(G.x, yy, w, w * .16, 0, 0, TAU); c.stroke();
  }
  const cities = [[.3, .5], [1.1, .25], [1.9, -.15], [2.6, .4], [3.4, -.35], [4.2, .1], [5.0, .55], [5.7, -.05]];
  const pts = cities.map(([lon, lat]) => {
    const L = lon + rot, x = Math.cos(L) * Math.cos(lat), z = Math.sin(L) * Math.cos(lat);
    return { x: G.x + x * G.r, y: G.y - Math.sin(lat) * G.r, z };
  });
  pts.forEach((p, i) => {                                 // дуги между соседними городами
    const q = pts[(i + 2) % pts.length];
    if (p.z <= 0 || q.z <= 0) return;
    c.strokeStyle = cy(255, 214, 120, .5);
    c.beginPath(); c.moveTo(p.x, p.y);
    c.quadraticCurveTo((p.x + q.x) / 2, Math.min(p.y, q.y) - 40, q.x, q.y); c.stroke();
  });
  pts.forEach((p, i) => {
    if (p.z <= 0) return;
    const pulse = .6 + .4 * Math.sin(s * 3 + i);
    c.fillStyle = cy(200, 250, 255, .9 * p.z);
    c.beginPath(); c.arc(p.x, p.y, 2.4 + pulse * 1.6, 0, TAU); c.fill();
  });
  c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';     // орбита и спутник
  const oa = s * .9;
  c.strokeStyle = cy(120, 235, 255, .25); c.lineWidth = 1;
  c.beginPath(); c.ellipse(G.x, G.y, G.r * 1.32, G.r * .3, -.18, 0, TAU); c.stroke();
  const sx = G.x + Math.cos(oa) * G.r * 1.32, sy = G.y + Math.sin(oa) * G.r * .3;
  const ex = Math.cos(-.18), ey = Math.sin(-.18);
  const px = G.x + (sx - G.x) * ex - (sy - G.y) * ey, py = G.y + (sx - G.x) * ey + (sy - G.y) * ex;
  if (Math.sin(oa) > -.2) {
    const g = c.createRadialGradient(px, py, 0, px, py, 12);
    g.addColorStop(0, cy(230, 255, 255, 1)); g.addColorStop(1, cy(90, 220, 255, 0));
    c.fillStyle = g; c.beginPath(); c.arc(px, py, 12, 0, TAU); c.fill();
  }
  c.restore();

  /* 2. линейный график справа: две бегущие волны */
  c.save(); c.globalCompositeOperation = 'lighter';
  c.beginPath(); c.moveTo(566, 274); c.lineTo(742, 284); c.lineTo(742, 356); c.lineTo(566, 350); c.clip();
  c.globalCompositeOperation = 'source-over'; c.fillStyle = cy(5, 78, 108, .82); c.fillRect(560, 268, 190, 96);
  c.globalCompositeOperation = 'lighter';
  [[120, 240, 255, 1.6, 0], [255, 205, 110, 2.3, 1.7]].forEach(([r, g, b, f, ph]) => {
    c.strokeStyle = cy(r, g, b, .75); c.lineWidth = 1.6; c.beginPath();
    for (let x = 566; x <= 742; x += 3) {
      const base = 312 + (x - 566) * .05;
      const y = base + Math.sin((x - 566) / 176 * TAU * f - s * 2.2 + ph) * 18 * (.6 + .4 * Math.sin(s * .7 + ph));
      x === 566 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  });
  c.restore();

  /* 3. столбики: прячем нарисованные и рисуем живые */
  const bars = (x0, base, w, gap, n, hMax, seed, slope) => {
    c.save();
    c.fillStyle = cy(5, 80, 110, .92);
    c.fillRect(x0 - 3, base - hMax - 6 + (n * (w + gap)) * slope * 0, n * (w + gap) + 4, hMax + 8);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const h = hMax * (.35 + .45 * (i + 1) / n + .2 * Math.sin(s * 1.8 + i * 1.3 + seed));
      const x = x0 + i * (w + gap), y = base + i * (w + gap) * slope;
      const g = c.createLinearGradient(0, y - h, 0, y);
      g.addColorStop(0, cy(170, 250, 255, .95)); g.addColorStop(1, cy(30, 170, 230, .7));
      c.fillStyle = g; c.fillRect(x, y - h, w, h);
    }
    c.restore();
  };
  bars(494, 609, 10, 7, 6, 64, 0, 0);          // нижняя диаграмма
  bars(745, 382, 7, 5, 5, 58, 2, 0);           // маленькая справа

  /* 4. радар: бегущий луч */
  const R = { x: 373, y: 587, r: 37 }, ang = s * 2.4;
  c.save(); c.globalCompositeOperation = 'lighter';
  const sw = c.createConicGradient ? c.createConicGradient(ang - .9, R.x, R.y) : null;
  if (sw) {
    sw.addColorStop(0, cy(80, 230, 255, 0)); sw.addColorStop(.14, cy(140, 245, 255, .55)); sw.addColorStop(.15, cy(80, 230, 255, 0)); sw.addColorStop(1, cy(80, 230, 255, 0));
    c.fillStyle = sw; c.beginPath(); c.arc(R.x, R.y, R.r, 0, TAU); c.fill();
  }
  c.strokeStyle = cy(200, 250, 255, .8); c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(R.x, R.y); c.lineTo(R.x + Math.cos(ang) * R.r, R.y + Math.sin(ang) * R.r); c.stroke();
  c.restore();

  /* 5. код: бегущая подсветка строки и мигающий курсор */
  c.save(); c.globalCompositeOperation = 'lighter';
  const ly = 292 + ((s * 38) % 190);
  const hl = c.createLinearGradient(78, 0, 270, 0);
  hl.addColorStop(0, cy(120, 240, 255, .0)); hl.addColorStop(.2, cy(120, 240, 255, .28)); hl.addColorStop(1, cy(120, 240, 255, 0));
  c.fillStyle = hl; c.fillRect(78, ly, 192, 6);
  if (Math.floor(s * 2) % 2) { c.fillStyle = cy(220, 255, 255, .9); c.fillRect(262, ly - 1, 6, 8); }
  c.restore();

  /* 6. пустые панели: кардиограмма, кольца-проценты, полосы загрузки */
  c.save(); c.globalCompositeOperation = 'lighter';
  c.beginPath(); c.moveTo(84, 168); c.lineTo(270, 199); c.lineTo(270, 288); c.lineTo(84, 288); c.clip();
  c.strokeStyle = cy(120, 240, 255, .8); c.lineWidth = 1.6; c.beginPath();
  for (let x = 84; x <= 270; x += 2) {
    const ph = ((x - 84) / 62 - s * 1.2) % 1, k = ph < 0 ? ph + 1 : ph;
    const spike = k > .42 && k < .5 ? -Math.sin((k - .42) / .08 * Math.PI) * 30 : k > .5 && k < .55 ? Math.sin((k - .5) / .05 * Math.PI) * 10 : 0;
    const y = 246 + (x - 84) * .05 + spike + Math.sin(x * .2 + s * 3) * 1.5;
    x === 84 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke(); c.restore();

  c.save(); c.globalCompositeOperation = 'lighter';        // кольца в средней правой панели
  [[600, 452, 26, .78, 0], [672, 456, 26, .54, 1.5]].forEach(([x, y, r, v, ph]) => {
    const val = v + .12 * Math.sin(s * .9 + ph);
    c.lineWidth = 5; c.strokeStyle = cy(60, 160, 200, .35);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    c.strokeStyle = cy(130, 240, 255, .9);
    c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * val); c.stroke();
    c.fillStyle = cy(200, 250, 255, .9);
    c.beginPath(); c.arc(x + Math.cos(-Math.PI / 2 + TAU * val) * r, y + Math.sin(-Math.PI / 2 + TAU * val) * r, 3, 0, TAU); c.fill();
  });
  c.restore();

  c.save(); c.globalCompositeOperation = 'lighter';        // полосы в нижней левой панели
  for (let i = 0; i < 4; i++) {
    const y = 522 + i * 22, w = 190, v = (.35 + .5 * ((Math.sin(s * .8 + i * 1.7) + 1) / 2));
    c.fillStyle = cy(60, 160, 200, .3); c.fillRect(100, y, w, 5);
    const g = c.createLinearGradient(100, 0, 100 + w * v, 0);
    g.addColorStop(0, cy(40, 170, 230, .6)); g.addColorStop(1, i % 2 ? cy(255, 210, 120, .95) : cy(170, 250, 255, .95));
    c.fillStyle = g; c.fillRect(100, y, w * v, 5);
  }
  c.restore();

  /* 7. световая волна, проходящая по всей доске раз в 7 секунд */
  const k = (s % 7) / 7;
  if (k < .45) {
    const x = 30 + (k / .45) * 840;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(x - 60, 0, x + 10, 0);
    g.addColorStop(0, cy(120, 240, 255, 0)); g.addColorStop(.85, cy(150, 245, 255, .14)); g.addColorStop(1, cy(220, 255, 255, 0));
    c.fillStyle = g; c.fillRect(x - 60, 110 + (x - 35) * .148 - 10, 70, 560);
    c.restore();
  }
  c.restore();
}

export class Avatar {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    this.open = 0; this.round = 0; this.tOpen = 0; this.tRound = 0;
    this.state = 'idle'; this.mode = 'empty';
    this.g = { ang: 0, tAng: 0, lift: 0, tLift: 0, next: 0, rot: 0, tRot: 0, nod: 0, amp: 0 };
    this.blinkT = -1; this.nextBlink = performance.now() + 2500;
    this.onLive = null;
    this.sparks = Array.from({ length: 70 }, () => ({ x: 900 + Math.random() * 340, y: 940 - Math.random() * 180, v: 10 + Math.random() * 26, s: 1 + Math.random() * 2.2, ph: Math.random() * 6.28 }));
    this.lastNow = 0;

    const load = src => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
    Promise.all(['base.jpg', 'plate.jpg', 'girl.webp', 'hand.webp', 'body.webp'].map(f => load('/static/img/' + f)))
      .then(([base, plate, girl, hand, body]) => {
        Object.assign(this, { base, plate, girl, hand, body });
        this._buildJaw(); this._buildUpper(); this._buildLids(); this._buildParticles();
        this.ready = true;
      })
      .catch(() => console.error('Не удалось загрузить картинки сцены'));
    requestAnimationFrame(t => this._frame(t));
  }

  setMouth(open, round = 0) { this.tOpen = clamp01(open); this.tRound = clamp01(round); }
  setState(s) { this.state = s; }
  /** Вступительная анимация; done() вызывается, когда она закончилась */
  intro(done) { this.mode = 'intro'; this.introT0 = performance.now(); this.onLive = done || null; document.body.classList.remove('live'); }
  /** Сразу показать девушку без вступления */
  live() { this.mode = 'live'; document.body.classList.add('live'); }

  // ---------- подготовка кусочков ----------
  _quad(t) { const a = 1 - t; return { x: a * a * MOUTH.x0 + 2 * a * t * MOUTH.cx + t * t * MOUTH.x1, y: a * a * MOUTH.y0 + 2 * a * t * MOUTH.cy + t * t * MOUTH.y1 }; }
  _lineY(x) { let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (this._quad(m).x < x) lo = m; else hi = m; } return this._quad((lo + hi) / 2).y; }

  _buildJaw() {
    const c = this.jaw = document.createElement('canvas'); c.width = JAW.w; c.height = JAW.h;
    const j = c.getContext('2d');
    j.drawImage(this.base, JAW.x, JAW.y, JAW.w, JAW.h, 0, 0, JAW.w, JAW.h);
    j.globalCompositeOperation = 'destination-in';
    j.beginPath();
    j.moveTo(0, MOUTH.y0 - JAW.y); j.lineTo(MOUTH.x0 - JAW.x, MOUTH.y0 - JAW.y);
    j.quadraticCurveTo(MOUTH.cx - JAW.x, MOUTH.cy - JAW.y, MOUTH.x1 - JAW.x, MOUTH.y1 - JAW.y);
    j.lineTo(JAW.w, MOUTH.y1 - JAW.y); j.lineTo(JAW.w, JAW.h); j.lineTo(0, JAW.h); j.closePath(); j.fill();
    const g = j.createLinearGradient(0, 0, JAW.w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.18, '#000'); g.addColorStop(.82, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    j.fillStyle = g; j.fillRect(0, 0, JAW.w, JAW.h);
  }

  _buildUpper() {
    const c = this.upper = document.createElement('canvas'); c.width = UP.w; c.height = UP.h;
    const j = c.getContext('2d');
    j.drawImage(this.base, UP.x, UP.y, UP.w, UP.h, 0, 0, UP.w, UP.h);
    j.globalCompositeOperation = 'destination-in';
    j.beginPath();
    j.moveTo(0, 0); j.lineTo(UP.w, 0); j.lineTo(UP.w, MOUTH.y1 - UP.y); j.lineTo(MOUTH.x1 - UP.x, MOUTH.y1 - UP.y);
    j.quadraticCurveTo(MOUTH.cx - UP.x, MOUTH.cy - UP.y, MOUTH.x0 - UP.x, MOUTH.y0 - UP.y);
    j.lineTo(0, MOUTH.y0 - UP.y); j.closePath(); j.fill();
    const gx = j.createLinearGradient(0, 0, UP.w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(.16, '#000'); gx.addColorStop(.84, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    j.fillStyle = gx; j.fillRect(0, 0, UP.w, UP.h);
    const gy = j.createLinearGradient(0, 0, 0, UP.h);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(.45, '#000'); gy.addColorStop(1, '#000');
    j.fillStyle = gy; j.fillRect(0, 0, UP.w, UP.h);
  }

  _buildLids() {
    this.lids = EYES.map(e => {
      const w = e.rx * 2 + 8, h = e.ry * 2 + 5;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const j = c.getContext('2d');
      j.drawImage(this.base, e.x - w / 2, e.y + e.ry + 3, w, 9, 0, 0, w, h);   // кожа под глазом → веко
      j.globalCompositeOperation = 'source-atop';
      const tone = j.createLinearGradient(0, 0, 0, h);
      tone.addColorStop(0, 'rgba(120,75,58,.05)'); tone.addColorStop(1, 'rgba(105,58,44,.32)');
      j.fillStyle = tone; j.fillRect(0, 0, w, h);
      j.globalCompositeOperation = 'destination-in';
      j.save(); j.translate(w / 2, h / 2); j.scale(1, h / w);
      const g = j.createRadialGradient(0, 0, w * .3, 0, 0, w * .5);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      j.fillStyle = g; j.fillRect(-w / 2, -w / 2, w, w); j.restore();
      return { c, w, h, x: e.x - w / 2, y: e.y - h / 2 };
    });
  }

  _buildParticles() {
    try {
      const c = document.createElement('canvas'); c.width = this.girl.naturalWidth; c.height = this.girl.naturalHeight;
      const j = c.getContext('2d'); j.drawImage(this.girl, 0, 0);
      const d = j.getImageData(0, 0, c.width, c.height).data;
      const N = 3600, out = [];
      for (let tries = 0; out.length < N && tries < N * 30; tries++) {
        const x = Math.random() * c.width | 0, y = Math.random() * c.height | 0, k = (y * c.width + x) * 4;
        if (d[k + 3] < 150) continue;
        const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random());
        out.push({ tx: GIRL.x + x, ty: GIRL.y + y, r: d[k], g: d[k + 1], b: d[k + 2],
          sx: 1068 + Math.cos(ang) * 250 * rad, sy: 945 + Math.sin(ang) * 36 * rad,
          delay: (1 - (GIRL.y + y) / H) * 950 + Math.random() * 320, sw: (Math.random() - .5) * 120, ph: Math.random() * 6.28,
          size: 1.6 + Math.random() * 2.2 });
      }
      this.parts = out;
    } catch (e) { this.parts = []; }
  }

  // ---------- рисование ----------
  _topY(x) { return SCREEN.tl + (SCREEN.tr - SCREEN.tl) * (x - SCREEN.l) / (SCREEN.r - SCREEN.l); }
  _botY(x) { return SCREEN.bl + (SCREEN.br - SCREEN.bl) * (x - SCREEN.l) / (SCREEN.r - SCREEN.l); }
  _screenOff(edge, alpha) {
    const c = this.ctx;
    if (alpha <= 0 || edge >= SCREEN.r) return;
    const x0 = Math.max(SCREEN.l, edge);
    c.save(); c.filter = 'blur(5px)';
    c.beginPath(); c.moveTo(x0, this._topY(x0) - 6); c.lineTo(SCREEN.r + 6, this._topY(SCREEN.r) - 6); c.lineTo(SCREEN.r + 6, this._botY(SCREEN.r) + 6); c.lineTo(x0, this._botY(x0) + 6); c.closePath();
    c.fillStyle = 'rgba(2,9,15,' + alpha.toFixed(3) + ')'; c.fill(); c.restore();
    if (edge > SCREEN.l && edge < SCREEN.r) {
      const g = c.createLinearGradient(edge - 26, 0, edge + 4, 0);
      g.addColorStop(0, 'rgba(90,230,250,0)'); g.addColorStop(.85, 'rgba(150,245,255,.55)'); g.addColorStop(1, 'rgba(230,255,255,.95)');
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g;
      c.fillRect(edge - 26, this._topY(edge) - 4, 30, this._botY(edge) - this._topY(edge) + 8); c.restore();
    }
  }
  _ringOff(alpha) {
    if (alpha <= 0) return;
    const c = this.ctx;
    c.save(); c.filter = 'blur(16px)';
    c.beginPath(); c.ellipse(RING.x, RING.y, RING.rx, RING.ry, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(2,8,14,' + (alpha * .93).toFixed(3) + ')'; c.fill(); c.restore();
  }

  _drawEmpty() {
    const c = this.ctx;
    c.drawImage(this.plate, 0, 0, W, H);
    this._screenOff(SCREEN.l, .9); this._ringOff(1);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H);
  }

  _drawIntro(now) {
    const c = this.ctx, e = now - this.introT0;
    c.drawImage(this.plate, 0, 0, W, H);
    const board = clamp01((e - T.board[0]) / (T.board[1] - T.board[0]));
    const flick = board > 0 && board < 1 ? (Math.random() < .12 ? .25 : 0) : 0;
    this._screenOff(SCREEN.l + (SCREEN.r - SCREEN.l + 30) * ease(board), .9 - flick);
    if (board > 0) boardFx(c, now, board * board);
    this._ringOff(1 - ease(clamp01((e - T.ring[0]) / (T.ring[1] - T.ring[0]))));
    const girlA = ease(clamp01((e - T.girl[0]) / (T.girl[1] - T.girl[0])));
    if (this.parts && this.parts.length && girlA < 1) {   // частицы летят с платформы и собираются в девушку
      c.save(); c.globalAlpha = 1 - girlA;
      for (const p of this.parts) {
        const k = clamp01((e - T.fly[0] - p.delay) / T.fly[1]);
        if (k <= 0) continue;
        const q = ease(k), inv = 1 - q;
        const x = p.sx + (p.tx - p.sx) * q + Math.sin(p.ph + k * 7) * p.sw * inv;
        const y = p.sy + (p.ty - p.sy) * q;
        const m = clamp01((k - .55) / .45);
        c.fillStyle = 'rgb(' + (90 + (p.r - 90) * m | 0) + ',' + (230 + (p.g - 230) * m | 0) + ',' + (255 + (p.b - 255) * m | 0) + ')';
        const s = p.size * (1 + inv * 1.4);
        c.fillRect(x - s / 2, y - s / 2, s, s);
      }
      c.restore();
    }
    if (girlA > 0) {
      c.save(); c.globalAlpha = girlA; c.drawImage(this.girl, GIRL.x, GIRL.y); c.restore();
      if (girlA < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - girlA) * .35; c.drawImage(this.girl, GIRL.x, GIRL.y); c.restore(); }
    }
    const hall = ease(clamp01((e - T.hall[0]) / (T.hall[1] - T.hall[0])));
    if (hall < 1) { c.fillStyle = 'rgba(0,0,0,' + (1 - hall).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
    if (e > T.end) {
      this.live();
      const f = this.onLive; this.onLive = null; if (f) f();
    }
  }

  _drawMouth(open, rnd) {
    const c = this.ctx, D = OPEN_PX * open;
    if (D < .15) return;
    const lift = D * .13;
    const xa = this._quad(.02 + .17 * rnd).x, xb = this._quad(.98 - .17 * rnd).x;
    const pw = .55 - .2 * rnd;
    const prof = x => { const u = (x - xa) / (xb - xa); return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), pw); };
    const N = 32, top = [], bot = [];
    for (let i = 0; i <= N; i++) { const x = xa + (xb - xa) * i / N, y = this._lineY(x), f = prof(x); top.push({ x, y: y - lift * f }); bot.push({ x, y: y + D * f }); }
    const shape = () => { c.beginPath(); c.moveTo(top[0].x, top[0].y); top.forEach(q => c.lineTo(q.x, q.y)); for (let i = N; i >= 0; i--) c.lineTo(bot[i].x, bot[i].y); c.closePath(); };
    c.save(); shape();
    const cav = c.createLinearGradient(0, MOUTH.y0 - lift, 0, MOUTH.cy + D);
    cav.addColorStop(0, '#16060A'); cav.addColorStop(.55, '#33101A'); cav.addColorStop(1, '#5E2228');
    c.fillStyle = cav; c.fill(); c.clip();
    if (D > 1.5) {   // верхние зубы
      const th = Math.min(D * .34, 3.2), a = Math.round(N * .1), b = Math.round(N * .9);
      c.beginPath();
      for (let i = a; i <= b; i++) { const q = top[i]; i === a ? c.moveTo(q.x, q.y - 2) : c.lineTo(q.x, q.y - 2); }
      for (let i = b; i >= a; i--) { const q = top[i]; const s = Math.sin(Math.PI * (i - a) / (b - a)); c.lineTo(q.x, q.y + th * (.35 + .65 * s)); }
      c.closePath();
      const tg = c.createLinearGradient(0, MOUTH.cy - lift - 6, 0, MOUTH.cy - lift + th);
      tg.addColorStop(0, '#9C8C86'); tg.addColorStop(.45, '#E6DDD7'); tg.addColorStop(1, '#D3C7C1');
      c.fillStyle = tg; c.fill();
      const sg = c.createLinearGradient(xa, 0, xb, 0);
      sg.addColorStop(0, 'rgba(20,6,8,.85)'); sg.addColorStop(.22, 'rgba(20,6,8,0)'); sg.addColorStop(.78, 'rgba(20,6,8,0)'); sg.addColorStop(1, 'rgba(20,6,8,.85)');
      c.fillStyle = sg; c.fillRect(xa, MOUTH.y0 - 10, xb - xa, 30);
    }
    if (D > 5) {     // язык на широких гласных
      c.beginPath(); c.ellipse(MOUTH.cx, this._lineY(MOUTH.cx) + D * 1.12, 13, D * .34, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(150,60,68,' + Math.min(.55, (D - 5) / 4.5).toFixed(2) + ')'; c.fill();
    }
    shape(); c.strokeStyle = 'rgba(70,20,26,.55)'; c.lineWidth = 1.3; c.stroke();
    c.restore();
    for (let sx = 0; sx < JAW.w; sx += 1) {          // нижняя губа и подбородок
      const d = D * prof(JAW.x + sx + .5); if (d < .03) continue;
      c.drawImage(this.jaw, sx, 0, 1, JAW.h, JAW.x + sx - .2, JAW.y + d, 1.4, JAW.h - d * .62);
    }
    for (let sx = 0; sx < UP.w; sx += 1) {           // верхняя губа
      const l = lift * prof(UP.x + sx + .5); if (l < .03) continue;
      c.drawImage(this.upper, sx, 0, 1, UP.h, UP.x + sx - .2, UP.y - l, 1.4, UP.h);
    }
  }

  _drawLids(lid) {
    if (lid < .02) return;
    const c = this.ctx;
    this.lids.forEach(L => {
      const cover = L.h * Math.min(1, lid * 1.05);
      c.drawImage(L.c, 0, 0, L.w, cover, L.x, L.y, L.w, cover);
      if (lid > .5) {
        const yy = L.y + cover - 1.5;
        c.beginPath(); c.moveTo(L.x + 5, yy - 1); c.quadraticCurveTo(L.x + L.w / 2, yy + 2.5, L.x + L.w - 5, yy - 1);
        c.strokeStyle = 'rgba(30,18,15,' + (.75 * (lid - .5) * 2).toFixed(2) + ')'; c.lineWidth = 1.3; c.lineCap = 'round'; c.stroke();
      }
    });
  }

  // жесты: рука плавно «объясняет», корпус чуть наклоняется и кивает
  _gestures(now) {
    const G = this.g, s = now / 1000, talking = this.state === 'speaking';
    const POSES = [[-5, 0], [4, -1], [11, -2], [1, 1], [14, -2.5], [-3, .5], [8, -1.5]];
    G.amp += ((talking ? 1 : 0) - G.amp) * .04;
    if (talking && now > G.next) {
      const p = POSES[Math.floor(Math.random() * POSES.length)];
      G.tAng = p[0]; G.tLift = p[1]; G.tRot = (Math.random() - .5) * .9;
      G.next = now + 650 + Math.random() * 700;
    }
    if (!talking) { G.tAng = 0; G.tLift = 0; G.tRot = 0; }
    G.ang += (G.tAng - G.ang) * .045; G.lift += (G.tLift - G.lift) * .045; G.rot += (G.tRot - G.rot) * .03;
    G.nod += ((this.open > .55 ? 1 : 0) - G.nod) * .08;
    G.breath = Math.sin(s * 1.25);
    G.sway = Math.sin(s * .5) * .15 + Math.sin(s * .23 + 1) * .1;
  }
  _bodyTransform() {
    const G = this.g, c = this.ctx;
    const rot = (G.sway + G.rot * G.amp - G.nod * .3 * G.amp) * Math.PI / 180;
    const dy = G.breath * 1.3 - G.nod * 1.5 * G.amp;
    c.translate(BODY.px, BODY.py + dy); c.rotate(rot); c.translate(-BODY.px, -BODY.py);
  }
  _drawHand(now) {
    const s = now / 1000, G = this.g, c = this.ctx;
    const ang = G.ang * G.amp + Math.sin(s * 1.3) * (1.2 + 1.3 * G.amp) + Math.sin(s * 2.9 + .7) * .8 * G.amp;
    const dy = G.lift * G.amp + Math.sin(s * 1.25) * .8;
    c.save();
    c.translate(HAND.px, HAND.py); c.rotate(-ang * Math.PI / 180); c.translate(-HAND.px, -HAND.py + dy);
    c.drawImage(this.hand, HAND.x, HAND.y);
    c.restore();
  }

  _drawSparks(now) {
    const dt = Math.min(.05, (now - this.lastNow) / 1000); this.lastNow = now;
    const c = this.ctx;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      p.y -= p.v * dt; if (p.y < 760) { p.y = 940; p.x = 900 + Math.random() * 340; }
      const al = (.35 + .35 * Math.sin(now / 260 + p.ph)) * clamp01((p.y - 760) / 120);
      c.fillStyle = 'rgba(120,235,255,' + al.toFixed(3) + ')'; c.fillRect(p.x, p.y, p.s, p.s);
    }
    c.restore();
  }

  _frame(t) {
    requestAnimationFrame(tt => this._frame(tt));
    if (!this.ready) return;
    if (this.mode === 'empty') return this._drawEmpty();
    if (this.mode === 'intro') return this._drawIntro(t);
    // губы: открываются быстро, закрываются чуть медленнее — как у живого человека
    this.open += (this.tOpen - this.open) * (this.tOpen > this.open ? .5 : .28);
    this.round += (this.tRound - this.round) * .25;
    if (this.open < .006 && this.tOpen === 0) this.open = 0;
    let lid = 0;
    if (this.blinkT < 0 && t > this.nextBlink) this.blinkT = t;
    if (this.blinkT >= 0) {
      const k = t - this.blinkT;
      lid = k < 70 ? k / 70 : k < 110 ? 1 : k < 200 ? 1 - (k - 110) / 90 : 0;
      if (k >= 200) { this.blinkT = -1; this.nextBlink = t + 2200 + Math.random() * 3800; if (Math.random() < .15) this.nextBlink = t + 260; }
    }
    this._gestures(t);
    const c = this.ctx;
    c.drawImage(this.plate, 0, 0, W, H);
    boardFx(c, t, 1);
    c.save();
    this._bodyTransform();
    c.drawImage(this.body, BODY.x, BODY.y);
    this._drawMouth(this.open, this.round);
    this._drawLids(lid);
    this._drawHand(t);
    c.restore();
    this._drawSparks(t);
  }
}

/* Запасной вариант, когда звук идёт из браузера (нет доступа к сигналу):
   губы двигаются по буквам текста. */
export function textVisemes(text, rate = 1) {
  const UNIT = 66 / rate, out = []; let t = 0;
  const v = ch => {
    const c = ch.toLowerCase();
    if ('аәяa'.includes(c)) return [.95, 0, 1.35];
    if ('оөуұүюёou'.includes(c)) return [.62, 1, 1.3];
    if ('еэіиыei'.includes(c)) return [.5, 0, 1.15];
    if ('мбпmbp'.includes(c)) return [0, 0, .95];
    if (/[\p{L}\d]/u.test(c)) return [.28, 0, .8];
    if (/\s/.test(c)) return [.06, 0, .55];
    if (/[,;:—–-]/.test(c)) return [0, 0, 3.2];
    if (/[.!?…]/.test(c)) return [0, 0, 4.6];
    return [.05, 0, .4];
  };
  for (const ch of text) { const [o, r, d] = v(ch); out.push({ t0: t, t1: t + d * UNIT, o, r }); t += d * UNIT; }
  return { tl: out, total: t, at(ms) {
    if (ms < 0 || ms > t) return { o: 0, r: 0 };
    let lo = 0, hi = out.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (out[m].t1 < ms) lo = m + 1; else hi = m; }
    return { o: out[lo].o, r: out[lo].r };
  } };
}
