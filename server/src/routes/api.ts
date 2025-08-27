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

// Endpoints para el bot de Telegram
router.get('/telegram/status', async (req, res) => {
  try {
    const telegramBot = (await import('../services/telegramBot')).default;
    const status = telegramBot.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estado del bot de Telegram:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/telegram/restart', async (req, res) => {
  try {
    const telegramBot = (await import('../services/telegramBot')).default;
    await telegramBot.restart();
    
    res.json({
      success: true,
      message: 'Bot de Telegram reiniciado exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error reiniciando bot de Telegram:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/telegram/force-restart', async (req, res) => {
  try {
    const telegramBot = (await import('../services/telegramBot')).default;
    await telegramBot.forceRestart();
    
    res.json({
      success: true,
      message: 'Bot de Telegram forzado a reiniciar exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error forzando reinicio del bot de Telegram:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
