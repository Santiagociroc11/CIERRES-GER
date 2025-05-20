import { Socket } from 'socket.io-client';
import winston from 'winston';

// Contador de eventos para monitoreo
let eventCounters = {
  messagesReceived: 0,
  messagesUpdated: 0,
  connectionUpdates: 0,
  lastEventTimestamp: null as Date | null
};

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

// Función para obtener estadísticas de eventos
export function getEventStats() {
  return {
    ...eventCounters,
    uptime: process.uptime(),
    lastEventTime: eventCounters.lastEventTimestamp?.toISOString() || null
  };
}

export function setupWhatsAppEventHandlers(socket: Socket, logger: winston.Logger) {
  // Manejar nuevos mensajes
  socket.on('messages.upsert', (data: any) => {
    logger.info('[RAW] Evento messages.upsert:', { raw: data });
    console.log('[RAW] Evento messages.upsert:', JSON.stringify(data));
    if (!data || !Array.isArray(data.messages)) {
      logger.warn('Evento messages.upsert recibido sin messages:', { raw: data });
      console.log('⚠️ Evento messages.upsert recibido sin messages:', JSON.stringify(data));
      return;
    }
    eventCounters.messagesReceived += data.messages.length;
    eventCounters.lastEventTimestamp = new Date();

    data.messages.forEach((message: WhatsAppMessage) => {
      if (!message.key.fromMe) {
        const eventData = {
          from: message.key.remoteJid,
          type: getMessageType(message),
          timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
          messageId: message.key.id
        };

        logger.info('Mensaje recibido:', eventData);
        console.log('📥 Nuevo mensaje:', JSON.stringify(eventData, null, 2));

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
  socket.on('messages.update', (data: any) => {
    logger.info('[RAW] Evento messages.update:', { raw: data });
    console.log('[RAW] Evento messages.update:', JSON.stringify(data));
    if (!data || !Array.isArray(data.messages)) {
      logger.warn('Evento messages.update recibido sin messages:', { raw: data });
      console.log('⚠️ Evento messages.update recibido sin messages:', JSON.stringify(data));
      return;
    }
    eventCounters.messagesUpdated += data.messages.length;
    eventCounters.lastEventTimestamp = new Date();

    data.messages.forEach((message: WhatsAppMessage) => {
      const eventData = {
        from: message.key.remoteJid,
        status: message.status,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        messageId: message.key.id
      };

      logger.info('Mensaje actualizado:', eventData);
      console.log('🔄 Mensaje actualizado:', JSON.stringify(eventData, null, 2));
    });
  });

  // Manejar actualizaciones de conexión
  socket.on('connection.update', (data: ConnectionUpdate) => {
    eventCounters.connectionUpdates++;
    eventCounters.lastEventTimestamp = new Date();

    const eventData = {
      connection: data.connection,
      error: data.lastDisconnect?.error?.message,
      hasQR: !!data.qr,
      timestamp: new Date().toISOString()
    };

    logger.info('Estado de conexión actualizado:', eventData);
    console.log('🔌 Estado de conexión:', JSON.stringify(eventData, null, 2));

    if (data.connection === 'close') {
      logger.warn('Conexión cerrada:', {
        error: data.lastDisconnect?.error?.message,
        status: data.lastDisconnect?.error?.status
      });
      console.log('❌ Conexión cerrada:', data.lastDisconnect?.error?.message);
    }
  });

  // Log inicial de conexión
  logger.info('Manejadores de eventos de WhatsApp configurados');
  console.log('✅ Manejadores de eventos de WhatsApp configurados');
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
  const eventData = {
    from: message.key.remoteJid,
    text,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
    messageId: message.key.id
  };

  logger.info('Procesando mensaje de texto:', eventData);
  console.log('💬 Mensaje de texto:', JSON.stringify(eventData, null, 2));
}

function processImageMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const image = message.message.imageMessage;
  const eventData = {
    from: message.key.remoteJid,
    url: image?.url,
    caption: image?.caption,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
    messageId: message.key.id
  };

  logger.info('Procesando mensaje de imagen:', eventData);
  console.log('🖼️ Mensaje de imagen:', JSON.stringify(eventData, null, 2));
}

function processVideoMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const video = message.message.videoMessage;
  const eventData = {
    from: message.key.remoteJid,
    url: video?.url,
    caption: video?.caption,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
    messageId: message.key.id
  };

  logger.info('Procesando mensaje de video:', eventData);
  console.log('🎥 Mensaje de video:', JSON.stringify(eventData, null, 2));
}

function processDocumentMessage(message: WhatsAppMessage, logger: winston.Logger) {
  const document = message.message.documentMessage;
  const eventData = {
    from: message.key.remoteJid,
    url: document?.url,
    fileName: document?.fileName,
    timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
    messageId: message.key.id
  };

  logger.info('Procesando mensaje de documento:', eventData);
  console.log('📄 Mensaje de documento:', JSON.stringify(eventData, null, 2));
} 