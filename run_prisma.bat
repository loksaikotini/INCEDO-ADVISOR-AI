@echo off
set "PATH=c:\Users\KOTINI LOKSAI\Documents\INCEDO PROJECT Anti gravity\advisor-ai\apps\copilot-backend-legacy\.venv\Scripts;%PATH%"
cd libs\db-client
npx prisma generate --schema=src/prisma/schema.prisma
