@echo off
rem Gera o build do frontend e publica no Firebase Hosting.
rem Opcoes: --funcoes (Cloud Functions), --regras (regras do Firestore), --tudo, --sem-site
cd /d "%~dp0"
node scripts\publicar-firebase.mjs %*
set CODIGO=%ERRORLEVEL%
echo.
pause
exit /b %CODIGO%
