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
  } catch (err) {
    console.error('Error recargando asesores:', err);
  }
}

// Cargar asesores al iniciar y recargar cada 5 minutos
recargarAsesores();
setInterval(recargarAsesores, 5 * 60 * 1000);

export function setupWhatsAppEventHandlers(socket: Socket) {
  // ===============================================
  // 📤 EVENTO: Mensaje Enviado (CRUCIAL para estados y guardado en BD)
  // ===============================================
  socket.on('send.message', async (data: any) => {
    try {
      console.log('🔍 [DEBUG] Evento send.message recibido:');
      console.log('📦 Data completa:', JSON.stringify(data, null, 2));
      console.log('🏷️ Tipo de data:', typeof data);
      console.log('🔑 Keys disponibles:', Object.keys(data));
      
      const message = data.data || data;
      const messageId = message.key?.id;
      const instance = data.instance || 'desconocida';
      
      console.log('📨 Mensaje extraído:', JSON.stringify(message, null, 2));
      console.log('🆔 Message ID:', messageId);
      console.log('🏢 Instance:', instance);
      console.log('📱 Remote JID:', message.key?.remoteJid);
      console.log('💬 Contenido del mensaje:', message.message?.conversation || message.message?.caption);
      
      if (messageId) {
        // Actualizar estado a "enviado" en BD
        console.log('✅ Actualizando estado en BD para mensaje:', messageId);
        await updateMensajeEstado(messageId, 'enviado');
        console.log('✅ Estado actualizado exitosamente');
      }
      
      // También guardar el mensaje en BD si no existe
      try {
        const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === instance.trim().toLowerCase());
        console.log('👥 Asesores disponibles:', asesores.map(a => ({ ID: a.ID, NOMBRE: a.NOMBRE })));
        console.log('🔍 Buscando asesor para instance:', instance);
        console.log('✅ Asesor encontrado:', asesor);
        
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
          
          console.log('💾 Datos del mensaje a guardar:', JSON.stringify(messageData, null, 2));
          
          // Buscar cliente por WhatsApp
          const cliente = await getClienteByWhatsapp(messageData.wha_cliente);
          console.log('👤 Cliente encontrado:', cliente);
          if (cliente) {
            messageData.id_cliente = cliente.ID;
          }
          
          // Insertar en BD
          console.log('💾 Insertando mensaje en BD...');
          await insertConversacion(messageData);
          console.log('✅ Mensaje insertado exitosamente en BD');
        } else {
          console.log('❌ No se pudo procesar: asesor no encontrado o remoteJid faltante');
          console.log('   - Asesor encontrado:', !!asesor);
          console.log('   - Remote JID:', message.key?.remoteJid);
        }
      } catch (insertError) {
        console.error('❌ Error guardando mensaje saliente en BD:', insertError);
      }
      
    } catch (error) {
      console.error('❌ Error procesando send.message:', error);
    }
  });

  // ===============================================
  // 🔄 EVENTO: Actualización de Estados (Entregado, Leído) - CORREGIDO
  // ===============================================
  socket.on('messages.update', async (data: any) => {
    try {
      console.log('🔍 [DEBUG] Evento messages.update recibido:');
      console.log('📦 Data completa:', JSON.stringify(data, null, 2));
      console.log('🏷️ Tipo de data:', typeof data);
      console.log('🔑 Keys disponibles:', Object.keys(data));
      
      // Evolution API puede enviar múltiples formatos
      let updates = [];
      
      if (data && Array.isArray(data)) {
        updates = data;
        console.log('📋 Data es array con', updates.length, 'elementos');
      } else if (data && data.data && Array.isArray(data.data)) {
        updates = data.data;
        console.log('📋 Data.data es array con', updates.length, 'elementos');
      } else if (data && typeof data === 'object') {
        updates = [data];
        console.log('📋 Data es objeto, convertido a array de 1 elemento');
      }
      
      console.log('🔄 Procesando', updates.length, 'actualizaciones...');
      
      for (const update of updates) {
        console.log('📝 Procesando update:', JSON.stringify(update, null, 2));
        
        // Buscar información del mensaje - ESTRUCTURA EVOLUTION API
        let messageKey = update.key || update.messageKey;
        let messageId = messageKey?.id;
        let fromMe = messageKey?.fromMe;
        
        console.log('🔑 MessageKey encontrado:', messageKey);
        console.log('🆔 Message ID:', messageId);
        console.log('👤 FromMe:', fromMe);
        
        // Si no hay key directamente, buscar en data (estructura Evolution)
        if (!messageKey && update.data) {
          messageId = update.data.keyId;
          fromMe = update.data.fromMe;
          console.log('🔍 Buscando en update.data - keyId:', messageId, 'fromMe:', fromMe);
        }
        
        // Si aún no tenemos messageId, intentar usar keyId directamente
        if (!messageId && update.keyId) {
          messageId = update.keyId;
          console.log('🔍 Usando update.keyId directamente:', messageId);
        }
        if (!messageId && update.data?.keyId) {
          messageId = update.data.keyId;
          console.log('🔍 Usando update.data.keyId:', messageId);
        }
        
        // Buscar estado en diferentes ubicaciones posibles
        let status = null;
        let statusText = '';
        
        console.log('🔍 Buscando status en diferentes ubicaciones...');
        
        // Formato 1: update.status
        if (update.status !== undefined) {
          status = update.status;
          console.log('✅ Status encontrado en update.status:', status);
        }
        // Formato 2: update.data?.status (Evolution API)
        else if (update.data?.status !== undefined) {
          status = update.data.status;
          console.log('✅ Status encontrado en update.data.status:', status);
        }
        // Formato 3: update.message?.status
        else if (update.message?.status !== undefined) {
          status = update.message.status;
          console.log('✅ Status encontrado en update.message.status:', status);
        }
        
        console.log('📊 Status final:', status, 'MessageId:', messageId, 'FromMe:', fromMe);
        
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
            console.log('🔤 Status string mapeado:', status, '→', statusText);
          } else {
            // Estados numéricos tradicionales
            switch (status) {
              case 0: statusText = 'enviando'; break;
              case 1: statusText = 'enviado'; break;
              case 2: statusText = 'entregado'; break;
              case 3: statusText = 'leido'; break;
              default: statusText = 'enviado';
            }
            console.log('🔢 Status numérico mapeado:', status, '→', statusText);
          }
          
          // Verificar si el estado actual es más avanzado antes de actualizar
          try {
            console.log('🔍 Verificando estado actual en BD para mensaje:', messageId);
            const estadoActual = await getMensajeEstadoActual(messageId);
            console.log('📊 Estado actual en BD:', estadoActual, 'Nuevo estado:', statusText);
            
            // Solo actualizar si el nuevo estado es más avanzado que el actual
            if (debeActualizarEstado(estadoActual, statusText)) {
              console.log('✅ Actualizando estado en BD:', messageId, '→', statusText);
              await updateMensajeEstado(messageId, statusText);
              console.log('✅ Estado actualizado exitosamente');
            } else {
              console.log('⏸️ No se actualiza: estado actual es más avanzado');
            }
          } catch (err) {
            console.error('❌ Error verificando/actualizando estado en BD:', err);
          }
        } else {
          console.log('⚠️ No se puede procesar: faltan datos requeridos');
          console.log('   - Status:', status);
          console.log('   - MessageId:', messageId);
          console.log('   - FromMe:', fromMe);
        }
      }
    } catch (error) {
      console.error('❌ Error procesando messages.update:', error);
    }
  });

  socket.on('messages.upsert', async (data: any) => {
    console.log('🔍 [DEBUG] Evento messages.upsert recibido:');
    console.log('📦 Data completa:', JSON.stringify(data, null, 2));
    console.log('🏷️ Tipo de data:', typeof data);
    console.log('🔑 Keys disponibles:', Object.keys(data));
    
    if (data && data.data && data.data.key && data.data.message) {
      console.log('✅ Estructura de data válida detectada');
      
      const message = {
        key: data.data.key,
        message: data.data.message,
        messageTimestamp: data.data.messageTimestamp,
        status: data.data.status,
      } as WhatsAppMessage;

      console.log('📨 Mensaje estructurado:', JSON.stringify(message, null, 2));
      console.log('🔑 Key del mensaje:', message.key);
      console.log('💬 Contenido del mensaje:', message.message);
      console.log('⏰ Timestamp:', message.messageTimestamp);
      console.log('📊 Status:', message.status);

      // IGNORAR reactionMessage
      const tipo = getMessageType(message);
      console.log('🏷️ Tipo de mensaje detectado:', tipo);
      
      if (tipo === 'reactionMessage') {
        console.log('⏭️ Ignorando reactionMessage');
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

      console.log('📋 EventData extraído:', JSON.stringify(eventData, null, 2));
      console.log('📱 From:', eventData.from);
      console.log('💬 Text:', eventData.text);
      console.log('⏰ Timestamp:', eventData.timestamp);
      console.log('🆔 MessageId:', eventData.messageId);
      console.log('👤 FromMe:', eventData.fromMe);
      console.log('🏢 Instance:', eventData.instance);
      console.log('🏷️ Tipo:', eventData.tipo);

      // FILTRO DE DUPLICADOS
      const uniqueKey = `${eventData.instance}:${eventData.messageId}`;
      console.log('🔑 Unique key generada:', uniqueKey);
      
      if (processedMessages.has(uniqueKey)) {
        console.log('⏭️ Mensaje duplicado, ignorando');
        return; // Ya lo procesamos
      }
      processedMessages.add(uniqueKey);
      console.log('✅ Mensaje agregado a processedMessages');
      
      if (processedMessages.size > 1000) {
        console.log('🧹 Limpiando processedMessages (más de 1000)');
        processedMessages.clear();
      }

      // ⚡ OPTIMIZACIÓN: Verificar asesor PRIMERO antes de procesar el mensaje
      console.log('👥 Asesores disponibles:', asesores.map(a => ({ ID: a.ID, NOMBRE: a.NOMBRE })));
      console.log('🔍 Buscando asesor para instance:', eventData.instance);
      
      const asesor = asesores.find(a => a.NOMBRE.trim().toLowerCase() === (eventData.instance || '').trim().toLowerCase());
      console.log('✅ Asesor encontrado:', asesor);
      
      if (!asesor) {
        console.log('❌ No se procesa: asesor no encontrado para instance:', eventData.instance);
        console.log('   - Instance recibida:', eventData.instance);
        console.log('   - Asesores disponibles:', asesores.map(a => a.NOMBRE));
        return; // Salir temprano - NO procesar mensajes de instancias sin asesor
      }

      // Determinar modo
      const modo: 'saliente' | 'entrante' = message.key.fromMe ? 'saliente' : 'entrante';
      console.log('📤 Modo del mensaje:', modo);

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
      
      console.log('💬 Mensaje para BD:', mensaje);

      // Buscar id_cliente por wha_cliente
      let id_cliente: number | null = null;
      try {
        console.log('🔍 Buscando cliente por WhatsApp:', eventData.from);
        const cliente = await getClienteByWhatsapp(eventData.from);
        console.log('👤 Cliente encontrado:', cliente);
        if (cliente) {
          id_cliente = cliente.ID;
        }
      } catch (err) {
        console.log('⚠️ Error buscando cliente (continuando):', err);
        // Silenciar error de cliente no encontrado
      }

      // Insertar en la tabla conversaciones
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
        
        console.log('💾 Datos de conversación a insertar:', JSON.stringify(conversacionData, null, 2));
        console.log('💾 Insertando conversación en BD...');
        
        await insertConversacion(conversacionData);
        console.log('✅ Conversación insertada exitosamente en BD');
        
      } catch (err) {
        console.error('❌ Error guardando mensaje:', err);
      }
    } else {
      console.log('❌ Estructura de data inválida para messages.upsert');
      console.log('   - data existe:', !!data);
      console.log('   - data.data existe:', !!(data && data.data));
      console.log('   - data.data.key existe:', !!(data && data.data && data.data.key));
      console.log('   - data.data.message existe:', !!(data && data.data && data.data.message));
    }
  });
  
  // ===============================================
  // 🔗 EVENTOS DE CONEXIÓN (Socket.io eventos estándar)
  // ===============================================
  socket.on('connect', () => {
    // Conexión exitosa - sin log para no interferir
  });
  
  socket.on('disconnect', (reason) => {
    console.error(`Socket desconectado: ${reason}`);
  });
  
  socket.on('connect_error', (error) => {
    console.error(`Error de conexión: ${error.message}`);
  });
  
  // ===============================================
  // 📱 EVENTOS ESPECÍFICOS DE EVOLUTION API
  // ===============================================
  socket.on('qrcode.updated', (_data) => {
    // QR Code actualizado - sin log para no interferir
  });
  
  socket.on('connection.update', (data) => {
    // Estado de conexión actualizado - sin log para no interferir
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