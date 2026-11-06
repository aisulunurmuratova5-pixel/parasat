/* AI ПАРАСАТ — кинематографиялық кіріспе (2 экран).
   1) «ЖҮЙЕНІ ІСКЕ ҚОСУ» картасы  2) зертхана, жүктелу, SYSTEM ONLINE.
   Соңында бет «cine-done» оқиғасын алады да, аватардың өз кіріспесі басталады.
   Батырманы басқанда «cine-start» оқиғасы жіберіледі (толық экран, дыбыс). */
(() => {
  'use strict';
  const me = document.currentScript;
  const LAB = (me && me.dataset.lab) || 'lab.jpg';
  const HOLD_MS = 1800;           // SYSTEM ONLINE экранда қанша тұрады

  const root = document.createElement('main');
  root.className = 'intro'; root.id = 'cine';
  root.innerHTML = `
    <div class="grain" aria-hidden="true"></div>
    <div class="ambient ambient-one" aria-hidden="true"></div>
    <div class="ambient ambient-two" aria-hidden="true"></div>
    <header class="topline">
      <div class="brand"><span class="brand-mark">✧</span><span>AI ПАРАСАТ</span></div>
      <div class="top-status"><i></i> ЖҮЙЕ ЖАҒДАЙЫ: <b id="cineState">КҮТУДЕ</b></div>
    </header>
    <section class="lab-scene" aria-label="AI Парасат жүйесінің іске қосылуы">
      <img class="lab-bg" src="${LAB}" alt="">
      <div class="lab-shade"></div>
      <div class="scanlines"></div>
      <div class="light-beam beam-left"></div>
      <div class="light-beam beam-right"></div>
      <div class="hud hud-left">
        <span>ЖҮЙЕЛІК ТАЛДАУ</span>
        <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <small>ДЕРЕКТЕР АҒЫНЫ <b>98.7%</b></small>
      </div>
      <div class="hud hud-right">
        <span>AI CORE</span><div class="core-mini">✧</div>
        <small>ЖЕЛІ ҚОСЫЛУЫ <b>ОРНЫҚТЫ</b></small>
      </div>
      <div class="center-ring" aria-hidden="true">
        <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
        <div class="ring-core">AI</div>
        <div class="orbit-dot dot-one"></div><div class="orbit-dot dot-two"></div>
      </div>
      <div class="startup-copy">
        <p id="cineBoot">ЖҮЙЕ ІСКЕ ҚОСЫЛУДА...</p>
        <div class="progress"><i id="cineFill"></i></div>
        <small id="cinePct">0%</small>
      </div>
      <div class="floor-glow"></div>
      <div class="flash" id="cineFlash"></div>
    </section>
    <div class="online-message" id="cineOnline" aria-live="polite">
      <span class="online-check">✓</span>
      <b>SYSTEM ONLINE</b>
      <span>AI ПАРАСАТ ЖҮЙЕСІ ДАЙЫН</span>
    </div>
    <div class="start-overlay" id="cineOverlay">
      <canvas class="start-bg" id="cineBg" aria-hidden="true"></canvas>
      <div class="start-card">
        <div class="start-symbol">✧</div>
        <div class="start-label">БІЛІМНІҢ ЖАҢА ӨЛШЕМІ</div>
        <h2 class="galaxy"><span class="g1" data-t="Парасат апталығына">Парасат апталығына</span><span class="g2" data-t="қош келдіңіздер!">қош келдіңіздер!</span><i class="spark s1">✦</i><i class="spark s2">✦</i><i class="spark s3">✧</i><i class="spark s4">✦</i></h2>
        <p>Футуристік жүйені іске қосуға дайынсыз ба?</p>
        <button id="cineStart" type="button">ЖҮЙЕНІ ІСКЕ ҚОСУ <span>↗</span></button>
        <small>Жүйені іске қосу үшін басыңыз</small>
      </div>
    </div>
    <button class="sound-control" id="cineSound" type="button" aria-label="Дыбысты өшіру" title="Дыбыс">♫ <span>ДЫБЫС ҚОСУЛЫ</span></button>
    <footer class="bottom-hint"><span id="cineStep">01 / 02</span><span>ПАРАСАТПЕН БІРГЕ БОЛАШАҚҚА!</span><span>ҚАЗАҚША AI</span></footer>`;
  document.body.appendChild(root);

  const $ = id => document.getElementById(id);
  const state = $('cineState'), bootText = $('cineBoot'), fill = $('cineFill'), pct = $('cinePct');
  const online = $('cineOnline'), flash = $('cineFlash'), overlay = $('cineOverlay'), soundBtn = $('cineSound');


  /* бастапқы беттің фоны: айналатын спираль галактика, тұмандықтар, жыпылықтаған жұлдыздар, құйрықты жұлдыз */
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600;1,700&family=Unbounded:wght@400;600;700&display=swap';
  document.head.appendChild(fontLink);

  const bgc = $('cineBg'), bx = bgc.getContext('2d');
  let bgOn = true, W = 0, H = 0, field = [], gal = [], neb = null, meteor = null, nextMeteor = 2500, skyFill = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function buildGalaxy() {
    const R = Math.max(W, H) * .62, ARMS = 3, N = 14000;
    gal = Array.from({ length: N }, () => {
      const t = Math.pow(Math.random(), 1.6);              // ядрода тығызырақ
      const r = t * R;
      const arm = Math.floor(Math.random() * ARMS);
      const th = arm / ARMS * Math.PI * 2 + t * 5.2 + gauss() * (.35 - .2 * t);
      const hue = t < .12 ? rnd(35, 55) : Math.random() < .55 ? rnd(195, 225) : rnd(265, 320);
      const light = t < .12 ? rnd(80, 95) : rnd(65, 88);
      return { r: r + gauss() * R * .025, th, size: t < .1 ? rnd(.6, 1.6) : rnd(.4, 1.5), col: `hsla(${hue},90%,${light}%,`, a: rnd(.35, .95), tw: rnd(0, 6.28) };
    });
    // тұмандықтар — бір рет салынады, сосын тек айналады
    neb = document.createElement('canvas'); neb.width = neb.height = Math.round(R * 2.2);
    const n = neb.getContext('2d'), c = neb.width / 2;
    n.globalCompositeOperation = 'lighter';
    const cols = ['rgba(120,60,220,', 'rgba(40,140,255,', 'rgba(230,70,170,', 'rgba(30,200,220,'];
    for (let i = 0; i < 900; i++) {
      const t = Math.pow(Math.random(), .8), arm = Math.floor(Math.random() * ARMS);
      const th = arm / ARMS * Math.PI * 2 + t * 5.2 + gauss() * .16, r = t * R;
      const x = c + Math.cos(th) * r, y = c + Math.sin(th) * r, rad = rnd(.025, .075) * R * (1 - t * .4);
      const g = n.createRadialGradient(x, y, 0, x, y, rad), col = cols[i % cols.length];
      g.addColorStop(0, col + (.11 * (1 - t * .5)).toFixed(3) + ')'); g.addColorStop(1, col + '0)');
      n.fillStyle = g; n.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    n.globalCompositeOperation = 'lighter';
    for (const p of gal) {                                   // жұлдыздарды бір рет салып қоямыз
      n.fillStyle = p.col + p.a.toFixed(3) + ')';
      n.fillRect(c + Math.cos(p.th) * p.r, c + Math.sin(p.th) * p.r, p.size * 1.15, p.size * 1.15);
    }
    const core = n.createRadialGradient(c, c, 0, c, c, R * .22);
    core.addColorStop(0, 'rgba(255,244,220,1)'); core.addColorStop(.2, 'rgba(255,205,150,.55)'); core.addColorStop(1, 'rgba(255,170,120,0)');
    n.fillStyle = core; n.fillRect(c - R * .22, c - R * .22, R * .44, R * .44);
  }
  function sizeBg() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = bgc.clientWidth; H = bgc.clientHeight;
    bgc.width = W * dpr; bgc.height = H * dpr; bx.setTransform(dpr, 0, 0, dpr, 0, 0);
    field = Array.from({ length: Math.round(W * H / 3200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < .93 ? rnd(.3, 1) : rnd(1, 1.9), p: rnd(0, 6.28), s: rnd(.6, 2.2) }));
    skyFill = null; buildGalaxy();
  }
  function drawBg(t) {
    if (!bgOn) return;
    requestAnimationFrame(drawBg);
    const s = t / 1000;
    // терең ғарыш
    if (!skyFill) { skyFill = bx.createRadialGradient(W * .5, H * .5, 0, W * .5, H * .5, Math.max(W, H) * .8);
      skyFill.addColorStop(0, '#0d1236'); skyFill.addColorStop(.55, '#070a24'); skyFill.addColorStop(1, '#020310'); }
    bx.fillStyle = skyFill; bx.fillRect(0, 0, W, H);
    // алыс жұлдыздар
    for (const p of field) {
      bx.fillStyle = `rgba(220,235,255,${(.35 + .55 * Math.abs(Math.sin(s * p.s + p.p))).toFixed(3)})`;
      bx.fillRect(p.x, p.y, p.r, p.r);
    }
    // галактика: қисайтылған, баяу айналады
    const cx = W * .5, cy = H * .52, tilt = -.42, flat = .46, spin = s * .02;
    bx.save(); bx.translate(cx, cy); bx.rotate(tilt); bx.scale(1, flat);
    bx.globalCompositeOperation = 'lighter';
    bx.rotate(spin); bx.drawImage(neb, -neb.width / 2, -neb.height / 2);
    bx.restore();
    // құйрықты жұлдыз
    if (!meteor && t > nextMeteor) { meteor = { x: rnd(W * .1, W * .9), y: rnd(0, H * .4), vx: rnd(-9, -5), vy: rnd(3, 5), life: 0 }; }
    if (meteor) {
      meteor.x += meteor.vx; meteor.y += meteor.vy; meteor.life++;
      const g = bx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 14, meteor.y - meteor.vy * 14);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(140,200,255,0)');
      bx.strokeStyle = g; bx.lineWidth = 1.6; bx.beginPath(); bx.moveTo(meteor.x, meteor.y); bx.lineTo(meteor.x - meteor.vx * 14, meteor.y - meteor.vy * 14); bx.stroke();
      if (meteor.life > 70) { meteor = null; nextMeteor = t + rnd(3500, 8000); }
    }
  }
  sizeBg(); window.addEventListener('resize', sizeBg); requestAnimationFrame(drawBg);

  let ac = null, master = null, soundOn = true, started = false;
  function audio() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!ac) { ac = new C(); master = ac.createGain(); master.gain.value = soundOn ? .72 : 0; master.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, dur, o = {}) {
    if (!soundOn) return; const c = audio(); if (!c) return;
    const { type = 'sine', volume = .045, delay = 0, endFrequency = f } = o;
    const osc = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + Math.min(.12, dur / 3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + .03);
  }
  function sweep(dur = 1.6) {
    if (!soundOn) return; const c = audio(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, i / (c.sampleRate * .18)) * Math.max(0, 1 - i / n);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(180, c.currentTime); fl.frequency.exponentialRampToValueAtTime(2400, c.currentTime + dur * .8);
    g.gain.value = .075; s.connect(fl); fl.connect(g); g.connect(master); s.start();
  }
  function startupSound() {
    sweep(2.1); tone(48, 2.4, { type: 'sawtooth', volume: .025, endFrequency: 92 });
    [82, 110, 164.81, 220, 329.63].forEach((f, i) => tone(f, 1.15, { volume: .025, delay: .18 + i * .2, endFrequency: f * 1.015 }));
    tone(440, .7, { volume: .025, delay: 1.2, endFrequency: 660 });
  }
  function doneSound() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, .65, { volume: .04, delay: i * .13 })); }
  function setSoundBtn() {
    soundBtn.classList.toggle('muted', !soundOn);
    soundBtn.innerHTML = soundOn ? '♫ <span>ДЫБЫС ҚОСУЛЫ</span>' : '♪ <span>ДЫБЫС ӨШІРУЛІ</span>';
    if (master && ac) master.gain.setTargetAtTime(soundOn ? .72 : 0, ac.currentTime, .08);
  }

  function finish() {
    state.textContent = 'ONLINE';
    bootText.textContent = 'ЖҮЙЕ СӘТТІ ІСКЕ ҚОСЫЛДЫ';
    root.classList.add('online');
    flash.classList.add('flash-active'); setTimeout(() => flash.classList.remove('flash-active'), 850);
    online.classList.add('visible'); doneSound();
    $('cineStep').textContent = '02 / 02';
    setTimeout(() => {
      root.classList.add('done');
      window.dispatchEvent(new CustomEvent('cine-done'));
    }, HOLD_MS);
  }

  function begin() {
    if (started) return; started = true;
    audio();
    window.dispatchEvent(new CustomEvent('cine-start'));
    overlay.classList.add('hidden'); root.classList.add('booting');
    setTimeout(() => { bgOn = false; }, 1000);
    state.textContent = 'ЖҮКТЕЛУДЕ'; startupSound();
    const stages = [{ at: 20, text: 'ҚУАТ КӨЗІ ҚОСЫЛДЫ' }, { at: 45, text: 'ДЕРЕКТЕР АҒЫНЫ ІСКЕ ҚОСЫЛДЫ' },
      { at: 72, text: 'ГОЛОГРАФИЯЛЫҚ ЖҮЙЕ ДАЙЫН' }, { at: 100, text: 'ЖҮЙЕ СӘТТІ ІСКЕ ҚОСЫЛДЫ' }];
    let p = 0, si = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + 1); fill.style.width = p + '%'; pct.textContent = p + '%';
      while (si < stages.length && p >= stages[si].at) {
        bootText.textContent = stages[si].text;
        if (stages[si].at !== 100) tone(260 + si * 90, .18, { volume: .025, type: 'triangle' });
        si++;
      }
      if (p >= 100) { clearInterval(timer); setTimeout(finish, 450); }
    }, 48);
  }

  $('cineStart').addEventListener('click', begin);
  soundBtn.addEventListener('click', () => { soundOn = !soundOn; if (soundOn) audio(); setSoundBtn(); });
  setSoundBtn();

  /* қайта көрсету: window.cineReplay() */
  window.cineReplay = () => {
    started = false; root.className = 'intro'; online.classList.remove('visible');
    overlay.classList.remove('hidden'); fill.style.width = '0%';
    if (!bgOn) { bgOn = true; sizeBg(); requestAnimationFrame(drawBg); } pct.textContent = '0%';
    bootText.textContent = 'ЖҮЙЕ ІСКЕ ҚОСЫЛУДА...'; state.textContent = 'КҮТУДЕ'; $('cineStep').textContent = '01 / 02';
  };
})();
