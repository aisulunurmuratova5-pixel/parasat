#!/bin/bash
# macOS: екі рет басып іске қосыңыз (алғашқы рет: оң жақ батырма → Open)
cd "$(dirname "$0")"
if [ ! -d venv ]; then
  echo "Виртуал орта жасалуда..."
  python3 -m venv venv || { echo "python.org сайтынан Python 3.10+ орнатыңыз"; read; exit 1; }
fi
source venv/bin/activate
pip install -q -r requirements.txt
if ! grep -q "^ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
  echo ""
  echo ".env файлына ANTHROPIC_API_KEY кілтін қойыңыз (кілтсіз ДЕМО режим жұмыс істейді)."
  echo ""
fi
python server.py
