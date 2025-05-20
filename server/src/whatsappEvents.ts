import { Socket } from 'socket.io-client';
import { insertConversacion, getAsesores, getClienteByWhatsapp } from './dbClient';

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
    reactionMessage?: {
      text: string;
      key: any;
    };
    [key: string]: any; // Para cualquier otro tipo de mensaje
  };
  messageTimestamp: number;
  status: number;
}

const processedMessages = new Set<string>();
let asesores: { ID: number; NOMBRE: string }[] = [];

// Cargar asesores al iniciar
(async () => {
  try {
    asesores = await getAsesores();
    console.log('Asesores cargados:', asesores.map(a => a.NOMBRE).join(', '));
  } catch (err) {
    console.error('Error cargando asesores:', err);
  }
})();

export function setupWhatsAppEventHandlers(socket: Socket) {
  socket.on('messages.upsert', async (data: any) => {
    if (data && data.data && data.data.key && data.data.message) {
      const message = {
        key: data.data.key,
        message: data.data.message,
        messageTimestamp: data.data.messageTimestamp,
        status: data.data.status,
      } as WhatsAppMessage;

      // IGNORAR reactionMessage
      const tipo = getMessageType(message);
      if (tipo === 'reactionMessage') {
        return;
      }

      const eventData = {
        from: message.key.remoteJid,
        text: message.message.conversation || message.message.caption || '',
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        messageId: message.key.id,
        fromMe: message.key.fromMe,
        instance: data.instance || data.data.instanceId || 'desconocida',
        tipo
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
      console.log(`\x1b[90m[RAW data.data]:\n${JSON.stringify(data.data, null, 2)}\x1b[0m\n${'='.repeat(40)}`);

      // Buscar asesor por nombre de instancia
      const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === (eventData.instance || '').trim().toLowerCase());
      if (!asesor) return;

      // Determinar modo
      const modo = message.key.fromMe ? 'saliente' : 'entrante';

      // Determinar mensaje para la BD
      let mensaje = '';
      if (tipo === 'text') {
        mensaje = eventData.text;
      } else if (tipo === 'image') {
        mensaje = message.key.fromMe ? '🖼️ (imagen) enviado' : '🖼️ (imagen) recibido';
      } else if (tipo === 'video') {
        mensaje = message.key.fromMe ? '🎥 (video) enviado' : '🎥 (video) recibido';
      } else if (tipo === 'audio') {
        mensaje = message.key.fromMe ? '🎵 (audio) enviado' : '🎵 (audio) recibido';
      } else if (tipo === 'document') {
        mensaje = message.key.fromMe ? '📄 (documento) enviado' : '📄 (documento) recibido';
      } else if (tipo === 'sticker') {
        mensaje = message.key.fromMe ? '💬 (sticker) enviado' : '💬 (sticker) recibido';
      } else {
        mensaje = message.key.fromMe ? `📦 (${tipo}) enviado` : `📦 (${tipo}) recibido`;
      }

      // Buscar id_cliente por wha_cliente
      let id_cliente: number | null = null;
      try {
        const cliente = await getClienteByWhatsapp(eventData.from);
        if (cliente) id_cliente = cliente.ID;
      } catch (err) {
        console.error('Error buscando cliente por whatsapp:', err);
      }

      // Insertar en la tabla conversaciones
      try {
        await insertConversacion({
          id_asesor: asesor.ID,
          id_cliente,
          wha_cliente: eventData.from,
          modo,
          timestamp: Math.floor(Date.now() / 1000),
          mensaje
        });
      } catch (err) {
        console.error('Error insertando conversación:', err);
      }
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
  if (message.message.reactionMessage) return 'reactionMessage';
  // Si hay otro tipo de mensaje
  const keys = Object.keys(message.message).filter(k => k.endsWith('Message'));
  if (keys.length > 0) return keys.join(',');
  return 'unknown';
} 