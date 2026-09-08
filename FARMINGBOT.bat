@echo off
set NODE_OPTIONS=--no-deprecation
set LOG_LEVEL=info
REM Keep this window open and visible. Do not start the bot from Cursor.
color 0A
title FARMINGBOT
cd /d "D:\BOTS\FS25-Discord-Bot"

echo Starting Farming bot...
call npm run build
title FARMINGBOT
node build/Main.js

echo.
echo Bot stopped. If it crashed, see bot-crash.log in this folder.
pause
