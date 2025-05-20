import { Socket } from 'socket.io-client';

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

export function setupWhatsAppEventHandlers(socket: Socket) {
  socket.on('messages.upsert', (data: any) => {
    if (data && data.data && data.data.key && data.data.message) {
      const message = {
        key: data.data.key,
        message: data.data.message,
        messageTimestamp: data.data.messageTimestamp,
        status: data.data.status,
      } as WhatsAppMessage;

      const eventData = {
        from: message.key.remoteJid,
        text: message.message.conversation,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        messageId: message.key.id,
        fromMe: message.key.fromMe
      };

      if (message.key.fromMe) {
        console.log('✅ Mensaje ENVIADO POR MÍ:', JSON.stringify(eventData, null, 2));
      } else {
        console.log('📥 Mensaje RECIBIDO:', JSON.stringify(eventData, null, 2));
      }
    }
    // Si no es un mensaje válido, ignorar
  });
} 