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
import telegramQueue from '../services/telegramQueueService';
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

// Función para segmentar clientes según CRM
function segmentarCliente(haComprado: boolean, mainDoubt: string | null): {
  tipo: 'VIP_POST_VENTA' | 'PROSPECTO_CALIENTE' | 'PROSPECTO_FRIO';
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  emoji: string;
  descripcion: string;
} {
  if (haComprado) {
    return {
      tipo: 'VIP_POST_VENTA',
      prioridad: 'ALTA',
      emoji: '🔥',
      descripcion: 'Cliente VIP - Post-venta'
    };
  }

  // Para no compradores, segmentar según tipo de duda
  switch (mainDoubt) {
    case 'tecnico':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'ALTA', // Técnico es alta porque puede ser venta perdida
        emoji: '⚠️',
        descripcion: 'URGENTE - Venta Fallida (Problema Técnico)'
      };
    
    case 'precio':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'MEDIA',
        emoji: '💰',
        descripcion: 'Lead Caliente - Objeción de Precio'
      };
    
    case 'adecuacion':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'MEDIA',
        emoji: '🎯',
        descripcion: 'Lead Caliente - Evaluando Compra'
      };
    
    case 'contenido':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'MEDIA',
        emoji: '📚',
        descripcion: 'Lead Caliente - Duda sobre Producto'
      };
    
    case 'otra':
    default:
      return {
        tipo: 'PROSPECTO_FRIO',
        prioridad: 'BAJA',
        emoji: '❄️',
        descripcion: 'Prospecto Frío - Consulta General'
      };
  }
}

// Función para crear mensaje de notificación al asesor
function createSoporteNotificationMessage(
  clienteName: string,
  clientePhone: string,
  asesorTelegramId: string,
  segmentacion: {
    tipo: string;
    prioridad: string;
    emoji: string;
    descripcion: string;
  },
  mainDoubt: string | null = null,
  crmLabel: string | null = null
): any {
  // Crear header según prioridad
  let headerEmoji = '';
  let urgencyText = '';
  
  switch (segmentacion.prioridad) {
    case 'ALTA':
      headerEmoji = '🚨🔥🚨';
      urgencyText = '*PRIORIDAD ALTA*';
      break;
    case 'MEDIA':
      headerEmoji = '⚡💡⚡';
      urgencyText = '*OPORTUNIDAD DE VENTA*';
      break;
    case 'BAJA':
    default:
      headerEmoji = '💬';
      urgencyText = '*CONSULTA GENERAL*';
      break;
  }

  // Mapear dudas para el mensaje
  const doubtLabels = {
    'precio': '💰 Objeción de Precio - Listo para cerrar',
    'adecuacion': '🎯 Evaluando si comprar - Calentar lead',
    'contenido': '📚 Duda sobre el producto - Educar beneficios', 
    'tecnico': '🔧 ¡PROBLEMA TÉCNICO! - Venta fallida, rescatar YA',
    'otra': '❓ Consulta general'
  };

  let doubtInfo = '';
  if (mainDoubt && doubtLabels[mainDoubt as keyof typeof doubtLabels]) {
    doubtInfo = `\n🎯 *Tipo de Consulta:*\n${doubtLabels[mainDoubt as keyof typeof doubtLabels]}\n`;
  }

  const messageText = `${headerEmoji} *CLIENTE INGRESÓ SUS DATOS EN LINK DE SOPORTE* ${headerEmoji}

${segmentacion.emoji} *${urgencyText}*
${segmentacion.descripcion}

👤 *Cliente:* ${clienteName}
📱 *WhatsApp:* ${clientePhone}
${crmLabel ? `🏷️ *Etiqueta CRM:* \`${crmLabel}\`` : ''}
${doubtInfo}
⏰ *Recibido:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}

💬 *Te debe llegar directamente a tu WhatsApp, si no llega, escríbele* 👇🏻

