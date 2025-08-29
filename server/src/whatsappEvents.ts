import { Socket } from 'socket.io-client';
import { insertConversacion, getAsesores, getClienteByWhatsapp, updateMensajeEstado, buscarClientePorUltimosDigitos, crearMapeoLID, buscarMapeoLID, actualizarMapeoLID, actualizarConversacionesHistoricasLID } from './dbClient';

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
    [key: string]: any;
  };
  messageTimestamp: number;
  status: number;
}

const processedMessages = new Set<string>();
let asesores: { ID: number; NOMBRE: string }[] = [];

// Función para obtener el estado actual de un mensaje
async function getMensajeEstadoActual(messageId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL}/conversaciones?mensaje_id=eq.${messageId}&select=estado`
    );
    
    if (!response.ok) {
      console.error(`Error obteniendo estado del mensaje ${messageId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data && data.length > 0) {
      return data[0].estado || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error obteniendo estado del mensaje ${messageId}:`, error);
    return null;
  }
}

// Función para determinar si se debe actualizar el estado
function debeActualizarEstado(estadoActual: string | null, nuevoEstado: string): boolean {
  if (!estadoActual) return true;
  
  const jerarquiaEstados = ['enviando', 'enviado', 'entregado', 'leido'];
  
  const indiceActual = jerarquiaEstados.indexOf(estadoActual);
  const indiceNuevo = jerarquiaEstados.indexOf(nuevoEstado);
  
  return indiceNuevo > indiceActual;
}

// Función para cargar asesores
async function recargarAsesores() {
  try {
    asesores = await getAsesores();
  } catch (err) {
    console.error('Error recargando asesores:', err);
  }
}

// Cargar asesores al iniciar y recargar cada 5 minutos
recargarAsesores();
setInterval(recargarAsesores, 5 * 60 * 1000);

// Función para detectar patrones de soporte y mapear LIDs automáticamente (SALIENTES)
async function detectarYMapearLID(eventData: any, asesor: any) {
  try {
    if (!eventData.fromMe) return;
    if (!eventData.from.includes('@lid')) return;
    
    const patronesSoporte = [
      /caso de soporte[:\s]*(\d{6,})/i,
      /soporte[:\s]*(\d{6,})/i,
      /caso[:\s]*(\d{6,})/i,
      /ticket[:\s]*(\d{6,})/i,
      /cliente[:\s]*(\d{6,})/i
    ];
    
    let ultimosDigitos = null;
    
    for (const patron of patronesSoporte) {
      const match = eventData.text.match(patron);
      if (match) {
        ultimosDigitos = match[1];
        break;
      }
    }
    
    if (ultimosDigitos) {    
      const cliente = await buscarClientePorUltimosDigitos(ultimosDigitos);
      
      if (cliente) {
        const mapeoCreado = await crearMapeoLID(eventData.from, cliente.WHATSAPP, cliente.ID, asesor.ID);
        
        if (mapeoCreado) {
          console.log('✅ Mapeo LID creado:', eventData.from, '→', cliente.WHATSAPP);
          
          const conversacionesActualizadas = await actualizarConversacionesHistoricasLID(
            eventData.from,
            cliente.ID,
            asesor.ID
          );
          
          if (conversacionesActualizadas > 0) {
            console.log(`✅ ${conversacionesActualizadas} conversaciones históricas actualizadas para ${cliente.NOMBRE}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error detectando mapeo LID SALIENTE:', error);
  }
}

