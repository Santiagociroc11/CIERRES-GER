import { Router } from 'express';
import winston from 'winston';
import { getConversacionesPorAsesor, getMensajesConversacion, procesarVIPs, guardarVIPsNuevos, getVIPsPendientes, asignarVIPAsesor, actualizarEstadoVIP, getVIPsPorAsesor, getVIPsEnSistema, getVIPsEnPipelinePorAsesor, getVIPsTableData, getTodosClientesVIPPorAsesor, getClienteById, verificarVIPExistente, insertarVIPIndividual } from '../dbClient';
import telegramQueue from '../services/telegramQueueService';
import { getPlatformUrl } from '../utils/platformUrl';
import { markdownToHtml } from '../utils/telegramFormat';
import { getHotmartConfig, getPagosExternosConfig, getCuposVipConfig, updateCuposVipConfig } from '../config/webhookConfig';

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

// Endpoint para recibir cupos VIP desde formulario web (reemplaza n8n)
router.post('/cupo-vip', async (req, res) => {
  try {
    const { nombre, correo, whatsapp } = req.body;

    // Validar campos requeridos
    if (!whatsapp) {
      return res.status(400).json({
        success: false,
        error: 'El campo whatsapp es requerido',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`🔄 Recibiendo cupo VIP: ${nombre || 'Sin nombre'} - ${whatsapp}`);

    // Verificar si el VIP ya existe
    const vipExistente = await verificarVIPExistente(whatsapp);

    if (vipExistente) {
      logger.info(`ℹ️ VIP ya existe en el sistema: ${vipExistente.ID}`);
      return res.json({
        success: true,
        message: 'VIP ya existe en el sistema',
        data: {
          id: vipExistente.ID,
          yaExistia: true
        },
        timestamp: new Date().toISOString()
      });
    }

    // Insertar nuevo VIP
    const nuevoVIP = await insertarVIPIndividual({
      NOMBRE: nombre || null,
      CORREO: correo || null,
      WHATSAPP: whatsapp,
      ORIGEN_REGISTRO: 'formulario_web'
    });

    logger.info(`✅ VIP insertado exitosamente: ID ${nuevoVIP.ID}`);

    // Enviar notificación a Telegram (similar a n8n)
    try {
      const hotmartConfig = await getHotmartConfig();
      const cuposVipConfig = await getCuposVipConfig();
      const botToken = hotmartConfig.tokens?.telegram;
      
      // Usar configuración específica de cupos VIP, o fallback a configuración de Hotmart
      const telegramConfig = cuposVipConfig.telegram?.groupChatId 
        ? cuposVipConfig.telegram 
        : hotmartConfig.telegram;

      if (botToken && telegramConfig?.groupChatId) {
        // Formato HTML similar al de n8n
        const mensaje = `<b>CUPO VIP GENERADO</b> 🔥\n\n<b>NOMBRE:</b> ${nombre || 'No proporcionado'}\n<b>CORREO:</b> ${correo || 'No proporcionado'}\n<b>WHATSAPP:</b> ${whatsapp}`;

        // Convertir threadId de string a number si existe
        const threadIdNumber = telegramConfig.threadId 
          ? (typeof telegramConfig.threadId === 'string' ? parseInt(telegramConfig.threadId, 10) : telegramConfig.threadId)
          : undefined;

        telegramQueue.enqueueMessage(
          telegramConfig.groupChatId,
          mensaje,
          undefined, // webhookLogId
          undefined, // metadata
          undefined, // reply_markup
          threadIdNumber // message_thread_id (puede ser undefined)
        );

        logger.info('✅ Notificación de Telegram encolada');
      } else {
        logger.warn('⚠️ Configuración de Telegram no disponible, no se envió notificación');
      }
    } catch (telegramError) {
      // No fallar el endpoint si Telegram falla, solo loguear
      logger.error('❌ Error enviando notificación a Telegram:', telegramError);
    }

    res.json({
      success: true,
      message: 'Cupo VIP registrado exitosamente',
      data: {
        id: nuevoVIP.ID,
        yaExistia: false
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error procesando cupo VIP:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
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
              const mensajeMarkdown = crearMensajeVIPsMasivos(vipsAsignadosAsesor, asesor.NOMBRE);
              // ✅ Convertir Markdown a HTML para telegramQueueService (que usa parse_mode: 'HTML')
              const mensajeHtml = markdownToHtml(mensajeMarkdown);
              const messageId = telegramQueue.enqueueMessage(
                asesor.ID_TG,
                mensajeHtml,
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

// Endpoint para reportar pagos externos (migrado de n8n)
router.post('/pagosexternos-reisy', async (req, res) => {
  try {
    const { 
      clienteID, 
      asesorID, 
      nombreAsesor, 
      tipoVenta, 
      comentario, 
      imagenPagoUrl, 
      medioPago, 
      pais, 
      correoInscripcion, 
      telefono,
      correoPago,
      cedulaComprador,
      actividadEconomica
    } = req.body;

    // Validar datos requeridos
    if (!clienteID || !imagenPagoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere clienteID e imagenPagoUrl',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Reporte de pago externo recibido', {
      clienteID,
      asesorID,
      nombreAsesor,
      tipoVenta,
      imagenPagoUrl
    });

    // Obtener datos del cliente
    const cliente = await getClienteById(clienteID);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener configuración de Telegram para pagos externos (configuración específica)
    const hotmartConfig = await getHotmartConfig();
    const TELEGRAM_BOT_TOKEN = hotmartConfig.tokens.telegram;
    
    // Obtener configuración específica de pagos externos
    const pagosExternosConfig = await getPagosExternosConfig();
    const groupChatId = pagosExternosConfig.telegram.groupChatId || hotmartConfig.telegram.groupChatId || '-1003694709837';
    const threadId = pagosExternosConfig.telegram.threadId 
      ? parseInt(pagosExternosConfig.telegram.threadId, 10) 
      : (hotmartConfig.telegram.threadId ? parseInt(hotmartConfig.telegram.threadId, 10) : 5);

    logger.info('Configuración de pagos externos cargada', {
      groupChatId,
      threadId,
      tieneGroupChatId: !!pagosExternosConfig.telegram.groupChatId,
      tieneThreadId: !!pagosExternosConfig.telegram.threadId,
      fallbackGroupChatId: hotmartConfig.telegram.groupChatId,
      fallbackThreadId: hotmartConfig.telegram.threadId
    });

    if (!TELEGRAM_BOT_TOKEN) {
      logger.error('Token de Telegram no configurado');
      return res.status(500).json({
        success: false,
        error: 'Token de Telegram no configurado',
        timestamp: new Date().toISOString()
      });
    }

    // Importar escapeHtml para formatear el caption
    const { escapeHtml } = await import('../utils/telegramFormat');
    const FormData = require('form-data');

    // Construir el caption del mensaje en HTML
    // Nota: Evitar usar "->" y "<-" ya que Telegram los interpreta como tags HTML
    const caption = `<b>Notificación de Pago Externo</b>\n\n` +
      `<b>Nombre:</b> ${escapeHtml(cliente.NOMBRE)}\n` +
      `<b>País:</b> ${escapeHtml(pais || 'N/A')}\n` +
      `<b>Medio:</b> ${escapeHtml(medioPago || 'N/A')}\n` +
      `<b>Teléfono:</b> ${escapeHtml(telefono || cliente.WHATSAPP || 'N/A')}\n` +
      `<b>Correo inscripción:</b> ${escapeHtml(correoInscripcion || 'N/A')}\n` +
      `<b>Correo Pago (stripe):</b> ${escapeHtml(correoPago || 'no aplica')}\n` +
      `<b>CEDULA:</b> ${escapeHtml(cedulaComprador || 'no aplica')}\n` +
      `<b>Actividad económica:</b> ${escapeHtml(actividadEconomica || 'no aplica')}\n` +
      `<b>ASESOR QUE REPORTA:</b> ${escapeHtml(nombreAsesor || 'N/A')}\n\n` +
      `▶️ <b>CONFIRMAR INGRESO E INSCRIBIR</b> 🔥`;

    // Descargar la imagen desde la URL y enviarla como FormData
    try {
      logger.info('Descargando imagen desde URL', {
        imagenPagoUrl: imagenPagoUrl.substring(0, 100) + '...'
      });

      // Descargar la imagen desde la URL
      const imageResponse = await fetch(imagenPagoUrl);
      if (!imageResponse.ok) {
        throw new Error(`Error descargando imagen: ${imageResponse.status} ${imageResponse.statusText}`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      
      // Obtener el content-type de la respuesta o inferirlo
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';

      logger.info('Imagen descargada exitosamente', {
        size: imageBuffer.length,
        contentType,
        extension
      });

      // Crear FormData para enviar la imagen como multipart/form-data
      const form = new FormData();
      form.append('chat_id', groupChatId);
      form.append('photo', imageBuffer, {
        filename: `pago-externo.${extension}`,
        contentType: contentType
      });
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');

      // Solo agregar message_thread_id si threadId es válido
      if (threadId && !isNaN(threadId) && threadId > 0) {
        form.append('message_thread_id', threadId.toString());
      }

      logger.info('Enviando foto a Telegram', {
        groupChatId,
        threadId,
        imageSize: imageBuffer.length,
        usandoFormData: true
      });

      // Usar axios en lugar de fetch para manejar correctamente FormData
      const axios = require('axios');
      let telegramResponse;
      let telegramData;
      
      try {
        telegramResponse = await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          form,
          { 
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );
        telegramData = telegramResponse.data;
      } catch (axiosError: any) {
        // Capturar el error de axios para obtener más detalles
        const errorDetails = axiosError.response?.data || axiosError.message;
        logger.error('Error de axios enviando a Telegram (reporte inicial)', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          errorData: errorDetails,
          errorMessage: axiosError.message,
          groupChatId,
          threadId,
          imageSize: imageBuffer.length,
          captionLength: caption.length
        });
        
        // Devolver el error directamente sin lanzar excepción
        res.status(500).json({
          success: false,
          error: 'Error enviando foto a Telegram',
          details: errorDetails?.description || errorDetails?.message || JSON.stringify(errorDetails),
          debug: {
            groupChatId,
            threadId,
            imageSize: imageBuffer.length,
            captionLength: caption.length,
            tieneToken: !!TELEGRAM_BOT_TOKEN,
            telegramError: errorDetails
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!telegramData || !telegramData.ok) {
        logger.error('Error de Telegram API', {
          status: telegramResponse?.status,
          statusText: telegramResponse?.statusText,
          telegramData,
          groupChatId,
          threadId
        });
        res.status(500).json({
          success: false,
          error: 'Error de Telegram API',
          details: telegramData?.description || JSON.stringify(telegramData),
          debug: {
            groupChatId,
            threadId,
            telegramError: telegramData
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info('Foto de pago externo enviada a Telegram exitosamente', {
        clienteID,
        clienteNombre: cliente.NOMBRE,
        asesorNombre: nombreAsesor,
        telegramMessageId: telegramData.result?.message_id,
        groupChatId,
        threadId
      });

      res.json({
        success: true,
        message: 'Pago externo reportado exitosamente',
        data: {
          clienteID,
          clienteNombre: cliente.NOMBRE,
          asesorNombre: nombreAsesor,
          tipoVenta,
          telegramMessageId: telegramData.result?.message_id,
          telegramChatId: groupChatId,
          telegramThreadId: threadId
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Este catch solo debería ejecutarse si hay un error antes de enviar a Telegram
      // Si ya se envió la respuesta (con return), este catch no debería ejecutarse
      if (!res.headersSent) {
        logger.error('Error antes de enviar a Telegram (reporte inicial)', {
          error: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined,
          clienteID,
          imagenPagoUrl: imagenPagoUrl?.substring(0, 100)
        });
        res.status(500).json({
          success: false,
          error: 'Error procesando reporte de pago externo',
          details: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString()
        });
      }
    }

  } catch (error) {
    logger.error('Error en reporte de pago externo', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: {
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para probar la configuración de pagos externos
router.post('/pagos-externos/test', async (_req, res) => {
  try {
    const { getHotmartConfig } = await import('../config/webhookConfig');
    const { getPagosExternosConfig } = await import('../config/webhookConfig');
    const { escapeHtml } = await import('../utils/telegramFormat');
    const FormData = require('form-data');
    
    const hotmartConfig = await getHotmartConfig();
    const TELEGRAM_BOT_TOKEN = hotmartConfig.tokens.telegram;
    
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Token de Telegram no configurado',
        timestamp: new Date().toISOString()
      });
    }
    
    const pagosExternosConfig = await getPagosExternosConfig();
    const groupChatId = pagosExternosConfig.telegram.groupChatId || hotmartConfig.telegram.groupChatId || '-1003694709837';
    const threadId = pagosExternosConfig.telegram.threadId 
      ? parseInt(pagosExternosConfig.telegram.threadId, 10) 
      : (hotmartConfig.telegram.threadId ? parseInt(hotmartConfig.telegram.threadId, 10) : 5);

    // Crear una imagen de prueba simple (1x1 pixel PNG en base64)
    // Esto es más confiable que depender de una URL externa
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const testImageBuffer = Buffer.from(testImageBase64, 'base64');
    
    // Alternativa: descargar una imagen de prueba desde una URL confiable
    let imageBuffer = testImageBuffer;
    try {
      // Intentar descargar una imagen de prueba más visible
      const imageResponse = await fetch('https://picsum.photos/800/600');
      if (imageResponse.ok) {
        const arrayBuffer = await imageResponse.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        logger.info('Imagen de prueba descargada exitosamente desde picsum.photos');
      }
    } catch (downloadError) {
      logger.warn('No se pudo descargar imagen de prueba, usando imagen mínima', downloadError);
      // Usar la imagen base64 mínima como fallback
    }
    
    const caption = `<b>🧪 Prueba de Configuración de Pagos Externos</b>\n\n` +
      `<b>Grupo:</b> ${escapeHtml(groupChatId)}\n` +
      `<b>Tema/Hilo:</b> ${threadId}\n` +
      `<b>Fecha:</b> ${new Date().toLocaleString('es-ES')}\n\n` +
      `✅ Si recibes este mensaje, la configuración está correcta.`;

    // Crear FormData para enviar la imagen como multipart/form-data
    const form = new FormData();
    form.append('chat_id', groupChatId);
    form.append('photo', imageBuffer, {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg'
    });
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');

    if (threadId && !isNaN(threadId) && threadId > 0) {
      form.append('message_thread_id', threadId.toString());
    }

    logger.info('Enviando mensaje de prueba de pagos externos', {
      groupChatId,
      threadId,
      imageSize: imageBuffer.length,
      usandoFormData: true
    });

    // Usar axios en lugar de fetch para manejar correctamente FormData
    const axios = require('axios');
    let telegramResponse;
    let telegramData;
    
    try {
      telegramResponse = await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        form,
        { 
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      telegramData = telegramResponse.data;
    } catch (axiosError: any) {
      // Capturar el error de axios para obtener más detalles
      const errorDetails = axiosError.response?.data || axiosError.message;
      logger.error('Error de axios en prueba de Telegram', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        errorData: errorDetails,
        errorMessage: axiosError.message,
        groupChatId,
        threadId,
        imageSize: imageBuffer.length
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error enviando mensaje de prueba a Telegram',
        details: errorDetails?.description || JSON.stringify(errorDetails),
        debug: {
          groupChatId,
          threadId,
          tieneToken: !!TELEGRAM_BOT_TOKEN,
          imageSize: imageBuffer.length
        },
        timestamp: new Date().toISOString()
      });
    }

    if (!telegramData || !telegramData.ok) {
      logger.error('Error en prueba de Telegram', {
        status: telegramResponse?.status,
        statusText: telegramResponse?.statusText,
        telegramData,
        groupChatId,
        threadId
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error enviando mensaje de prueba a Telegram',
        details: telegramData?.description || JSON.stringify(telegramData),
        debug: {
          groupChatId,
          threadId,
          tieneToken: !!TELEGRAM_BOT_TOKEN,
          imageSize: imageBuffer.length
        },
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Mensaje de prueba enviado exitosamente', {
      telegramMessageId: telegramData.result?.message_id,
      groupChatId,
      threadId
    });

    res.json({
      success: true,
      message: 'Mensaje de prueba enviado exitosamente',
      data: {
        telegramMessageId: telegramData.result?.message_id,
        groupChatId,
        threadId,
        config: {
          groupChatId: pagosExternosConfig.telegram.groupChatId,
          threadId: pagosExternosConfig.telegram.threadId,
          usandoFallback: !pagosExternosConfig.telegram.groupChatId
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en prueba de pagos externos', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para reenviar un pago externo al grupo de Telegram
router.post('/pagos-externos/reenviar', async (req, res) => {
  try {
    const { reporteId } = req.body;

    if (!reporteId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere reporteId',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Reenvío de pago externo solicitado', { reporteId });

    // Obtener el reporte desde la base de datos
    const POSTGREST_URL = process.env.POSTGREST_URL;
    if (!POSTGREST_URL) {
      throw new Error('POSTGREST_URL no configurada');
    }

    const reporteResponse = await fetch(
      `${POSTGREST_URL}/GERSSON_REPORTES?ID=eq.${reporteId}&select=*&limit=1`
    );

    if (!reporteResponse.ok) {
      throw new Error(`Error obteniendo reporte: ${reporteResponse.status}`);
    }

    const reportes = await reporteResponse.json();
    if (!reportes || reportes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Reporte no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    const reporte = reportes[0];

    // Validar que sea un pago externo con imagen
    if (reporte.TIPO_VENTA !== 'EXTERNA' || !reporte.IMAGEN_PAGO_URL) {
      return res.status(400).json({
        success: false,
        error: 'Este reporte no es un pago externo o no tiene imagen de pago',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener datos del cliente
    const cliente = await getClienteById(reporte.ID_CLIENTE);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener configuración de Telegram para pagos externos
    const hotmartConfig = await getHotmartConfig();
    const TELEGRAM_BOT_TOKEN = hotmartConfig.tokens.telegram;
    
    const pagosExternosConfig = await getPagosExternosConfig();
    const groupChatId = pagosExternosConfig.telegram.groupChatId || hotmartConfig.telegram.groupChatId || '-1003694709837';
    const threadId = pagosExternosConfig.telegram.threadId 
      ? parseInt(pagosExternosConfig.telegram.threadId, 10) 
      : (hotmartConfig.telegram.threadId ? parseInt(hotmartConfig.telegram.threadId, 10) : 5);

    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Token de Telegram no configurado',
        timestamp: new Date().toISOString()
      });
    }

    // Importar utilidades
    const { escapeHtml } = await import('../utils/telegramFormat');
    const FormData = require('form-data');

    // Construir el caption del mensaje en HTML
    // Nota: Evitar usar "->" y "<-" ya que Telegram los interpreta como tags HTML
    const caption = `<b>Notificación de Pago Externo (Reenviado)</b>\n\n` +
      `<b>Nombre:</b> ${escapeHtml(cliente.NOMBRE)}\n` +
      `<b>País:</b> ${escapeHtml(reporte.PAIS_CLIENTE || 'N/A')}\n` +
      `<b>Medio:</b> ${escapeHtml(reporte.MEDIO_PAGO || 'N/A')}\n` +
      `<b>Teléfono:</b> ${escapeHtml(reporte.TELEFONO_CLIENTE || cliente.WHATSAPP || 'N/A')}\n` +
      `<b>Correo inscripción:</b> ${escapeHtml(reporte.CORREO_INSCRIPCION || 'N/A')}\n` +
      `<b>Correo Pago (stripe):</b> ${escapeHtml(reporte.CORREO_PAGO || 'no aplica')}\n` +
      `<b>ASESOR QUE REPORTA:</b> ${escapeHtml(reporte.NOMBRE_ASESOR || 'N/A')}\n\n` +
      `▶️ <b>CONFIRMAR INGRESO E INSCRIBIR</b> 🔥`;

    // Descargar la imagen desde la URL y enviarla como FormData
    try {
      logger.info('Descargando imagen desde URL para reenvío', {
        imagenPagoUrl: reporte.IMAGEN_PAGO_URL.substring(0, 100) + '...'
      });

      const imageResponse = await fetch(reporte.IMAGEN_PAGO_URL);
      if (!imageResponse.ok) {
        throw new Error(`Error descargando imagen: ${imageResponse.status} ${imageResponse.statusText}`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';

      // Crear FormData para enviar la imagen como multipart/form-data
      const form = new FormData();
      form.append('chat_id', groupChatId);
      form.append('photo', imageBuffer, {
        filename: `pago-externo-reenviado.${extension}`,
        contentType: contentType
      });
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');

      if (threadId && !isNaN(threadId) && threadId > 0) {
        form.append('message_thread_id', threadId.toString());
      }

      logger.info('Reenviando foto a Telegram', {
        groupChatId,
        threadId,
        imageSize: imageBuffer.length,
        reporteId
      });

      // Usar axios para enviar
      const axios = require('axios');
      let telegramResponse;
      let telegramData;
      
      try {
        telegramResponse = await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          form,
          { 
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );
        telegramData = telegramResponse.data;
      } catch (axiosError: any) {
        // Capturar el error de axios para obtener más detalles
        const errorDetails = axiosError.response?.data || axiosError.message;
        logger.error('Error de axios enviando a Telegram (reenvío)', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          errorData: errorDetails,
          errorMessage: axiosError.message,
          groupChatId,
          threadId,
          imageSize: imageBuffer.length,
          captionLength: caption.length
        });
        
        // Devolver el error directamente sin lanzar excepción
        res.status(500).json({
          success: false,
          error: 'Error reenviando foto a Telegram',
          details: errorDetails?.description || errorDetails?.message || JSON.stringify(errorDetails),
          debug: {
            groupChatId,
            threadId,
            imageSize: imageBuffer.length,
            captionLength: caption.length,
            tieneToken: !!TELEGRAM_BOT_TOKEN,
            telegramError: errorDetails
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!telegramData || !telegramData.ok) {
        logger.error('Error de Telegram API en reenvío', {
          status: telegramResponse?.status,
          telegramData,
          groupChatId,
          threadId
        });
        res.status(500).json({
          success: false,
          error: 'Error de Telegram API',
          details: telegramData?.description || JSON.stringify(telegramData),
          debug: {
            groupChatId,
            threadId,
            telegramError: telegramData
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info('Pago externo reenviado exitosamente', {
        reporteId,
        clienteID: cliente.ID,
        telegramMessageId: telegramData.result?.message_id,
        groupChatId,
        threadId
      });

      res.json({
        success: true,
        message: 'Pago externo reenviado exitosamente',
        data: {
          reporteId,
          clienteID: cliente.ID,
          clienteNombre: cliente.NOMBRE,
          telegramMessageId: telegramData.result?.message_id,
          telegramChatId: groupChatId,
          telegramThreadId: threadId
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Este catch solo debería ejecutarse si hay un error antes de enviar a Telegram
      // Si ya se envió la respuesta (con return), este catch no debería ejecutarse
      if (!res.headersSent) {
        logger.error('Error antes de enviar a Telegram (reenvío)', {
          error: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined,
          reporteId
        });
        res.status(500).json({
          success: false,
          error: 'Error procesando reenvío',
          details: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString()
        });
      }
    }

  } catch (error) {
    logger.error('Error en reenvío de pago externo', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener la configuración de pagos externos
router.get('/pagos-externos/config', async (_req, res) => {
  try {
    const { getPagosExternosConfig } = await import('../config/webhookConfig');
    const { getHotmartConfig } = await import('../config/webhookConfig');
    
    const config = await getPagosExternosConfig();
    const hotmartConfig = await getHotmartConfig();
    
    // Mostrar también los valores de fallback
    res.json({
      success: true,
      data: config,
      fallback: {
        groupChatId: hotmartConfig.telegram.groupChatId,
        threadId: hotmartConfig.telegram.threadId
      },
      final: {
        groupChatId: config.telegram.groupChatId || hotmartConfig.telegram.groupChatId || '-1003694709837',
        threadId: config.telegram.threadId 
          ? parseInt(config.telegram.threadId, 10) 
          : (hotmartConfig.telegram.threadId ? parseInt(hotmartConfig.telegram.threadId, 10) : 5)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo configuración de pagos externos', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para actualizar la configuración de pagos externos
router.put('/pagos-externos/config', async (req, res) => {
  try {
    const { body } = req;
    
    // Validar estructura de la configuración
    if (!body || !body.telegram) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de configuración inválida. Debe incluir: telegram',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar configuración
    const { updatePagosExternosConfig } = await import('../config/webhookConfig');
    const success = await updatePagosExternosConfig(body);
    
    if (success) {
      logger.info('Configuración de Pagos Externos actualizada', { 
        updatedBy: req.ip,
        timestamp: new Date().toISOString()
      });
      
      const { getPagosExternosConfig } = await import('../config/webhookConfig');
      res.json({
        success: true,
        message: 'Configuración de pagos externos actualizada exitosamente',
        data: await getPagosExternosConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración de pagos externos',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error actualizando configuración de pagos externos', error);
    
    // Intentar obtener la configuración actual para verificar si algunos datos se guardaron
    let currentConfig = null;
    try {
      const { getPagosExternosConfig } = await import('../config/webhookConfig');
      currentConfig = await getPagosExternosConfig();
    } catch (configError) {
      logger.warn('No se pudo obtener configuración actual para verificación:', configError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        note: 'Algunos cambios podrían haberse guardado parcialmente. Revisa la configuración actual.',
        currentConfig: currentConfig || 'No disponible'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener la configuración de cupos VIP
router.get('/cupos-vip/config', async (_req, res) => {
  try {
    const config = await getCuposVipConfig();
    const hotmartConfig = await getHotmartConfig();
    
    // Mostrar también los valores de fallback
    res.json({
      success: true,
      data: config,
      fallback: {
        groupChatId: hotmartConfig.telegram.groupChatId,
        threadId: hotmartConfig.telegram.threadId
      },
      final: {
        groupChatId: config.telegram.groupChatId || hotmartConfig.telegram.groupChatId,
        threadId: config.telegram.threadId 
          ? parseInt(config.telegram.threadId, 10) 
          : (hotmartConfig.telegram.threadId ? parseInt(hotmartConfig.telegram.threadId, 10) : undefined)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo configuración de cupos VIP', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para actualizar la configuración de cupos VIP
router.put('/cupos-vip/config', async (req, res) => {
  try {
    const { body } = req;
    
    // Validar estructura de la configuración
    if (!body || !body.telegram) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de configuración inválida. Debe incluir: telegram',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar configuración
    const success = await updateCuposVipConfig(body);
    
    if (success) {
      logger.info('Configuración de Cupos VIP actualizada', { 
        updatedBy: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Configuración de cupos VIP actualizada exitosamente',
        data: await getCuposVipConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración de cupos VIP',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error actualizando configuración de cupos VIP', error);
    
    // Intentar obtener la configuración actual para verificar si algunos datos se guardaron
    let currentConfig = null;
    try {
      currentConfig = await getCuposVipConfig();
    } catch (configError) {
      logger.warn('No se pudo obtener configuración actual para verificación:', configError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        note: 'Algunos cambios podrían haberse guardado parcialmente. Revisa la configuración actual.',
        currentConfig: currentConfig || 'No disponible'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
