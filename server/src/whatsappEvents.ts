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
        text: message.message.conversation,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        messageId: message.key.id,
        fromMe: message.key.fromMe,
        instance: data.instance || data.data.instanceId || 'desconocida'
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
      const body = `De: ${eventData.from}\nTexto: ${eventData.text}\nID: ${eventData.messageId}\nFecha: ${eventData.timestamp}`;
      console.log(`${header}\n${body}\n${'-'.repeat(40)}`);
    }
    // Si no es un mensaje válido, ignorar
  });
} 