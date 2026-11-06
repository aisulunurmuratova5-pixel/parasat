/* PARASAT: микрофон → сервер (Claude) → голос → губы.
   Работает в Chrome на http://127.0.0.1:8000 (на localhost браузер разрешает микрофон). */
import { Avatar, textVisemes } from '/static/avatar.js';

const $ = s => document.querySelector(s);
const avatar = new Avatar($('#face'));

const CHIPS = [
  'Өзіңді таныстыршы',
  'Парасаттылық деген не?',
  'Жасанды интеллект мұғалімді алмастыра ма?',
  'Абайдың «толық адам» ілімі деген не?',
  'Жалған ақпаратты қалай тануға болады?',
  'Студенттерге ақыл-кеңес айтшы',
];
const STATUS = {
  idle: 'Микрофонды басып, сұрақ қойыңыз',
  listening: 'Тыңдап тұрмын…',
  thinking: 'Ойланып жатырмын…',
  speaking: 'Жауап беріп тұрмын',
};

let state = 'idle';
function setState(s) {
  state = s; document.body.dataset.state = s; avatar.setState(s);
  $('#statusText').textContent = STATUS[s];
}

let toastT;
function toast(msg, ms = 5000) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}

/* ------------------------------------------------------------ волна ---- */
const BARS = 40;
const wave = $('#wave');
for (let i = 0; i < BARS; i++) wave.appendChild(document.createElement('i'));
const bars = [...wave.children];
function drawWave(levels) {
  for (let i = 0; i < BARS; i++) bars[i].style.height = (4 + Math.min(1, levels ? levels[i] : 0) * 30).toFixed(1) + 'px';
}

/* ------------------------------------------------------------ аудио ---- */
let ac = null, outAnalyser = null, outGain = null;
function ensureAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  outAnalyser = ac.createAnalyser(); outAnalyser.fftSize = 1024; outAnalyser.smoothingTimeConstant = .5;
  outGain = ac.createGain(); outGain.gain.value = 1;
  outAnalyser.connect(outGain); outGain.connect(ac.destination);
}

const queue = new Map();       // seq → сообщение speak
let nextSeq = 0, playing = null, doneReceived = false, awaitingReset = false;
let fallbackLip = null, fallbackStart = 0;

function stopPlayback() {
  queue.clear(); nextSeq = 0; doneReceived = false;
  if (playing && playing.stop) { try { playing.stop(); } catch (e) {} }
  playing = null; fallbackLip = null;
  try { speechSynthesis.cancel(); } catch (e) {}
}

function b64ToBuf(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

async function pump() {
  if (playing || !queue.has(nextSeq)) {
    if (!playing && doneReceived && queue.size === 0) finishTurn();
    return;
  }
  const msg = queue.get(nextSeq); queue.delete(nextSeq); nextSeq++;
  setState('speaking');
  if (msg.b64) {
    const pending = { stop() {} };
    playing = pending;               // пока MP3 декодируется, очередь занята
    try {
      ensureAudio();
      const buf = await ac.decodeAudioData(b64ToBuf(msg.b64));
      if (playing !== pending) return;   // успели нажать «Тоқтату»
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(outAnalyser);
      playing = src;
      src.onended = () => { if (playing === src) { playing = null; pump(); } };
      src.start();
      return;
    } catch (e) {
      console.warn('MP3 не декодировался, говорю голосом браузера', e);
      if (playing !== pending) return;
      playing = null;
    }
  }
  speakWithBrowser(msg.text);
}

/* Если сервер не смог синтезировать голос (нет интернета) — говорит браузер */
function speakWithBrowser(text) {
  const silent = () => {            // голоса нет вообще: губы двигаются по тексту без звука
    fallbackLip = textVisemes(text, 1); fallbackStart = performance.now();
    const token = { stop() { fallbackLip = null; } }; playing = token;
    setTimeout(() => { if (playing === token) { playing = null; fallbackLip = null; pump(); } }, fallbackLip.total + 150);
  };
  if (!('speechSynthesis' in window)) return silent();
  const u = new SpeechSynthesisUtterance(text);
  const vs = speechSynthesis.getVoices();
  const v = vs.find(x => /^kk/i.test(x.lang)) || vs.find(x => /^ru/i.test(x.lang));
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'kk-KZ';
  let began = false;
  const token = { stop() { speechSynthesis.cancel(); } };
  playing = token;
  u.onstart = () => { began = true; fallbackLip = textVisemes(text, u.rate || 1); fallbackStart = performance.now(); };
  u.onboundary = e => { if (fallbackLip && e.charIndex != null && fallbackLip.tl[e.charIndex]) fallbackStart = performance.now() - fallbackLip.tl[e.charIndex].t0; };
  u.onend = u.onerror = () => { if (playing !== token) return; if (!began) { playing = null; return silent(); } playing = null; fallbackLip = null; pump(); };
  try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { playing = null; return silent(); }
  setTimeout(() => { if (playing === token && !began) { speechSynthesis.cancel(); playing = null; silent(); } }, 3000);
}

function finishTurn() {
  doneReceived = false;
  clearTimeout(capT); capT = setTimeout(() => { if (state === 'idle') document.body.classList.remove('caps'); }, 12000);
  if (state === 'speaking' || state === 'thinking') setState('idle');
  if ($('#handsFree').checked && started) setTimeout(() => { if (state === 'idle' && !playing) startListening(); }, 500);
}

/* Chrome/Edge озвучивают только после клика: «будим» голос браузера прямо в клике */
function primeVoice() {
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) {}
}

