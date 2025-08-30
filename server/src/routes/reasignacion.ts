import { Router } from 'express';
import winston from 'winston';
import { 
  updateCliente, 
  getClienteById, 
  getAsesorById,
  getNextAsesorPonderado 
} from '../dbClient';
import { sendTelegramMessage } from '../services/telegramService';
import telegramQueue from '../services/telegramQueueService';

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

// Endpoint para reasignar clientes
router.post('/reasigna-cierres', async (req, res) => {
  try {
    const { cliente_id, asesor_viejo_id, asesor_nuevo_id } = req.body;

    // Validar datos requeridos
    if (!cliente_id || !asesor_viejo_id || !asesor_nuevo_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere cliente_id, asesor_viejo_id y asesor_nuevo_id',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Iniciando reasignación de cliente', {
      cliente_id,
      asesor_viejo_id,
      asesor_nuevo_id
    });

    // Obtener datos del cliente
    const cliente = await getClienteById(cliente_id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener datos de asesores
    const asesorViejo = await getAsesorById(asesor_viejo_id);
    const asesorNuevo = await getAsesorById(asesor_nuevo_id);

    if (!asesorViejo || !asesorNuevo) {
      return res.status(404).json({
        success: false,
        error: 'Asesor(es) no encontrado(s)',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar cliente con nuevo asesor
    await updateCliente(cliente_id, {
      ID_ASESOR: asesor_nuevo_id,
      NOMBRE_ASESOR: asesorNuevo.NOMBRE,
      WHA_ASESOR: asesorNuevo.WHATSAPP
    });

    logger.info('Cliente reasignado exitosamente', {
      cliente_id,
      asesor_viejo: asesorViejo.NOMBRE,
      asesor_nuevo: asesorNuevo.NOMBRE
    });

    // Notificar al asesor viejo (desasignación)
    let telegramViejoStatus = 'skipped';
    let telegramNuevoStatus = 'skipped';

    if (asesorViejo.ID_TG) {
      try {
        const textoMensajeViejo = `*CLIENTE DESASIGNADO* ⚠️ \n\nnombre: ${cliente.NOMBRE}\nWha: ${cliente.WHATSAPP}\n\nSe reasignó tu cliente por decisión de la gerencia 🚨`;

        // Usar cola en lugar de envío directo
        const messageIdViejo = telegramQueue.enqueueMessage(
          asesorViejo.ID_TG,
          textoMensajeViejo,
          undefined, // Sin webhookLogId para reasignaciones
          { 
            type: 'reasignacion_desasignado',
            asesorViejo: asesorViejo.NOMBRE,
            asesorNuevo: asesorNuevo.NOMBRE,
            cliente: cliente.NOMBRE,
            whatsapp: cliente.WHATSAPP
          }
        );
        
        telegramViejoStatus = 'queued'; // Estado inicial en cola
        
        logger.info('Notificación de desasignación agregada a cola', {
          asesor: asesorViejo.NOMBRE,
          telegram_id: asesorViejo.ID_TG,
          messageId: messageIdViejo,
          cliente: cliente.NOMBRE,
          queueStats: telegramQueue.getQueueStats()
        });
      } catch (error) {
        telegramViejoStatus = 'error';
        logger.error('Error agregando notificación de desasignación a cola', error);
      }
    }

    // Notificar al asesor nuevo (asignación)
    if (asesorNuevo.ID_TG) {
      try {
        // Nota: Los botones inline no son compatibles con la cola simplificada
        // El mensaje incluirá el enlace de WhatsApp directamente
        const textoMensajeNuevo = `*CLIENTE REASIGNADO A TI* ⚠️ 

👤 Nombre: ${cliente.NOMBRE}
📱 WhatsApp: ${cliente.WHATSAPP}

Se reasignó este cliente a ti por decisión de la gerencia 🚨

💬 Ve al chat: https://wa.me/${cliente.WHATSAPP}`;

        // Usar cola en lugar de envío directo
        const messageIdNuevo = telegramQueue.enqueueMessage(
          asesorNuevo.ID_TG,
          textoMensajeNuevo,
          undefined, // Sin webhookLogId para reasignaciones
          { 
            type: 'reasignacion_asignado',
            asesorViejo: asesorViejo.NOMBRE,
            asesorNuevo: asesorNuevo.NOMBRE,
            cliente: cliente.NOMBRE,
            whatsapp: cliente.WHATSAPP
          }
        );
        
        telegramNuevoStatus = 'queued'; // Estado inicial en cola
        
        logger.info('Notificación de reasignación agregada a cola', {
          asesor: asesorNuevo.NOMBRE,
          telegram_id: asesorNuevo.ID_TG,
          messageId: messageIdNuevo,
          cliente: cliente.NOMBRE,
          queueStats: telegramQueue.getQueueStats()
        });
      } catch (error) {
        telegramNuevoStatus = 'error';
        logger.error('Error agregando notificación de reasignación a cola', error);
      }
    }

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Cliente reasignado exitosamente',
      data: {
        cliente_id,
        cliente_nombre: cliente.NOMBRE,
        asesor_viejo: {
          id: asesorViejo.ID,
          nombre: asesorViejo.NOMBRE,
          telegram_status: telegramViejoStatus
        },
        asesor_nuevo: {
          id: asesorNuevo.ID,
          nombre: asesorNuevo.NOMBRE,
          telegram_status: telegramNuevoStatus
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en reasignación de cliente', error);
    
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

// Endpoint para reasignación automática usando getNextAsesorPonderado
router.post('/reasigna-automatico', async (req, res) => {
  try {
    const { cliente_id, asesor_viejo_id } = req.body;

    // Validar datos requeridos
    if (!cliente_id || !asesor_viejo_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere cliente_id y asesor_viejo_id',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Iniciando reasignación automática de cliente', {
      cliente_id,
      asesor_viejo_id
    });

    // Obtener datos del cliente
    const cliente = await getClienteById(cliente_id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener asesor viejo
    const asesorViejo = await getAsesorById(asesor_viejo_id);
    if (!asesorViejo) {
      return res.status(404).json({
        success: false,
        error: 'Asesor actual no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener próximo asesor usando lógica ponderada
    const nextAsesorResult = await getNextAsesorPonderado();
    if (!nextAsesorResult) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo obtener el siguiente asesor disponible',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener datos completos del nuevo asesor
    const asesorNuevo = await getAsesorById(nextAsesorResult.ID);
    if (!asesorNuevo) {
      return res.status(404).json({
        success: false,
        error: 'Datos del nuevo asesor no encontrados',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que no se esté reasignando al mismo asesor
    if (asesorViejo.ID === asesorNuevo.ID) {
      return res.status(400).json({
        success: false,
        error: 'El sistema seleccionó el mismo asesor actual. Intenta nuevamente.',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar cliente con nuevo asesor
    await updateCliente(cliente_id, {
      ID_ASESOR: asesorNuevo.ID,
      NOMBRE_ASESOR: asesorNuevo.NOMBRE,
      WHA_ASESOR: asesorNuevo.WHATSAPP
    });

    logger.info('Cliente reasignado automáticamente exitosamente', {
      cliente_id,
      asesor_viejo: asesorViejo.NOMBRE,
      asesor_nuevo: asesorNuevo.NOMBRE,
      asesor_nuevo_id: asesorNuevo.ID
    });

    // Notificar al asesor viejo (desasignación)
    let telegramViejoStatus = 'skipped';
    let telegramNuevoStatus = 'skipped';

    if (asesorViejo.ID_TG) {
      try {
        const textoMensajeViejo = `*CLIENTE DESASIGNADO* ⚠️ \n\nnombre: ${cliente.NOMBRE}\nWha: ${cliente.WHATSAPP}\n\nSe reasignó tu cliente automáticamente por decisión de la gerencia 🚨`;

        const messageIdViejo = telegramQueue.enqueueMessage(
          asesorViejo.ID_TG,
          textoMensajeViejo,
          undefined,
          { 
            type: 'reasignacion_automatica_desasignado',
            asesorViejo: asesorViejo.NOMBRE,
            asesorNuevo: asesorNuevo.NOMBRE,
            cliente: cliente.NOMBRE,
            whatsapp: cliente.WHATSAPP
          }
        );
        
        telegramViejoStatus = 'queued';
        
        logger.info('Notificación automática de desasignación agregada a cola', {
          asesor: asesorViejo.NOMBRE,
          telegram_id: asesorViejo.ID_TG,
          messageId: messageIdViejo,
          cliente: cliente.NOMBRE
        });
      } catch (error) {
        telegramViejoStatus = 'error';
        logger.error('Error agregando notificación automática de desasignación a cola', error);
      }
    }

    // Notificar al asesor nuevo (asignación)
    if (asesorNuevo.ID_TG) {
      try {
        const textoMensajeNuevo = `*CLIENTE REASIGNADO A TI* ⚠️ 

👤 Nombre: ${cliente.NOMBRE}
📱 WhatsApp: ${cliente.WHATSAPP}

Se reasignó este cliente a ti automáticamente por decisión de la gerencia 🚨

💬 Ve al chat: https://wa.me/${cliente.WHATSAPP}`;

        const messageIdNuevo = telegramQueue.enqueueMessage(
          asesorNuevo.ID_TG,
          textoMensajeNuevo,
          undefined,
          { 
            type: 'reasignacion_automatica_asignado',
            asesorViejo: asesorViejo.NOMBRE,
            asesorNuevo: asesorNuevo.NOMBRE,
            cliente: cliente.NOMBRE,
            whatsapp: cliente.WHATSAPP
          }
        );
        
        telegramNuevoStatus = 'queued';
        
        logger.info('Notificación automática de reasignación agregada a cola', {
          asesor: asesorNuevo.NOMBRE,
          telegram_id: asesorNuevo.ID_TG,
          messageId: messageIdNuevo,
          cliente: cliente.NOMBRE
        });
      } catch (error) {
        telegramNuevoStatus = 'error';
        logger.error('Error agregando notificación automática de reasignación a cola', error);
      }
    }

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Cliente reasignado automáticamente exitosamente',
      data: {
        cliente_id,
        cliente_nombre: cliente.NOMBRE,
        asesor_viejo: {
          id: asesorViejo.ID,
          nombre: asesorViejo.NOMBRE,
          telegram_status: telegramViejoStatus
        },
        asesor_nuevo: {
          id: asesorNuevo.ID,
          nombre: asesorNuevo.NOMBRE,
          telegram_status: telegramNuevoStatus
        },
        modo: 'automatico'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en reasignación automática de cliente', error);
    
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

export default router;