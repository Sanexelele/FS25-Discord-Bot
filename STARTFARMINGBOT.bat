@echo off
set NODE_OPTIONS=--no-deprecation
set LOG_LEVEL=error
color 0A
title FARMINGBOT
cd /d "C:\Users\Administrator\Desktop\BOTS\FS25-Discord-Bot"

REM No log file while running; fatal crashes are written to bot-crash.log by the bot
npm start

echo.
echo Bot stopped. If it crashed, see bot-crash.log in this folder.
pause
