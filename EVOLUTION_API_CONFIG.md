# ⚡ Configuración Evolution API para Estados de Mensajes

## ✅ Cambios Implementados

### 🔄 **Eventos WebSocket Corregidos**
- **❌ REMOVIDO**: `messages.receipt.update`, `message.receipt.update`, `messageUpdate` (no existen)
- **✅ AGREGADO**: `send.message` (CRUCIAL para mensajes enviados)
- **✅ MEJORADO**: `messages.update` con estructura de datos correcta
- **✅ DEBUG**: Sistema exhaustivo para capturar todos los eventos

### 📋 **Eventos Ahora Soportados**
```typescript
const evolutionEvents = [
  'send.message',           // ✅ Mensaje enviado exitosamente
  'messages.upsert',        // ✅ Nuevo mensaje (recibido/enviado)
  'messages.update',        // ✅ Estado del mensaje (entregado, leído)  
  'messages.delete',        // ✅ Mensaje eliminado
  'connection.update',      // ✅ Estado de conexión
  'qrcode.updated',         // ✅ QR Code actualizado
  'creds.update'            // ✅ Credenciales actualizadas
];
```

## 🚨 PASOS CRÍTICOS PARA APLICAR

### 1. 🗄️ **EJECUTAR MIGRACIÓN SQL** (OBLIGATORIO)
Ejecuta estos comandos en tu base de datos PostgreSQL:

```sql
-- Agregar campos necesarios
ALTER TABLE "public"."conversaciones" 
ADD COLUMN IF NOT EXISTS "mensaje_id" VARCHAR(255) NULL;

ALTER TABLE "public"."conversaciones" 
ADD COLUMN IF NOT EXISTS "estado" VARCHAR(20) NULL;

-- Crear índices para performance (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS "idx_conversaciones_mensaje_id" 
ON "public"."conversaciones" ("mensaje_id") 
WHERE "mensaje_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_conversaciones_estado" 
ON "public"."conversaciones" ("estado") 
WHERE "estado" IS NOT NULL;

-- Verificar que se crearon correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'conversaciones' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### 2. 🔄 **REINICIAR SERVIDOR NODE.JS**
```bash
cd server
npm run dev  # o el comando que uses para ejecutar tu servidor
```

### 3. 🔧 **CONFIGURAR EVOLUTION API (Si es necesario)**

#### Variables de Entorno Evolution API
Asegúrate de tener habilitados estos eventos:
```bash
# En tu .env de Evolution API
WEBSOCKET_ENABLED=true
WEBSOCKET_EVENTS_SEND_MESSAGE=true
WEBSOCKET_EVENTS_MESSAGES_UPSERT=true
WEBSOCKET_EVENTS_MESSAGES_UPDATE=true
WEBSOCKET_EVENTS_CONNECTION_UPDATE=true
WEBSOCKET_EVENTS_QRCODE_UPDATED=true
```

#### Configuración de Instancia
Al crear tu instancia en Evolution API, asegúrate de incluir:
```javascript
{
  instanceName: 'tu-instancia',
  websocket: {
    enabled: true,
    events: [
      'send.message',        // ✅ CRUCIAL para estados
      'messages.upsert',
      'messages.update', 
      'connection.update',
      'qrcode.updated'
    ]
  }
}
```

## 📊 **Logs Esperados Después del Fix**

### ✅ Al Conectar:
```
🔍 [DEBUG] Configurando handlers de WhatsApp...
🔗 Socket conectado a WhatsApp
👥 Asesores recargados: X
```

### ✅ Al Enviar Mensaje:
```
🔍 [DEBUG] Evento recibido: "messages.upsert"
📨 [messages.upsert] Evento Evolution específico recibido
✅ [ASESOR_NAME] Mensaje ENVIADO POR MÍ
✅ Mensaje guardado exitosamente

🔍 [DEBUG] Evento recibido: "send.message"
📤 [SEND_MESSAGE] Mensaje enviado exitosamente
✅ Estado actualizado: mensaje ABC123 = ENVIADO
```

### ✅ Al Cambiar Estado (Entregado/Leído):
```
🔍 [DEBUG] Evento recibido: "messages.update"
🔄 [MESSAGES_UPDATE] Actualización de estado recibida
📊 Estado actualizado: ID ABC123 = entregado (2)
✅ Estado actualizado en BD: ABC123 = entregado
```

## 🎯 **Estados de Mensajes Soportados**

| Código | Estado | Descripción | Color UI |
|--------|--------|-------------|----------|
| 0 | `enviando` | En proceso de envío | 🟡 Amarillo |
| 1 | `enviado` | Enviado a WhatsApp | 🔵 Azul |
| 2 | `entregado` | Entregado al dispositivo | 🟢 Verde |
| 3 | `leido` | Leído por el usuario | 🟢 Verde brillante |
| - | `error` | Error en envío | 🔴 Rojo |

## 🧪 **Verificación en Base de Datos**

Ejecuta esta consulta para verificar que los estados se están guardando:

```sql
SELECT 
    id, 
    id_asesor, 
    wha_cliente, 
    modo, 
    mensaje_id, 
    estado, 
    timestamp,
    substring(mensaje, 1, 50) as mensaje_preview
FROM conversaciones 
WHERE mensaje_id IS NOT NULL 
ORDER BY timestamp DESC 
LIMIT 10;
```

**Deberías ver**:
- `mensaje_id` con valores como `"3EB0123456789ABCD_1234567890"`
- `estado` con valores como `"enviado"`, `"entregado"`, `"leido"`

## ⚠️ **Troubleshooting**

### Problema: No veo eventos `send.message`
**Solución**: Tu Evolution API puede estar desactualizada o mal configurada
- Verifica versión de Evolution API
- Revisa configuración de WebSocket events
- Asegúrate de que WEBSOCKET_EVENTS_SEND_MESSAGE=true

### Problema: Los eventos llegan pero estados no se actualizan
**Solución**: 
1. Verifica que ejecutaste la migración SQL
2. Revisa que la función `updateMensajeEstado` esté funcionando
3. Chequea los logs para ver si hay errores de BD

### Problema: Solo veo un check en los mensajes
**Solución**:
1. Verifica que Evolution API está enviando `messages.update` events
2. Revisa si el webhook está configurado correctamente
3. Asegúrate de que los mensajes se guardan con `mensaje_id`

## 🚀 **Resultado Final**

Después de aplicar estos cambios:
- ✅ Mensajes se guardan con `mensaje_id` único
- ✅ Estados se actualizan automáticamente desde WhatsApp
- ✅ UI muestra indicadores visuales correctos (⏱️, ✓, ✓✓)
- ✅ Sistema de reintento funciona para mensajes fallidos
- ✅ Debug exhaustivo para troubleshooting

**¡El sistema de estados de mensajes debería funcionar completamente!**