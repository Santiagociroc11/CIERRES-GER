const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;

// Interfaces para webhook logs
export interface WebhookLogEntry {
  event_type: string;
  flujo: string;
  status: 'received' | 'processing' | 'success' | 'error';
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_country?: string;
  product_name?: string;
  transaction_id?: string;
  purchase_amount?: number;
  purchase_date?: Date;
  cliente_id?: number;
  asesor_id?: number;
  asesor_nombre?: string;
  manychat_status?: 'success' | 'error' | 'skipped';
  manychat_flow_id?: string;
  manychat_subscriber_id?: string;
  manychat_error?: string;
  flodesk_status?: 'success' | 'error' | 'skipped';
  flodesk_segment_id?: string;
  flodesk_error?: string;
  telegram_status?: 'success' | 'error' | 'skipped' | 'queued';
  telegram_chat_id?: string;
  telegram_message_id?: string;
  telegram_error?: string;
  raw_webhook_data?: any;
  processing_time_ms?: number;
  error_message?: string;
  error_stack?: string;
  received_at?: Date;
  processed_at?: Date;
  processing_steps?: any[];
}

export interface WebhookLogUpdate {
  id: number;
  status?: 'processing' | 'success' | 'error';
  cliente_id?: number;
  asesor_id?: number;
  asesor_nombre?: string;
  manychat_status?: 'success' | 'error' | 'skipped';
  manychat_flow_id?: string;
  manychat_subscriber_id?: string;
  manychat_error?: string;
  flodesk_status?: 'success' | 'error' | 'skipped';
  flodesk_segment_id?: string;
  flodesk_error?: string;
  telegram_status?: 'success' | 'error' | 'skipped' | 'queued';
  telegram_chat_id?: string;
  telegram_message_id?: string;
  telegram_error?: string;
  processing_time_ms?: number;
  error_message?: string;
  error_stack?: string;
  processed_at?: Date;
  processing_steps?: any[];
  // Información de comprador para casos de soporte
  buyer_status?: string;
  buyer_previous_advisor?: string;
  // Campos de comprador que pueden actualizarse desde API de Hotmart
  buyer_phone?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_country?: string;
  buyer_creation_date?: number;
  redirect_reason?: string;
}