/* ------------------------------------------------- губы по звуку ------ */
const td = new Float32Array(1024), fd = new Uint8Array(512);
let micAnalyser = null;
function lipLoop() {
  requestAnimationFrame(lipLoop);
  let levels = null;
  if (playing && playing.buffer && outAnalyser) {
    outAnalyser.getFloatTimeDomainData(td);
    let sum = 0; for (let i = 0; i < td.length; i++) sum += td[i] * td[i];
    const rms = Math.sqrt(sum / td.length);
    outAnalyser.getByteFrequencyData(fd);
    let low = 0, high = 0;
    for (let i = 6; i < 22; i++) low += fd[i];
    for (let i = 32; i < 86; i++) high += fd[i];
    low /= 16; high /= 54;
    const open = Math.min(1, Math.sqrt(Math.max(0, rms - .008)) * 2.6);
    const round = open > .2 ? Math.max(0, Math.min(1, (low / (high + 1) - 1.6) / 2.2)) : 0;
    avatar.setMouth(open, round);
    levels = bars.map((_, i) => fd[2 + Math.floor(i * 2.2)] / 255);
  } else if (fallbackLip) {
    const s = fallbackLip.at(performance.now() - fallbackStart);
    avatar.setMouth(s.o, s.r);
    levels = bars.map((_, i) => s.o * (.4 + .6 * Math.abs(Math.sin(i * .7 + performance.now() / 120))));
  } else {
    avatar.setMouth(0, 0);
    if (micAnalyser && state === 'listening') {
      micAnalyser.getByteFrequencyData(fd);
      levels = bars.map((_, i) => Math.min(1, fd[2 + Math.floor(i * 2.2)] / 200));
    }
  }
  drawWave(levels);
}
requestAnimationFrame(lipLoop);

/* --------------------------------------------------------- сервер ---- */
let ws = null, wsReady = false, demo = false;
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => { wsReady = true; $('#live').classList.add('on'); $('#liveText').textContent = 'LIVE'; };
  ws.onclose = () => {
    wsReady = false; $('#live').classList.remove('on'); $('#liveText').textContent = 'Байланыс жоқ';
    setTimeout(connect, 1500);
  };
  ws.onmessage = e => onServer(JSON.parse(e.data));
}
function send(obj) {
  if (!wsReady) { toast('Сервермен байланыс жоқ. server.py іске қосылғанын тексеріңіз.'); return false; }
  ws.send(JSON.stringify(obj)); return true;
}

let herText = '', capT = 0;
function onServer(m) {
  if (m.type === 'hello') { demo = m.demo; return; }
  if (m.type === 'state') { if (m.state === 'thinking') setState('thinking'); return; }
  if (m.type === 'text') {
    if (m.reset) { awaitingReset = false; stopPlayback(); herText = ''; }
    if (awaitingReset) return;
    herText += m.delta || ''; $('#herText').textContent = herText; if (herText) { clearTimeout(capT); document.body.classList.add('caps'); } return;
  }
  if (m.type === 'speak') { if (awaitingReset) return; queue.set(m.seq, m); pump(); return; }
  if (m.type === 'done') {
    if (awaitingReset && !m.stopped) return;
    if (m.stopped) { awaitingReset = false; stopPlayback(); setState('idle'); return; }
    doneReceived = true; pump(); return;
  }
  if (m.type === 'error') { toast(m.message); }
}

