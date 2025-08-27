#!/bin/bash

echo "🧹 Limpiando PM2 y procesos del bot de Telegram..."

# Detener todos los procesos PM2
echo "⏹️ Deteniendo todos los procesos PM2..."
pm2 kill

# Esperar a que se cierren completamente
echo "⏳ Esperando 10 segundos para que se cierren los procesos..."
sleep 10

# Verificar que no hay procesos PM2 corriendo
echo "🔍 Verificando que no hay procesos PM2..."
pm2 list

# Limpiar logs antiguos
echo "🗑️ Limpiando logs antiguos..."
pm2 flush

# Verificar procesos de Node.js relacionados
echo "🔍 Verificando procesos de Node.js..."
ps aux | grep node | grep -v grep

# Matar cualquier proceso de Node.js relacionado con el bot
echo "💀 Matando procesos de Node.js relacionados..."
pkill -f "cierres-ger-server" || true
pkill -f "telegramBot" || true

# Esperar un poco más
echo "⏳ Esperando 5 segundos adicionales..."
sleep 5

echo "✅ Limpieza completada!"
echo ""
echo "🚀 Ahora puedes reiniciar tu aplicación:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "🔍 Para verificar el estado:"
echo "   pm2 list"
echo "   pm2 logs"
