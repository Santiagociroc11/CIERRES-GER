@echo off
echo Compilando el servidor...
call npm run build

echo Iniciando el servidor...
call npx pm2 start ecosystem.config.js

echo Servidor iniciado. Presiona Ctrl+C para detener.
pause 