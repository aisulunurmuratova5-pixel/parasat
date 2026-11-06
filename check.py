"""
PARASAT — тексеру скрипті.  Іске қосу:  python check.py

Барлығы дұрыс па, соны көрсетеді:
  1) Python пакеттері орнатылған ба
  2) .env файлында API кілті бар ма
  3) Claude жауап бере ме (кілт пен баланс)
  4) Қазақша «Айгүл» дауысы жұмыс істей ме (test_voice.mp3 файлын жасайды)
"""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OK, BAD = "  [OK] ", "  [!!] "


def step(title):
    print("\n" + title)


def main():
    step("1. Пакеттер")
    missing = []
    for mod in ("fastapi", "uvicorn", "anthropic", "edge_tts", "dotenv", "multipart"):
        try:
            __import__(mod)
            print(OK + mod)
        except ImportError:
            print(BAD + mod + " орнатылмаған")
            missing.append(mod)
    if missing:
        print("\n  Орнатыңыз:  pip install -r requirements.txt")
        return

    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")

    step("2. API кілті (.env файлы)")
    env = ROOT / ".env"
    if not env.exists():
        print(BAD + ".env файлы жоқ. Оны жоба папкасында жасаңыз (README.md қараңыз).")
        return
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        print(BAD + ".env файлындағы ANTHROPIC_API_KEY= бос. Кілтті теңдік белгісінен кейін қойыңыз.")
    elif not key.startswith("sk-ant-"):
        print(BAD + "Кілт sk-ant- деп басталуы керек. Қате көшірілген сияқты.")
    else:
        print(OK + "кілт табылды: " + key[:10] + "…" + key[-4:])

    step("3. Claude (мидың) байланысы")
    if key:
        try:
            from anthropic import Anthropic
            model = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
            r = Anthropic(api_key=key).messages.create(
                model=model, max_tokens=60,
                messages=[{"role": "user", "content": "Бір сөйлеммен қазақша сәлем айт."}])
            print(OK + model + " жауап берді: " + r.content[0].text.strip())
        except Exception as exc:
            print(BAD + f"Claude жауап бермеді: {exc}")
            print("       • 401 / authentication → кілт қате")
            print("       • credit / billing → console.anthropic.com → Billing бөлімінде баланс толтырыңыз")
            print("       • model not found → .env ішінде CLAUDE_MODEL=claude-sonnet-5-5 немесе claude-haiku-5-5 қойыңыз")
    else:
        print("  (кілт жоқ — бет ДЕМО режимде жұмыс істейді)")

    step("4. Қазақша дауыс (edge-tts)")
    voice = os.getenv("TTS_VOICE", "kk-KZ-AigulNeural")

    async def tts():
        import edge_tts
        out = ROOT / "test_voice.mp3"
        await edge_tts.Communicate("Сәлеметсіздер ме! Парасат апталығына қош келдіңіздер!", voice).save(str(out))
        return out

    try:
        out = asyncio.run(tts())
        print(OK + f"{voice} жұмыс істейді → {out.name} файлын ашып тыңдаңыз")
    except Exception as exc:
        print(BAD + f"Дауыс жасалмады: {exc}")
        print("       Интернетті тексеріңіз немесе:  pip install -U edge-tts")

    print("\nДайын болса:  python server.py   →  Chrome-да http://127.0.0.1:8000")


if __name__ == "__main__":
    if sys.version_info < (3, 10):
        print("Python 3.10 немесе жаңасы керек. Қазіргі:", sys.version.split()[0])
    else:
        main()
