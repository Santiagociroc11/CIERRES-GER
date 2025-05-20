import { Socket } from 'socket.io-client';
import winston from 'winston';

export interface WhatsAppMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    imageMessage?: {
      url: string;
      mimetype: string;
      caption?: string;
    };
    videoMessage?: {
      url: string;
      mimetype: string;
      caption?: string;
    };
    documentMessage?: {
      url: string;
      mimetype: string;
      fileName: string;
    };
  };
  messageTimestamp: number;
  status: number;
}

export interface ConnectionUpdate {
  connection: string;
  lastDisconnect?: {
    error?: {
      message: string;
      status: number;
    };
  };
  qr?: string;
}

export function setupWhatsAppEventHandlers(socket: Socket, logger: winston.Logger) {
  // Manejar nuevos mensajes
  socket.on('messages.upsert', (data: { messages: WhatsAppMessage[] }) => {
    data.messages.forEach(message => {
      if (!message.key.fromMe) {
        logger.info('Mensaje recibido:', {
          from: message.key.remoteJid,
          type: getMessageType(message),
          timestamp: new Date(message.messageTimestamp * 1000).toISOString()
        });

        // Aquí puedes agregar lógica para procesar diferentes tipos de mensajes
        if (message.message.conversation) {
          processTextMessage(message, logger);
        } else if (message.message.imageMessage) {
          processImageMessage(message, logger);
        } else if (message.message.videoMessage) {
          processVideoMessage(message, logger);
        } else if (message.message.documentMessage) {
          processDocumentMessage(message, logger);
        }
      }
    });
  });

  // Manejar actualizaciones de mensajes
  socket.on('messages.update', (data: { messages: WhatsAppMessage[] }) => {
    data.messages.forEach(message => {
      logger.info('Mensaje actualizado:', {
        from: message.key.remoteJid,
        status: message.status,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString()
      });
    });
  });

  // Manejar actualizaciones de conexión
  socket.on('connection.update', (data: ConnectionUpdate) => {
    logger.info('Estado de conexión actualizado:', {
      connection: data.connection,
      error: data.lastDisconnect?.error?.message,
      hasQR: !!data.qr
    });

    if (data.connection === 'close') {
      logger.warn('Conexión cerrada:', {
        error: data.lastDisconnect?.error?.message,
        status: data.lastDisconnect?.error?.status
      });
    }
  });
}

// Funciones auxiliares para procesar diferentes tipos de mensajes
function getMessageType(message: WhatsAppMessage): string {
  if (message.message.conversation) return 'text';
  if (message.message.imageMessage) return 'image';
  if (message.message.videoMessage) return 'video';
  if (message.message.documentMessage) return 'document';
  return 'unknown';
}

function processTextMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const text = message.message.conversation;
  logger.info('Procesando mensaje de texto:', {
    from: message.key.remoteJid,
    text,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString()
  });
  // Aquí puedes agregar lógica específica para procesar mensajes de texto
}

function processImageMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const image = message.message.imageMessage;
  logger.info('Procesando mensaje de imagen:', {
    from: message.key.remoteJid,
    url: image?.url,
    caption: image?.caption,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString()
  });
  // Aquí puedes agregar lógica específica para procesar imágenes
}

function processVideoMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const video = message.message.videoMessage;
  logger.info('Procesando mensaje de video:', {
    from: message.key.remoteJid,
    url: video?.url,
    caption: video?.caption,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString()
  });
  // Aquí puedes agregar lógica específica para procesar videos
}

function processDocumentMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const document = message.message.documentMessage;
  logger.info('Procesando mensaje de documento:', {
    from: message.key.remoteJid,
    url: document?.url,
    fileName: document?.fileName,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString()
  });
  // Aquí puedes agregar lógica específica para procesar documentos
} 