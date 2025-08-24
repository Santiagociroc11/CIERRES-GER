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
  insertRegistro 
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
function asignarValores(datos: any) {
  const config = getHotmartConfig();
  
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

    // Asignar valores según el flujo
    const datosProcesados = asignarValores(datosComprador);

    logger.info('Datos procesados del webhook', {
      flujo,
      numero: datosProcesados.numero,
      nombre: datosProcesados.nombre,
      correo: datosProcesados.correo,
      timestamp: new Date().toISOString()
    });

    // 1. Buscar en la base de datos si el cliente existe
    const clienteExistente = await getClienteByWhatsapp(datosProcesados.numero);
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

    // 3. Procesar ManyChat (para todos los flujos)
    if (datosProcesados.flujomany) {
      try {
        // Buscar subscriber existente
        const subscriberResult = await findManyChatSubscriber(datosProcesados.numero);
        let subscriberId = null;

        if (subscriberResult.success && subscriberResult.data?.data?.length > 0) {
          subscriberId = subscriberResult.data.data[0].id;
          logger.info('Subscriber ManyChat encontrado', { subscriberId });
        } else {
          // Crear nuevo subscriber
          const createResult = await createManyChatSubscriber(datosProcesados.nombre, datosProcesados.numero);
          if (createResult.success && createResult.data?.data) {
            subscriberId = createResult.data.data.id;
            logger.info('Subscriber ManyChat creado', { subscriberId });
          }
        }

        // Enviar flujo si tenemos subscriber ID
        if (subscriberId) {
          await sendManyChatFlow(subscriberId, datosProcesados.flujomany);
          logger.info('Flujo ManyChat enviado', { subscriberId, flowId: datosProcesados.flujomany });
        }
      } catch (error) {
        logger.error('Error procesando ManyChat', error);
      }
    }

    // 4. Procesar Flodesk
    if (datosProcesados.correo && datosProcesados.grupoflodesk) {
      try {
        await addSubscriberToFlodesk(datosProcesados.correo, datosProcesados.grupoflodesk);
        logger.info('Subscriber agregado a Flodesk', { email: datosProcesados.correo });
      } catch (error) {
        logger.error('Error procesando Flodesk', error);
      }
    }

    // 5. Enviar notificaciones de Telegram
    try {
      if (flujo === 'COMPRAS') {
        // Notificación de venta al grupo general
        const ventaMessage = createVentaMessage(body.data, asesorAsignado?.NOMBRE);
        await sendTelegramMessage(ventaMessage);
        logger.info('Notificación de venta enviada', { asesor: asesorAsignado?.NOMBRE || 'SIN CERRADOR' });
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
          await sendTelegramMessage(asesorMessage);
          logger.info('Notificación enviada al asesor', { 
            asesor: asesorAsignado.NOMBRE, 
            evento: flujo,
            cliente: datosProcesados.nombre 
          });
        } else {
          logger.warn('No se pudo notificar: asesor sin ID_TG', { flujo, cliente: datosProcesados.nombre });
        }
      }
    } catch (error) {
      logger.error('Error enviando notificaciones Telegram', error);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook procesado exitosamente',
      data: {
        ...datosProcesados,
        clienteId,
        asesorAsignado: asesorAsignado?.NOMBRE || null,
        esClienteExistente: !!clienteExistente
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error procesando webhook de Hotmart', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
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
    const datosProcesados = asignarValores(datosComprador);

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
      const flodeskResponse = await fetch('https://api.flodesk.com/v1/subscribers?limit=1', {
        headers: {
          'Authorization': `Bearer ${config.tokens.flodesk}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (flodeskResponse.ok) {
        testResults.flodesk = { status: 'success', message: 'Token válido y conexión exitosa' };
      } else {
        testResults.flodesk = { status: 'error', message: 'Token inválido o error de conexión' };
      }
    } catch (error) {
      testResults.flodesk = { status: 'error', message: 'Error de conexión con Flodesk' };
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
router.get('/config', (_req, res) => {
  try {
    const config = getHotmartConfig();
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

export default router;
