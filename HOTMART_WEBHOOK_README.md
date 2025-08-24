# Implementación del Webhook de Hotmart

## Resumen

Se ha completado la implementación completa del webhook de Hotmart, migrando toda la lógica de N8N al backend de Node.js/Express. El sistema procesa automáticamente todos los eventos de Hotmart y ejecuta las acciones correspondientes.

## Funcionalidades Implementadas

### 1. Procesamiento de Webhooks ✅
- **Endpoint**: `POST /api/hotmart/webhook`
- **Eventos soportados**:
  - `CART*` → Flujo CARRITOS
  - `PURCHASE_APPROVED` → Flujo COMPRAS  
  - `PURCHASE_CANCELED` → Flujo RECHAZADOS
  - `PURCHASE_BILLET_PRINTED` → Flujo TICKETS

### 2. Gestión de Clientes ✅
- Búsqueda de clientes existentes por WhatsApp (últimos 7 dígitos)
- Creación automática de clientes nuevos
- Actualización de estados y datos de compra
- Asignación automática de asesores basada en lógica ponderada

### 3. Integración con ManyChat ✅
- Búsqueda de subscribers existentes
- Creación automática de nuevos subscribers
- Envío de flujos automáticos según el evento
- Configuración dinámica de IDs de flujo por tipo de evento

### 4. Integración con MailerLite ✅
- Adición automática de subscribers a grupos
- Configuración dinámica de grupos por flujo
- Manejo de errores y logging

### 5. Notificaciones de Telegram ✅
- Notificaciones de ventas al grupo principal
- Notificaciones directas a asesores asignados
- Botones inline para acciones rápidas (WhatsApp, Sistema)
- Mensajes personalizados por tipo de evento

### 6. Sistema de Contadores ✅
- Incremento automático de contadores por asesor
- Contadores por flujo: CARRITOS, RECHAZADOS, COMPRAS, TICKETS
- Función stored procedure para actualización eficiente

### 7. Registro de Eventos ✅
- Inserción automática en tabla GERSSON_REGISTROS
- Timestamp preciso de eventos
- Tracking completo del historial del cliente

## Arquitectura

### Archivos Principales
```
server/src/
├── routes/hotmart.ts           # Endpoint principal del webhook
├── services/
│   ├── manychatService.ts      # Integración ManyChat
│   ├── mailerliteService.ts    # Integración MailerLite
│   └── telegramService.ts      # Notificaciones Telegram
├── dbClient.ts                 # Funciones de base de datos
└── config/webhookConfig.ts     # Configuración dinámica
```

### Base de Datos
```sql
-- Nuevas funciones stored procedures
get_next_asesor_ponderado()     # Selección inteligente de asesores
increment_asesor_counter()      # Actualización de contadores
```

## Flujo de Procesamiento

### 1. Recepción del Webhook
```
Webhook Hotmart → Validación → Determinación del Flujo → Extracción de Datos
```

### 2. Procesamiento del Cliente
```
Búsqueda por WhatsApp → Cliente Existente? 
├─ SÍ → Actualizar Estado + Asesor
└─ NO → Crear Cliente + Asignar Asesor (si aplica)
```

### 3. Acciones Automáticas
```
Registro de Evento → ManyChat → MailerLite → Telegram → Respuesta
```

## Configuración

### Variables de Entorno
```bash
# Base de datos
POSTGREST_URL=https://your-supabase-url.supabase.co/rest/v1

# ManyChat
MANYCHAT_TOKEN=288702267651723:f96a1f26344892df99c98292741de8c9

# MailerLite  
MAILERLITE_TOKEN=your-mailerlite-token

# Telegram
TELEGRAM_BOT_TOKEN=8117750846:AAExGxB3Mbwv2YBb6b7rMAvP6vsIPeH8EIM
```

### Configuración Dinámica
```javascript
// Editable vía API: POST /api/hotmart/config
{
  "numericos": {
    "CARRITOS": "content20250222080111_909145",
    "RECHAZADOS": "content20250222082908_074257", 
    "COMPRAS": "content20250222083048_931507",
    "TICKETS": "content20250222083004_157122"
  },
  "mailer": {
    "CARRITOS": "112554445482493399",
    "RECHAZADOS": "112554438393071296",
    "COMPRAS": "112554427903116632", 
    "TICKETS": "147071027455723326"
  }
}
```

## Endpoints Disponibles

### Webhook Principal
- `POST /api/hotmart/webhook` - Recibe webhooks de Hotmart

### Configuración
- `GET /api/hotmart/config` - Obtiene configuración actual
- `PUT /api/hotmart/config` - Actualiza configuración
- `POST /api/hotmart/config/reset` - Resetea a valores por defecto

### Testing y Monitoreo
- `POST /api/hotmart/test` - Prueba lógica con datos simulados
- `GET /api/hotmart/stats` - Estadísticas del webhook

## Ejemplo de Uso

### Datos de Entrada (Webhook)
```json
{
  "event": "PURCHASE_APPROVED",
  "data": {
    "buyer": {
      "name": "Juan Pérez",
      "email": "juan@example.com", 
      "checkout_phone": "573001234567"
    },
    "purchase": {
      "transaction": "HP123456"
    }
  }
}
```

### Respuesta
```json
{
  "success": true,
  "message": "Webhook procesado exitosamente",
  "data": {
    "numero": "573001234567",
    "nombre": "Juan Pérez", 
    "flujo": "COMPRAS",
    "clienteId": 123,
    "asesorAsignado": "Carlos Mendez",
    "esClienteExistente": false
  }
}
```

## Migración Completada

### Desde N8N ➜ Backend
- ✅ Lógica de procesamiento de eventos
- ✅ Búsqueda y creación de clientes
- ✅ Asignación inteligente de asesores
- ✅ Integración con ManyChat API
- ✅ Integración con MailerLite API  
- ✅ Notificaciones de Telegram
- ✅ Actualización de contadores
- ✅ Registro de eventos
- ✅ Configuración dinámica
- ✅ Manejo de errores y logging

### Ventajas del Nuevo Sistema
- ⚡ Mayor velocidad de procesamiento
- 🔧 Configuración dinámica sin reiniciar
- 📊 Logging detallado y debugging
- 🛡️ Mejor manejo de errores
- 🔄 Reintentos automáticos en APIs externas
- 📈 Escalabilidad mejorada
- 🧪 Endpoints de testing integrados

El webhook de Hotmart está completamente implementado y listo para usar en producción.