// Función para detectar y mapear LIDs ENTRANTES
async function detectarYMapearLIDEntrante(eventData: any, asesor: any) {
  try {
    if (eventData.fromMe) return;
    if (!eventData.from.includes('@lid')) return;
    
    const patronesCliente = [
      /mi número[:\s]*(\d{6,})/i,
      /número[:\s]*(\d{6,})/i,
      /celular[:\s]*(\d{6,})/i,
      /teléfono[:\s]*(\d{6,})/i,
      /whatsapp[:\s]*(\d{6,})/i,
      /soy[:\s]*(\d{6,})/i,
      /cliente[:\s]*(\d{6,})/i,
      /(\d{6,})/
    ];
    
    let ultimosDigitos = null;
    
    for (const patron of patronesCliente) {
      const match = eventData.text.match(patron);
      if (match) {
        ultimosDigitos = match[1];
        break;
      }
    }
    
    if (ultimosDigitos) {
      const cliente = await buscarClientePorUltimosDigitos(ultimosDigitos);
      
      if (cliente) {
        const mapeoCreado = await crearMapeoLID(eventData.from, cliente.WHATSAPP, cliente.ID, asesor.ID);
        
        if (mapeoCreado) {
          console.log('✅ Mapeo LID ENTRANTE creado:', eventData.from, '→', cliente.WHATSAPP);
          
          const conversacionesActualizadas = await actualizarConversacionesHistoricasLID(
            eventData.from,
            cliente.ID,
            asesor.ID
          );
          
          if (conversacionesActualizadas > 0) {
            console.log(`✅ ${conversacionesActualizadas} conversaciones históricas actualizadas para ${cliente.NOMBRE}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error detectando mapeo LID ENTRANTE:', error);
  }
}

// Función para buscar cliente por LID (usando mapeos existentes)
async function buscarClientePorLID(lid: string): Promise<{ ID: number; ESTADO: string; ID_ASESOR?: number; NOMBRE_ASESOR?: string } | null> {
  try {
    const mapeo = await buscarMapeoLID(lid);
    
    if (mapeo) {
      await actualizarMapeoLID(lid);
      
      const cliente = await getClienteByWhatsapp(mapeo.whatsapp_number);
      if (cliente) {
        return cliente;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error buscando cliente por LID:', error);
    return null;
  }
}

export function setupWhatsAppEventHandlers(socket: Socket) {
  socket.on('send.message', async (data: any) => {
    try {
      const message = data.data || data;
      const messageId = message.key?.id;
      const instance = data.instance || 'desconocida';
      
      if (messageId) {
        await updateMensajeEstado(messageId, 'enviado');
      }
      
      try {
        const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === instance.trim().toLowerCase());
        
        if (asesor && message.key?.remoteJid) {
          const messageData = {
            id_asesor: asesor.ID,
            id_cliente: null as number | null,
            wha_cliente: message.key.remoteJid,
            modo: 'saliente' as const,
            timestamp: Math.floor(Date.now() / 1000),
            mensaje: message.message?.conversation || message.message?.caption || 'Mensaje enviado',
            mensaje_id: messageId,
            estado: 'enviado'
          };
          
          const cliente = await getClienteByWhatsapp(messageData.wha_cliente);
          if (cliente) {
            messageData.id_cliente = cliente.ID;
          }
          
          await insertConversacion(messageData);
        }
      } catch (insertError) {
        console.error('Error guardando mensaje saliente en BD:', insertError);
      }
      
    } catch (error) {
      console.error('Error procesando send.message:', error);
    }
  });

  socket.on('messages.update', async (data: any) => {
    try {
      let updates = [];
      
      if (data && Array.isArray(data)) {
        updates = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        updates = data.data;
      } else if (data && typeof data === 'object') {
        updates = [data];
      }
      
      for (const update of updates) {
        let messageKey = update.key || update.messageKey;
        let messageId = messageKey?.id;
        let fromMe = messageKey?.fromMe;
        
        if (!messageKey && update.data) {
          messageId = update.data.keyId;
          fromMe = update.data.fromMe;
        }
        
        if (!messageId && update.keyId) {
          messageId = update.keyId;
        }
        if (!messageId && update.data?.keyId) {
          messageId = update.data.keyId;
        }
        
        let status = null;
        let statusText = '';
        
        if (update.status !== undefined) {
          status = update.status;
        } else if (update.data?.status !== undefined) {
          status = update.data.status;
        } else if (update.message?.status !== undefined) {
          status = update.message.status;
        }
        
        if (status !== null && messageId && fromMe) {
          if (typeof status === 'string') {
            switch (status.toUpperCase()) {
              case 'PENDING': statusText = 'enviando'; break;
              case 'SENT': statusText = 'enviado'; break;
              case 'DELIVERY_ACK': statusText = 'entregado'; break;
              case 'READ': statusText = 'leido'; break;
              default: statusText = 'enviado';
            }
          } else {
            switch (status) {
              case 0: statusText = 'enviando'; break;
              case 1: statusText = 'enviado'; break;
              case 2: statusText = 'entregado'; break;
              case 3: statusText = 'leido'; break;
              default: statusText = 'enviado';
            }
          }
          
          try {
            const estadoActual = await getMensajeEstadoActual(messageId);
            
            if (debeActualizarEstado(estadoActual, statusText)) {
              await updateMensajeEstado(messageId, statusText);
            }
          } catch (err) {
            console.error('Error verificando/actualizando estado en BD:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error procesando messages.update:', error);
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

      const uniqueKey = `${eventData.instance}:${eventData.messageId}`;
      
      if (processedMessages.has(uniqueKey)) {
        return;
      }
      processedMessages.add(uniqueKey);
      
      if (processedMessages.size > 1000) {
        processedMessages.clear();
      }

      const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === (eventData.instance || '').trim().toLowerCase());
      
      if (!asesor) {
        return;
      }

      await detectarYMapearLID(eventData, asesor);
      await detectarYMapearLIDEntrante(eventData, asesor);

      const modo: 'saliente' | 'entrante' = message.key.fromMe ? 'saliente' : 'entrante';

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

      let id_cliente: number | null = null;
      try {
        if (eventData.from.includes('@lid')) {
          const cliente = await buscarClientePorLID(eventData.from);
          
          if (cliente) {
            id_cliente = cliente.ID;
          }
        } else {
          const cliente = await getClienteByWhatsapp(eventData.from);
          if (cliente) {
            id_cliente = cliente.ID;
          }
        }
        
      } catch (err) {
        // Silenciar error de cliente no encontrado
      }

      try {
        const conversacionData = {
          id_asesor: asesor.ID,
          id_cliente,
          wha_cliente: eventData.from,
          modo,
          timestamp: Math.floor(Date.now() / 1000),
          mensaje,
          mensaje_id: eventData.messageId,
          estado: message.key.fromMe ? 'enviado' : undefined
        };
        
        await insertConversacion(conversacionData);
        
      } catch (err) {
        // Error silencioso al insertar conversación
      }
    }
  });
  
  socket.on('connect', () => {
    // Conexión exitosa
  });
  
  socket.on('disconnect', (reason) => {
    console.error(`Socket desconectado: ${reason}`);
  });
  
  socket.on('connect_error', (error) => {
    console.error(`Error de conexión: ${error.message}`);
  });
  
  socket.on('qrcode.updated', (_data) => {
    // QR Code actualizado
  });
  
  socket.on('connection.update', (data) => {
    // Estado de conexión actualizado
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
  
  const keys = Object.keys(message.message).filter(k => k.endsWith('Message'));
  if (keys.length > 0) return keys.join(',');
  return 'unknown';
} 