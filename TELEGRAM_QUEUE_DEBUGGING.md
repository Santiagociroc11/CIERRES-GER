# 🔍 Guía de Debugging - Cola de Telegram

## Problema Reportado
❌ **Los mensajes nunca cambian de estado "queued"**

## ✅ Mejoras Implementadas

### **1. Logging Mejorado**
El sistema ahora tiene logging más detallado para identificar problemas:

```
🚀 Iniciando procesador de cola de Telegram...
🔍 Cola de Telegram: 3 mensajes pendientes
🔄 Procesando cola de Telegram: 3 mensajes
⏰ Mensajes listos para enviar: 2/3
📤 Enviando mensaje tg_123456 a chat -1001234567890
✅ Mensaje de Telegram enviado exitosamente
```

### **2. Nuevos Endpoints de Debugging**

#### **A. Estadísticas Mejoradas**
```bash
GET /api/hotmart/telegram-queue-stats
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPending": 2,
      "readyToSend": 1,
      "waiting": 1,
      "messagesSentThisMinute": 3,
      "rateLimit": 15,
      "isProcessing": false
    },
    "queue": [
      {
        "id": "tg_1234567890_abc123",
        "chatId": "-1001234567890",
        "text": "Nueva venta: Cliente Test...",
        "attempts": 0,
        "maxAttempts": 3,
        "isReady": true,
        "waitingSeconds": 0,
        "webhookLogId": 123
      }
    ],
    "config": {
      "botTokenConfigured": true,
      "botTokenLength": 46,
      "rateLimit": 15,
      "messageInterval": 4000
    }
  }
}
```

#### **B. Diagnóstico Completo**
```bash
GET /api/hotmart/telegram-queue-debug
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "queueHealth": {
      "isHealthy": true,
      "issues": []
    },
    "processingInfo": {
      "isProcessing": false,
      "totalPending": 0,
      "readyToSend": 0,
      "messagesSentThisMinute": 2,
      "rateLimit": 15
    },
    "configuration": {
      "botTokenConfigured": true,
      "botTokenPreview": "8117750846:..."
    }
  }
}
```

#### **C. Prueba de Cola**
```bash
POST /api/hotmart/telegram-queue-test
Content-Type: application/json

{
  "chatId": "-1001234567890",
  "text": "Mensaje de prueba"
}
```

### **3. Posibles Problemas y Soluciones**

#### **❌ Problema: Token no configurado**
```json
{
  "queueHealth": {
    "isHealthy": false,
    "issues": ["TELEGRAM_BOT_TOKEN no configurado"]
  }
}
```

**Solución:** Configurar variable de entorno
```bash
export TELEGRAM_BOT_TOKEN="8117750846:AAExGxB3Mbwv2YBb6b7rMAvP6vsIPeH8EIM"
```

#### **❌ Problema: Rate limit alcanzado**
```json
{
  "queueHealth": {
    "issues": ["Rate limit alcanzado - esperando próximo minuto"]
  }
}
```

**Solución:** Esperar. El sistema respeta 15 mensajes/minuto.

#### **❌ Problema: Mensajes no listos**
```json
{
  "queueHealth": {
    "issues": ["Hay mensajes en cola pero ninguno listo para enviar"]
  }
}
```

**Solución:** Verificar `scheduledAt` - pueden tener retry con backoff.

## 🔧 Comandos de Debugging

### **1. Verificar Estado Actual**
```bash
curl -s http://localhost:3001/api/hotmart/telegram-queue-debug | jq
```

### **2. Ver Cola en Tiempo Real**
```bash
watch -n 2 'curl -s http://localhost:3001/api/hotmart/telegram-queue-stats | jq .data.stats'
```

### **3. Probar Envío**
```bash
curl -X POST http://localhost:3001/api/hotmart/telegram-queue-test \
  -H "Content-Type: application/json" \
  -d '{"chatId": "-1001234567890", "text": "Prueba de debugging"}'
```

### **4. Verificar Logs del Servidor**
```bash
# Si usas PM2
pm2 logs

# Si usas Docker
docker logs nombre_del_contenedor

# Si usas node directamente
# Los logs aparecen en la consola
```

## 📊 Interpretación de Resultados

### **✅ Sistema Saludable**
```json
{
  "queueHealth": { "isHealthy": true, "issues": [] },
  "processingInfo": { "totalPending": 0 },
  "configuration": { "botTokenConfigured": true }
}
```

### **⚠️ Sistema con Problemas**
```json
{
  "queueHealth": { 
    "isHealthy": false, 
    "issues": ["TELEGRAM_BOT_TOKEN no configurado"] 
  },
  "processingInfo": { "totalPending": 5, "readyToSend": 0 }
}
```

## 🎯 Próximos Pasos

1. **Ejecutar diagnóstico completo**
2. **Verificar configuración del token**
3. **Monitorear logs en tiempo real**
4. **Probar con mensaje de prueba**
5. **Verificar si los mensajes cambian de estado**

---

**💡 Nota:** El procesador de cola se ejecuta automáticamente cada segundo. No necesitas ejecutar nada manualmente - solo monitorear los logs y usar los endpoints de debugging para identificar el problema exacto.
