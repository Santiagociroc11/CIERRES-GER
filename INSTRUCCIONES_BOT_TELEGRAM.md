# 🤖 Instrucciones de Configuración - Bot de Telegram

## ✅ **Bot Implementado Correctamente**

Se ha implementado exitosamente un bot de Telegram que responde al comando `/autoid` para ayudar a los asesores a obtener su ID de Telegram.

## 🔧 **Configuración Necesaria**

### 1. **Token del Bot**
El bot necesita el token configurado en la base de datos:

```sql
-- Actualizar token en webhookconfig
UPDATE webhook_config 
SET config_value = jsonb_set(config_value, '{telegram}', '"TU_BOT_TOKEN_AQUI"')
WHERE platform = 'hotmart' AND config_key = 'tokens';
```

**O desde la interfaz web:**
1. Ve a **Configuración → Webhooks → Tokens API**
2. Configura **"Telegram Bot Token"**
3. Guarda los cambios

### 2. **Reiniciar Servidor**
Después de configurar el token, reinicia el servidor para aplicar cambios:

```bash
cd server
npm run dev
```

## 🚀 **Funcionamiento del Bot**

### **Comandos Disponibles:**

#### `/start`
- Mensaje de bienvenida
- Explica cómo usar el bot
- Guía hacia el comando `/autoid`

#### `/autoid` ⭐
- **FUNCIÓN PRINCIPAL**: Responde con el ID de Telegram del usuario
- El usuario puede copiar este ID y pegarlo en el sistema
- Este ID se guarda en `GERSSON_ASESORES.ID_TG`

#### `/help`
- Muestra ayuda con todos los comandos

## 📱 **Instrucciones para Asesores**

### **Pasos a seguir:**
1. **Ir a Telegram** y buscar: `@Repartidor_td_bot`
2. **Presionar "Iniciar"** o escribir `/start`
3. **Escribir `/autoid`**
4. **Copiar el número** que responde el bot
5. **Ir al sistema web** → Configuración → ID de Telegram
6. **Pegar el número** y guardar

### **Ejemplo de respuesta del bot:**
```
🆔 Tu ID de Telegram es:

123456789

📋 Instrucciones:
1. Copia el número de arriba
2. Ve al sistema web de Repartidor TD
3. Pega el número en el campo "ID de Telegram"
4. ¡Listo! Ya recibirás notificaciones automáticas
```

## 🔍 **Verificación del Sistema**

### **Verificar Estado del Bot:**
```bash
# Endpoint para verificar estado
GET http://localhost:3001/telegram-bot-status

# Respuesta esperada:
{
  "status": "OK",
  "telegramBot": {
    "isRunning": true,
    "hasToken": true,
    "lastUpdateId": 123,
    "message": "Bot funcionando correctamente"
  }
}
```

### **Logs del Servidor:**
```bash
🤖 Inicializando bot de Telegram...
✅ Bot de Telegram configurado correctamente
🤖 [TelegramBot] Bot inicializado correctamente
✅ [TelegramBot] Bot conectado: @Repartidor_td_bot (Repartidor TD)
🔄 [TelegramBot] Iniciando polling...
```

## 🛠️ **Archivos Implementados**

### `server/src/services/telegramBot.ts`
- **Clase TelegramBot** con polling
- **Manejo de comandos** `/start`, `/autoid`, `/help`
- **Auto-inicialización** al importar
- **Graceful shutdown** al cerrar servidor

### `server/src/index.ts`
- **Importación** del bot
- **Inicialización** al arrancar servidor
- **Logging** de estado
- **Parada limpia** en señales de terminación

### `TELEGRAM_BOT_README.md`
- **Documentación técnica** completa
- **Arquitectura** y funcionamiento
- **Solución de problemas**

## ⚠️ **Solución de Problemas**

### **Bot no responde:**
1. ✅ Verificar que el token esté configurado
2. ✅ Revisar logs del servidor para errores
3. ✅ Verificar endpoint: `/telegram-bot-status`

### **Token inválido:**
```bash
❌ [TelegramBot] Error obteniendo info del bot: Unauthorized
```
- Verificar que el token sea correcto en webhookconfig
- El token debe tener formato: `123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

### **Sin token configurado:**
```bash
⚠️ Bot de Telegram sin token configurado - revisa webhookconfig
```
- Configurar token en interfaz de webhooks
- Reiniciar servidor

## 📊 **Integración con el Sistema**

### **Campo ID_TG**
- Se guarda en tabla `GERSSON_ASESORES`
- Campo `ID_TG` almacena el ID de Telegram
- Usado para notificaciones automáticas

### **Notificaciones**
- **CARRITOS** - Cliente abandonó carrito
- **TICKETS** - Cliente generó ticket de pago  
- **RECHAZADOS** - Compra rechazada
- **Mensajes directos** al asesor asignado

### **Flujo Completo**
1. Asesor usa `/autoid` en Telegram
2. Bot responde con su ID único
3. Asesor configura ID en el sistema web
4. Sistema envía notificaciones automáticas
5. Asesor recibe alertas de nuevos clientes

## 🎯 **Próximos Pasos**

1. **Configurar token** en webhookconfig
2. **Reiniciar servidor** para aplicar cambios
3. **Probar bot** enviando `/autoid`
4. **Verificar logs** que todo funcione
5. **Capacitar asesores** en el uso del bot

¡El bot está listo para usar! 🚀