export async function insertConversacion(data: {
  id_asesor: number;
  id_cliente?: number | null;
  wha_cliente: string;
  modo: 'entrante' | 'saliente';
  timestamp: number;
  mensaje: string;
  mensaje_id?: string;
  estado?: string;
}) {
  const response = await fetch(`${POSTGREST_URL}/conversaciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al insertar conversación: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function updateMensajeEstado(mensajeId: string, estado: string) {
  try {
    const response = await fetch(`${POSTGREST_URL}/conversaciones?mensaje_id=eq.${mensajeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ estado })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al actualizar estado de mensaje: ${response.status} - ${errorText}`);
    }
    
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      return { success: true };
    }
    
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      return { success: true };
    }
  } catch (error) {
    console.error(`Error actualizando estado de mensaje ${mensajeId}:`, error);
    throw error;
  }
}

export async function getAsesores(): Promise<{ ID: number; NOMBRE: string }[]> {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?select=ID,NOMBRE`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener asesores: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getClienteByWhatsapp(wha: string): Promise<{ ID: number; ESTADO: string; ID_ASESOR?: number; NOMBRE_ASESOR?: string } | null> {
  try {
    if (!wha || typeof wha !== 'string') {
      console.log('❌ getClienteByWhatsapp: Número inválido o vacío', { wha });
      return null;
    }

    // Limpiar el número (solo dígitos)
    const soloNumeros = wha.replace(/\D/g, '');
    
    if (soloNumeros.length < 7) {
      console.log('❌ getClienteByWhatsapp: Número muy corto para búsqueda', { 
        original: wha, 
        soloNumeros, 
        longitud: soloNumeros.length 
      });
      return null;
    }

    const ultimos7 = soloNumeros.slice(-7);
    console.log('🔍 getClienteByWhatsapp: Buscando por últimos 7 dígitos', { 
      original: wha, 
      soloNumeros, 
      ultimos7 
    });

    // Buscar clientes cuyo whatsapp contenga los últimos 7 dígitos
    const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?WHATSAPP=ilike.*${ultimos7}*&select=ID,ESTADO,ID_ASESOR,NOMBRE_ASESOR&limit=1`);
    
    if (!response.ok) {
      console.error('❌ getClienteByWhatsapp: Error en respuesta HTTP', { 
        status: response.status, 
        statusText: response.statusText,
        ultimos7 
      });
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      console.log('✅ getClienteByWhatsapp: Cliente encontrado', { 
        clienteId: data[0].ID,
        estado: data[0].ESTADO,
        ultimos7,
        whatsappBD: data[0].WHATSAPP || 'no disponible'
      });
      return data[0];
    } else {
      console.log('⚠️ getClienteByWhatsapp: No se encontraron clientes', { 
        ultimos7,
        numeroOriginal: wha 
      });
      return null;
    }

  } catch (error) {
    console.error('❌ getClienteByWhatsapp: Error inesperado', { 
      error: error instanceof Error ? error.message : 'Error desconocido',
      numero: wha 
    });
    return null;
  }
}

// 🆕 FUNCIONES PARA MAPEO LID

// Función para buscar cliente por últimos dígitos del WhatsApp
export async function buscarClientePorUltimosDigitos(ultimosDigitos: string): Promise<{ ID: number; NOMBRE: string; WHATSAPP: string; ID_ASESOR?: number } | null> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/GERSSON_CLIENTES?WHATSAPP=ilike.*${ultimosDigitos}&select=ID,NOMBRE,WHATSAPP,ID_ASESOR&limit=1`
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error buscando cliente por últimos dígitos:', error);
    return null;
  }
}

// Función para crear mapeo LID → WhatsApp
export async function crearMapeoLID(lid: string, whatsapp: string, idCliente: number, idAsesor: number): Promise<boolean> {
  try {
    const mappingData = {
      lid,
      whatsapp_number: whatsapp,
      id_cliente: idCliente,
      asesor_id: idAsesor
    };
    
    const response = await fetch(`${POSTGREST_URL}/lid_mappings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(mappingData)
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error creando mapeo LID:', error);
    return false;
  }
}

// Función para buscar mapeo LID existente
export async function buscarMapeoLID(lid: string): Promise<{ 
  id: number; 
  lid: string; 
  whatsapp_number: string; 
  id_cliente: number; 
  asesor_id: number; 
} | null> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/lid_mappings?lid=eq.${encodeURIComponent(lid)}&select=*&limit=1`
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error buscando mapeo LID:', error);
    return null;
  }
}

// Función para actualizar última vez visto del mapeo LID
export async function actualizarMapeoLID(lid: string): Promise<void> {
  try {
    await fetch(`${POSTGREST_URL}/lid_mappings?lid=eq.${encodeURIComponent(lid)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_seen: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error actualizando mapeo LID:', error);
  }
}

// 🆕 FUNCIÓN PARA OBTENER CONVERSACIONES AGRUPADAS POR CLIENTE PARA UN ASESOR
export async function getConversacionesPorAsesor(asesorId: number): Promise<any[]> {
  try {
    console.log(`🔍 Obteniendo conversaciones para asesor ID: ${asesorId}`);
    
    // Obtener conversaciones del asesor agrupadas por cliente/whatsapp
    const url = `${POSTGREST_URL}/conversaciones?id_asesor=eq.${asesorId}&select=*&order=timestamp.desc&limit=1000`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP ${response.status} obteniendo conversaciones: ${errorText}`);
      return [];
    }
    
    const conversaciones = await response.json();
    
    // Agrupar por cliente/whatsapp y obtener la información más reciente
    const conversacionesAgrupadas = conversaciones.reduce((acc: any, conv: any) => {
      const key = conv.id_cliente || conv.wha_cliente; // Usar id_cliente si existe, sino wha_cliente
      
      if (!acc[key]) {
        acc[key] = {
          id_cliente: conv.id_cliente,
          wha_cliente: conv.wha_cliente,
          nombre_cliente: conv.nombre_cliente || 'Sin nombre',
          ultimo_mensaje: conv.mensaje,
          ultimo_timestamp: conv.timestamp,
          total_mensajes: 0,
          mensajes_no_leidos: 0,
          ultimo_modo: conv.modo
        };
      }
      
      acc[key].total_mensajes++;
      
      // Actualizar con el mensaje más reciente
      if (conv.timestamp > acc[key].ultimo_timestamp) {
        acc[key].ultimo_mensaje = conv.mensaje;
        acc[key].ultimo_timestamp = conv.timestamp;
        acc[key].ultimo_modo = conv.modo;
      }
      
      return acc;
    }, {});
    
    // Convertir a array y ordenar por último mensaje
    const resultado = Object.values(conversacionesAgrupadas)
      .sort((a: any, b: any) => b.ultimo_timestamp - a.ultimo_timestamp);
    
    console.log(`✅ Encontradas ${resultado.length} conversaciones agrupadas para asesor ${asesorId}`);
    return resultado;
    
  } catch (error) {
    console.error('❌ Error obteniendo conversaciones por asesor:', error);
    return [];
  }
}

// 🆕 FUNCIÓN PARA OBTENER MENSAJES DE UNA CONVERSACIÓN ESPECÍFICA
export async function getMensajesConversacion(asesorId: number, clienteKey: string): Promise<any[]> {
  try {
    console.log(`🔍 Obteniendo mensajes para asesor ${asesorId}, cliente: ${clienteKey}`);
    
    // Determinar si es un ID de cliente o WhatsApp
    const isClienteId = !isNaN(Number(clienteKey)) && !clienteKey.includes('@');
    
    let url = `${POSTGREST_URL}/conversaciones?id_asesor=eq.${asesorId}&order=timestamp.asc&limit=500`;
    
    if (isClienteId) {
      url += `&id_cliente=eq.${clienteKey}`;
    } else {
      url += `&wha_cliente=eq.${encodeURIComponent(clienteKey)}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP ${response.status} obteniendo mensajes: ${errorText}`);
      return [];
    }
    
    const mensajes = await response.json();
    console.log(`✅ Encontrados ${mensajes.length} mensajes para la conversación`);
    return mensajes;
    
  } catch (error) {
    console.error('❌ Error obteniendo mensajes de conversación:', error);
    return [];
  }
}

