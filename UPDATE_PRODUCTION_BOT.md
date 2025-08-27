# 🚀 Actualizar Bot de Telegram en Producción

## 🎯 **Estado Actual**
- ✅ **Bot implementado** correctamente en el código
- ✅ **Código compilado** sin errores
- ❌ **Servidor de producción** usando versión anterior
- ❌ **Logs del bot** no aparecen al iniciar

## 📋 **Pasos para Actualizar Producción**

### **1. Subir código al servidor**
```bash
# En tu entorno local, hacer commit y push
git add .
git commit -m "Implementar bot Telegram /autoid con polling"
git push origin main
```

### **2. En el servidor de producción**
```bash
# Actualizar código
cd /app
git pull origin main

# Recompilar el proyecto
cd server
npm run build

# Reiniciar con PM2
pm2 restart all
# O si tienes un proceso específico:
pm2 restart cierres-ger-server
```

### **3. Verificar que funciona**
Después del reinicio deberías ver estos logs:
```bash
🤖 Inicializando bot de Telegram...
✅ Bot de Telegram configurado correctamente
🤖 [TelegramBot] Bot inicializado correctamente
✅ [TelegramBot] Bot conectado: @Repartidor_td_bot
🔄 [TelegramBot] Iniciando polling...
```

### **4. Verificar estado del bot**
```bash
# Endpoint para verificar
curl http://localhost:4445/telegram-bot-status

# Respuesta esperada:
{
  "status": "OK", 
  "telegramBot": {
    "isRunning": true,
    "hasToken": true,
    "message": "Bot funcionando correctamente"
  }
}
```

## ⚠️ **Si aparece "Token no configurado"**

Necesitas configurar el token del bot en webhookconfig:

### **Opción A - Interfaz Web:**
1. Ve a tu sistema → **Configuración → Webhooks → Tokens API**
2. Configura **"Telegram Bot Token"**
3. Guarda cambios

### **Opción B - SQL Directo:**
```sql
UPDATE webhook_config 
SET config_value = jsonb_set(config_value, '{telegram}', '"TU_BOT_TOKEN"')
WHERE platform = 'hotmart' AND config_key = 'tokens';
```

### **Opción C - Endpoint API:**
```bash
# PUT al endpoint de configuración
curl -X PUT http://localhost:4445/api/hotmart/config \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": {
      "telegram": "TU_BOT_TOKEN_AQUI"
    }
  }'
```

## 🧪 **Probar el Bot**

Una vez actualizado:

1. **Ir a Telegram** → Buscar `@Repartidor_td_bot`
2. **Escribir `/autoid`**
3. **El bot debe responder** con tu ID de Telegram
4. **Copiar el ID** y configurarlo en el sistema

## 📊 **Logs Esperados**

### **Al iniciar servidor:**
```bash
🚀 Servidor iniciado en puerto 4445
📡 WebSocket conectado a Evolution API
🤖 Inicializando bot de Telegram...
✅ Bot de Telegram configurado correctamente
🤖 [TelegramBot] Bot inicializado correctamente
✅ [TelegramBot] Bot conectado: @Repartidor_td_bot (Repartidor TD)
🔄 [TelegramBot] Iniciando polling...
```

### **Al recibir `/autoid`:**
```bash
📨 [TelegramBot] Mensaje de Juan (@juanito): /autoid
🆔 [TelegramBot] ID enviado a Juan: 123456789
```

## 🔧 **Comandos de PM2 Útiles**

```bash
# Ver procesos
pm2 list

# Ver logs en tiempo real
pm2 logs

# Ver logs específicos
pm2 logs cierres-ger-server

# Reiniciar proceso específico
pm2 restart cierres-ger-server

# Reiniciar todos
pm2 restart all

# Ver información detallada
pm2 info cierres-ger-server
```

## ✅ **Una vez funcionando**

El bot responderá automáticamente a:
- `/start` - Bienvenida y explicación
- `/autoid` - **COMANDO PRINCIPAL** - Responde con ID de Telegram
- `/help` - Ayuda con comandos

¡Los asesores podrán obtener su ID de Telegram fácilmente! 🎉
