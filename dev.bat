@echo off
setlocal enabledelayedexpansion

echo ====================================================================
echo Starting Incedo Advisor AI Microservices ^& UI Dashboard
echo ====================================================================
echo.

echo [INFO] Stopping existing processes on ports 3000-3004...
for %%P in (3000 3001 3002 3003 3004 5002) do (
    for /f "tokens=5" %%A in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":%%P "') do (
        if "%%A" NEQ "0" (
            echo Killing process %%A listening on port %%P...
            taskkill /F /PID %%A >nul 2>&1
        )
    )
)

echo [INFO] All ports cleared. Starting services...
echo.

rem NOTE: The copilot-backend-legacy code has been removed (dead/residual code).
rem       The .venv inside that folder is kept because it is the shared Python
rem       environment for ALL microservices (api-gateway, ai-orchestrator, etc.).
set "PYTHON_EXE=c:\Users\KOTINI LOKSAI\Documents\INCEDO PROJECT Anti gravity\advisor-ai\apps\copilot-backend-legacy\.venv\Scripts\python.exe"


echo Starting API Gateway (Port 3001)...
start "API Gateway (3001)" cmd /k "cd apps\api-gateway && "%PYTHON_EXE%" -m uvicorn main:app --port 3001 --reload"

echo Starting AI Orchestrator (Port 3002)...
start "AI Orchestrator (3002)" cmd /k "cd apps\ai-orchestrator && "%PYTHON_EXE%" -m uvicorn main:app --port 3002 --reload"

echo Starting Compliance Engine (Port 3003)...
start "Compliance Engine (3003)" cmd /k "cd apps\compliance-engine && "%PYTHON_EXE%" -m uvicorn main:app --port 3003 --reload"

echo Starting NER Background Service (Port 5002)...
start "NER Service (5002)" cmd /k "cd apps\ner-service && "%PYTHON_EXE%" server.py"

echo Starting Advisor UI Frontend (Port 3000)...
start "Advisor UI (3000)" cmd /k "pnpm --filter advisor-ui run dev"

echo.
echo All microservices and frontend have been launched in separate windows!
echo You can safely close this main window.