// 🆕 FUNCIÓN PARA OBTENER LIDs SIN MAPEAR
export async function getLIDsSinMapear(): Promise<any[]> {
  try {
    console.log('🔍 Buscando conversaciones con LID sin mapear...');
    
    // Buscar conversaciones que tienen @lid en wha_cliente pero no tienen id_cliente
    const url = `${POSTGREST_URL}/conversaciones?wha_cliente=like.*@lid&id_cliente=is.null&select=wha_cliente,id_asesor,timestamp,mensaje&order=timestamp.desc&limit=1000`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP ${response.status} obteniendo LIDs sin mapear: ${errorText}`);
      return [];
    }
    
    const conversaciones = await response.json();
    console.log(`🔍 Conversaciones encontradas con LID sin mapear: ${conversaciones.length}`);
    
    // Obtener información de asesores
    const asesoresResponse = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?select=ID,NOMBRE`);
    const asesores = asesoresResponse.ok ? await asesoresResponse.json() : [];
    
    // Agrupar por LID y obtener información del asesor
    const lidsAgrupados = conversaciones.reduce((acc: any, conv: any) => {
      const lid = conv.wha_cliente;
      if (!acc[lid]) {
        const asesor = asesores.find((a: any) => a.ID === conv.id_asesor);
        acc[lid] = {
          lid,
          id_asesor: conv.id_asesor,
          nombre_asesor: asesor?.NOMBRE || 'Asesor desconocido',
          primera_conversacion: conv.timestamp,
          ultima_conversacion: conv.timestamp,
          total_mensajes: 0,
          ultimo_mensaje: conv.mensaje
        };
      }
      
      acc[lid].total_mensajes++;
      if (conv.timestamp > acc[lid].ultima_conversacion) {
        acc[lid].ultima_conversacion = conv.timestamp;
        acc[lid].ultimo_mensaje = conv.mensaje;
      }
      if (conv.timestamp < acc[lid].primera_conversacion) {
        acc[lid].primera_conversacion = conv.timestamp;
      }
      
      return acc;
    }, {});
    
    const resultado = Object.values(lidsAgrupados);
    console.log(`✅ Encontrados ${resultado.length} LIDs únicos sin mapear`);
    
    // Log detallado para debugging
    resultado.forEach((lid: any) => {
      console.log(`📱 LID sin mapear: ${lid.lid} → Asesor: ${lid.nombre_asesor} (${lid.total_mensajes} mensajes)`);
    });
    
    return resultado;
    
  } catch (error) {
    console.error('❌ Error obteniendo LIDs sin mapear:', error);
    return [];
  }
}

