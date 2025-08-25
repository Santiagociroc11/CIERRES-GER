import express from 'express';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';
import winston from 'winston';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { setupWhatsAppEventHandlers } from './whatsappEvents';
import { scheduledMessageService } from './services/scheduledMessageService';
import apiRoutes from './routes/api';
import hotmartRoutes from './routes/hotmart';

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
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
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

// Ruta de prueba para mensajes programados
app.get('/test-scheduled-messages', async (req, res) => {
  try {
    const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;
    
    // Verificar conexión a BD
    const response = await fetch(`${POSTGREST_URL}/chat_scheduled_messages?select=*&limit=5`);
    
    if (!response.ok) {
      return res.status(500).json({
        error: 'Error conectando a BD',
        status: response.status,
        statusText: response.statusText
      });
    }
    
    const messages = await response.json();
    
    res.json({
      status: 'OK',
      postgrest_url: POSTGREST_URL,
      total_messages: messages.length,
      messages: messages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error interno',
      message: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Usar las rutas de la API
app.use('/api', apiRoutes);

// Usar las rutas de Hotmart
app.use('/api/hotmart', hotmartRoutes);

// Configuración del cliente WebSocket
const evolutionApiUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTIONAPI_URL;
const evolutionApiKey = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTIONAPI_TOKEN;

console.log('ENV:', process.env.EVOLUTION_API_URL, process.env.EVOLUTION_API_KEY);

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
  logger.info(`Servidor API iniciado en puerto ${PORT}`);
  console.log(`🚀 Servidor API iniciado en puerto ${PORT}`);
  console.log(`📡 WebSocket conectado a Evolution API`);
  console.log(`📅 Servicio de mensajes programados iniciado`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API base: http://localhost:${PORT}/api`);
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  logger.info('Cerrando servidor...');
  console.log('🛑 Cerrando servidor...');
  scheduledMessageService.stop();
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Cerrando servidor...');
  console.log('🛑 Cerrando servidor...');
  scheduledMessageService.stop();
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