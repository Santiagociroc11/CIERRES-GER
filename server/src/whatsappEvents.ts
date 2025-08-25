import { Socket } from 'socket.io-client';
import { insertConversacion, getAsesores, getClienteByWhatsapp, updateMensajeEstado } from './dbClient';

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
    console.log(`\x1b[36m👥 Asesores recargados: ${asesores.length}\x1b[0m`);
  } catch (err) {
    console.error('\x1b[31m❌ Error recargando asesores:\x1b[0m', err);
  }
}

// Cargar asesores al iniciar y recargar cada 5 minutos
recargarAsesores();
setInterval(recargarAsesores, 5 * 60 * 1000);

export function setupWhatsAppEventHandlers(socket: Socket) {
  // Manejar actualizaciones de estado de mensajes
  socket.on('messages.update', async (data: any) => {
    try {
      if (data && data.data && Array.isArray(data.data)) {
        for (const update of data.data) {
          if (update.key && update.key.fromMe && update.status) {
            const messageId = update.key.id;
            const status = update.status;
            const instance = data.instance || 'desconocida';
            
            // Mapear status numérico a texto
            let estadoTexto = 'enviado';
            switch (status) {
              case 1: estadoTexto = 'enviado'; break;
              case 2: estadoTexto = 'entregado'; break;
              case 3: estadoTexto = 'leido'; break;
              default: estadoTexto = 'enviado';
            }
            
            console.log(`\x1b[33m📊 [${instance}] Estado actualizado\x1b[0m`);
            console.log(`ID: ${messageId}, Estado: ${estadoTexto} (${status})`);
            
            // Actualizar en base de datos si existe la función
            try {
              await updateMensajeEstado(messageId, estadoTexto);
            } catch (err) {
              console.error('Error actualizando estado de mensaje:', err);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error procesando actualización de estados:', error);
    }
  });

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
      if (message.key.fromMe) {
        console.log(`\x1b[32m✅ [${eventData.instance}] Mensaje ENVIADO POR MÍ\x1b[0m`);
      } else {
        console.log(`\x1b[36m📥 [${eventData.instance}] Mensaje RECIBIDO\x1b[0m`);
      }
      console.log(`De: ${eventData.from}\nTipo: ${eventData.tipo}\nTexto/Caption: ${eventData.text}\nID: ${eventData.messageId}\nFecha: ${eventData.timestamp}`);

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
          mensaje,
          mensaje_id: eventData.messageId,
          estado: message.key.fromMe ? 'enviado' : undefined
        });
        
        console.log(`\x1b[32m✅ Mensaje guardado exitosamente\x1b[0m`);
        
      } catch (err) {
        console.error('\x1b[31m❌ Error guardando mensaje:\x1b[0m', err);
      }
    } else {
      console.log('\x1b[31m❌ Datos de mensaje inválidos\x1b[0m');
    }
  });
  
  // Manejar eventos de conexión
  socket.on('connect', () => {
    console.log('\x1b[32m🔗 Socket conectado a WhatsApp\x1b[0m');
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`\x1b[31m🔌 Socket desconectado: ${reason}\x1b[0m`);
  });
  
  socket.on('connect_error', (error) => {
    console.log(`\x1b[31m❌ Error de conexión: ${error.message}\x1b[0m`);
  });
  
  // Escuchar otros eventos útiles
  socket.on('qr', (data) => {
    console.log('\x1b[33m📱 QR Code recibido\x1b[0m');
  });
  
  socket.on('connection.update', (data) => {
    console.log(`\x1b[36m🔄 Estado de conexión actualizado:\x1b[0m`, data.connection);
  });
  
  socket.on('creds.update', () => {
    console.log('\x1b[36m🔑 Credenciales actualizadas\x1b[0m');
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