// 🆕 FUNCIÓN PARA ACTUALIZAR CONVERSACIONES HISTÓRICAS CON LID
export async function actualizarConversacionesHistoricasLID(lid: string, idCliente: number, asesorId: number): Promise<number> {
  try {
    console.log(`🔄 Actualizando conversaciones históricas para LID: ${lid} → Cliente ID: ${idCliente}`);
    
    // Actualizar todas las conversaciones que tienen este LID pero no tienen id_cliente
    const url = `${POSTGREST_URL}/conversaciones?wha_cliente=eq.${encodeURIComponent(lid)}&id_cliente=is.null`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id_cliente: idCliente,
        id_asesor: asesorId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP ${response.status} actualizando conversaciones históricas: ${errorText}`);
      return 0;
    }
    
    // PostgREST no devuelve los registros modificados por defecto en PATCH
    // Hacer una consulta para contar las conversaciones que ahora tienen el cliente
    const countResponse = await fetch(`${POSTGREST_URL}/conversaciones?wha_cliente=eq.${encodeURIComponent(lid)}&id_cliente=eq.${idCliente}&select=id`);
    
    if (countResponse.ok) {
      const conversaciones = await countResponse.json();
      const cantidad = Array.isArray(conversaciones) ? conversaciones.length : 0;
      console.log(`✅ ${cantidad} conversaciones históricas actualizadas para LID: ${lid}`);
      return cantidad;
    }
    
    return 0;
    
  } catch (error) {
    console.error('❌ Error actualizando conversaciones históricas:', error);
    return 0;
  }
}

export async function getNextAsesorPonderado(): Promise<{ ID: number } | null> {
  const response = await fetch(`${POSTGREST_URL}/rpc/get_next_asesor_ponderado`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return null;
  const asesorId = await response.json();
  
  // La función retorna directamente el ID (INTEGER), no un objeto
  if (typeof asesorId === 'number' && asesorId > 0) {
    return { ID: asesorId };
  }
  return null;
}

export async function getAsesorById(id: number): Promise<{ ID: number; NOMBRE: string; WHATSAPP: string; ID_TG: string } | null> {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${id}&select=ID,NOMBRE,WHATSAPP,ID_TG`);
  if (!response.ok) return null;
  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
}

export async function getClienteById(id: number): Promise<{ ID: number; NOMBRE: string; WHATSAPP: string; ESTADO: string; ID_ASESOR?: number; NOMBRE_ASESOR?: string } | null> {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${id}&select=ID,NOMBRE,WHATSAPP,ESTADO,ID_ASESOR,NOMBRE_ASESOR&limit=1`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching cliente by ID: ${response.status}`);
  }

  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
}

