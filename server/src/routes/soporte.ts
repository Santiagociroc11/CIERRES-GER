import { Router } from 'express';
import winston from 'winston';
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
  getWebhookLogById,
  type WebhookLogEntry
} from '../dbClient';
import { sendTelegramMessage } from '../services/telegramService';
import { getSoporteConfig, updateSoporteConfig } from '../config/webhookConfig';

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

// Función para limpiar número de WhatsApp
function limpiarNumeroWhatsapp(numero: string): string {
  // Remover el símbolo + y cualquier espacio
  return numero.replace(/^\+/, '').replace(/\s/g, '');
}

// Función para crear mensaje de notificación al asesor
function createSoporteNotificationMessage(
  clienteName: string,
  clientePhone: string,
  asesorTelegramId: string,
  hasBought: boolean
): any {
  const messageText = `*CLIENTE INGRESÓ SUS DATOS EN LINK DE SOPORTE*

Un cliente puso sus datos en el link de soporte, te debe llegar directamente a tu whatsapp, si no llega, escribele 👇🏻

Nombre: ${clienteName}
WhatsApp ingresado: ${clientePhone}
${hasBought ? 'Estado: Ya compró el curso' : 'Estado: Aún no ha comprado'}`;

  return {
    chat_id: asesorTelegramId,
    text: messageText,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "IR AL CHAT",
            url: `https://wa.me/${clientePhone}`
          },
          {
            text: "IR A REPORTAR", 
            url: "https://sistema-cierres-ger.automscc.com/"
          }
        ]
      ]
    }
  };
}

