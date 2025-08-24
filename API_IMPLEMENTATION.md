# Implementación de API REST en CIERRES-GER

## 🚀 Arquitectura Implementada

Se ha implementado una **API REST unificada** que funciona en el mismo puerto que tu frontend, utilizando la siguiente arquitectura:

### Desarrollo Local
- **Frontend**: Vite + React en puerto 4445
- **Backend**: Express + WebSocket en puerto 3001
- **Proxy**: Vite redirige `/api/*` al backend

### Producción
- **Servidor Unificado**: Express sirve tanto la API como el frontend en puerto 4445
- **WebSocket**: Mantiene la funcionalidad de WhatsApp
- **Archivos Estáticos**: El frontend se sirve desde el mismo servidor

## 📁 Estructura de Archivos

```
server/
├── src/
│   ├── index.ts          # Servidor de desarrollo
│   ├── server.ts         # Servidor de producción
│   ├── routes/
│   │   └── api.ts        # Rutas de la API
│   └── whatsappEvents.ts # Lógica de WebSocket
├── package.json
├── tsconfig.json
├── ecosystem.config.js    # Configuración PM2
└── dev.config.js         # Configuración desarrollo
```

## 🔧 Configuración

### Variables de Entorno
```bash
# Configuración del servidor
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# Configuración de Evolution API
EVOLUTION_API_URL=wss://your-evolution-api-url.com
EVOLUTION_API_KEY=your-evolution-api-key
```

### Desarrollo Local
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd server
npm run dev
```

### Producción
```bash
# Construir y ejecutar
npm run build
cd server
npm run build
pm2 start ecosystem.config.js
```

## 🌐 Endpoints de la API

### Health Check
```
GET /health
```

### Status de la API
```
GET /api/status
```

### Operaciones CRUD
```
GET    /api/data          # Obtener todos los datos
POST   /api/data          # Crear nuevo item
PUT    /api/data/:id      # Actualizar item
DELETE /api/data/:id      # Eliminar item
```

### Búsqueda
```
GET /api/search?q=termino&limit=10
```

## 📡 Uso desde el Frontend

### Ejemplo de llamada a la API
```typescript
// Obtener datos
const response = await fetch('/api/data');
const data = await response.json();

// Crear nuevo item
const newItem = await fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Nuevo Item' })
});

// Actualizar item
const updatedItem = await fetch('/api/data/1', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Item Actualizado' })
});
```

## 🐳 Docker

El Dockerfile ha sido actualizado para usar el servidor unificado:

```dockerfile
# Construir frontend
RUN npm run build

# Construir backend
RUN cd server && npm run build

# Ejecutar servidor unificado
CMD ["/app/start.sh"]
```

## 🔄 Flujo de Desarrollo

1. **Desarrollo**: Frontend en puerto 4445, Backend en puerto 3001
2. **Proxy**: Vite redirige `/api/*` al backend
3. **Producción**: Servidor unificado en puerto 4445
4. **WebSocket**: Mantiene funcionalidad de WhatsApp

## ✅ Beneficios de esta Implementación

- **Mismo puerto** para frontend y API
- **Sin problemas de CORS** en desarrollo
- **Fácil despliegue** en un solo contenedor
- **Escalabilidad** para agregar más endpoints
- **Mantenimiento** simplificado
- **Logging** centralizado
- **Seguridad** con Helmet y CORS

## 🚀 Próximos Pasos

1. **Instalar dependencias**: `cd server && npm install`
2. **Configurar variables de entorno**
3. **Probar endpoints**: `curl http://localhost:3001/api/status`
4. **Desarrollar nuevos endpoints** en `server/src/routes/api.ts`
5. **Integrar con frontend** usando fetch o axios

## 📚 Recursos Adicionales

- [Express.js Documentation](https://expressjs.com/)
- [Vite Proxy Configuration](https://vitejs.dev/config/server-options.html#server-proxy)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)