export async function createCliente(clienteData: {
  NOMBRE: string;
  ESTADO: string;
  WHATSAPP: string;
  ID_ASESOR?: number;
  NOMBRE_ASESOR?: string;
  WHA_ASESOR?: string;
  FECHA_CREACION: number;
  FECHA_COMPRA?: number;
  MEDIO_COMPRA?: string;
  // Campos CRM de soporte
  soporte_tipo?: string;
  soporte_prioridad?: string;
  soporte_duda?: string;
  soporte_descripcion?: string;
  soporte_fecha_ultimo?: number;
}) {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(clienteData)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear cliente: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function updateCliente(id: number, updates: Partial<{
  NOMBRE: string;
  ESTADO: string;
  WHATSAPP: string;
  FECHA_COMPRA: number;
  MEDIO_COMPRA: string;
  // Campos CRM de soporte
  soporte_tipo: string;
  soporte_prioridad: string;
  soporte_duda: string;
  soporte_descripcion: string;
  soporte_fecha_ultimo: number;
  // Campos de asesor
  ID_ASESOR: number;
  NOMBRE_ASESOR: string;
  WHA_ASESOR: string;
}>) {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar cliente: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function updateAsesorCounter(asesorId: number, flujo: string) {
  const validFlujos = ['CARRITOS', 'RECHAZADOS', 'COMPRAS', 'TICKETS', 'LINK', 'MASIVOS'];
  if (!validFlujos.includes(flujo)) {
    throw new Error(`Flujo inválido: ${flujo}`);
  }

  const response = await fetch(`${POSTGREST_URL}/rpc/increment_asesor_counter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      asesor_id: asesorId,
      counter_field: flujo
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar contador: ${response.status} - ${errorText}`);
  }
  
  // Para stored procedures que no devuelven datos, verificar si hay contenido antes de parsear JSON
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    return { success: true }; // Respuesta vacía es considerada exitosa para updates
  }
  
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    // Si no se puede parsear, pero la respuesta HTTP fue exitosa, considerarlo como éxito
    return { success: true };
  }
}

