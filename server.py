"""
PARASAT — говорящий AI-аватар для «Парасат апталығы».

Схема (как в видео: «мозг» + «лицо»):
    микрофон (браузер) → распознавание речи → Claude (ответ, по предложениям)
    → нейронный голос edge-tts (kk-KZ-AigulNeural) → браузер: лицо двигает губами
    в такт реальному звуку.

Запуск:  python server.py   →  откроется http://127.0.0.1:8000
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import re
import threading
import time
import webbrowser
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5").strip()
TTS_VOICE = os.getenv("TTS_VOICE", "kk-KZ-AigulNeural").strip()
TTS_RATE = os.getenv("TTS_RATE", "+0%").strip()
TTS_PITCH = os.getenv("TTS_PITCH", "+0Hz").strip()
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small").strip()
HOST = os.getenv("HOST", "127.0.0.1").strip()
PORT = int(os.getenv("PORT", "8000"))
OPEN_BROWSER = os.getenv("OPEN_BROWSER", "1").strip() == "1"

PERSONA = (ROOT / "persona.md").read_text(encoding="utf-8")
KNOWLEDGE = (ROOT / "knowledge.md").read_text(encoding="utf-8")
SYSTEM_PROMPT = f"{PERSONA}\n\nKNOWLEDGE (facts you can rely on):\n{KNOWLEDGE}"

GREETING = "Сәлеметсіздер ме! Парасат апталығына қош келдіңіздер! Кез келген сұрақтарыңызды қоя беріңіздер."
WHO = ("Мен қазақ тілінде сөйлейтін жасанды интеллектпін. Мені Қазақ ұлттық қыздар педагогикалық "
       "университетінің информатика студенттері жасады.")

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------- Claude ---
claude = None
if API_KEY:
    try:
        from anthropic import AsyncAnthropic

        claude = AsyncAnthropic(api_key=API_KEY)
    except Exception as exc:  # пакет не установлен или ключ кривой
        print(f"[!] Claude недоступен: {exc}")

DEMO = claude is None

# --------------------------------------------------- офлайн-ответы (демо) ---
OFFLINE = [
    (["кімсің", "кімсіз", "атың", "атыңыз", "таныстыр", "кто ты"], WHO),
    (["апталы"], "Парасат апталығы парасаттылық, адалдық, білім мен мейірім сияқты құндылықтарға арналған. "
                 "Бұл күндері біз жақсы істер туралы ойланып, бір-бірімізден үйренеміз."),
    (["алмастыр"], "Жасанды интеллект мұғалімге жақсы көмекші бола алады, бірақ мейірім мен тәрбие адамға ғана тән. "
                   "Сондықтан болашақ мұғалімге оны шебер қолдана білу маңызды."),
    (["толық адам"], "Абай атамыз толық адам деп ақылы, қайраты және жүрегі үйлесім тапқан адамды айтқан. "
                     "Үшеуі қатар жүрсе ғана адам шын мәнінде парасатты болады."),
    (["парасат"], "Парасаттылық дегеніміз ақыл мен арды, білім мен мейірімді қатар ұстау. "
                  "Парасатты адам ойланып сөйлейді және өз сөзіне жауап береді."),
    (["адал"], "Адалдық сенімнің негізі. Сабақта да, интернетте де шындықты айту адалдықтың белгісі."),
    (["жасанды", "интеллект"], "Жасанды интеллектті көмекші ретінде пайдаланыңыз, бірақ ойлауды толық тапсырмаңыз. "
                                "Оның жауабын әрқашан тексеріңіз."),
    (["рақмет", "рахмет", "спасибо"], "Сізге де рақмет! Парасат апталығы сәтті өтсін!"),
    (["сәлем", "салем", "привет"], "Сәлеметсіз бе! Сізге не туралы айтып берейін?"),
]
OFFLINE_DEFAULT = ("Кешіріңіз, қазір мен демо режимде жұмыс істеп тұрмын. Парасаттылық, адалдық немесе "
                   "жасанды интеллект туралы сұрап көріңіз.")


def offline_answer(q: str) -> str:
    t = " " + q.lower() + " "
    best, score = None, 0
    for keys, ans in OFFLINE:
        s = sum(len(k) for k in keys if k in t)
        if s > score:
            best, score = ans, s
    return best or OFFLINE_DEFAULT


# ------------------------------------------------------------------- TTS ---
_tts_cache: dict[str, bytes] = {}
_tts_ok = True


def clean_for_speech(text: str) -> str:
    text = re.sub(r"[*_#`>|]+", " ", text)
    text = re.sub(r"[\U0001F300-\U0001FAFF☀-➿]", "", text)  # эмодзи
    return re.sub(r"\s+", " ", text).strip()


async def synthesize(text: str) -> bytes | None:
    """Текст → MP3 голосом Microsoft Edge (Aigul). None, если нет интернета."""
    global _tts_ok
    text = clean_for_speech(text)
    if not text:
        return None
    key = hashlib.sha1(f"{TTS_VOICE}|{TTS_RATE}|{TTS_PITCH}|{text}".encode()).hexdigest()
    if key in _tts_cache:
        return _tts_cache[key]
    try:
        import edge_tts

        comm = edge_tts.Communicate(text, TTS_VOICE, rate=TTS_RATE, pitch=TTS_PITCH)
        buf = bytearray()
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                buf.extend(chunk["data"])
        if not buf:
            return None
        if len(_tts_cache) > 300:
            _tts_cache.clear()
        _tts_cache[key] = bytes(buf)
        _tts_ok = True
        return bytes(buf)
    except Exception as exc:
        if _tts_ok:
            print(f"[!] edge-tts не сработал ({exc}). Браузер озвучит своим голосом.")
        _tts_ok = False
        return None


# -------------------------------------------------- разбивка на предложения ---
SENT_END = re.compile(r"[.!?…]+[»\")]*\s+")


def pop_sentences(buf: str, first: bool) -> tuple[list[str], str]:
    """Отрезает готовые предложения от начала буфера (для озвучки по кусочкам)."""
    out = []
    min_len = 14 if first else 28
    start = 0
    for m in SENT_END.finditer(buf):
        piece = buf[start:m.end()].strip()
        if len(piece) >= min_len:
            out.append(piece)
            start = m.end()
            min_len = 28
    return out, buf[start:]


# -------------------------------------------------------------- диалог ---
class Conversation:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.history: list[dict] = []
        self.task: asyncio.Task | None = None
        self.send_lock = asyncio.Lock()

    async def send(self, payload: dict):
        async with self.send_lock:
            await self.ws.send_text(json.dumps(payload, ensure_ascii=False))

    def trimmed_history(self) -> list[dict]:
        h = self.history[-12:]
        while h and h[0]["role"] != "user":
            h = h[1:]
        return h

    async def cancel(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except (asyncio.CancelledError, Exception):
                pass
        self.task = None

    # --- озвучка: очередь предложений, синтез идёт параллельно, отправка по порядку
    async def _speaker(self, queue: asyncio.Queue):
        while True:
            item = await queue.get()
            if item is None:
                return
            seq, sentence, job = item
            audio = await job
            msg = {"type": "speak", "seq": seq, "text": sentence}
            if audio:
                msg["mime"] = "audio/mpeg"
                msg["b64"] = base64.b64encode(audio).decode()
            await self.send(msg)

    async def speak_fixed(self, text: str):
        await self.send({"type": "state", "state": "speaking"})
        audio = await synthesize(text)
        msg = {"type": "speak", "seq": 0, "text": text}
        if audio:
            msg.update(mime="audio/mpeg", b64=base64.b64encode(audio).decode())
        await self.send({"type": "text", "delta": text, "reset": True})
        await self.send(msg)
        await self.send({"type": "done", "text": text})

    async def answer(self, question: str):
        t0 = time.time()
        await self.send({"type": "state", "state": "thinking"})
        await self.send({"type": "text", "delta": "", "reset": True})
        self.history.append({"role": "user", "content": question})

        queue: asyncio.Queue = asyncio.Queue()
        speaker = asyncio.create_task(self._speaker(queue))
        seq, buf, full, first = 0, "", "", True

        async def push(sentence: str):
            nonlocal seq
            await queue.put((seq, sentence, asyncio.create_task(synthesize(sentence))))
            seq += 1

        try:
            if DEMO:
                stream_src = self._demo_stream(question)
            else:
                stream_src = self._claude_stream()
            async for delta in stream_src:
                full += delta
                buf += delta
                await self.send({"type": "text", "delta": delta})
                ready, buf = pop_sentences(buf, first)
                for s in ready:
                    await push(s)
                    first = False
            if buf.strip():
                await push(buf.strip())
            await queue.put(None)
            await speaker
        except asyncio.CancelledError:
            speaker.cancel()
            raise
        except Exception as exc:
            speaker.cancel()
            err = str(exc).lower()
            if "authentication" in err or "api key" in err or "401" in err:
                why = "API кілті дұрыс емес. .env файлындағы ANTHROPIC_API_KEY тексеріңіз."
            elif "credit" in err or "billing" in err or "balance" in err:
                why = "Anthropic балансында ақша жоқ. console.anthropic.com → Billing."
            elif "not_found" in err or "model" in err and "404" in err:
                why = "Модель табылмады. .env файлындағы CLAUDE_MODEL тексеріңіз."
            else:
                why = "Байланыс үзілді, офлайн жауап беремін."
            print(f"[!] Ошибка ответа: {exc}")
            fallback = offline_answer(question)
            full = fallback
            await self.send({"type": "error", "message": why})
            await self.send({"type": "text", "delta": fallback, "reset": True})
            audio = await synthesize(fallback)
            msg = {"type": "speak", "seq": 0, "text": fallback}
            if audio:
                msg.update(mime="audio/mpeg", b64=base64.b64encode(audio).decode())
            await self.send(msg)

        full = full.strip()
        self.history.append({"role": "assistant", "content": full or "…"})
        await self.send({"type": "done", "text": full})
        log_turn(question, full, time.time() - t0)

    async def _claude_stream(self):
        async with claude.messages.stream(
            model=MODEL,
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=self.trimmed_history(),
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def _demo_stream(self, question: str):
        await asyncio.sleep(0.6)
        for word in re.split(r"(\s+)", offline_answer(question)):
            await asyncio.sleep(0.02)
            yield word


def log_turn(q: str, a: str, secs: float):
    try:
        with open(LOG_DIR / "conversations.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"time": time.strftime("%Y-%m-%d %H:%M:%S"), "q": q, "a": a,
                                "sec": round(secs, 2)}, ensure_ascii=False) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------- Whisper ---
_whisper = None
_whisper_lock = threading.Lock()


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def transcribe_file(path: str) -> str:
    global _whisper
    from faster_whisper import WhisperModel

    with _whisper_lock:
        if _whisper is None:
            print(f"[i] Загружаю Whisper '{WHISPER_MODEL}' (первый раз скачивается)…")
            _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        segments, _ = _whisper.transcribe(path, language="kk", beam_size=1, vad_filter=True)
        return " ".join(s.text.strip() for s in segments).strip()


# ------------------------------------------------------------------- app ---
app = FastAPI(title="PARASAT")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
async def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/config")
async def config():
    return {"model": MODEL, "voice": TTS_VOICE, "demo": DEMO, "whisper": whisper_available(),
            "greeting": GREETING}


@app.post("/api/stt")
async def stt(file: UploadFile = File(...)):
    if not whisper_available():
        return JSONResponse({"error": "faster-whisper орнатылмаған"}, status_code=501)
    tmp = LOG_DIR / f"rec_{int(time.time() * 1000)}.webm"
    tmp.write_bytes(await file.read())
    try:
        text = await asyncio.to_thread(transcribe_file, str(tmp))
    finally:
        tmp.unlink(missing_ok=True)
    return {"text": text}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    conv = Conversation(ws)
    await conv.send({"type": "hello", "demo": DEMO})
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            kind = msg.get("type")
            if kind == "ask":
                text = str(msg.get("text", "")).strip()[:500]
                if text:
                    await conv.cancel()
                    conv.task = asyncio.create_task(conv.answer(text))
            elif kind == "greet":
                await conv.cancel()
                conv.task = asyncio.create_task(conv.speak_fixed(GREETING))
            elif kind == "say":
                text = str(msg.get("text", "")).strip()[:500]
                if text:
                    await conv.cancel()
                    conv.task = asyncio.create_task(conv.speak_fixed(text))
            elif kind == "stop":
                await conv.cancel()
                await conv.send({"type": "done", "text": "", "stopped": True})
            elif kind == "reset":
                await conv.cancel()
                conv.history.clear()
                await conv.send({"type": "done", "text": "", "stopped": True})
    except WebSocketDisconnect:
        await conv.cancel()


def main():
    print("=" * 60)
    print(" PARASAT — AI-аватар")
    print(f"  Модель : {'ДЕМО (нет ANTHROPIC_API_KEY в .env)' if DEMO else MODEL}")
    print(f"  Голос  : {TTS_VOICE}")
    print(f"  Whisper: {'да, ' + WHISPER_MODEL if whisper_available() else 'нет (речь распознаёт браузер)'}")
    print(f"  Откройте в Chrome: http://{HOST}:{PORT}")
    print("=" * 60)
    if OPEN_BROWSER:
        threading.Timer(1.5, lambda: webbrowser.open(f"http://{HOST}:{PORT}")).start()
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


if __name__ == "__main__":
    main()
