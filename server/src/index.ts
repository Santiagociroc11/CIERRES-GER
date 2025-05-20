import { io } from 'socket.io-client';
import dotenv from 'dotenv';
import winston from 'winston';
import { setupWhatsAppEventHandlers } from './whatsappEvents';

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

// Configuración del cliente WebSocket
const evolutionApiUrl = process.env.EVOLUTION_API_URL;
const evolutionApiKey = process.env.EVOLUTION_API_KEY;

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
});

socket.on('disconnect', () => {
  logger.warn('Desconectado del WebSocket de Evolution API');
});

socket.on('connect_error', (error) => {
  logger.error('Error de conexión:', error);
});

// Configurar manejadores de eventos de WhatsApp
setupWhatsAppEventHandlers(socket, logger);

// Manejar señales de terminación
process.on('SIGINT', () => {
  logger.info('Cerrando conexión WebSocket...');
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Cerrando conexión WebSocket...');
  socket.disconnect();
  process.exit(0);
});

// Mantener el proceso en ejecución
process.on('uncaughtException', (error) => {
  logger.error('Error no manejado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
}); 