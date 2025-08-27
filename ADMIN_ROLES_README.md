# Sistema de Roles de Administradores

## Descripción

Se ha implementado un sistema de roles para los administradores que permite crear usuarios con diferentes niveles de acceso. Ahora existen dos tipos de roles:

### Roles Disponibles

#### 1. **Admin** (Acceso Completo)
- ✅ Acceso a todas las funcionalidades del sistema
- ✅ Gestión de asesores
- ✅ Reasignación de clientes
- ✅ Configuración de webhooks
- ✅ Gestión de asignaciones
- ✅ Vista de clientes y reportes
- ✅ Estadísticas y análisis

#### 2. **Supervisor** (Acceso Limitado)
- ✅ Vista de asesores y sus estadísticas
- ✅ Vista de clientes y reportes
- ✅ Estadísticas y análisis
- ❌ **NO** puede reasignar clientes
- ❌ **NO** puede acceder a configuraciones de webhooks
- ❌ **NO** puede acceder a gestión de asignaciones
- ❌ **NO** tiene acceso a funciones administrativas avanzadas

## Cambios Implementados

### Base de Datos
- Añadido campo `rol` a la tabla `gersson_admins`
- Valores permitidos: `'admin'` | `'supervisor'`
- Valor por defecto: `'admin'`
- Constraint check para validar valores
- Índice para consultas eficientes

### Frontend
- Actualizada interfaz `Admin` con campo `rol`
- Tipo `AdminRole` para TypeScript
- Modificado sistema de login para manejar roles
- Dashboard admin con restricciones condicionales basadas en rol
- Ocultación de elementos de UI para supervisores

### Funcionalidades Restringidas para Supervisores

1. **Botones de navegación ocultos:**
   - Gestión de asignaciones
   - Configuración de webhooks

2. **Componentes deshabilitados:**
   - `ReasignarCliente`: No pueden reasignar clientes a diferentes asesores
   - `GestionAsignaciones`: No pueden acceder a la gestión de asignaciones
   - `WebhookConfig`: No pueden modificar configuraciones de webhooks

3. **Vistas restringidas:**
   - No pueden acceder a `vistaAdmin === 'gestion'`
   - No pueden acceder a `vistaAdmin === 'webhooks'`

## Uso

### Crear un Supervisor
```sql
INSERT INTO gersson_admins (nombre, whatsapp, rol) 
VALUES ('Nombre del Supervisor', '1234567890', 'supervisor');
```

### Convertir Admin a Supervisor
```sql
UPDATE gersson_admins 
SET rol = 'supervisor' 
WHERE whatsapp = 'numero_del_admin';
```

### Convertir Supervisor a Admin
```sql
UPDATE gersson_admins 
SET rol = 'admin' 
WHERE whatsapp = 'numero_del_supervisor';
```

### Consultar Usuarios por Rol
```sql
-- Ver todos los supervisores
SELECT * FROM gersson_admins WHERE rol = 'supervisor';

-- Ver todos los admins completos
SELECT * FROM gersson_admins WHERE rol = 'admin';
```

## Login y Autenticación

El sistema de login automáticamente detecta el rol del usuario y aplica las restricciones correspondientes:

1. Usuario ingresa su WhatsApp
2. Sistema busca en `gersson_admins`
3. Si existe, obtiene el `rol` del usuario
4. Aplica las restricciones según el rol en el dashboard

## Beneficios

- **Seguridad**: Los supervisores no pueden realizar cambios críticos
- **Flexibilidad**: Fácil asignación y cambio de roles
- **Control**: Acceso granular a diferentes funcionalidades
- **Escalabilidad**: Base para futuros roles adicionales

## Casos de Uso

- **Supervisores de turno**: Pueden monitorear pero no modificar asignaciones
- **Analistas**: Acceso a datos sin capacidad de cambio
- **Personal temporal**: Acceso limitado para tareas específicas
- **Entrenamiento**: Nuevos empleados con acceso supervisado

## Notas de Implementación

- Los cambios son retrocompatibles
- Usuarios existentes mantienen rol `'admin'` por defecto
- No se requiere migración de datos existentes
- Sistema extensible para futuros roles
