@echo off
color 0A
title FS25 Discord Bot
cd /d "C:\Users\Administrator\Desktop\BOTS\FS25-Discord-Bot"

echo.
echo [%date% %time%] Starting bot...
echo. >> bot-start.log
echo [%date% %time%] Starting bot... >> bot-start.log

REM Show npm/node output on screen AND append to log (plain ">>" only wrote to file, so nothing showed)
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm start 2>&1 | Tee-Object -FilePath '%CD%\bot-start.log' -Append"

echo.
echo Bot stopped. Check bot-start.log in the bot folder.
pause
