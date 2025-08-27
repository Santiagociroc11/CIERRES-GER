import express from 'express';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';
import winston from 'winston';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { setupWhatsAppEventHandlers } from './whatsappEvents';
import { scheduledMessageService } from './services/scheduledMessageService';
import telegramBot from './services/telegramBot';
import path from 'path';
import apiRoutes from './routes/api';
import hotmartRoutes from './routes/hotmart';
import soporteRoutes from './routes/soporte';
import reasignacionRoutes from './routes/reasignacion';

// Configurar variables de entorno
dotenv.config();

// Configurar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad y logging
// app.use(helmet()); // DESACTIVADO - Causa problemas de CSP
app.use(cors({
  origin: '*', // Permitir cualquier origen
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Headers personalizados para permitir conexiones externas
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging personalizado
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'CIERRES-GER API'
  });
});

// Ruta para verificar estado del bot de Telegram
app.get('/telegram-bot-status', (req, res) => {
  const botStatus = telegramBot.getStatus();
  res.json({
    status: 'OK',
    telegramBot: {
      isRunning: botStatus.isRunning,
      hasToken: botStatus.hasToken,
      lastUpdateId: botStatus.lastUpdateId,
      message: botStatus.hasToken 
        ? (botStatus.isRunning ? 'Bot funcionando correctamente' : 'Bot detenido')
        : 'Token no configurado - revisa webhookconfig'
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', (req, res, next) => {
  logger.info(`API Request: ${req.method} ${req.path}`);
  next();
});

// Usar las rutas de la API
app.use('/api', apiRoutes);

// Usar las rutas de Hotmart
app.use('/api/hotmart', hotmartRoutes);

// Usar las rutas de Soporte
app.use('/api/soporte', soporteRoutes);

// Usar las rutas de Reasignación
app.use('/api', reasignacionRoutes);

// Ejemplo de ruta de API
app.get('/api/status', (req, res) => {
  res.json({
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Ejemplo de ruta para obtener datos
app.get('/api/data', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Ejemplo 1' },
      { id: 2, name: 'Ejemplo 2' }
    ],
    total: 2
  });
});

// Ruta POST de ejemplo
app.post('/api/data', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  
  logger.info(`Creando nuevo item: ${name}`);
  
  res.status(201).json({
    message: 'Item creado exitosamente',
    data: { id: Date.now(), name }
  });
});

// Manejo de rutas no encontradas para API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Servir archivos estáticos del frontend en producción
let frontendPath: string | undefined;

if (process.env.NODE_ENV === 'production') {
  frontendPath = path.join(__dirname, '../../dist');
  app.use(express.static(frontendPath));
  
  // Para SPA, redirigir todas las rutas no-API al index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath!, 'index.html'));
    }
  });
}

// Configuración del cliente WebSocket
const evolutionApiUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTIONAPI_URL;
const evolutionApiKey = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTIONAPI_TOKEN;

if (!evolutionApiUrl || !evolutionApiKey) {
  logger.error('Faltan variables de entorno requeridas');
  process.exit(1);
}

// Conectar al WebSocket global de Evolution API
const socket = io(evolutionApiUrl, {
  transports: ['websocket'],
  extraHeaders: {
    'apikey': evolutionApiKey
  }
});

// Manejar eventos de conexión
socket.on('connect', () => {
  logger.info('Conectado al WebSocket de Evolution API');
  console.log('✅ Conectado al WebSocket de Evolution API');
});

socket.on('disconnect', () => {
  logger.warn('Desconectado del WebSocket de Evolution API');
  console.log('⚠️ Desconectado del WebSocket de Evolution API');
});

socket.on('connect_error', (error) => {
  logger.error('Error de conexión:', error);
  console.log('❌ Error de conexión:', error.message);
});

// Configurar manejadores de eventos de WhatsApp
setupWhatsAppEventHandlers(socket);

// Iniciar servicio de mensajes programados
scheduledMessageService.start();

// Iniciar servidor Express
app.listen(PORT, () => {
  logger.info(`Servidor iniciado en puerto ${PORT}`);
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`📡 WebSocket conectado a Evolution API`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API base: http://localhost:${PORT}/api`);
  
  if (process.env.NODE_ENV === 'production' && frontendPath) {
    console.log(`🌍 Frontend servido desde: ${frontendPath}`);
  }
  
  // Inicializar bot de Telegram para responder a /autoid
  console.log('🤖 Inicializando bot de Telegram...');
  const botStatus = telegramBot.getStatus();
  if (botStatus.hasToken) {
    console.log('✅ Bot de Telegram configurado correctamente');
  } else {
    console.log('⚠️ Bot de Telegram sin token configurado - revisa webhookconfig');
  }
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  logger.info('Cerrando servidor...');
  console.log('🛑 Cerrando servidor...');
  scheduledMessageService.stop();
  telegramBot.stopPolling();
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Cerrando servidor...');
  console.log('🛑 Cerrando servidor...');
  scheduledMessageService.stop();
  telegramBot.stopPolling();
  socket.disconnect();
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Error no manejado:', error);
  console.log('❌ Error no manejado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
  console.log('❌ Promesa rechazada no manejada:', reason);
});
