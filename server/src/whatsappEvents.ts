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
    audioMessage?: {
      url: string;
      mimetype: string;
      caption?: string;
    };
    stickerMessage?: {
      url: string;
      mimetype: string;
    };
    [key: string]: any; // Para cualquier otro tipo de mensaje
  };
  messageTimestamp: number;
  status: number;
}

const processedMessages = new Set<string>();

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
        text: message.message.conversation || message.message.caption || '',
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        messageId: message.key.id,
        fromMe: message.key.fromMe,
        instance: data.instance || data.data.instanceId || 'desconocida',
        tipo: getMessageType(message)
      };

      // FILTRO DE DUPLICADOS
      const uniqueKey = `${eventData.instance}:${eventData.messageId}`;
      if (processedMessages.has(uniqueKey)) {
        return; // Ya lo procesamos
      }
      processedMessages.add(uniqueKey);
      if (processedMessages.size > 1000) {
        processedMessages.clear();
      }

      // LOG BONITO
      const header = message.key.fromMe
        ? `\x1b[32m✅ [${eventData.instance}] Mensaje ENVIADO POR MÍ\x1b[0m`
        : `\x1b[36m📥 [${eventData.instance}] Mensaje RECIBIDO\x1b[0m`;
      const body = `De: ${eventData.from}\nTipo: ${eventData.tipo}\nTexto/Caption: ${eventData.text}\nID: ${eventData.messageId}\nFecha: ${eventData.timestamp}`;
      console.log(`${header}\n${body}\n${'-'.repeat(40)}`);

      // LOG DEL CUERPO RAW DEL EVENTO
      console.log(`\x1b[90m[RAW data.data]:\n${JSON.stringify(data.data, null, 2)}\x1b[0m\n${'='.repeat(40)}`);
    }
    // Si no es un mensaje válido, ignorar
  });
}

function getMessageType(message: WhatsAppMessage): string {
  if (message.message.conversation) return 'text';
  if (message.message.imageMessage) return 'image';
  if (message.message.videoMessage) return 'video';
  if (message.message.documentMessage) return 'document';
  if (message.message.audioMessage) return 'audio';
  if (message.message.stickerMessage) return 'sticker';
  // Si hay otro tipo de mensaje
  const keys = Object.keys(message.message).filter(k => k.endsWith('Message'));
  if (keys.length > 0) return keys.join(',');
  return 'unknown';
} 