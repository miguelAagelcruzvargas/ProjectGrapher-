@echo off
TITLE ProjectGrapher AI - Lanzador
echo ==========================================
echo    🚀 Lanzando ProjectGrapher AI
echo ==========================================
echo.

:: 1. Iniciar el Backend de Python en una nueva ventana
echo [1/2] Iniciando Backend de Python (FastAPI)...
start "ProjectGrapher Backend" cmd /k "python main.py"

:: 2. Esperar un momento para que el backend cargue
timeout /t 3 /nobreak > nul

:: 3. Iniciar el Frontend de React
echo [2/2] Iniciando Frontend de React (Vite)...
echo.
echo ------------------------------------------
echo ✅ El sistema estara listo en breve.
echo 🔗 URL: http://localhost:3000
echo 🔗 API: http://localhost:8000
echo ------------------------------------------
echo.
npm run dev

pause
