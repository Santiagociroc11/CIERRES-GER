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

// Función para cargar asesores
async function recargarAsesores() {
  try {
    asesores = await getAsesores();
  } catch (err) {
  }
}

// Cargar asesores al iniciar y recargar cada 5 minutos
recargarAsesores();
setInterval(recargarAsesores, 5 * 60 * 1000);

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

      // ⚡ OPTIMIZACIÓN: Verificar asesor PRIMERO antes de procesar el mensaje
      const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === (eventData.instance || '').trim().toLowerCase());
      if (!asesor) {
        return; // Salir temprano - NO procesar mensajes de instancias sin asesor
      }

      // LOG BONITO (solo para mensajes que SÍ tienen asesor)
      const header = message.key.fromMe
        ? `\x1b[32m✅ [${eventData.instance}] Mensaje ENVIADO POR MÍ\x1b[0m`
        : `\x1b[36m📥 [${eventData.instance}] Mensaje RECIBIDO\x1b[0m`;
      const body = `De: ${eventData.from}\nTipo: ${eventData.tipo}\nTexto/Caption: ${eventData.text}\nID: ${eventData.messageId}\nFecha: ${eventData.timestamp}`;

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
        if (cliente) {
          id_cliente = cliente.ID;
        } else {
        }
      } catch (err) {
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
      }
    } else {
    }
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