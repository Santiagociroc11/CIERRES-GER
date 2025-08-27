# 🤖 Bot de Telegram - Sistema /autoid

## Descripción

Bot de Telegram implementado para ayudar a los asesores a obtener su ID de Telegram fácilmente mediante el comando `/autoid`. El bot usa **polling** (no webhooks) para recibir y responder mensajes.

## Funcionalidades

### Comandos Disponibles

#### `/start`
- Mensaje de bienvenida al bot
- Explica la funcionalidad y comandos disponibles
- Guía al usuario hacia el comando `/autoid`

#### `/autoid` ⭐ **PRINCIPAL**
- Responde con el ID de Telegram del usuario (chat_id)
- Proporciona instrucciones claras para copiar y pegar en el sistema
- Este ID se usa en el campo `ID_TG` de la tabla `GERSSON_ASESORES`

#### `/help`
- Muestra ayuda con todos los comandos disponibles
- Explica el propósito del bot

## Arquitectura Técnica

### Polling vs Webhooks
- ✅ **Usa Polling**: Consulta cada 2 segundos la API de Telegram
- ❌ **No usa Webhooks**: Evita configuraciones complejas de red
- 🔄 **Auto-reinicio**: Se reconecta automáticamente si hay errores

### Configuración
- **Token**: Obtenido de `webhookconfig.hotmart.tokens.telegram`
- **Auto-inicialización**: Se inicia automáticamente con el servidor
- **Graceful shutdown**: Se cierra correctamente al terminar el servidor

## Flujo de Uso

### Para Asesores:
1. Van a Telegram y buscan `@Repartidor_td_bot`
2. Presionan "Iniciar" o escriben `/start`
3. Escriben `/autoid`
4. El bot responde con su ID único de Telegram
5. Copian el ID y lo pegan en el sistema web

### Para el Sistema:
1. El ID se guarda en `GERSSON_ASESORES.ID_TG`
2. Se usa para enviar notificaciones automáticas
3. Los asesores reciben alertas de nuevos clientes

## Archivos Implementados

### `server/src/services/telegramBot.ts`
```typescript
class TelegramBot {
  - startPolling()     // Inicia polling de mensajes
  - processUpdate()    // Procesa mensajes recibidos
  - handleCommand()    // Maneja comandos específicos
  - sendAutoIdMessage() // Responde al /autoid
}
```

### Integración en `server/src/index.ts`
```typescript
import telegramBot from './services/telegramBot';

// Se inicializa automáticamente al importar
// Logs de estado en el arranque del servidor
```

## Mensajes del Bot

### Respuesta a `/autoid`
```
🆔 **Tu ID de Telegram es:**

`123456789`

📋 **Instrucciones:**
1. **Copia** el número de arriba (toca para seleccionar)
2. Ve al sistema web de Repartidor TD
3. Pega el número en el campo "ID de Telegram"
4. ¡Listo! Ya recibirás notificaciones automáticas

✅ **¡[Nombre], ya puedes configurar tu ID en el sistema!**
```

## Logs y Monitoreo

### Logs del Servidor
```bash
🤖 [TelegramBot] Bot inicializado correctamente
✅ [TelegramBot] Bot conectado: @Repartidor_td_bot (Repartidor TD)
🔄 [TelegramBot] Iniciando polling...
📨 [TelegramBot] Mensaje de Juan (@juanito): /autoid
🆔 [TelegramBot] ID enviado a Juan: 123456789
```

### Estados del Bot
```typescript
telegramBot.getStatus() // { isRunning, hasToken, lastUpdateId }
```

## Configuración Requerida

### Token en WebhookConfig
```sql
-- El bot necesita el token configurado en:
UPDATE webhook_config 
SET config_value = jsonb_set(config_value, '{telegram}', '"TU_BOT_TOKEN"')
WHERE platform = 'hotmart' AND config_key = 'tokens';
```

### Verificar Configuración
1. Ve a Configuración → Webhooks → Tokens API
2. Configura "Telegram Bot Token"
3. Reinicia el servidor para aplicar cambios

## Solución de Problemas

### Bot no responde
1. ✅ Verificar que el token esté configurado en webhookconfig
2. ✅ Revisar logs del servidor para errores
3. ✅ Verificar que el bot esté corriendo: `telegramBot.getStatus()`

### Token inválido
```bash
❌ [TelegramBot] Error obteniendo info del bot: Unauthorized
```
- Revisar que el token sea correcto
- Verificar que el bot exista en Telegram

### Sin token configurado
```bash
⚠️ [TelegramBot] Token no configurado en webhookconfig
```
- Configurar token en la interfaz de webhooks
- Reiniciar servidor

## Integración con el Sistema

### Campo ID_TG
- Se guarda en `GERSSON_ASESORES.ID_TG`
- Usado por `telegramService.ts` para notificaciones
- Visible en DashboardAsesor.tsx para configuración

### Notificaciones Automáticas
- Eventos de CARRITOS, TICKETS, RECHAZADOS
- Mensajes directos al asesor asignado
- Botones de acción para atender cliente

## Seguridad

- ✅ No almacena información personal
- ✅ Solo responde a comandos específicos
- ✅ No requiere permisos especiales
- ✅ Token protegido en configuración del sistema
