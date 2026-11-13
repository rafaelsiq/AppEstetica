@echo off
rem Gera o build do frontend e publica no Firebase Hosting.
rem Use publicar-firebase.cmd --regras para publicar tambem as regras do Firestore.
cd /d "%~dp0"
node scripts\publicar-firebase.mjs %*
set CODIGO=%ERRORLEVEL%
echo.
pause
exit /b %CODIGO%
