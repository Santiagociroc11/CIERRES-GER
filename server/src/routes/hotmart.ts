import { Router } from 'express';
import winston from 'winston';

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

// Configuración de valores para diferentes flujos
const FLUJO_CONFIG = {
  numericos: {
    CARRITOS: "content20250222080111_909145",
    RECHAZADOS: "content20250222082908_074257",
    COMPRAS: "content20250222083048_931507",
    TICKETS: "content20250222083004_157122"
  },
  mailer: {
    CARRITOS: "112554445482493399",
    RECHAZADOS: "112554438393071296",
    COMPRAS: "112554427903116632",
    TICKETS: "147071027455723326"
  },
  tablas: {
    CARRITOS: "FECHA_ABANDONADO",
    RECHAZADOS: "FECHA_RECHAZADO",
    COMPRAS: "FECHA_COMPRA",
    TICKETS: "FECHA_TICKET"
  }
};

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

// Función para asignar valores según el flujo
function asignarValores(datos: any) {
  return {
    ...datos,
    flujomany: FLUJO_CONFIG.numericos[datos.flujo as keyof typeof FLUJO_CONFIG.numericos] || 0,
    grupomailer: FLUJO_CONFIG.mailer[datos.flujo as keyof typeof FLUJO_CONFIG.mailer] || 0,
    tabla: FLUJO_CONFIG.tablas[datos.flujo as keyof typeof FLUJO_CONFIG.tablas] || 0
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

// Endpoint para obtener la configuración de flujos
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: FLUJO_CONFIG,
    timestamp: new Date().toISOString()
  });
});

export default router;
