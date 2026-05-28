@echo off
setlocal enabledelayedexpansion

echo ====================================================================
echo Incedo Advisor AI - Full Setup Script 🚀
echo ====================================================================
echo.

echo [1/6] Checking and installing pnpm (Node package manager)...
call npm install -g pnpm
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install pnpm. Please ensure Node.js is installed.
    exit /b %ERRORLEVEL%
)
echo.

echo [2/6] Installing frontend and workspace dependencies...
call pnpm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install pnpm dependencies.
    exit /b %ERRORLEVEL%
)
echo.

echo [3/6] Creating shared Python Virtual Environment...
if not exist "apps\copilot-backend-legacy\.venv" (
    echo Creating virtual environment at apps\copilot-backend-legacy\.venv...
    if not exist "apps\copilot-backend-legacy" mkdir "apps\copilot-backend-legacy"
    call python -m venv apps\copilot-backend-legacy\.venv
) else (
    echo Virtual environment already exists.
)

set "PYTHON_EXE=%~dp0apps\copilot-backend-legacy\.venv\Scripts\python.exe"
set "PIP_EXE=%~dp0apps\copilot-backend-legacy\.venv\Scripts\pip.exe"
call "%~dp0apps\copilot-backend-legacy\.venv\Scripts\activate.bat"

if not exist "!PYTHON_EXE!" (
    echo [ERROR] Python virtual environment was not created successfully. Make sure Python 3.11 is installed.
    exit /b 1
)
echo.

echo [4/6] Installing Python backend dependencies...
call "!PYTHON_EXE!" -m pip install --upgrade pip

echo Installing dependencies for API Gateway...
if exist "apps\api-gateway\requirements.txt" call "!PIP_EXE!" install -r apps\api-gateway\requirements.txt

echo Installing dependencies for AI Orchestrator...
if exist "apps\ai-orchestrator\requirements.txt" call "!PIP_EXE!" install -r apps\ai-orchestrator\requirements.txt

echo Installing dependencies for Compliance Engine...
if exist "apps\compliance-engine\requirements.txt" call "!PIP_EXE!" install -r apps\compliance-engine\requirements.txt

echo Installing dependencies for NER Service...
if exist "apps\ner-service\requirements.txt" call "!PIP_EXE!" install -r apps\ner-service\requirements.txt

echo Installing additional core dependencies (cohere, etc.)...
call "!PIP_EXE!" install cohere prisma
echo.

echo [5/6] Setting up the database and dummy data...
cd libs\db-client
call pnpm install

call npx prisma migrate deploy --schema=src/prisma/schema.prisma
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to migrate database schema. Please check your .env DATABASE_URL.
    cd ..\..
    exit /b %ERRORLEVEL%
)

call npx ts-node src/seed.ts
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Database seeding encountered an error, but setup will continue.
)
cd ..\..
echo.

echo [6/6] Generating gRPC Protos for NER Service...
if exist "apps\ner-service\generate_protos.bat" (
    cd apps\ner-service
    call generate_protos.bat
    cd ..\..
) else (
    echo [WARNING] generate_protos.bat not found in apps\ner-service.
)
echo.

echo ====================================================================
echo Setup Complete! 🎉
echo You can now start the application by running:
echo    .\dev.bat
echo ====================================================================
pause