${segmentacion.prioridad === 'ALTA' ? '⚠️ *ACCIÓN INMEDIATA REQUERIDA* ⚠️' : ''}
${segmentacion.tipo === 'PROSPECTO_CALIENTE' ? '💡 *OPORTUNIDAD DE CIERRE* - Lead caliente esperando' : ''}`;

  // Botones dinámicos según el tipo de cliente
  const buttons = [
    [
      {
        text: segmentacion.prioridad === 'ALTA' ? "🚨 IR AL CHAT URGENTE" : "💬 IR AL CHAT",
        url: `https://wa.me/${clientePhone}`
      }
    ],
    [
      {
        text: "📊 REPORTAR EN SISTEMA", 
        url: "https://sistema-cierres-ger.automscc.com/"
      }
    ]
  ];

  return {
    chat_id: asesorTelegramId,
    text: messageText,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: buttons
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
    
    // Nuevos campos del formulario mejorado
    const mainDoubt = body.mainDoubt || null; // Solo para no compradores
    const doubtType = body.doubtType || null;
    const crmLabel = body.crmLabel || null;

    // Segmentar cliente según CRM
    const segmentacion = segmentarCliente(haComprado, mainDoubt);

    logger.info('Datos procesados del formulario', {
      nombre,
      whatsappOriginal,
      whatsappLimpio,
      haComprado,
      mainDoubt,
      crmLabel,
      segmentacion,
      timestamp: new Date().toISOString()
    });

    // Crear entrada inicial en webhook logs
    const initialLogEntry: WebhookLogEntry = {
      event_type: 'SUPPORT_FORM',
      flujo: segmentacion.tipo, // Usar el tipo de segmentación como flujo
      status: 'received',
      buyer_name: nombre,
      buyer_phone: whatsappLimpio,
      raw_webhook_data: {
        ...body,
        source: 'support_form',
        haComprado: haComprado,
        segmentacion: segmentacion,
        mainDoubt: mainDoubt,
        crmLabel: crmLabel
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

    // 1. Buscar cliente existente (usando getClienteByWhatsapp que maneja la lógica internamente)
    let clienteExistente = await getClienteByWhatsapp(whatsappLimpio);
    
    // Si no encuentra por WhatsApp, log para debugging
    if (!clienteExistente && nombre) {
      logger.info('Cliente no encontrado por WhatsApp en soporte', {
        nombre,
        whatsappCompleto: whatsappLimpio
      });
    }
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let clienteId: number;
    let asesorAsignado = null;
    let shouldRedirectToAcademy = false;
    
    // Si dice que ya compró (VIP_POST_VENTA) pero no está en BD, dirigir a academia
    if (segmentacion.tipo === 'VIP_POST_VENTA' && !clienteExistente) {
      shouldRedirectToAcademy = true;
      logger.warn('🚨 VIP_POST_VENTA sin registro en BD - Redirigir a academia', {
        nombre,
        whatsapp: whatsappLimpio,
        reason: 'client_claims_purchased_but_not_in_db'
      });
    }

    // IMPORTANTE: asesorAsignado se maneja dentro de cada bloque según shouldRedirectToAcademy

    // Variables para tracking de resultados de integraciones
    let telegramStatus: 'success' | 'error' | 'skipped' | 'queued' = 'skipped';
    let telegramChatId = '';
    let telegramMessageId = '';
    let telegramError = '';

    if (clienteExistente) {
      logger.info('Cliente existente encontrado', { clienteId: clienteExistente.ID });
      clienteId = clienteExistente.ID;

      // Verificar si ya compró (como en el flujo N8N)
      if (clienteExistente.ESTADO === 'PAGADO' || clienteExistente.ESTADO === 'VENTA CONSOLIDADA') {
        shouldRedirectToAcademy = true;
        
        // Logging detallado para compradores
        logger.warn('🛍️ COMPRADOR DETECTADO - Redirigir a academia', {
          clienteId,
          nombre: nombre,
          whatsapp: whatsappLimpio,
          estado: clienteExistente.ESTADO,
          asesorAsignado: clienteExistente.NOMBRE_ASESOR || 'Sin asesor',
          fechaCreacion: 'unknown',
          segmentacion: {
            tipo: segmentacion.tipo,
            prioridad: segmentacion.prioridad,
            emoji: segmentacion.emoji
          },
          mainDoubt,
          crmLabel,
          action: 'redirect_to_academy',
          reason: 'buyer_status'
        });
      } else {
        // Cliente existente pero no ha comprado, actualizar estado a LINK con datos CRM
        await updateCliente(clienteId, {
          ESTADO: 'LINK',
          NOMBRE: nombre,
          WHATSAPP: whatsappLimpio,
          soporte_tipo: segmentacion.tipo,
          soporte_prioridad: segmentacion.prioridad,
          soporte_duda: mainDoubt,
          soporte_descripcion: segmentacion.descripcion,
          soporte_fecha_ultimo: currentTimestamp
        });

        // Obtener asesor asignado SOLO si NO va a academia
        if (clienteExistente.ID_ASESOR && !shouldRedirectToAcademy) {
          asesorAsignado = await getAsesorById(clienteExistente.ID_ASESOR);
        } else if (shouldRedirectToAcademy) {
          logger.info('🧹 Asesor NO asignado para cliente existente VIP_POST_VENTA', {
            nombre,
            whatsapp: whatsappLimpio,
            clienteId: clienteExistente.ID,
            reason: 'redirect_to_academy_existing_client'
          });
        }
      }
    } else {
      logger.info('Cliente nuevo, creando registro');

      if (!shouldRedirectToAcademy) {
        // Obtener próximo asesor ponderado solo si NO va a academia
        const nextAsesor = await getNextAsesorPonderado();
        if (nextAsesor?.ID) {
          asesorAsignado = await getAsesorById(nextAsesor.ID);
          
          // Crear nuevo cliente con asesor asignado y datos CRM
          const nuevoCliente = await createCliente({
            NOMBRE: nombre,
            ESTADO: 'LINK',
            WHATSAPP: whatsappLimpio,
            ID_ASESOR: nextAsesor.ID,
            NOMBRE_ASESOR: asesorAsignado?.NOMBRE,
            WHA_ASESOR: asesorAsignado?.WHATSAPP,
            FECHA_CREACION: currentTimestamp,
            soporte_tipo: segmentacion.tipo,
            soporte_prioridad: segmentacion.prioridad,
            soporte_duda: mainDoubt,
            soporte_descripcion: segmentacion.descripcion,
            soporte_fecha_ultimo: currentTimestamp
          });
          clienteId = nuevoCliente[0].ID;

          // Incrementar contador LINK del asesor
          await updateAsesorCounter(nextAsesor.ID, 'LINK');
        } else {
          // No hay asesores disponibles - crear cliente sin asesor
          const nuevoCliente = await createCliente({
            NOMBRE: nombre,
            ESTADO: 'LINK',
            WHATSAPP: whatsappLimpio,
            FECHA_CREACION: currentTimestamp,
            soporte_tipo: segmentacion.tipo,
            soporte_prioridad: segmentacion.prioridad,
            soporte_duda: mainDoubt,
            soporte_descripcion: segmentacion.descripcion,
            soporte_fecha_ultimo: currentTimestamp
          });
          clienteId = nuevoCliente[0].ID;
        }
      } else {
        // Cliente VIP_POST_VENTA que no existe en BD - crear SIN asesor
        logger.info('🎓 Creando cliente VIP_POST_VENTA sin asesor (será redirigido a academia)', {
          nombre,
          whatsapp: whatsappLimpio,
          reason: 'vip_post_venta_not_in_db'
        });
        
        const nuevoCliente = await createCliente({
          NOMBRE: nombre,
          ESTADO: 'LINK',
          WHATSAPP: whatsappLimpio,
          FECHA_CREACION: currentTimestamp,
          soporte_tipo: segmentacion.tipo,
          soporte_prioridad: segmentacion.prioridad,
          soporte_duda: mainDoubt,
          soporte_descripcion: segmentacion.descripcion,
          soporte_fecha_ultimo: currentTimestamp
          // SIN ID_ASESOR, NOMBRE_ASESOR, WHA_ASESOR
        });
        clienteId = nuevoCliente[0].ID;
        
        // Asegurar que asesorAsignado permanezca null
        asesorAsignado = null;
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
          telegram_error: 'Cliente redirigido a academia - Ya es comprador',
          processing_time_ms: processingTime,
          processed_at: new Date(),
          buyer_status: clienteExistente?.ESTADO || 'unknown',
          buyer_previous_advisor: clienteExistente?.NOMBRE_ASESOR || undefined,
          buyer_creation_date: undefined,
          redirect_reason: 'buyer_status'
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

    // 4. Enviar notificación por Telegram si tiene asesor (NO para VIPs)
    let telegramNotified = false;
    if (asesorAsignado?.ID_TG && !shouldRedirectToAcademy) {
      try {
        const notificationMessage = createSoporteNotificationMessage(
          nombre,
          whatsappLimpio,
          asesorAsignado.ID_TG,
          segmentacion,
          mainDoubt,
          crmLabel
        );

        telegramChatId = asesorAsignado.ID_TG;
        
        // Usar cola en lugar de envío directo
        const messageId = telegramQueue.enqueueMessage(
          asesorAsignado.ID_TG,
          notificationMessage.text,
          webhookLogId || undefined,
          { 
            type: 'soporte',
            asesor: asesorAsignado.NOMBRE,
            cliente: nombre,
            segmentacion: segmentacion.tipo,
            prioridad: segmentacion.prioridad
          },
          notificationMessage.reply_markup
        );
        
        telegramStatus = 'queued'; // Estado inicial en cola
        telegramMessageId = messageId;
        telegramNotified = true;
        
        logger.info('Notificación de soporte agregada a cola', {
          asesor: asesorAsignado.NOMBRE,
          cliente: nombre,
          telegramId: asesorAsignado.ID_TG,
          messageId,
          segmentacion: segmentacion.tipo,
          queueStats: telegramQueue.getQueueStats()
        });
      } catch (error) {
        telegramStatus = 'error';
        telegramError = error instanceof Error ? error.message : 'Error agregando a cola';
        logger.error('Error agregando notificación de soporte a cola', error);
      }
    } else if (asesorAsignado && !shouldRedirectToAcademy) {
      telegramStatus = 'skipped';
      telegramError = 'Asesor sin ID_TG configurado';
    } else if (shouldRedirectToAcademy) {
      telegramStatus = 'skipped';
      telegramError = 'Cliente VIP_POST_VENTA - No se notifica asesor';
      logger.info('📱 Notificación de Telegram saltada para VIP_POST_VENTA', {
        nombre,
        whatsapp: whatsappLimpio,
        reason: 'vip_post_venta'
      });
    }

    // 5. Preparar mensaje de WhatsApp personalizado según tipo de lead
    let whatsappUrl;
    
    // Si debe ir a academia, NO generar URL de asesor
    if (shouldRedirectToAcademy) {
      whatsappUrl = null; // Se maneja en la respuesta de academia
      logger.info('🎓 URL de WhatsApp saltada para VIP_POST_VENTA', {
        nombre,
        whatsapp: whatsappLimpio,
        reason: 'redirect_to_academy'
      });
    } else if (asesorAsignado?.WHATSAPP) {
      let mensajePersonalizado = '';

      if (haComprado) {
        // VIP POST-VENTA - Mensaje directo y urgente
        mensajePersonalizado = `🔥 Hola! Soy ${nombre}, YA COMPRÉ el curso y tengo un problema que necesito resolver urgentemente. ¿Me puedes ayudar?`;
      } else {
        // PROSPECTOS - Mensajes según tipo de duda
        switch (mainDoubt) {
          case 'precio':
            mensajePersonalizado = `💰 Hola! Soy ${nombre}. Estoy MUY interesado en el curso pero tengo algunas dudas sobre el precio y métodos de pago. ¿Podríamos hablar?`;
            break;
            
          case 'tecnico':
            mensajePersonalizado = `🚨 URGENTE - Hola! Soy ${nombre}. Estaba tratando de COMPRAR el curso pero tengo un problema técnico que me impide completar la compra. ¡Ayúdame por favor!`;
            break;
            
          case 'adecuacion':
            mensajePersonalizado = `🎯 Hola! Soy ${nombre}. Estoy evaluando si el curso es realmente para mí y mi situación. ¿Podrías ayudarme a aclarar algunas dudas?`;
            break;
            
          case 'contenido':
            mensajePersonalizado = `📚 Hola! Soy ${nombre}. Tengo una pregunta específica sobre el contenido del curso antes de tomar la decisión de comprar. ¿Puedes orientarme?`;
            break;
            
          case 'otra':
          default:
            mensajePersonalizado = `❓ Hola! Soy ${nombre}. Tengo algunas consultas sobre la terapia del dolor y me gustaría conversar contigo. ¿Tienes un momento?`;
            break;
        }
      }
      
      const mensajeCodificado = encodeURIComponent(mensajePersonalizado);
      whatsappUrl = `https://wa.me/${asesorAsignado.WHATSAPP}?text=${mensajeCodificado}`;
    } else if (!shouldRedirectToAcademy) {
      // Fallback si no hay asesor Y NO es VIP - usar número configurado (obligatorio)
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
            processingTimeMs: processingTime,
            crmSegmentation: {
              tipo: segmentacion.tipo,
              prioridad: segmentacion.prioridad,
              descripcion: segmentacion.descripcion,
              emoji: segmentacion.emoji
            }
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
        asesorAsignado: shouldRedirectToAcademy ? null : asesorAsignado?.NOMBRE || null,
        asesorWhatsapp: shouldRedirectToAcademy ? null : asesorAsignado?.WHATSAPP || null,
        telegramNotified: shouldRedirectToAcademy ? false : telegramNotified,
        redirectedToAcademy: shouldRedirectToAcademy,
        webhookLogId,
        processingTimeMs: processingTime,
        // Nueva información CRM
        crmSegmentation: {
          tipo: segmentacion.tipo,
          prioridad: segmentacion.prioridad,
          descripcion: segmentacion.descripcion,
          emoji: segmentacion.emoji
        },
        mainDoubt,
        crmLabel,
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