function ask(text) {
  text = (text || '').trim(); if (!text) return;
  if (!started) begin(false);
  if (introRunning) { setTimeout(() => ask(text), 500); return; }
  stopListening(true); stopPlayback();
  $('#youText').textContent = text; $('#herText').textContent = ''; herText = '';
  clearTimeout(capT); document.body.classList.add('caps');
  awaitingReset = true;
  if (send({ type: 'ask', text })) setState('thinking');
}

/* ------------------------------------------------- распознавание ----- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, micStream = null, listenToken = 0;
const sttSel = $('#sttSel');

async function openMicMeter() {
  try {
    ensureAudio();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const src = ac.createMediaStreamSource(micStream);
    micAnalyser = ac.createAnalyser(); micAnalyser.fftSize = 1024; src.connect(micAnalyser);
    return true;
  } catch (e) {
    toast('Микрофонға рұқсат жоқ. Браузердің адрес жолындағы 🔒 белгісін басып, микрофонды рұқсат етіңіз.');
    return false;
  }
}
function closeMic() {
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  micStream = null; micAnalyser = null;
}

async function startListening() {
  if (!started) begin(false);
  if (state === 'listening') return;
  if (playing || state === 'speaking' || state === 'thinking') { send({ type: 'stop' }); stopPlayback(); awaitingReset = false; }
  const token = ++listenToken;
  setState('listening'); $('#youText').textContent = '';
  if (sttSel.value === 'whisper') return listenWhisper(token);
  if (!SR) { toast('Бұл браузерде сөзді тану жоқ. Chrome-ды қолданыңыз немесе «Whisper» әдісін таңдаңыз.'); setState('idle'); return; }
  await openMicMeter();
  if (token !== listenToken) return;
  rec = new SR();
  rec.lang = 'kk-KZ'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    $('#youText').textContent = (finalText + ' ' + interim).trim();
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Микрофонға рұқсат беріңіз (адрес жолындағы белгіше).');
    else if (e.error === 'language-not-supported') toast('Браузер қазақ тілін танымады. «Whisper» әдісін таңдап көріңіз.');
    else if (e.error === 'network') toast('Сөзді тану үшін интернет керек.');
  };
  rec.onend = () => {
    if (token !== listenToken) return;
    rec = null; closeMic();
    const text = finalText.trim();
    if (text) ask(text);
    else { setState('idle'); if ($('#handsFree').checked) setTimeout(() => state === 'idle' && startListening(), 400); }
  };
  try { rec.start(); } catch (e) { setState('idle'); }
}

/* Whisper: пишем звук сами, сами ловим тишину, отправляем на сервер */
async function listenWhisper(token) {
  if (!(await openMicMeter())) { setState('idle'); return; }
  if (token !== listenToken) return closeMic();
  const mr = new MediaRecorder(micStream);
  const chunks = []; mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  let spoke = false, lastLoud = performance.now();
  const t0 = performance.now();
  const buf = new Float32Array(1024);
  const vad = setInterval(() => {
    if (token !== listenToken) { clearInterval(vad); if (mr.state !== 'inactive') mr.stop(); return; }
    micAnalyser.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length), now = performance.now();
    if (rms > .02) { spoke = true; lastLoud = now; }
    if ((spoke && now - lastLoud > 1200) || now - t0 > 15000 || (!spoke && now - t0 > 8000)) { clearInterval(vad); mr.stop(); }
  }, 60);
  mr.onstop = async () => {
    closeMic();
    if (token !== listenToken) return;
    if (!spoke) { setState('idle'); return; }
    setState('thinking'); $('#youText').textContent = '…';
    try {
      const fdata = new FormData(); fdata.append('file', new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), 'rec.webm');
      const r = await fetch('/api/stt', { method: 'POST', body: fdata });
      const j = await r.json();
      if (j.text) ask(j.text); else { toast(j.error || 'Сөз танылмады, қайталап көріңіз.'); setState('idle'); }
    } catch (e) { toast('Whisper жауап бермеді.'); setState('idle'); }
  };
  mr.start();
}

