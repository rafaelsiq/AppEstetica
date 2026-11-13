@echo off
rem Gera o .aab (React + Capacitor), assina e envia para o Google Play (teste interno).
rem Aceita as opcoes do script, ex.: publicar-play.cmd --notas "Novidades" --faixa production
cd /d "%~dp0"
node scripts\publicar-play.mjs %*
set CODIGO=%ERRORLEVEL%
echo.
pause
exit /b %CODIGO%
