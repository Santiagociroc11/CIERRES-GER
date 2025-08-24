import { Router } from 'express';
import winston from 'winston';
import { getHotmartConfig, updateHotmartConfig, resetToDefault } from '../config/webhookConfig';

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
    grupomailer: config.mailer[datos.flujo as keyof typeof config.mailer] || 0,
    tabla: config.tablas[datos.flujo as keyof typeof config.tablas] || 0
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

    // Aquí puedes agregar la lógica para:
    // 1. Buscar en la base de datos si el cliente existe
    // 2. Enviar a ManyChat
    // 3. Enviar a MailerLite
    // 4. Actualizar tablas de seguimiento

    // Por ahora, solo retornamos los datos procesados
    res.status(200).json({
      success: true,
      message: 'Webhook procesado exitosamente',
      data: datosProcesados,
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

// Endpoint para probar la lógica de procesamiento
router.post('/test', async (req, res) => {
  try {
    const { body } = req;
    
    // Simular el procesamiento sin guardar nada
    const flujo = determinarFlujo(body.event || '');
    const datosComprador = extraerDatosComprador(body, flujo);
    const datosProcesados = asignarValores(datosComprador);

    res.json({
      success: true,
      message: 'Prueba de procesamiento exitosa',
      input: body,
      output: datosProcesados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en prueba de procesamiento', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener la configuración actual
router.get('/config', (req, res) => {
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
    if (!body || !body.numericos || !body.mailer || !body.tablas) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de configuración inválida',
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
