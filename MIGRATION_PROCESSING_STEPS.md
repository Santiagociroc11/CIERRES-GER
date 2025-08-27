# Migración: Agregar Campo processing_steps a webhook_logs

## Resumen
Esta migración agrega el campo `processing_steps` a la tabla `webhook_logs` para almacenar los pasos detallados del procesamiento de webhooks, permitiendo un logging completo y persistente del flujo de procesamiento.

## Archivos Modificados

### 1. Base de Datos
- **Nueva migración**: `supabase/migrations/20250115_add_processing_steps.sql`
- **Campo agregado**: `processing_steps JSONB` a la tabla `webhook_logs`
- **Índices**: Índice GIN para búsquedas eficientes en JSON
- **Vistas actualizadas**: `recent_webhook_logs` incluye el nuevo campo
- **Funciones nuevas**: Búsqueda y estadísticas por pasos de procesamiento

### 2. Backend (server/src/)
- **dbClient.ts**: Interfaces actualizadas para incluir `processing_steps`
- **routes/hotmart.ts**: Código modificado para guardar `processingSteps` en BD

### 3. Frontend (src/components/)
- **WebhookLogs.tsx**: Interfaz actualizada para usar `processing_steps`

## Cómo Aplicar la Migración

### Opción 1: Supabase Local
```bash
# En el directorio supabase/
supabase db reset
# O si solo quieres aplicar la nueva migración:
supabase db push
```

### Opción 2: Supabase Cloud
```bash
# Aplicar la migración específica
supabase db push --include-all
```

### Opción 3: SQL Directo
```sql
-- Ejecutar directamente en tu base de datos
\i supabase/migrations/20250115_add_processing_steps.sql
```

## Estructura del Campo processing_steps

### Formato JSON
```json
[
  {
    "step": "database_lookup",
    "status": "starting",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  {
    "step": "database_lookup",
    "status": "completed",
    "result": "client_found",
    "clientId": 123,
    "timestamp": "2024-01-15T10:30:01.000Z"
  },
  {
    "step": "manychat_integration",
    "status": "starting",
    "timestamp": "2024-01-15T10:30:02.000Z"
  }
]
```

### Campos de Cada Paso
- **step**: Nombre del paso (ej: "database_lookup", "manychat_integration")
- **status**: Estado del paso ("starting", "completed", "failed", "skipped")
- **timestamp**: Cuándo se ejecutó el paso
- **action**: Descripción de la acción (opcional)
- **input**: Datos de entrada (opcional)
- **result**: Resultado del paso (opcional)
- **error**: Mensaje de error si falló (opcional)

## Funcionalidades Nuevas

### 1. Búsqueda por Pasos
```sql
-- Buscar webhooks que ejecutaron un paso específico
SELECT * FROM search_webhook_logs_by_step('manychat_integration');
```

### 2. Estadísticas de Pasos
```sql
-- Obtener estadísticas de ejecución de pasos
SELECT * FROM get_processing_steps_stats(7); -- últimos 7 días
```

### 3. Consultas JSONB
```sql
-- Buscar webhooks con pasos fallidos
SELECT * FROM webhook_logs 
WHERE processing_steps @> '[{"status": "failed"}]';

-- Buscar webhooks que ejecutaron un paso específico
SELECT * FROM webhook_logs 
WHERE processing_steps @> '[{"step": "database_lookup"}]';
```

## Beneficios de la Migración

### 1. Logging Persistente
- Los pasos de procesamiento ahora se guardan en BD
- Información disponible para análisis histórico
- No se pierde al reiniciar el servidor

### 2. Debugging Mejorado
- Visibilidad completa del flujo de procesamiento
- Identificación rápida de pasos problemáticos
- Análisis de performance por paso

### 3. Análisis y Monitoreo
- Estadísticas de éxito/fallo por paso
- Métricas de tiempo de ejecución
- Identificación de cuellos de botella

### 4. Auditoría Completa
- Trazabilidad completa del procesamiento
- Historial de cambios y errores
- Cumplimiento de requisitos de auditoría

## Verificación de la Migración

### 1. Verificar Campo en BD
```sql
-- Verificar que el campo existe
\d webhook_logs

-- Verificar que hay datos
SELECT id, processing_steps FROM webhook_logs LIMIT 5;
```

### 2. Probar Webhook
```bash
# Enviar webhook de prueba
curl -X POST http://localhost:3001/api/hotmart/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "PURCHASE_APPROVED", "data": {...}}'
```

### 3. Verificar en Frontend
- Ir a la pestaña "Log Crudo" en WebhookLogs
- Verificar que se muestran los pasos de procesamiento
- Confirmar que la información persiste entre recargas

## Rollback (si es necesario)

### Revertir la Migración
```sql
-- Eliminar el campo (¡CUIDADO! Esto eliminará datos)
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS processing_steps;

-- Eliminar índices
DROP INDEX IF EXISTS idx_webhook_logs_processing_steps;

-- Revertir vistas
-- (restaurar desde backup o recrear manualmente)
```

## Notas Importantes

1. **Compatibilidad**: La migración es compatible con datos existentes
2. **Performance**: El índice GIN puede afectar ligeramente el rendimiento de escritura
3. **Tamaño**: Los logs pueden crecer significativamente con pasos detallados
4. **Retención**: Considerar políticas de retención para logs antiguos

## Próximos Pasos

1. **Aplicar la migración** en el entorno de desarrollo
2. **Probar** con webhooks reales
3. **Verificar** que la información se guarda correctamente
4. **Implementar** en producción
5. **Monitorear** el crecimiento de la tabla
6. **Considerar** políticas de limpieza de logs antiguos