// Endpoint principal para formularios de soporte
router.post('/formulario-soporte', async (req, res) => {
  const startTime = Date.now();
  let webhookLogId: number | null = null;
  
  try {
    const { body } = req;
    
    logger.info('Formulario de soporte recibido', {
      body,
      timestamp: new Date().toISOString()
    });

    // Validar estructura del formulario
    if (!body || !body.name || !body.whatsapp) {
      return res.status(400).json({
        success: false,
        error: 'Datos de formulario inválidos. Se requiere name y whatsapp',
        timestamp: new Date().toISOString()
      });
    }

    // Extraer y limpiar datos
    const nombre = body.name;
    const whatsappOriginal = body.whatsapp;
    const haComprado = body.courseStatus === 'si';
    const whatsappLimpio = limpiarNumeroWhatsapp(whatsappOriginal);

    logger.info('Datos procesados del formulario', {
      nombre,
      whatsappOriginal,
      whatsappLimpio,
      haComprado,
      timestamp: new Date().toISOString()
    });

    // Crear entrada inicial en webhook logs
    const initialLogEntry: WebhookLogEntry = {
      event_type: 'SUPPORT_FORM',
      flujo: 'SOPORTE',
      status: 'received',
      buyer_name: nombre,
      buyer_phone: whatsappLimpio,
      raw_webhook_data: {
        ...body,
        source: 'support_form',
        haComprado: haComprado
      },
      received_at: new Date()
    };

    try {
      const logResult = await insertWebhookLog(initialLogEntry);
      webhookLogId = logResult[0]?.id || null;
      logger.info(`Support webhook log creado con ID: ${webhookLogId}`);
    } catch (logError) {
      logger.error('Error creando support webhook log:', logError);
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
        logger.error('Error actualizando support webhook log a processing:', updateError);
        // Continuar procesamiento aunque falle la actualización del log
      }
    }

    // 1. Buscar cliente existente (usando los últimos 6 dígitos como en N8N)
    const ultimosSeis = whatsappLimpio.slice(-6);
    const clienteExistente = await getClienteByWhatsapp(`%${ultimosSeis}`);
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let clienteId: number;
    let asesorAsignado = null;
    let shouldRedirectToAcademy = false;

    // Variables para tracking de resultados de integraciones
    let telegramStatus: 'success' | 'error' | 'skipped' = 'skipped';
    let telegramChatId = '';
    let telegramMessageId = '';
    let telegramError = '';

    if (clienteExistente) {
      logger.info('Cliente existente encontrado', { clienteId: clienteExistente.ID });
      clienteId = clienteExistente.ID;

      // Verificar si ya compró (como en el flujo N8N)
      if (clienteExistente.ESTADO === 'PAGADO' || clienteExistente.ESTADO === 'VENTA CONSOLIDADA') {
        shouldRedirectToAcademy = true;
        logger.info('Cliente ya había comprado, redirigir a academia', { clienteId });
      } else {
        // Cliente existente pero no ha comprado, actualizar estado a LINK
        await updateCliente(clienteId, {
          ESTADO: 'LINK',
          NOMBRE: nombre,
          WHATSAPP: whatsappLimpio
        });

        // Obtener asesor asignado
        if (clienteExistente.ID_ASESOR) {
          asesorAsignado = await getAsesorById(clienteExistente.ID_ASESOR);
        }
      }
    } else {
      logger.info('Cliente nuevo, creando registro');

      // Obtener próximo asesor ponderado
      const nextAsesor = await getNextAsesorPonderado();
      if (nextAsesor?.ID) {
        asesorAsignado = await getAsesorById(nextAsesor.ID);
        
        // Crear nuevo cliente con asesor asignado
        const nuevoCliente = await createCliente({
          NOMBRE: nombre,
          ESTADO: 'LINK',
          WHATSAPP: whatsappLimpio,
          ID_ASESOR: nextAsesor.ID,
          NOMBRE_ASESOR: asesorAsignado?.NOMBRE,
          WHA_ASESOR: asesorAsignado?.WHATSAPP,
          FECHA_CREACION: currentTimestamp
        });
        clienteId = nuevoCliente[0].ID;

        // Incrementar contador LINK del asesor
        await updateAsesorCounter(nextAsesor.ID, 'LINK');
      } else {
        // No hay asesores disponibles
        const nuevoCliente = await createCliente({
          NOMBRE: nombre,
          ESTADO: 'LINK',
          WHATSAPP: whatsappLimpio,
          FECHA_CREACION: currentTimestamp
        });
        clienteId = nuevoCliente[0].ID;
      }
    }

    // 2. Registrar evento LINK
    await insertRegistro({
      ID_CLIENTE: clienteId,
      TIPO_EVENTO: 'LINK',
      FECHA_EVENTO: currentTimestamp
    });

    // 3. Si debe ir a academia, responder inmediatamente
    if (shouldRedirectToAcademy) {
      // Obtener número configurado para academia (obligatorio)
      let academyPhoneNumber: string | null = null;
      try {
        const soporteConfig = await getSoporteConfig();
        if (soporteConfig.phoneNumbers.academySupport) {
          academyPhoneNumber = soporteConfig.phoneNumbers.academySupport;
          logger.info('Usando número de soporte configurado:', academyPhoneNumber);
        } else {
          logger.error('Número de soporte academia no está configurado en BD');
        }
      } catch (configError) {
        logger.error('Error obteniendo configuración de soporte:', configError);
      }

      if (!academyPhoneNumber) {
        // Finalizar webhook log con error de configuración
        const processingTime = Date.now() - startTime;
        if (webhookLogId) {
          try {
            await updateWebhookLog({
              id: webhookLogId,
              status: 'error',
              error_message: 'Número de soporte academia no configurado',
              processing_time_ms: processingTime,
              processed_at: new Date()
            });
          } catch (updateError) {
            logger.error('Error actualizando webhook log con error de configuración:', updateError);
          }
        }

        return res.status(500).json({
          success: false,
          error: 'Número de soporte academia no configurado',
          message: 'Debe configurar el número de WhatsApp para soporte academia en el dashboard',
          data: {
            clienteId,
            nombre,
            whatsapp: whatsappLimpio,
            redirectedToAcademy: false,
            configurationRequired: true,
            webhookLogId,
            processingTimeMs: processingTime
          },
          timestamp: new Date().toISOString()
        });
      }

      // Finalizar webhook log para redirección a academia
      const processingTime = Date.now() - startTime;
      if (webhookLogId) {
        try {
          await updateWebhookLog({
            id: webhookLogId,
            status: 'success',
            cliente_id: clienteId,
            telegram_status: 'skipped',
            telegram_error: 'Cliente redirigido a academia',
            processing_time_ms: processingTime,
            processed_at: new Date()
          });
        } catch (updateError) {
          logger.error('Error finalizando webhook log (academia):', updateError);
        }
      }

      return res.json({
        success: true,
        url: `https://wa.me/${academyPhoneNumber}?text=Ya+compre+y+necesito+ayuda.`,
        message: 'Cliente redirigido a academia',
        data: {
          clienteId,
          nombre,
          whatsapp: whatsappLimpio,
          redirectedToAcademy: true,
          academyPhoneUsed: academyPhoneNumber,
          webhookLogId,
          processingTimeMs: processingTime
        },
        timestamp: new Date().toISOString()
      });
    }

    // 4. Enviar notificación por Telegram si tiene asesor
    let telegramNotified = false;
    if (asesorAsignado?.ID_TG) {
      try {
        const notificationMessage = createSoporteNotificationMessage(
          nombre,
          whatsappLimpio,
          asesorAsignado.ID_TG,
          haComprado
        );

        telegramChatId = asesorAsignado.ID_TG;
        const telegramResult = await sendTelegramMessage(notificationMessage);
        if (telegramResult.success) {
          telegramStatus = 'success';
          telegramMessageId = telegramResult.data?.result?.message_id?.toString() || '';
          telegramNotified = true;
          logger.info('Notificación de soporte enviada al asesor', {
            asesor: asesorAsignado.NOMBRE,
            cliente: nombre,
            telegramId: asesorAsignado.ID_TG
          });
        } else {
          telegramStatus = 'error';
          telegramError = telegramResult.error || 'Error enviando notificación';
          logger.error('Error enviando notificación de soporte', telegramResult.error);
        }
      } catch (error) {
        telegramStatus = 'error';
        telegramError = error instanceof Error ? error.message : 'Error desconocido';
        logger.error('Error enviando notificación Telegram', error);
      }
    } else if (asesorAsignado) {
      telegramStatus = 'skipped';
      telegramError = 'Asesor sin ID_TG configurado';
    }

    // 5. Preparar mensaje de WhatsApp y respuesta
    let whatsappUrl;
    if (asesorAsignado?.WHATSAPP) {
      const mensajeBase = haComprado 
        ? "Hola, ya hice la compra y tengo un problema, mi nombre es"
        : "Hola, quiero inscribirme a la terapia del dolor pero tengo unas dudas o problemas, mi nombre es";
      
      const mensajeCompleto = `${mensajeBase} ${nombre}`;
      const mensajeCodificado = encodeURIComponent(mensajeCompleto);
      whatsappUrl = `https://wa.me/${asesorAsignado.WHATSAPP}?text=${mensajeCodificado}`;
    } else {
      // Fallback si no hay asesor - usar número configurado (obligatorio)
      let fallbackPhoneNumber: string | null = null;
      try {
        const soporteConfig = await getSoporteConfig();
        if (soporteConfig.phoneNumbers.academySupport) {
          fallbackPhoneNumber = soporteConfig.phoneNumbers.academySupport;
          logger.info('Usando número de soporte configurado para fallback:', fallbackPhoneNumber);
        } else {
          logger.error('Número de soporte academia no configurado para fallback');
        }
      } catch (configError) {
        logger.error('Error obteniendo configuración de soporte para fallback:', configError);
      }

      if (!fallbackPhoneNumber) {
        // Finalizar webhook log con error de configuración
        const processingTime = Date.now() - startTime;
        if (webhookLogId) {
          try {
            await updateWebhookLog({
              id: webhookLogId,
              status: 'error',
              error_message: 'Número de soporte academia no configurado (fallback)',
              processing_time_ms: processingTime,
              processed_at: new Date()
            });
          } catch (updateError) {
            logger.error('Error actualizando webhook log con error de configuración (fallback):', updateError);
          }
        }

        return res.status(500).json({
          success: false,
          error: 'Número de soporte academia no configurado',
          message: 'Debe configurar el número de WhatsApp para soporte academia en el dashboard',
          data: {
            clienteId,
            nombre,
            whatsapp: whatsappLimpio,
            haComprado,
            asesorAsignado: null,
            telegramNotified: false,
            redirectedToAcademy: false,
            configurationRequired: true,
            webhookLogId,
            processingTimeMs: processingTime
          },
          timestamp: new Date().toISOString()
        });
      }
      
      whatsappUrl = `https://wa.me/${fallbackPhoneNumber}?text=Necesito+ayuda+con+soporte`;
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
          telegram_status: telegramStatus,
          telegram_chat_id: telegramChatId || undefined,
          telegram_message_id: telegramMessageId || undefined,
          telegram_error: telegramError || undefined,
          processing_time_ms: processingTime,
          processed_at: new Date()
        });
      } catch (updateError) {
        logger.error('Error finalizando support webhook log:', updateError);
        // No afectar la respuesta exitosa por errores de logging
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

    res.json({
      success: true,
      url: whatsappUrl,
      message: 'Formulario de soporte procesado exitosamente',
      data: {
        clienteId,
        nombre,
        whatsapp: whatsappLimpio,
        haComprado,
        asesorAsignado: asesorAsignado?.NOMBRE || null,
        asesorWhatsapp: asesorAsignado?.WHATSAPP || null,
        telegramNotified,
        redirectedToAcademy: false,
        webhookLogId,
        processingTimeMs: processingTime,
        integrationResults: {
          telegram: { 
            status: telegramStatus, 
            error: telegramError || undefined,
            chatId: telegramChatId || undefined,
            messageId: telegramMessageId || undefined
          }
        },
        // Log completo de la base de datos
        fullLog: fullLog
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error procesando formulario de soporte', error);
    
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
        logger.error('Error actualizando support webhook log con error:', updateError);
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
        // Log completo para debugging
        fullLog: fullLog
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de prueba para el formulario de soporte
router.post('/test-soporte', async (req, res) => {
  try {
    const { name, whatsapp, courseStatus = 'no', dryRun = true } = req.body;
    
    if (!name || !whatsapp) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y WhatsApp requeridos para la prueba',
        timestamp: new Date().toISOString()
      });
    }

    const whatsappLimpio = limpiarNumeroWhatsapp(whatsapp);
    const haComprado = courseStatus === 'si';
    
    if (dryRun) {
      // Modo de prueba - no hacer cambios reales
      const ultimosSeis = whatsappLimpio.slice(-6);
      
      res.json({
        success: true,
        message: 'Simulación de formulario de soporte',
        input: { name, whatsapp, courseStatus },
        processed: {
          nombre: name,
          whatsappOriginal: whatsapp,
          whatsappLimpio,
          haComprado,
          ultimosSeisDigitos: ultimosSeis
        },
        simulatedSteps: [
          `Buscaría cliente por últimos 6 dígitos: ${ultimosSeis}`,
          'Evaluaría si cliente ya compró',
          'Asignaría asesor si es cliente nuevo',
          'Registraría evento LINK',
          'Enviaría notificación por Telegram',
          'Generaría URL de WhatsApp'
        ],
        timestamp: new Date().toISOString()
      });
    } else {
      // Procesamiento real
      return res.status(501).json({
        success: false,
        error: 'Procesamiento real no implementado en endpoint de prueba. Use /formulario-soporte',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error en prueba de formulario de soporte', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener la configuración de soporte
router.get('/config', async (_req, res) => {
  try {
    const config = await getSoporteConfig();
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo configuración de soporte', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para actualizar la configuración de soporte
router.put('/config', async (req, res) => {
  try {
    const { body } = req;
    
    // Validar estructura de la configuración
    if (!body || !body.phoneNumbers) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de configuración inválida. Debe incluir: phoneNumbers',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar configuración
    const success = await updateSoporteConfig(body);
    
    if (success) {
      logger.info('Configuración de Soporte actualizada', { 
        updatedBy: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Configuración de soporte actualizada exitosamente',
        data: await getSoporteConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración de soporte',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error actualizando configuración de soporte', error);
    
    // Intentar obtener la configuración actual para verificar si algunos datos se guardaron
    let currentConfig = null;
    try {
      currentConfig = await getSoporteConfig();
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