export async function insertRegistro(data: {
  ID_CLIENTE: number;
  TIPO_EVENTO: string;
  FECHA_EVENTO: number;
}) {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_REGISTROS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al insertar registro: ${response.status} - ${errorText}`);
  }
  
  // Para inserts con return=representation, verificar si hay contenido antes de parsear JSON
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    return { success: true }; // Respuesta vacía es considerada exitosa
  }
  
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    // Si no se puede parsear, pero la respuesta HTTP fue exitosa, considerarlo como éxito
    return { success: true };
  }
}

// Funciones para webhook logs
export async function insertWebhookLog(logEntry: WebhookLogEntry) {
  // Verificar que POSTGREST_URL esté configurada
  if (!POSTGREST_URL) {
    throw new Error('POSTGREST_URL no está configurada');
  }
  
  // Convert dates to ISO strings for JSON
  const processedEntry = {
    ...logEntry,
    received_at: logEntry.received_at?.toISOString() || new Date().toISOString(),
    processed_at: logEntry.processed_at?.toISOString(),
    purchase_date: logEntry.purchase_date?.toISOString()
  };

  const response = await fetch(`${POSTGREST_URL}/webhook_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(processedEntry)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al insertar webhook log: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function updateWebhookLog(logUpdate: WebhookLogUpdate) {
  // Verificar que POSTGREST_URL esté configurada
  if (!POSTGREST_URL) {
    throw new Error('POSTGREST_URL no está configurada');
  }
  
  const { id, ...updates } = logUpdate;
  
  // Convert dates to ISO strings for JSON
  const processedUpdates = {
    ...updates,
    processed_at: updates.processed_at?.toISOString() || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${POSTGREST_URL}/webhook_logs?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(processedUpdates)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar webhook log: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getRecentWebhookLogs(limit: number = 100, offset: number = 0) {
  if (!POSTGREST_URL) {
    throw new Error('POSTGREST_URL no está configurada');
  }
  
  const response = await fetch(`${POSTGREST_URL}/recent_webhook_logs?order=received_at.desc&limit=${limit}&offset=${offset}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener webhook logs: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getWebhookLogsCount() {
  if (!POSTGREST_URL) {
    throw new Error('POSTGREST_URL no está configurada');
  }
  
  // Hacer request con header Prefer: count=exact para obtener solo el conteo
  const response = await fetch(`${POSTGREST_URL}/webhook_logs?select=id`, {
    headers: {
      'Prefer': 'count=exact'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener conteo de webhook logs: ${response.status} - ${errorText}`);
  }
  
  // PostgREST devuelve el count en el header Content-Range
  const contentRange = response.headers.get('Content-Range');
  if (contentRange) {
    // Format: "0-24/3573" donde 3573 es el total
    const match = contentRange.match(/\/(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Fallback: contar los resultados devueltos
  const data = await response.json();
  return Array.isArray(data) ? data.length : 0;
}

export async function getWebhookStats(days: number = 7) {
  if (!POSTGREST_URL) {
    throw new Error('POSTGREST_URL no está configurada');
  }
  
  const response = await fetch(`${POSTGREST_URL}/webhook_stats?date=gte.${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&order=date.desc`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener estadísticas de webhook: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getWebhookLogById(id: number) {
  if (!POSTGREST_URL) {
    throw new Error('POSTGREST_URL no está configurada');
  }
  
  const response = await fetch(`${POSTGREST_URL}/webhook_logs?id=eq.${id}&limit=1`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener webhook log: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
} 

// Webhook Configuration Functions
export async function getWebhookConfigFromDB(platform: string): Promise<any> {
  try {
    // Usar PostgREST para llamar a la función de la base de datos
    const response = await fetch(`${POSTGREST_URL}/rpc/get_webhook_config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ p_platform: platform })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      throw new Error(`Error getting webhook config: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    // PostgREST puede devolver el resultado directamente o en un array
    // Si es un objeto directo, usarlo; si es un array, tomar el primer elemento
    let finalResult;
    if (Array.isArray(result)) {
      finalResult = result[0] || {};
    } else {
      finalResult = result || {};
    }
    return finalResult;
  } catch (error) {
    console.error('Error getting webhook config from DB:', error);
    throw error;
  }
}

export async function updateWebhookConfigInDB(
  platform: string, 
  configKey: string, 
  configValue: any, 
  updatedBy: string = 'system'
): Promise<boolean> {
  try {
    console.log(`Actualizando webhook config - Platform: ${platform}, Key: ${configKey}`);
    
    const response = await fetch(`${POSTGREST_URL}/rpc/update_webhook_config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        p_platform: platform,
        p_config_key: configKey,
        p_config_value: configValue,
        p_updated_by: updatedBy
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error HTTP ${response.status} actualizando webhook config (${platform}.${configKey}): ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    // PostgREST devuelve directamente true/false para funciones RPC
    const success = result === true || result === 'true';
    console.log(`Configuración ${platform}.${configKey} actualizada: ${success}`);
    return success;
  } catch (error) {
    console.error(`Error de conexión actualizando webhook config (${platform}.${configKey}):`, error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
    // En lugar de throw, retornar false para que el proceso continue
    return false;
  }
}

export async function resetWebhookConfigInDB(platform: string): Promise<boolean> {
  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/reset_webhook_config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ p_platform: platform })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error resetting webhook config: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result[0]?.success || false;
  } catch (error) {
    console.error('Error resetting webhook config in DB:', error);
    throw error;
  }
}

export async function getWebhookConfigHistory(platform: string, limit: number = 10): Promise<any[]> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/webhook_config?platform=eq.${platform}&order=updated_at.desc&limit=${limit}&select=*`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error getting webhook config history: ${response.status} - ${errorText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error getting webhook config history:', error);
    throw error;
  }
}

// 🆕 FUNCIONES PARA MANEJO DE DUPLICADOS

export async function getReportesByClienteId(clienteId: number): Promise<any[]> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/REPORTES?ID_CLIENTE=eq.${clienteId}&select=*&order=FECHA_REPORTE.desc`
    );
    
    if (!response.ok) {
      throw new Error(`Error fetching reportes: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error getting reportes by cliente ID:', error);
    throw error;
  }
}

export async function getRegistrosByClienteId(clienteId: number): Promise<any[]> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/REGISTROS?ID_CLIENTE=eq.${clienteId}&select=*&order=FECHA_EVENTO.desc`
    );
    
    if (!response.ok) {
      throw new Error(`Error fetching registros: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error getting registros by cliente ID:', error);
    throw error;
  }
}

export async function deleteCliente(clienteId: number): Promise<void> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${clienteId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error deleting cliente: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting cliente:', error);
    throw error;
  }
}

export async function deleteReporte(reporteId: number): Promise<void> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/REPORTES?ID=eq.${reporteId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error deleting reporte: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting reporte:', error);
    throw error;
  }
}

export async function insertReporte(reporte: {
  ID_CLIENTE: number;
  TIPO_REPORTE: string;
  DESCRIPCION: string;
  FECHA_REPORTE: string;
  ID_ASESOR: number;
  NOMBRE_ASESOR: string;
}): Promise<any[]> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/REPORTES`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reporte)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error inserting reporte: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error inserting reporte:', error);
    throw error;
  }
} 