function stopListening(silent) {
  listenToken++;
  if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
  closeMic();
  if (!silent && state === 'listening') setState('idle');
}

/* --------------------------------------------------------- кнопки ---- */
let started = false;
let introRunning = false;
function begin(greet) {
  started = true; ensureAudio(); $('#startBtn').classList.add('gone');
  if (greet) playIntro();
  else if (!introRunning) avatar.live();
}
/* девушка собирается из частиц, включается экран, затем она здоровается */
function playIntro() {
  stopListening(true); stopPlayback(); send({ type: 'stop' });
  document.body.classList.remove('caps'); setState('idle');
  introRunning = true;
  avatar.intro(() => { introRunning = false; awaitingReset = true; send({ type: 'greet' }); });
}
$('#startBtn').onclick = () => begin(true);
/* «ЖҮЙЕНІ ІСКЕ ҚОСУ» → загрузка → SYSTEM ONLINE → девушка собирается из частиц и здоровается */
window.addEventListener('cine-start', () => { ensureAudio(); primeVoice(); document.documentElement.requestFullscreen?.().catch(() => {}); });
window.addEventListener('cine-done', () => { if (!started) begin(true); else playIntro(); });
$('#cineBtn').onclick = () => { stopListening(true); stopPlayback(); send({ type: 'stop' }); setState('idle'); window.cineReplay?.(); };
/* экрандағы голографиялық микрофон: тыңдау / тоқтату */
$('#holoMic').onclick = () => {
  ensureAudio();
  if (state === 'speaking' || state === 'thinking') { stopListening(true); stopPlayback(); send({ type: 'stop' }); setState('idle'); return; }
  state === 'listening' ? stopListening() : startListening();
};
$('#micBtn').onclick = () => { ensureAudio(); state === 'listening' ? stopListening() : startListening(); };
$('#askForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#q').value; $('#q').value = ''; ask(v); });

const chipsEl = $('#chips');
CHIPS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = c; b.onclick = () => ask(c); chipsEl.appendChild(b); });

document.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => {
  const c = b.dataset.cmd;
  if (c === 'entrance') { started = true; ensureAudio(); $('#startBtn').classList.add('gone'); return playIntro(); }
  if (c === 'greet') { if (!started) return begin(true); stopListening(true); stopPlayback(); awaitingReset = true; send({ type: 'greet' }); }
  if (c === 'stop') { stopListening(true); stopPlayback(); send({ type: 'stop' }); setState('idle'); }
  if (c === 'reset') { stopListening(true); stopPlayback(); send({ type: 'reset' }); $('#youText').textContent = ''; $('#herText').textContent = ''; document.body.classList.remove('caps'); setState('idle'); }
});

$('#stageBtn').onclick = () => {
  document.body.classList.add('big');
  document.documentElement.requestFullscreen?.().catch(() => {});
};
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('big'); });

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.shiftKey && e.code === 'KeyS') { document.body.classList.toggle('admin'); e.preventDefault(); return; }
  if (e.code === 'Space') { e.preventDefault(); $('#holoMic').click(); }
  if (e.key === 'Escape') { stopListening(); if (playing) { stopPlayback(); send({ type: 'stop' }); setState('idle'); } }
  if (e.key === 'b' || e.key === 'и') document.body.classList.toggle('big');
});

/* --------------------------------------------------------- старт ---- */
fetch('/api/config').then(r => r.json()).then(cfg => {
  const badge = $('#modeBadge');
  if (cfg.demo) { badge.textContent = 'ДЕМО: .env файлына ANTHROPIC_API_KEY қойыңыз'; badge.classList.add('warn'); }
  else badge.textContent = cfg.model + ' · ' + cfg.voice.replace('Neural', '');
  if (!cfg.whisper) sttSel.querySelector('[value="whisper"]').disabled = true;
  sttSel.value = SR ? 'browser' : (cfg.whisper ? 'whisper' : 'browser');
  if (!SR && !cfg.whisper) toast('Сөзді тану үшін Google Chrome-да ашыңыз.', 8000);
}).catch(() => {});

setState('idle');
connect();
