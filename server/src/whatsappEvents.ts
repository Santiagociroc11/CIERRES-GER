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
  // Si no hay estado actual, siempre actualizar
  if (!estadoActual) return true;
  
  // Definir jerarquía de estados (de menor a mayor prioridad)
  const jerarquiaEstados = ['enviando', 'enviado', 'entregado', 'leido'];
  
  const indiceActual = jerarquiaEstados.indexOf(estadoActual);
  const indiceNuevo = jerarquiaEstados.indexOf(nuevoEstado);
  
  // Solo actualizar si el nuevo estado es más avanzado
  return indiceNuevo > indiceActual;
}

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
  // ===============================================
  // 🔍 DEBUG: Escuchar TODOS los eventos para diagnosticar
  // ===============================================
  
  // Interceptar todos los eventos para debugging
  const originalOn = socket.on.bind(socket);
  socket.on = function(event: string, listener: (...args: any[]) => void) {
    return originalOn(event, (...args: any[]) => {
      console.log(`\x1b[35m🔍 [DEBUG] Evento recibido: "${event}"\x1b[0m`);
      console.log(`\x1b[35m📦 [DEBUG] Datos:`, JSON.stringify(args, null, 2).substring(0, 500) + '...\x1b[0m');
      return listener(...args);
    });
  };

  // Escuchar eventos CORRECTOS de Evolution API
  console.log('🔍 [DEBUG] Configurando handlers de WhatsApp...');
  
  const evolutionEvents = [
    'send.message',           // ✅ Mensaje enviado exitosamente
    'messages.upsert',        // ✅ Nuevo mensaje (recibido/enviado)
    'messages.update',        // ✅ Estado del mensaje (entregado, leído)
    'messages.delete',        // ✅ Mensaje eliminado
    'connection.update',      // ✅ Estado de conexión
    'qrcode.updated',         // ✅ QR Code actualizado
    'creds.update'            // ✅ Credenciales actualizadas
  ];

  evolutionEvents.forEach(eventName => {
    socket.on(eventName, (data: any) => {
      console.log(`\x1b[32m📨 [${eventName}] Evento Evolution específico recibido\x1b[0m`);
    });
  });

  // Debug adicional: escuchar TODOS los eventos posibles
  const allPossibleEvents = [
    'send.message', 'messages.upsert', 'messages.update', 'messages.delete',
    'connection.update', 'qrcode.updated', 'creds.update', 'qr', 'qr.updated',
    'message', 'message.update', 'message.receipt', 'receipt', 'status',
    'presence.update', 'chats.upsert', 'contacts.upsert', 'groups.upsert'
  ];

  allPossibleEvents.forEach(eventName => {
    socket.on(eventName, (data: any) => {
      console.log(`\x1b[35m🎯 [${eventName}] Evento capturado\x1b[0m`);
      console.log(`\x1b[35m📦 Datos:`, JSON.stringify(data, null, 2).substring(0, 300));
    });
  });

  // ===============================================
  // 📤 EVENTO: Mensaje Enviado (CRUCIAL para estados y guardado en BD)
  // ===============================================
  socket.on('send.message', async (data: any) => {
    console.log(`\x1b[32m📤 [SEND_MESSAGE] Mensaje enviado exitosamente\x1b[0m`);
    console.log(`\x1b[36m📋 Datos:`, JSON.stringify(data, null, 2).substring(0, 800));
    
    try {
      const message = data.data || data;
      const messageId = message.key?.id;
      const instance = data.instance || 'desconocida';
      
      if (messageId) {
        // Actualizar estado a "enviado" en BD
        await updateMensajeEstado(messageId, 'enviado');
        console.log(`\x1b[32m✅ Estado actualizado: mensaje ${messageId} = ENVIADO\x1b[0m`);
      }
      
      // También guardar el mensaje en BD si no existe
      try {
        const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === instance.trim().toLowerCase());
        if (asesor && message.key?.remoteJid) {
          const messageData = {
            id_asesor: asesor.ID,
            id_cliente: null as number | null, // Se determinará por wha_cliente
            wha_cliente: message.key.remoteJid,
            modo: 'saliente' as const,
            timestamp: Math.floor(Date.now() / 1000),
            mensaje: message.message?.conversation || message.message?.caption || 'Mensaje enviado',
            mensaje_id: messageId,
            estado: 'enviado'
          };
          
          // Buscar cliente por WhatsApp
          const cliente = await getClienteByWhatsapp(messageData.wha_cliente);
          if (cliente) {
            messageData.id_cliente = cliente.ID;
          }
          
          // Insertar en BD
          await insertConversacion(messageData);
          console.log(`\x1b[32m✅ Mensaje saliente guardado en BD desde send.message\x1b[0m`);
        }
      } catch (insertError) {
        console.error('Error guardando mensaje saliente en BD:', insertError);
      }
      
    } catch (error) {
      console.error('Error procesando send.message:', error);
    }
  });

  // ===============================================
  // 🔄 EVENTO: Actualización de Estados (Entregado, Leído) - CORREGIDO
  // ===============================================
  socket.on('messages.update', async (data: any) => {
    console.log(`\x1b[36m🔄 [MESSAGES_UPDATE] Actualización de estado recibida\x1b[0m`);
    console.log(`\x1b[36m📋 Datos:`, JSON.stringify(data, null, 2).substring(0, 800));
    
    try {
      // Evolution API puede enviar múltiples formatos
      let updates = [];
      
      if (data && Array.isArray(data)) {
        updates = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        updates = data.data;
      } else if (data && typeof data === 'object') {
        updates = [data];
      }
      
      console.log(`\x1b[36m📊 Procesando ${updates.length} actualizaciones\x1b[0m`);
      
      for (const update of updates) {
        console.log(`\x1b[36m🔍 Procesando update:`, JSON.stringify(update, null, 2).substring(0, 400));
        
        // Buscar información del mensaje - ESTRUCTURA EVOLUTION API
        let messageKey = update.key || update.messageKey;
        let messageId = messageKey?.id;
        let fromMe = messageKey?.fromMe;
        
        // Si no hay key directamente, buscar en data (estructura Evolution)
        if (!messageKey && update.data) {
          messageId = update.data.keyId;
          fromMe = update.data.fromMe;
        }
        
        // Si aún no tenemos messageId, intentar usar keyId directamente
        if (!messageId && update.keyId) {
          messageId = update.keyId;
        }
        if (!messageId && update.data?.keyId) {
          messageId = update.data.keyId;
        }
        
        // Buscar estado en diferentes ubicaciones posibles
        let status = null;
        let statusText = '';
        
        // Formato 1: update.status
        if (update.status !== undefined) {
          status = update.status;
        }
        // Formato 2: update.data?.status (Evolution API)
        else if (update.data?.status !== undefined) {
          status = update.data.status;
        }
        // Formato 3: update.message?.status
        else if (update.message?.status !== undefined) {
          status = update.message.status;
        }
        
        if (status !== null && messageId && fromMe) {
          // Mapear estado - TANTO NUMÉRICO COMO STRING (Evolution API)
          if (typeof status === 'string') {
            // Estados como strings de Evolution API
            switch (status.toUpperCase()) {
              case 'PENDING': statusText = 'enviando'; break;
              case 'SENT': statusText = 'enviado'; break;
              case 'DELIVERY_ACK': statusText = 'entregado'; break;
              case 'READ': statusText = 'leido'; break;
              default: statusText = 'enviado';
            }
          } else {
            // Estados numéricos tradicionales
            switch (status) {
              case 0: statusText = 'enviando'; break;
              case 1: statusText = 'enviado'; break;
              case 2: statusText = 'entregado'; break;
              case 3: statusText = 'leido'; break;
              default: statusText = 'enviado';
            }
          }
          
          console.log(`\x1b[33m📊 Estado actualizado: ID ${messageId} = ${statusText} (${status})\x1b[0m`);
          
          // Verificar si el estado actual es más avanzado antes de actualizar
          try {
            const estadoActual = await getMensajeEstadoActual(messageId);
            
            // Solo actualizar si el nuevo estado es más avanzado que el actual
            if (debeActualizarEstado(estadoActual, statusText)) {
              await updateMensajeEstado(messageId, statusText);
              console.log(`\x1b[32m✅ Estado actualizado en BD: ${messageId} = ${statusText}\x1b[0m`);
            } else {
              console.log(`\x1b[33m⏭️  Estado no actualizado: ${messageId} ya tiene estado ${estadoActual} (nuevo: ${statusText})\x1b[0m`);
            }
          } catch (err) {
            console.error('Error verificando/actualizando estado en BD:', err);
          }
        } else {
          console.log(`\x1b[33m⚠️  Update sin datos válidos para estado:`, {
            messageId, fromMe, status, hasKey: !!messageKey
          });
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
  
  // ===============================================
  // 🔗 EVENTOS DE CONEXIÓN (Socket.io eventos estándar)
  // ===============================================
  socket.on('connect', () => {
    console.log('\x1b[32m🔗 Socket conectado a WhatsApp\x1b[0m');
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`\x1b[31m🔌 Socket desconectado: ${reason}\x1b[0m`);
  });
  
  socket.on('connect_error', (error) => {
    console.log(`\x1b[31m❌ Error de conexión: ${error.message}\x1b[0m`);
  });
  
  // ===============================================
  // 📱 EVENTOS ESPECÍFICOS DE EVOLUTION API
  // ===============================================
  socket.on('qrcode.updated', (_data) => {
    console.log('\x1b[33m📱 QR Code actualizado\x1b[0m');
  });
  
  socket.on('connection.update', (data) => {
    console.log(`\x1b[36m🔄 Estado de conexión actualizado:\x1b[0m`, data?.connection || data);
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