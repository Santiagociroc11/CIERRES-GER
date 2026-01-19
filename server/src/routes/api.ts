import { Router } from 'express';
import winston from 'winston';
import { getConversacionesPorAsesor, getMensajesConversacion, procesarVIPs, guardarVIPsNuevos, getVIPsPendientes, asignarVIPAsesor, actualizarEstadoVIP, getVIPsPorAsesor, getVIPsEnSistema, getVIPsEnPipelinePorAsesor, getVIPsTableData, getTodosClientesVIPPorAsesor } from '../dbClient';
import telegramQueue from '../services/telegramQueueService';
import { getPlatformUrl } from '../utils/platformUrl';

const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Middleware de logging para todas las rutas de la API
router.use((req, res, next) => {
  logger.info(`API Request: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Ruta de status de la API
router.get('/status', (req, res) => {
  res.json({
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Ejemplo de ruta para obtener datos
router.get('/data', (req, res) => {
  try {
    const data = [
      { id: 1, name: 'Ejemplo 1', createdAt: new Date().toISOString() },
      { id: 2, name: 'Ejemplo 2', createdAt: new Date().toISOString() }
    ];
    
    res.json({
      success: true,
      data,
      total: data.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo datos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta POST de ejemplo para crear datos
router.post('/data', (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`Creando nuevo item: ${name}`);
    
    const newItem = {
      id: Date.now(),
      name,
      description: description || '',
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json({
      success: true,
      message: 'Item creado exitosamente',
      data: newItem,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creando item:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta PUT de ejemplo para actualizar datos
router.put('/data/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`Actualizando item ${id}: ${name}`);
    
    const updatedItem = {
      id: parseInt(id),
      name,
      description: description || '',
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'Item actualizado exitosamente',
      data: updatedItem,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error actualizando item:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta DELETE de ejemplo para eliminar datos
router.delete('/data/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`Eliminando item ${id}`);
    
    res.json({
      success: true,
      message: 'Item eliminado exitosamente',
      id: parseInt(id),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error eliminando item:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta de ejemplo para búsqueda
router.get('/search', (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro de búsqueda "q" es requerido',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`Búsqueda: "${q}" con límite ${limit}`);
    
    // Simular resultados de búsqueda
    const results = [
      { id: 1, name: `Resultado para "${q}"`, relevance: 0.95 },
      { id: 2, name: `Otro resultado "${q}"`, relevance: 0.87 }
    ];
    
    res.json({
      success: true,
      query: q,
      results,
      total: results.length,
      limit: parseInt(limit as string),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error en búsqueda:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Telegram Bot Management
router.get('/telegram/status', async (req, res) => {
  try {
    const telegramBot = require('../services/telegramBot').default;
    const status = telegramBot.getStatus();
    const webhookInfo = await telegramBot.getWebhookInfo();
    
    res.json({
      success: true,
      data: {
        ...status,
        webhookUrl: webhookInfo?.url || null,
        pendingUpdates: webhookInfo?.pending_update_count || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estado del bot:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado del bot',
      timestamp: new Date().toISOString()
    });
  }
});

// Configurar webhook de Telegram
router.post('/telegram/set-webhook', async (req, res) => {
  try {
    const telegramBot = require('../services/telegramBot').default;
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere webhookUrl en el body',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await telegramBot.setWebhook(webhookUrl);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error configurando webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error configurando webhook de Telegram',
      timestamp: new Date().toISOString()
    });
  }
});

// Eliminar webhook de Telegram
router.post('/telegram/delete-webhook', async (req, res) => {
  try {
    const telegramBot = require('../services/telegramBot').default;
    const result = await telegramBot.deleteWebhook();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error eliminando webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Error eliminando webhook de Telegram',
      timestamp: new Date().toISOString()
    });
  }
});


// 🆕 Ruta para obtener conversaciones de un asesor
router.get('/conversaciones/:asesorId', async (req, res) => {
  try {
    const asesorId = parseInt(req.params.asesorId);
    if (isNaN(asesorId)) {
      return res.status(400).json({ 
        success: false,
        error: 'ID de asesor inválido',
        timestamp: new Date().toISOString()
      });
    }
    
    const conversaciones = await getConversacionesPorAsesor(asesorId);
    res.json({
      success: true,
      data: conversaciones,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error obteniendo conversaciones:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// 🆕 Ruta para obtener mensajes de una conversación
router.get('/mensajes/:asesorId/:clienteKey', async (req, res) => {
  try {
    const asesorId = parseInt(req.params.asesorId);
    const clienteKey = req.params.clienteKey;
    
    if (isNaN(asesorId)) {
      return res.status(400).json({ 
        success: false,
        error: 'ID de asesor inválido',
        timestamp: new Date().toISOString()
      });
    }
    
    const mensajes = await getMensajesConversacion(asesorId, clienteKey);
    res.json({
      success: true,
      data: mensajes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error obteniendo mensajes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// ENDPOINTS PARA GESTIÓN DE VIPs
// ================================

// Procesar CSV de VIPs
router.post('/vips/procesar', async (req, res) => {
  try {
    const { vips } = req.body;
    
    if (!vips || !Array.isArray(vips)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de VIPs',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Procesando ${vips.length} VIPs desde CSV`);
    
    const resultado = await procesarVIPs(vips);
    
    res.json({
      success: true,
      data: resultado,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error procesando VIPs:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Guardar VIPs nuevos después del procesamiento
router.post('/vips/guardar', async (req, res) => {
  try {
    const { vips } = req.body;
    
    if (!vips || !Array.isArray(vips)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de VIPs',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Guardando ${vips.length} VIPs nuevos`);
    
    const resultado = await guardarVIPsNuevos(vips);
    
    res.json({
      success: true,
      data: resultado,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error guardando VIPs:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener todos los VIPs pendientes
router.get('/vips/pendientes', async (req, res) => {
  try {
    logger.info('🔄 Obteniendo VIPs pendientes');
    
    const vips = await getVIPsPendientes();
    
    res.json({
      success: true,
      data: vips,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error obteniendo VIPs pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Asignar VIP a un asesor
router.patch('/vips/:vipId/asignar', async (req, res) => {
  try {
    const vipId = parseInt(req.params.vipId);
    const { asesorId } = req.body;
    
    if (!asesorId || isNaN(vipId)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere vipId y asesorId válidos',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Asignando VIP ${vipId} a asesor ${asesorId}`);
    
    await asignarVIPAsesor(vipId, asesorId);
    
    res.json({
      success: true,
      message: 'VIP asignado exitosamente',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error asignando VIP:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Función para crear mensaje de notificación masiva
function crearMensajeVIPsMasivos(cantidadVips: number, asesorNombre: string): string {
  return `🎯 *ASIGNACIÓN MASIVA DE VIPs*

👤 *Asesor:* ${asesorNombre}
📊 *VIPs Asignados:* ${cantidadVips}

⏰ *Fecha:* ${new Date().toLocaleString('es-ES', { 
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit', 
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

🔥 Estos VIPs han sido priorizados por su nivel de conciencia
📋 Revisa tu lista de clientes para verlos todos

🚀 *¡Comienza a contactarlos de inmediato!*`;
}

// Asignación masiva de VIPs
router.post('/vips/asignar-masivo', async (req, res) => {
  try {
    const { asignaciones, prioridad } = req.body;
    
    if (!asignaciones || typeof asignaciones !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un objeto de asignaciones válido',
        timestamp: new Date().toISOString()
      });
    }
    
    // Calcular total de VIPs solicitados
    const totalVipsSolicitados = Object.values(asignaciones as Record<number, number>)
      .reduce((sum, cantidad) => sum + (cantidad as number), 0);
    
    if (totalVipsSolicitados === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay VIPs para asignar',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Procesando asignación masiva de ${totalVipsSolicitados} VIPs`);
    
    // Obtener VIPs pendientes ordenados por prioridad
    const vipsPendientes = await getVIPsPendientes();
    
    if (totalVipsSolicitados > vipsPendientes.length) {
      return res.status(400).json({
        success: false,
        error: `No hay suficientes VIPs pendientes. Disponibles: ${vipsPendientes.length}, Solicitados: ${totalVipsSolicitados}`,
        timestamp: new Date().toISOString()
      });
    }
    
    let indiceProcesado = 0;
    let totalAsignados = 0;
    const errores: string[] = [];
    
    // Procesar asignaciones por asesor
    for (const [asesorIdStr, cantidad] of Object.entries(asignaciones as Record<string, number>)) {
      const asesorId = parseInt(asesorIdStr);
      const cantidadVips = cantidad as number;
      
      if (cantidadVips > 0) {
        logger.info(`📋 Asignando ${cantidadVips} VIPs al asesor ${asesorId}`);
        
        // Tomar los siguientes VIPs en orden de prioridad
        const vipsParaAsesor = vipsPendientes.slice(indiceProcesado, indiceProcesado + cantidadVips);
        
        // Asignar cada VIP individualmente (sin notificaciones individuales, solo masiva)
        let vipsAsignadosAsesor = 0;
        for (const vip of vipsParaAsesor) {
          try {
            if (!vip.ID) {
              errores.push(`VIP sin ID válido para asesor ${asesorId}`);
              continue;
            }
            // ✅ CORREGIDO: Omitir notificaciones individuales en asignación masiva
            // Solo se enviará la notificación masiva al final
            await asignarVIPAsesor(vip.ID, asesorId, true); // skipNotification = true
            totalAsignados++;
            vipsAsignadosAsesor++;
          } catch (error) {
            errores.push(`Error asignando VIP ${vip.ID} al asesor ${asesorId}: ${error}`);
          }
        }
        
        // Enviar notificación masiva al asesor si se asignaron VIPs exitosamente
        if (vipsAsignadosAsesor > 0) {
          try {
            // Obtener datos del asesor
            const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;
            const asesorResponse = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${asesorId}&select=NOMBRE,ID_TG`);
            const asesores = await asesorResponse.json();
            const asesor = asesores[0];
            
            if (asesor?.ID_TG) {
              const mensaje = crearMensajeVIPsMasivos(vipsAsignadosAsesor, asesor.NOMBRE);
              const messageId = telegramQueue.enqueueMessage(
                asesor.ID_TG,
                mensaje,
                undefined,
                {
                  type: 'mass_vip_assignment',
                  asesor: asesor.NOMBRE,
                  cantidad_vips: vipsAsignadosAsesor,
                  asesor_id: asesorId
                },
                {
                  inline_keyboard: [[
                    {
                      text: "🚀 Ir a la Plataforma",
                      url: getPlatformUrl()
                    }
                  ]]
                }
              );
              logger.info(`📱 Notificación masiva VIP encolada para ${asesor.NOMBRE}: ${messageId} (${vipsAsignadosAsesor} VIPs)`);
            } else {
              logger.warn(`⚠️ Asesor ${asesorId} sin ID de Telegram, no se envió notificación masiva`);
            }
          } catch (error) {
            logger.error(`❌ Error encolando notificación masiva para asesor ${asesorId}:`, error);
          }
        }
        
        indiceProcesado += cantidadVips;
      }
    }
    
    logger.info(`✅ Asignación masiva completada: ${totalAsignados} VIPs asignados, ${errores.length} errores`);
    
    res.json({
      success: true,
      data: {
        asignados: totalAsignados,
        errores: errores.length,
        detalleErrores: errores
      },
      message: `${totalAsignados} VIPs asignados exitosamente`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error en asignación masiva:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Actualizar estado de VIP
router.patch('/vips/:vipId/estado', async (req, res) => {
  try {
    const vipId = parseInt(req.params.vipId);
    const { estado, notas } = req.body;
    
    if (!estado || isNaN(vipId)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere vipId y estado válidos',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Actualizando VIP ${vipId} a estado: ${estado}`);
    
    await actualizarEstadoVIP(vipId, estado, notas);
    
    res.json({
      success: true,
      message: 'Estado de VIP actualizado exitosamente',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error actualizando estado VIP:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener VIPs asignados a un asesor
router.get('/vips/asesor/:asesorId', async (req, res) => {
  try {
    const asesorId = parseInt(req.params.asesorId);
    
    if (isNaN(asesorId)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere asesorId válido',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Obteniendo VIPs del asesor ${asesorId}`);
    
    const vips = await getVIPsPorAsesor(asesorId);
    
    res.json({
      success: true,
      data: vips,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error obteniendo VIPs del asesor:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener VIPs que ya están en el sistema (para Kanban)
router.get('/vips/en-sistema', async (req, res) => {
  try {
    logger.info('🔄 Obteniendo VIPs que están en el sistema');
    
    const vips = await getVIPsEnSistema();
    
    res.json({
      success: true,
      data: vips,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error obteniendo VIPs en sistema:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener VIPs en pipeline agrupados por asesor
router.get('/vips/pipeline-por-asesor', async (req, res) => {
  try {
    logger.info('🔄 Obteniendo VIPs en pipeline agrupados por asesor');
    
    const vipsPorAsesor = await getVIPsEnPipelinePorAsesor();
    
    res.json({
      success: true,
      data: vipsPorAsesor,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error obteniendo VIPs en pipeline por asesor:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener datos de VIPs para vista de tabla con métricas
router.get('/vips/table-data', async (req, res) => {
  try {
    logger.info('🔄 Obteniendo datos de VIPs para vista de tabla');
    
    const vipsTableData = await getVIPsTableData();
    
    res.json({
      success: true,
      data: vipsTableData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error obteniendo datos de tabla VIP:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener todos los clientes VIP de un asesor (para el modal)
router.get('/vips/asesor/:asesorId/todos', async (req, res) => {
  try {
    const asesorId = parseInt(req.params.asesorId);
    
    if (isNaN(asesorId)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere asesorId válido',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`🔄 Obteniendo todos los clientes VIP del asesor ${asesorId}`);
    
    const todosLosClientes = await getTodosClientesVIPPorAsesor(asesorId);
    
    res.json({
      success: true,
      data: todosLosClientes,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`❌ Error obteniendo todos los clientes VIP del asesor ${req.params.asesorId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
