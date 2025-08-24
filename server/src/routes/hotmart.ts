import { Router } from 'express';
import winston from 'winston';
import { getHotmartConfig, updateHotmartConfig, resetToDefault } from '../config/webhookConfig';
import { 
  getClienteByWhatsapp, 
  createCliente, 
  updateCliente, 
  getNextAsesorPonderado, 
  getAsesorById, 
  updateAsesorCounter, 
  insertRegistro,
  insertWebhookLog,
  updateWebhookLog,
  getRecentWebhookLogs,
  getWebhookStats,
  getWebhookLogById,
  getAsesores,
  type WebhookLogEntry
} from '../dbClient';
import { 
  findManyChatSubscriber, 
  createManyChatSubscriber, 
  sendManyChatFlow 
} from '../services/manychatService';
import { addSubscriberToFlodesk } from '../services/flodeskService';
import { 
  sendTelegramMessage, 
  createVentaMessage, 
  createAsesorNotificationMessage 
} from '../services/telegramService';
import { checkWhatsAppNumber } from '../services/evolutionService';

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

// Función para extraer datos del comprador según el flujo
function extraerDatosComprador(body: any, flujo: string) {
  const buyer = body.data?.buyer;
  
  let numero = null;
  if (flujo === 'CARRITOS') {
    numero = buyer?.phone || null;
  } else {
    numero = buyer?.checkout_phone || null;
  }

  return {
    numero,
    nombre: buyer?.name || null,
    correo: buyer?.email || null,
    flujo,
    motivo: flujo === 'RECHAZADOS' ? body.data?.purchase?.payment?.refusal_reason || null : null
  };
}

// Función para asignar valores según el flujo (usando configuración dinámica)
async function asignarValores(datos: any) {
  const config = await getHotmartConfig();
  
  return {
    ...datos,
    flujomany: config.numericos[datos.flujo as keyof typeof config.numericos] || 0,
    grupoflodesk: config.flodesk[datos.flujo as keyof typeof config.flodesk] || 0
  };
}

// Función para determinar el flujo basado en el evento
function determinarFlujo(event: string): string {
  if (event.includes('CART')) return 'CARRITOS';
  if (event.includes('PURCHASE_APPROVED')) return 'COMPRAS';
  if (event.includes('PURCHASE_CANCELED')) return 'RECHAZADOS';
  if (event === 'PURCHASE_BILLET_PRINTED') return 'TICKETS';
  return 'DESCONOCIDO';
}

