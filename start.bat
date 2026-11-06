@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist venv (
  echo Виртуал орта жасалуда...
  python -m venv venv || (echo python.org сайтынан Python 3.10+ орнатыңыз & pause & exit /b 1)
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
findstr /b /c:"ANTHROPIC_API_KEY=sk-" .env >nul 2>&1 || (
  echo.
  echo .env файлына ANTHROPIC_API_KEY кiлтiн қойыңыз. Кiлтсiз ДЕМО режим жұмыс iстейдi.
  echo.
)
python server.py
pause
