# 🔍 Diagnóstico WebSocket - Sistema de Estados de Mensajes

## ✅ Pasos Completados

1. **Migración de BD**: Agregados campos `mensaje_id` y `estado` a tabla `conversaciones`
2. **Logging Mejorado**: Sistema de debug exhaustivo para capturar todos los eventos
3. **Múltiples Eventos**: Escuchando varios tipos de eventos de estado
4. **Compilación**: Todo compila sin errores

## 🚨 Pasos para Diagnosticar

### 1. Ejecutar la Migración de BD

**IMPORTANTE**: Debes ejecutar estos comandos SQL en tu base de datos:

```sql
-- Agregar campos necesarios
ALTER TABLE "public"."conversaciones" 
ADD COLUMN IF NOT EXISTS "mensaje_id" VARCHAR(255) NULL;

ALTER TABLE "public"."conversaciones" 
ADD COLUMN IF NOT EXISTS "estado" VARCHAR(20) NULL;

-- Verificar que se agregaron
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'conversaciones' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### 2. Reiniciar el Servidor

Reinicia tu servidor Node.js para aplicar los cambios del WebSocket mejorado:

```bash
cd server
npm run dev  # o npm start
```

### 3. Monitorear los Logs

Una vez reiniciado el servidor, envía un mensaje desde la interfaz y observa los logs. Deberías ver:

#### ✅ Logs Esperados al Conectar:
```
🔗 Socket conectado a WhatsApp
👥 Asesores recargados: X
```

#### ✅ Logs Esperados al Enviar Mensaje:
```
🔍 [DEBUG] Evento recibido: "messages.upsert"
📨 [messages.upsert] Evento específico recibido
✅ [NOMBRE_ASESOR] Mensaje ENVIADO POR MÍ
✅ Mensaje guardado exitosamente
```

#### ✅ Logs Esperados al Cambiar Estado:
```
🔍 [DEBUG] Evento recibido: "messages.update"
🔄 [messages.update] Procesando actualización de estado
📊 [NOMBRE_ASESOR] Estado actualizado
✅ Estado actualizado en BD para mensaje ABC123
```

### 4. Verificar en Base de Datos

Ejecuta esta consulta para ver si los mensajes se están guardando con `mensaje_id`:

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

## 🔧 Posibles Problemas y Soluciones

### ❌ Problema 1: No se reciben eventos
**Síntoma**: Solo ves logs de conexión, no de eventos
**Solución**: Verificar configuración de Evolution API WebSocket

### ❌ Problema 2: Se reciben eventos pero no actualizaciones de estado
**Síntoma**: Ves `messages.upsert` pero no `messages.update`
**Soluciones**:
- Evolution API puede usar nombres de eventos diferentes
- Verificar si está en modo global vs tradicional
- Revisar la documentación específica de tu versión de Evolution API

### ❌ Problema 3: Estados no se actualizan en BD
**Síntoma**: Ves logs de actualización pero BD no cambia
**Solución**: Verificar que los campos existen en BD y función `updateMensajeEstado`

## 📞 Información de Contacto para Debug

Comparte estos logs si necesitas ayuda:
1. Logs del servidor al iniciar
2. Logs al enviar un mensaje
3. Resultado de la consulta SQL de verificación
4. Variables de entorno de Evolution API (sin claves secretas)

## 🎯 Eventos Específicos que Estamos Escuchando

- `messages.upsert` - Nuevos mensajes
- `messages.update` - Actualización de mensajes  
- `message.update` - Actualización de mensaje singular
- `messages.receipt.update` - Actualización de recibos
- `message.receipt.update` - Recibo singular
- `messageUpdate` - Forma alternativa
- `connection.update` - Estado de conexión
- `qr.updated` - Código QR

El sistema ahora debería capturar CUALQUIER evento que llegue y mostrártelo en los logs para identificar exactamente qué está enviando tu Evolution API.