// Endpoint principal para webhooks de Hotmart
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  let webhookLogId: number | null = null;
  let processingSteps: any[] = [];
  
  try {
    const { body } = req;
    
    logger.info('Webhook de Hotmart recibido', {
      event: body.event,
      timestamp: new Date().toISOString()
    });

    // Validar que el webhook tenga la estructura esperada
    if (!body || !body.event || !body.data) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de webhook inválida',
        timestamp: new Date().toISOString()
      });
    }

    // Determinar el flujo basado en el evento
    const flujo = determinarFlujo(body.event);
    
    if (flujo === 'DESCONOCIDO') {
      logger.warn('Evento de Hotmart no reconocido', { event: body.event });
      return res.status(200).json({
        success: true,
        message: 'Evento procesado (no reconocido)',
        event: body.event,
        timestamp: new Date().toISOString()
      });
    }

    // Extraer datos del comprador
    const datosComprador = extraerDatosComprador(body, flujo);
    
    // Validar que tengamos un número de teléfono
    if (!datosComprador.numero) {
      logger.warn('Webhook sin número de teléfono', { 
        flujo, 
        event: body.event,
        buyer: body.data?.buyer 
      });
      
      return res.status(200).json({
        success: true,
        message: 'Webhook procesado (sin número de teléfono)',
        flujo,
        timestamp: new Date().toISOString()
      });
    }

    // Crear entrada inicial en webhook logs
    const initialLogEntry: WebhookLogEntry = {
      event_type: body.event,
      flujo,
      status: 'received',
      buyer_name: datosComprador.nombre || undefined,
      buyer_email: datosComprador.correo || undefined,
      buyer_phone: datosComprador.numero,
      buyer_country: body.data?.buyer?.address?.country || undefined,
      product_name: body.data?.product?.name || undefined,
      transaction_id: body.data?.purchase?.transaction || undefined,
      purchase_amount: body.data?.purchase?.price ? parseFloat(body.data.purchase.price) : undefined,
      purchase_date: body.data?.purchase?.order_date ? new Date(body.data.purchase.order_date) : undefined,
      raw_webhook_data: body,
      received_at: new Date()
    };

    try {
      const logResult = await insertWebhookLog(initialLogEntry);
      webhookLogId = logResult[0]?.id || null;
      logger.info(`Webhook log creado con ID: ${webhookLogId}`);
    } catch (logError) {
      logger.error('Error creando webhook log:', logError);
      // Continuar procesamiento aunque falle el logging
    }

    // Actualizar status a processing
    if (webhookLogId) {
      try {
        await updateWebhookLog({
          id: webhookLogId,
          status: 'processing'
        });
      } catch (updateError) {
        logger.error('Error actualizando webhook log a processing:', updateError);
        // Continuar procesamiento aunque falle la actualización del log
      }
    }

    // Asignar valores según el flujo
    const datosProcesados = await asignarValores(datosComprador);

    logger.info('Datos procesados del webhook', {
      flujo,
      numero: datosProcesados.numero,
      nombre: datosProcesados.nombre,
      correo: datosProcesados.correo,
      timestamp: new Date().toISOString()
    });

    // 1. Buscar en la base de datos si el cliente existe
    processingSteps.push({ step: 'database_lookup', status: 'starting', timestamp: new Date() });
    const clienteExistente = await getClienteByWhatsapp(datosProcesados.numero);
    processingSteps.push({ 
      step: 'database_lookup', 
      status: 'completed', 
      result: clienteExistente ? 'client_found' : 'client_not_found',
      clientId: clienteExistente?.ID,
      timestamp: new Date() 
    });
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let clienteId: number;
    let asesorAsignado = null;

    if (clienteExistente) {
      logger.info('Cliente existente encontrado', { clienteId: clienteExistente.ID });
      clienteId = clienteExistente.ID;

      // Verificar si es una compra
      if (flujo === 'COMPRAS') {
        // Si el cliente tiene un asesor asignado y ya había comprado, no hacer nada más
        if (clienteExistente.ESTADO === 'PAGADO' || clienteExistente.ESTADO === 'VENTA CONSOLIDADA') {
          logger.info('Cliente ya había comprado, no se procesa', { clienteId });
          return res.status(200).json({
            success: true,
            message: 'Cliente ya había comprado anteriormente',
            timestamp: new Date().toISOString()
          });
        }

        // Actualizar estado a PAGADO y datos de compra
        await updateCliente(clienteId, {
          ESTADO: 'PAGADO',
          NOMBRE: datosProcesados.nombre,
          WHATSAPP: datosProcesados.numero,
          FECHA_COMPRA: currentTimestamp,
          MEDIO_COMPRA: 'HOTMART'
        });

        // Si tiene asesor, incrementar contador de compras
        if (clienteExistente.ID_ASESOR) {
          await updateAsesorCounter(clienteExistente.ID_ASESOR, 'COMPRAS');
          asesorAsignado = await getAsesorById(clienteExistente.ID_ASESOR);
        }
      } else {
        // Para otros flujos, solo actualizar estado
        await updateCliente(clienteId, {
          ESTADO: flujo,
          NOMBRE: datosProcesados.nombre,
          WHATSAPP: datosProcesados.numero
        });

        // Incrementar contador del asesor si existe
        if (clienteExistente.ID_ASESOR) {
          await updateAsesorCounter(clienteExistente.ID_ASESOR, flujo);
          asesorAsignado = await getAsesorById(clienteExistente.ID_ASESOR);

          // Verificar número de WhatsApp (como en N8N Evolution API)
          try {
            const whatsappCheck = await checkWhatsAppNumber(asesorAsignado?.NOMBRE || 'default', datosProcesados.numero);
            if (whatsappCheck.success && whatsappCheck.data?.data?.[0]?.exists) {
              logger.info('Número WhatsApp verificado exitosamente', { 
                numero: datosProcesados.numero,
                exists: whatsappCheck.data.data[0].exists 
              });
            } else {
              logger.warn('Número WhatsApp no existe o no verificable', { 
                numero: datosProcesados.numero,
                response: whatsappCheck 
              });
            }
          } catch (error) {
            logger.error('Error verificando WhatsApp', error);
          }
        }
      }
    } else {
      logger.info('Cliente nuevo, creando registro');

      if (flujo === 'COMPRAS') {
        // Cliente nuevo con compra directa
        const nuevoCliente = await createCliente({
          NOMBRE: datosProcesados.nombre,
          ESTADO: 'PAGADO',
          WHATSAPP: datosProcesados.numero,
          FECHA_CREACION: currentTimestamp,
          FECHA_COMPRA: currentTimestamp,
          MEDIO_COMPRA: 'HOTMART'
        });
        clienteId = nuevoCliente[0].ID;
      } else {
        // Cliente nuevo con otro flujo - asignar asesor
        const nextAsesor = await getNextAsesorPonderado();
        if (nextAsesor?.ID) {
          asesorAsignado = await getAsesorById(nextAsesor.ID);
          
          const nuevoCliente = await createCliente({
            NOMBRE: datosProcesados.nombre,
            ESTADO: flujo,
            WHATSAPP: datosProcesados.numero,
            ID_ASESOR: nextAsesor.ID,
            NOMBRE_ASESOR: asesorAsignado?.NOMBRE,
            WHA_ASESOR: asesorAsignado?.WHATSAPP,
            FECHA_CREACION: currentTimestamp
          });
          clienteId = nuevoCliente[0].ID;

          // Incrementar contador del asesor
          await updateAsesorCounter(nextAsesor.ID, flujo);
        } else {
          // No hay asesores disponibles
          const nuevoCliente = await createCliente({
            NOMBRE: datosProcesados.nombre,
            ESTADO: flujo,
            WHATSAPP: datosProcesados.numero,
            FECHA_CREACION: currentTimestamp
          });
          clienteId = nuevoCliente[0].ID;
        }
      }
    }

    // 2. Registrar evento
    await insertRegistro({
      ID_CLIENTE: clienteId,
      TIPO_EVENTO: flujo === 'COMPRAS' ? 'COMPRA' : flujo,
      FECHA_EVENTO: currentTimestamp
    });

    // Variables para tracking de resultados de integraciones
    let manychatStatus: 'success' | 'error' | 'skipped' = 'skipped';
    let manychatFlowId = '';
    let manychatSubscriberId = '';
    let manychatError = '';

    // Variables para tracking de errores específicos (para uso futuro)
    // let clienteProcessingError = null;
    // let asesorAssignmentError = null;

    // 3. Procesar ManyChat (para todos los flujos)
    processingSteps.push({ step: 'manychat_integration', status: 'starting', timestamp: new Date() });
    if (datosProcesados.flujomany) {
      try {
        manychatFlowId = datosProcesados.flujomany;
        
        // Buscar subscriber existente
        const subscriberResult = await findManyChatSubscriber(datosProcesados.numero);
        let subscriberId = null;

        if (subscriberResult.success && subscriberResult.data?.data?.length > 0) {
          subscriberId = subscriberResult.data.data[0].id;
          manychatSubscriberId = subscriberId;
          logger.info('Subscriber ManyChat encontrado', { subscriberId });
        } else {
          // Crear nuevo subscriber
          const createResult = await createManyChatSubscriber(datosProcesados.nombre, datosProcesados.numero);
          if (createResult.success && createResult.data?.data) {
            subscriberId = createResult.data.data.id;
            manychatSubscriberId = subscriberId;
            logger.info('Subscriber ManyChat creado', { subscriberId });
          }
        }

        // Enviar flujo si tenemos subscriber ID
        if (subscriberId) {
          const flowResult = await sendManyChatFlow(subscriberId, datosProcesados.flujomany);
          if (flowResult.success) {
            manychatStatus = 'success';
            processingSteps.push({ 
              step: 'manychat_integration', 
              status: 'completed', 
              result: 'success',
              subscriberId, 
              flowId: datosProcesados.flujomany,
              timestamp: new Date() 
            });
            logger.info('Flujo ManyChat enviado', { subscriberId, flowId: datosProcesados.flujomany });
          } else {
            manychatStatus = 'error';
            manychatError = flowResult.error || 'Error enviando flujo';
            processingSteps.push({ 
              step: 'manychat_integration', 
              status: 'failed', 
              error: manychatError,
              subscriberId, 
              flowId: datosProcesados.flujomany,
              timestamp: new Date() 
            });
            logger.error('Error enviando flujo ManyChat', flowResult.error);
          }
        } else {
          manychatStatus = 'error';
          manychatError = 'No se pudo obtener subscriber ID';
        }
      } catch (error) {
        manychatStatus = 'error';
        manychatError = error instanceof Error ? error.message : 'Error desconocido';
        processingSteps.push({ 
          step: 'manychat_integration', 
          status: 'failed', 
          error: manychatError,
          timestamp: new Date() 
        });
        logger.error('Error procesando ManyChat', error);
      }
    } else {
      processingSteps.push({ 
        step: 'manychat_integration', 
        status: 'skipped', 
        reason: 'No flow ID configured',
        timestamp: new Date() 
      });
    }

    // Variables para tracking de Flodesk
    let flodeskStatus: 'success' | 'error' | 'skipped' = 'skipped';
    let flodeskSegmentId = '';
    let flodeskError = '';

    // 4. Procesar Flodesk
    if (datosProcesados.correo && datosProcesados.grupoflodesk) {
      try {
        flodeskSegmentId = datosProcesados.grupoflodesk;
        const flodeskResult = await addSubscriberToFlodesk(datosProcesados.correo, datosProcesados.grupoflodesk);
        
        if (flodeskResult.success) {
          flodeskStatus = 'success';
          logger.info('Subscriber agregado a Flodesk', { email: datosProcesados.correo });
        } else {
          flodeskStatus = 'error';
          flodeskError = flodeskResult.error || 'Error agregando subscriber';
          logger.error('Error agregando subscriber a Flodesk', flodeskResult.error);
        }
      } catch (error) {
        flodeskStatus = 'error';
        flodeskError = error instanceof Error ? error.message : 'Error desconocido';
        logger.error('Error procesando Flodesk', error);
      }
    }

    // Variables para tracking de Telegram
    let telegramStatus: 'success' | 'error' | 'skipped' = 'skipped';
    let telegramChatId = '';
    let telegramMessageId = '';
    let telegramError = '';

    // 5. Enviar notificaciones de Telegram
    try {
      if (flujo === 'COMPRAS') {
        // Notificación de venta al grupo general
        const ventaMessage = createVentaMessage(body.data, asesorAsignado?.NOMBRE);
        telegramChatId = ventaMessage.chat_id;
        
        const telegramResult = await sendTelegramMessage(ventaMessage);
        if (telegramResult.success) {
          telegramStatus = 'success';
          telegramMessageId = telegramResult.data?.result?.message_id?.toString() || '';
          logger.info('Notificación de venta enviada', { asesor: asesorAsignado?.NOMBRE || 'SIN CERRADOR' });
        } else {
          telegramStatus = 'error';
          telegramError = telegramResult.error || 'Error enviando mensaje';
          logger.error('Error enviando notificación de venta', telegramResult.error);
        }
      } else {
        // Notificar al asesor asignado para eventos no-compra
        if (asesorAsignado?.ID_TG) {
          const asesorMessage = createAsesorNotificationMessage(
            flujo,
            datosProcesados.nombre,
            datosProcesados.numero,
            asesorAsignado.ID_TG,
            datosProcesados.motivo
          );
          telegramChatId = asesorMessage.chat_id;
          
          const telegramResult = await sendTelegramMessage(asesorMessage);
          if (telegramResult.success) {
            telegramStatus = 'success';
            telegramMessageId = telegramResult.data?.result?.message_id?.toString() || '';
            logger.info('Notificación enviada al asesor', { 
              asesor: asesorAsignado.NOMBRE, 
              evento: flujo,
              cliente: datosProcesados.nombre 
            });
          } else {
            telegramStatus = 'error';
            telegramError = telegramResult.error || 'Error enviando mensaje al asesor';
            logger.error('Error enviando notificación al asesor', telegramResult.error);
          }
        } else {
          telegramStatus = 'skipped';
          telegramError = 'Asesor sin ID_TG configurado';
          logger.warn('No se pudo notificar: asesor sin ID_TG', { flujo, cliente: datosProcesados.nombre });
        }
      }
    } catch (error) {
      telegramStatus = 'error';
      telegramError = error instanceof Error ? error.message : 'Error desconocido';
      logger.error('Error enviando notificaciones Telegram', error);
    }

    // Finalizar webhook log con resultado exitoso
    const processingTime = Date.now() - startTime;
    if (webhookLogId) {
      try {
        await updateWebhookLog({
          id: webhookLogId,
          status: 'success',
          cliente_id: clienteId,
          asesor_id: asesorAsignado?.ID || undefined,
          asesor_nombre: asesorAsignado?.NOMBRE || undefined,
          manychat_status: manychatStatus,
          manychat_flow_id: manychatFlowId || undefined,
          manychat_subscriber_id: manychatSubscriberId || undefined,
          manychat_error: manychatError || undefined,
          flodesk_status: flodeskStatus,
          flodesk_segment_id: flodeskSegmentId || undefined,
          flodesk_error: flodeskError || undefined,
          telegram_status: telegramStatus,
          telegram_chat_id: telegramChatId || undefined,
          telegram_message_id: telegramMessageId || undefined,
          telegram_error: telegramError || undefined,
          processing_time_ms: processingTime,
          processed_at: new Date()
        });
      } catch (updateError) {
        logger.error('Error finalizando webhook log:', updateError);
        // No afectar la respuesta exitosa del webhook por errores de logging
      }
    }

    // Obtener el log completo si existe
    let fullLog = null;
    if (webhookLogId) {
      try {
        fullLog = await getWebhookLogById(webhookLogId);
      } catch (logError) {
        logger.warn('No se pudo obtener el log completo para la respuesta:', logError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Webhook procesado exitosamente',
      data: {
        ...datosProcesados,
        clienteId,
        asesorAsignado: asesorAsignado?.NOMBRE || null,
        esClienteExistente: !!clienteExistente,
        webhookLogId,
        processingTimeMs: processingTime,
        integrationResults: {
          manychat: { 
            status: manychatStatus, 
            error: manychatError || undefined,
            flowId: manychatFlowId || undefined,
            subscriberId: manychatSubscriberId || undefined
          },
          flodesk: { 
            status: flodeskStatus, 
            error: flodeskError || undefined,
            segmentId: flodeskSegmentId || undefined
          },
          telegram: { 
            status: telegramStatus, 
            error: telegramError || undefined,
            chatId: telegramChatId || undefined,
            messageId: telegramMessageId || undefined
          }
        },
        // Pasos detallados del procesamiento
        processingSteps: processingSteps,
        // Log completo de la base de datos
        fullLog: fullLog
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error procesando webhook de Hotmart', error);
    
    // Finalizar webhook log con error (no afectar la respuesta si esto falla)
    const processingTime = Date.now() - startTime;
    if (webhookLogId) {
      try {
        await updateWebhookLog({
          id: webhookLogId,
          status: 'error',
          processing_time_ms: processingTime,
          error_message: error instanceof Error ? error.message : 'Error desconocido',
          error_stack: error instanceof Error ? error.stack : undefined,
          processed_at: new Date()
        });
      } catch (updateError) {
        logger.error('Error actualizando webhook log con error:', updateError);
        // No afectar la respuesta del webhook por errores de logging
      }
    }

    // Obtener el log completo para la respuesta de error también
    let fullLog = null;
    if (webhookLogId) {
      try {
        fullLog = await getWebhookLogById(webhookLogId);
      } catch (logError) {
        logger.warn('No se pudo obtener el log completo para la respuesta de error:', logError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        webhookLogId,
        processingTimeMs: processingTime,
        // Pasos detallados del procesamiento hasta el error
        processingSteps: processingSteps || [],
        // Log completo para debugging
        fullLog: fullLog
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para probar la lógica de procesamiento completa
router.post('/test', async (req, res) => {
  try {
    const { body, dryRun = true } = req.body;
    
    if (!body || !body.event || !body.data) {
      return res.status(400).json({
        success: false,
        error: 'Datos de prueba inválidos',
        timestamp: new Date().toISOString()
      });
    }

    // Simular el procesamiento
    const flujo = determinarFlujo(body.event || '');
    const datosComprador = extraerDatosComprador(body, flujo);
    const datosProcesados = await asignarValores(datosComprador);

    let processingSteps = [];

    if (dryRun) {
      // Modo de prueba - no hacer cambios reales
      processingSteps.push({
        step: 'Cliente Search',
        action: 'Buscaría cliente por WhatsApp',
        input: datosProcesados.numero
      });

      processingSteps.push({
        step: 'Asesor Assignment',
        action: 'Obtendría próximo asesor ponderado'
      });

      processingSteps.push({
        step: 'ManyChat',
        action: `Enviaría flujo ${datosProcesados.flujomany}`,
        enabled: !!datosProcesados.flujomany
      });

      processingSteps.push({
        step: 'Flodesk',
        action: `Agregaría a segmento ${datosProcesados.grupoflodesk}`,
        enabled: !!datosProcesados.correo
      });
    } else {
      // Procesamiento real - ejecutar todas las funciones
      const clienteExistente = await getClienteByWhatsapp(datosProcesados.numero);
      processingSteps.push({
        step: 'Cliente Search',
        result: clienteExistente ? 'Cliente encontrado' : 'Cliente nuevo',
        data: clienteExistente
      });
    }

    res.json({
      success: true,
      message: dryRun ? 'Simulación de procesamiento exitosa' : 'Procesamiento de prueba exitoso',
      input: body,
      output: datosProcesados,
      processingSteps,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en prueba de procesamiento', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener estadísticas del webhook
router.get('/stats', async (_req, res) => {
  try {
    // Aquí podrías agregar consultas para obtener estadísticas
    const stats = {
      totalWebhooksProcessed: 'N/A', // Implementar contador en el futuro
      lastProcessed: 'N/A',
      errorRate: 'N/A',
      flujoDistribution: {
        CARRITOS: 'N/A',
        COMPRAS: 'N/A', 
        RECHAZADOS: 'N/A',
        TICKETS: 'N/A'
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para probar conexiones con las APIs
router.post('/test-connections', async (_req, res) => {
  try {
    const config = getHotmartConfig();
    const testResults = {
      manychat: { status: 'unknown', message: '' },
      flodesk: { status: 'unknown', message: '' },
      telegram: { status: 'unknown', message: '' }
    };

    // Probar ManyChat (verificando que el token sea válido)
    try {
      const manychatResponse = await fetch('https://api.manychat.com/fb/page/getInfo', {
        headers: {
          'Authorization': `Bearer ${config.tokens.manychat}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (manychatResponse.ok) {
        testResults.manychat = { status: 'success', message: 'Token válido y conexión exitosa' };
      } else {
        testResults.manychat = { status: 'error', message: 'Token inválido o error de conexión' };
      }
    } catch (error) {
      testResults.manychat = { status: 'error', message: 'Error de conexión con ManyChat' };
    }

    // Probar Telegram (verificar bot y acceso al grupo)
    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${config.tokens.telegram}/getMe`);
      const telegramData = await telegramResponse.json();
      
      if (telegramData.ok) {
        // Probar acceso al grupo
        try {
          const chatResponse = await fetch(`https://api.telegram.org/bot${config.tokens.telegram}/getChat?chat_id=${config.telegram.groupChatId}`);
          const chatData = await chatResponse.json();
          
          if (chatData.ok) {
            testResults.telegram = { 
              status: 'success', 
              message: `Bot: ${telegramData.result.username} | Grupo: ${chatData.result.title || 'Acceso confirmado'}` 
            };
          } else {
            testResults.telegram = { 
              status: 'warning', 
              message: `Bot válido (${telegramData.result.username}) pero sin acceso al grupo especificado` 
            };
          }
        } catch (groupError) {
          testResults.telegram = { 
            status: 'warning', 
            message: `Bot válido (${telegramData.result.username}) pero no se pudo verificar el grupo` 
          };
        }
      } else {
        testResults.telegram = { status: 'error', message: 'Token de bot inválido' };
      }
    } catch (error) {
      testResults.telegram = { status: 'error', message: 'Error de conexión con Telegram' };
    }

    // Probar Flodesk (verificando autenticación)
    try {
      // Flodesk usa Basic Auth con el token como username y password vacía
      const basicAuth = Buffer.from(`${config.tokens.flodesk}:`).toString('base64');
      
      const flodeskResponse = await fetch('https://api.flodesk.com/v1/subscribers?limit=1', {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Hotmart Integration (hotmart-webhook-processor)'
        }
      });
      
      if (flodeskResponse.ok) {
        testResults.flodesk = { status: 'success', message: 'Token válido y conexión exitosa' };
      } else {
        const errorText = await flodeskResponse.text();
        testResults.flodesk = { 
          status: 'error', 
          message: `Token inválido o error de conexión: ${flodeskResponse.status} - ${errorText}` 
        };
      }
    } catch (error) {
      testResults.flodesk = { 
        status: 'error', 
        message: `Error de conexión con Flodesk: ${error instanceof Error ? error.message : 'Error desconocido'}` 
      };
    }

    res.json({
      success: true,
      data: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error probando conexiones', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener la configuración actual
router.get('/config', async (_req, res) => {
  try {
    const config = await getHotmartConfig();
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo configuración', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para actualizar la configuración
router.put('/config', async (req, res) => {
  try {
    const { body } = req;
    
    // Validar estructura de la configuración
    if (!body || !body.numericos || !body.flodesk || !body.tokens || !body.telegram) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de configuración inválida. Debe incluir: numericos, flodesk, tokens y telegram',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar configuración
    const success = updateHotmartConfig(body);
    
    if (success) {
      logger.info('Configuración de Hotmart actualizada', { 
        updatedBy: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Configuración actualizada exitosamente',
        data: getHotmartConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error actualizando configuración', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para resetear a configuración por defecto
router.post('/config/reset', (req, res) => {
  try {
    const success = resetToDefault();
    
    if (success) {
      logger.info('Configuración reseteada a valores por defecto', { 
        resetBy: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Configuración reseteada a valores por defecto',
        data: getHotmartConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error reseteando configuración',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error reseteando configuración', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoints para webhook logs
// Endpoint para obtener logs recientes
router.get('/webhook-logs', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  
  try {
    const logs = await getRecentWebhookLogs(limit, offset);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        total: logs.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo webhook logs', error);
    
    // Si es un error de vista no encontrada, devolver logs vacíos
    if (error instanceof Error && (error.message.includes('relation "recent_webhook_logs" does not exist') || error.message.includes('relation "webhook_logs" does not exist'))) {
      logger.warn('Vista/tabla webhook_logs no existe, devolviendo logs vacíos');
      res.json({
        success: true,
        data: [],
        pagination: {
          limit,
          offset,
          total: 0
        },
        warning: 'Tabla de logs no disponible',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Endpoint para obtener un log específico por ID
router.get('/webhook-logs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido',
        timestamp: new Date().toISOString()
      });
    }
    
    const log = await getWebhookLogById(id);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log no encontrado',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: log,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo webhook log', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener estadísticas de webhooks
router.get('/webhook-stats', async (req, res) => {
  const days = parseInt(req.query.days as string) || 7;
  
  try {
    const stats = await getWebhookStats(days);
    
    res.json({
      success: true,
      data: stats,
      period: `${days} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de webhooks', error);
    
    // Si es un error de vista no encontrada, devolver estadísticas vacías
    if (error instanceof Error && error.message.includes('relation "webhook_stats" does not exist')) {
      logger.warn('Vista webhook_stats no existe, devolviendo estadísticas vacías');
      res.json({
        success: true,
        data: [],
        period: `${days} días`,
        warning: 'Vista de estadísticas no disponible',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Endpoint para obtener asesores con Telegram configurado
router.get('/advisors-with-telegram', async (_req, res) => {
  try {
    const asesores = await getAsesores();
    
    // Filtrar solo asesores que tengan ID_TG configurado
    const asesoresConTelegram = [];
    
    for (const asesor of asesores) {
      try {
        const asesorCompleto = await getAsesorById(asesor.ID);
        if (asesorCompleto && asesorCompleto.ID_TG) {
          asesoresConTelegram.push({
            id: asesorCompleto.ID,
            nombre: asesorCompleto.NOMBRE,
            telegramId: asesorCompleto.ID_TG,
            whatsapp: asesorCompleto.WHATSAPP
          });
        }
      } catch (error) {
        logger.warn(`Error obteniendo detalles del asesor ${asesor.ID}:`, error);
      }
    }
    
    res.json({
      success: true,
      data: asesoresConTelegram,
      total: asesoresConTelegram.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo asesores con Telegram:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Test individual de ManyChat - Buscar subscriber
router.post('/test-manychat', async (req, res) => {
  try {
    const { phoneNumber, action = 'search' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono requerido',
        timestamp: new Date().toISOString()
      });
    }
    
    const config = getHotmartConfig();
    let result: any = {};
    
    if (action === 'search') {
      // Buscar subscriber
      const searchResult = await findManyChatSubscriber(phoneNumber);
      result = {
        action: 'search',
        phoneNumber,
        searchResult: searchResult,
        found: searchResult.success && searchResult.data?.data?.length > 0
      };
      
      if (searchResult.success && searchResult.data?.data?.length > 0) {
        result.subscriber = searchResult.data.data[0];
      }
    } else if (action === 'create') {
      // Crear subscriber (requiere nombre)
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Nombre requerido para crear subscriber',
          timestamp: new Date().toISOString()
        });
      }
      
      const createResult = await createManyChatSubscriber(name, phoneNumber);
      result = {
        action: 'create',
        phoneNumber,
        name,
        createResult: createResult,
        success: createResult.success
      };
    } else if (action === 'sendFlow') {
      // Enviar flujo (requiere subscriber ID y flow ID)
      const { subscriberId, flowId } = req.body;
      if (!subscriberId || !flowId) {
        return res.status(400).json({
          success: false,
          error: 'Subscriber ID y Flow ID requeridos',
          timestamp: new Date().toISOString()
        });
      }
      
      const flowResult = await sendManyChatFlow(subscriberId, flowId);
      result = {
        action: 'sendFlow',
        subscriberId,
        flowId,
        flowResult: flowResult,
        success: flowResult.success
      };
    }
    
    res.json({
      success: true,
      data: result,
      config: {
        token: config.tokens.manychat ? '***configurado***' : 'no configurado',
        flows: config.numericos
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error en test de ManyChat:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Test individual de Flodesk
router.post('/test-flodesk', async (req, res) => {
  try {
    const { email, segmentId } = req.body;
    
    if (!email || !segmentId) {
      return res.status(400).json({
        success: false,
        error: 'Email y Segment ID requeridos',
        timestamp: new Date().toISOString()
      });
    }
    
    const config = getHotmartConfig();
    const result = await addSubscriberToFlodesk(email, segmentId);
    
    res.json({
      success: true,
      data: {
        email,
        segmentId,
        result: result,
        addedSuccessfully: result.success
      },
      config: {
        token: config.tokens.flodesk ? '***configurado***' : 'no configurado',
        segments: config.flodesk
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error en test de Flodesk:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Test individual de Telegram
router.post('/test-telegram', async (req, res) => {
  try {
    const { advisorId, messageType = 'test', clientName, clientPhone, motivo } = req.body;
    
    if (!advisorId) {
      return res.status(400).json({
        success: false,
        error: 'ID del asesor requerido',
        timestamp: new Date().toISOString()
      });
    }
    
    const asesor = await getAsesorById(advisorId);
    if (!asesor) {
      return res.status(404).json({
        success: false,
        error: 'Asesor no encontrado',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!asesor.ID_TG) {
      return res.status(400).json({
        success: false,
        error: 'El asesor no tiene ID de Telegram configurado',
        advisorName: asesor.NOMBRE,
        timestamp: new Date().toISOString()
      });
    }
    
    let message;
    const config = getHotmartConfig();
    
    if (messageType === 'venta') {
      // Mensaje de venta al grupo general
      const fakeHotmartData = {
        buyer: { 
          name: clientName || 'Cliente de Prueba',
          email: 'test@ejemplo.com',
          address: { country: 'Colombia' }
        },
        product: { name: 'Producto de Prueba' },
        purchase: { 
          transaction: 'TEST_' + Date.now(),
          order_date: new Date().toISOString()
        }
      };
      
      message = createVentaMessage(fakeHotmartData, asesor.NOMBRE);
    } else {
      // Mensaje de notificación al asesor
      message = createAsesorNotificationMessage(
        'CARRITOS', // evento de prueba
        clientName || 'Cliente de Prueba',
        clientPhone || '57300000000',
        asesor.ID_TG,
        motivo || 'Mensaje de prueba desde el dashboard'
      );
    }
    
    const result = await sendTelegramMessage(message);
    
    res.json({
      success: true,
      data: {
        advisorId,
        advisorName: asesor.NOMBRE,
        advisorTelegramId: asesor.ID_TG,
        messageType,
        message: message,
        result: result,
        sentSuccessfully: result.success
      },
      config: {
        token: config.tokens.telegram ? '***configurado***' : 'no configurado',
        groupChatId: config.telegram.groupChatId,
        threadId: config.telegram.threadId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error en test de Telegram:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
