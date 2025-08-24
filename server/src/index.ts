import express from 'express';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';
import winston from 'winston';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { setupWhatsAppEventHandlers } from './whatsappEvents.js';
import apiRoutes from './routes/api.js';

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
app.use(helmet());
app.use(cors());
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

// Usar las rutas de la API
app.use('/api', apiRoutes);

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

// Iniciar servidor Express
app.listen(PORT, () => {
  logger.info(`Servidor API iniciado en puerto ${PORT}`);
  console.log(`🚀 Servidor API iniciado en puerto ${PORT}`);
  console.log(`📡 WebSocket conectado a Evolution API`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API base: http://localhost:${PORT}/api`);
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  logger.info('Cerrando servidor...');
  console.log('🛑 Cerrando servidor...');
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Cerrando servidor...');
  console.log('🛑 Cerrando servidor...');
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