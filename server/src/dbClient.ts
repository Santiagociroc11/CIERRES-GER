const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;
import telegramQueue from './services/telegramQueueService';

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
      return null;
    }

    // Limpiar el número (solo dígitos)
    const soloNumeros = wha.replace(/\D/g, '');
    

    const ultimos7 = soloNumeros.slice(-7);


    const url = `${POSTGREST_URL}/GERSSON_CLIENTES?WHATSAPP=ilike.*${encodeURIComponent(ultimos7)}&select=ID,ESTADO,ID_ASESOR,NOMBRE_ASESOR&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('❌ getClienteByWhatsapp: Error en respuesta HTTP', { 
        status: response.status, 
        statusText: response.statusText,
        ultimos7 
      });
      return null;
    }

    const data = await response.json();

    if (data.length > 0) {
      return data[0];
    } else {
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
    
    return resultado;
    
  } catch (error) {
    return [];
  }
}

// 🆕 FUNCIÓN PARA OBTENER MENSAJES DE UNA CONVERSACIÓN ESPECÍFICA
export async function getMensajesConversacion(asesorId: number, clienteKey: string): Promise<any[]> {
  try {
    
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
    return mensajes;
    
  } catch (error) {
    console.error('❌ Error obteniendo mensajes de conversación:', error);
    return [];
  }
}


// 🆕 FUNCIÓN PARA ACTUALIZAR CONVERSACIONES HISTÓRICAS CON LID
export async function actualizarConversacionesHistoricasLID(lid: string, idCliente: number, asesorId: number): Promise<number> {
  try {
    
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
      `${POSTGREST_URL}/GERSSON_REPORTES?ID_CLIENTE=eq.${clienteId}&select=*&order=FECHA_REPORTE.desc`
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
      `${POSTGREST_URL}/GERSSON_REGISTROS?ID_CLIENTE=eq.${clienteId}&select=*&order=FECHA_EVENTO.desc`
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
      `${POSTGREST_URL}/GERSSON_REPORTES?ID=eq.${reporteId}`,
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
      `${POSTGREST_URL}/GERSSON_REPORTES`,
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

export async function updateReporte(reporteId: number, datos: {
  ID_CLIENTE?: number;
  DESCRIPCION?: string;
}): Promise<void> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/GERSSON_REPORTES?ID=eq.${reporteId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error updating reporte: ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating reporte:', error);
    throw error;
  }
}

// ================================
// FUNCIONES PARA GESTIÓN DE VIPs
// ================================
// ✅ CORREGIDO: Lógica de estados actualizada para usar estados disponibles
// - ANTES: buscaba estados 'interesado', 'muy_interesado', 'activo', 'en_seguimiento', 'comprador' (nunca disponibles)
// - AHORA: usa estados REALES que SÍ están disponibles:
//   * 'VENTA CONSOLIDADA' → venta-consolidada
//   * 'PAGADO' → pagado  
//   * 'SEGUIMIENTO' → interesado
//   * 'NO CONTESTÓ' → en-seguimiento
//   * 'NO INTERESADO' → no-interesado
//   * 'NO CONTACTAR' → no-contactar
// - RESULTADO: Las métricas VIPs ahora funcionan correctamente y muestran datos reales

export interface VIP {
  ID?: number;
  NOMBRE?: string;
  CORREO?: string;
  WHATSAPP: string;
  FECHA_IMPORTACION?: string;
  ASESOR_ASIGNADO?: number;
  ESTADO_CONTACTO?: string;
  NOTAS?: string;
  YA_ES_CLIENTE?: boolean;
  FECHA_CONTACTO?: string;
  FECHA_ULTIMA_ACTUALIZACION?: string;
  POSICION_CSV?: number;
  NIVEL_CONCIENCIA?: string;
  ORIGEN_REGISTRO?: string;
}

// Procesar CSV de VIPs y clasificar si ya están en el sistema
export async function procesarVIPs(vips: { NOMBRE?: string; CORREO?: string; WHATSAPP: string }[]): Promise<{
  yaEnSistema: any[];
  nuevosVIPs: any[];
  errores: string[];
}> {
  try {
    console.log(`🔄 Procesando ${vips.length} VIPs...`);
    
    const yaEnSistema: any[] = [];
    const nuevosVIPs: any[] = [];
    const errores: string[] = [];
    
    for (const vip of vips) {
      try {
        if (!vip.WHATSAPP) {
          errores.push(`VIP sin WhatsApp: ${vip.NOMBRE || 'Sin nombre'}`);
          continue;
        }
        
        // Usar la función existente getClienteByWhatsapp que ya maneja la normalización
        const clienteExistente = await getClienteByWhatsapp(vip.WHATSAPP);
        
        // Log para debugging (solo los primeros 5 para no saturar)
        if (yaEnSistema.length + nuevosVIPs.length < 5) {
          console.log(`🔍 VIP: ${vip.NOMBRE} | WhatsApp: ${vip.WHATSAPP} | ${clienteExistente ? 'ENCONTRADO' : 'NUEVO'}`);
        }
        
        if (clienteExistente) {
          yaEnSistema.push({
            ...vip,
            cliente: clienteExistente,
            motivo: 'Ya es cliente en el sistema'
          });
        } else {
          nuevosVIPs.push(vip);
        }
      } catch (error) {
        errores.push(`Error procesando VIP ${vip.NOMBRE}: ${error}`);
      }
    }
    
    console.log(`✅ Procesamiento completo: ${yaEnSistema.length} ya en sistema, ${nuevosVIPs.length} nuevos VIPs, ${errores.length} errores`);
    
    return { yaEnSistema, nuevosVIPs, errores };
  } catch (error) {
    console.error('❌ Error procesando VIPs:', error);
    throw error;
  }
}

// Guardar VIPs nuevos en la base de datos
export async function guardarVIPsNuevos(vips: VIP[]): Promise<{ insertados: number; errores: string[] }> {
  try {
    console.log(`🔄 Guardando ${vips.length} VIPs nuevos...`);
    
    const errores: string[] = [];
    let insertados = 0;
    
    // Preparar datos para inserción
    const vipsParaInsertar = vips.map(vip => ({
      NOMBRE: vip.NOMBRE || null,
      CORREO: vip.CORREO || null,
      WHATSAPP: vip.WHATSAPP,
      ESTADO_CONTACTO: 'sin_asesor',
      YA_ES_CLIENTE: false,
      POSICION_CSV: vip.POSICION_CSV || null,
      NIVEL_CONCIENCIA: vip.NIVEL_CONCIENCIA || 'media',
      ORIGEN_REGISTRO: vip.ORIGEN_REGISTRO || 'grupo_whatsapp'
    }));
    
    // Insertar en lotes para mejor rendimiento
    const response = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(vipsParaInsertar)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error guardando VIPs: ${response.status} - ${errorText}`);
    }
    
    insertados = vipsParaInsertar.length;
    console.log(`✅ ${insertados} VIPs guardados exitosamente`);
    
    return { insertados, errores };
  } catch (error) {
    console.error('❌ Error guardando VIPs:', error);
    throw error;
  }
}

// Obtener todos los VIPs pendientes (no clientes aún) - OPTIMIZADO
export async function getVIPsPendientes(): Promise<VIP[]> {
  try {
    const response = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?YA_ES_CLIENTE=eq.false&select=*&order=POSICION_CSV.asc.nullslast,FECHA_IMPORTACION.desc`);
    
    if (!response.ok) {
      throw new Error(`Error obteniendo VIPs pendientes: ${response.status}`);
    }
    
    let vips = await response.json();
    
    if (vips.length === 0) {
      return vips;
    }
    
    // OPTIMIZACIÓN: Una sola consulta para obtener todos los WhatsApp de clientes existentes
    console.log(`🚀 Optimizando filtrado de ${vips.length} VIPs...`);
    const startTime = Date.now();
    
    const clientesResponse = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?select=ID,WHATSAPP,ESTADO,ID_ASESOR,NOMBRE_ASESOR`);
    if (!clientesResponse.ok) {
      throw new Error(`Error obteniendo clientes existentes: ${clientesResponse.status}`);
    }
    
    const clientesExistentes = await clientesResponse.json();
    
    // Crear Map para búsqueda rápida por últimos 7 dígitos
    const clientesPorWhatsapp = new Map<string, any>();
    
    for (const cliente of clientesExistentes) {
      if (cliente.WHATSAPP) {
        const soloNumeros = cliente.WHATSAPP.replace(/\D/g, '');
        const ultimos7 = soloNumeros.slice(-7);
        clientesPorWhatsapp.set(ultimos7, cliente);
      }
    }
    
    // Filtrar VIPs en memoria (mucho más rápido)
    const vipsFiltrados = [];
    const vipsParaActualizar = [];
    
    for (const vip of vips) {
      if (vip.WHATSAPP) {
        const soloNumeros = vip.WHATSAPP.replace(/\D/g, '');
        const ultimos7 = soloNumeros.slice(-7);
        const clienteExistente = clientesPorWhatsapp.get(ultimos7);
        
        if (!clienteExistente) {
          // Solo incluir si NO existe como cliente
          vipsFiltrados.push(vip);
        } else {
          // El VIP ya existe como cliente, marcarlo para actualización
          vipsParaActualizar.push({
            vipId: vip.ID,
            clienteId: clienteExistente.ID,
            nombre: vip.NOMBRE,
            whatsapp: vip.WHATSAPP
          });
        }
      } else {
        // VIP sin WhatsApp, incluir en pendientes
        vipsFiltrados.push(vip);
      }
    }
    
    // Actualizar VIPs que ya son clientes (en lotes para mayor eficiencia)
    if (vipsParaActualizar.length > 0) {
      console.log(`📋 Actualizando ${vipsParaActualizar.length} VIPs que ya son clientes...`);
      
      // Procesar en lotes de 20 para evitar sobrecargar la API
      const loteSize = 20;
      for (let i = 0; i < vipsParaActualizar.length; i += loteSize) {
        const lote = vipsParaActualizar.slice(i, i + loteSize);
        
        const promesasActualizacion = lote.map(async (item) => {
          try {
            await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?ID=eq.${item.vipId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                YA_ES_CLIENTE: true,
                CLIENTE_ID: item.clienteId,
                FECHA_CONVERSION_CLIENTE: new Date().toISOString(),
                FECHA_ULTIMA_ACTUALIZACION: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error(`❌ Error actualizando VIP ${item.vipId}:`, error);
          }
        });
        
        await Promise.all(promesasActualizacion);
      }
      
      console.log(`✅ VIPs actualizados correctamente`);
    }
    
    const endTime = Date.now();
    console.log(`⚡ Filtrado optimizado completado en ${endTime - startTime}ms`);
    console.log(`📊 Resultado: ${vipsFiltrados.length} VIPs pendientes, ${vipsParaActualizar.length} ya eran clientes`)
    
    console.log(`✅ VIPs pendientes: ${vipsFiltrados.length} de ${vips.length} (${vips.length - vipsFiltrados.length} filtrados por ser clientes)`);
    return vipsFiltrados;
  } catch (error) {
    console.error('❌ Error obteniendo VIPs pendientes:', error);
    throw error;
  }
}

// Crear mensaje de notificación para VIP asignado
function crearMensajeVIPAsignado(vip: any): string {
  const nivelEmoji: Record<string, string> = {
    'alta': '🔥',
    'media': '⚡',
    'baja': '💫'
  };

  const origenEmoji: Record<string, string> = {
    'segunda_clase': '🎓',
    'grupo_whatsapp_activo': '💬',
    'grupo_whatsapp': '📱'
  };

  const nivelConciencia = vip.NIVEL_CONCIENCIA || 'media';
  const origenRegistro = vip.ORIGEN_REGISTRO || 'grupo_whatsapp';

  return `🎯 *NUEVO CLIENTE DEL LISTADO VIP ASIGNADO*

👤 *Cliente:* ${vip.NOMBRE || 'Sin nombre'}
📞 *WhatsApp:* ${vip.WHATSAPP}

${nivelEmoji[nivelConciencia] || '⚡'} *Prioridad:* ${nivelConciencia.toUpperCase()}
${origenEmoji[origenRegistro] || '📱'} *Origen:* ${origenRegistro === 'segunda_clase' ? 'Registrado en 2da clase' : 'Grupo WhatsApp'}




🚀 *¡CONTACTAR Y VENDER EN FRIO!*`;
}

// Crear mensaje de notificación para asignación masiva de VIPs
function crearMensajeVIPsMasivos(cantidadVips: number, asesorNombre: string): string {
  return `🎯 *ASIGNACIÓN MASIVA DE CLIENTES DEL LISTADO VIP*

👤 *Asesor:* ${asesorNombre}
📊 *Clientes Asignados:* ${cantidadVips}

🔥 Estos clientes han sido priorizados por su nivel de conciencia
📋 Revisa tu lista de clientes para verlos todos

🚀 *¡CONTACTAR Y VENDER EN FRIO!*`;
}

// Crear cliente desde VIP
export async function crearClienteDesdeVIP(vip: any, asesorId: number): Promise<number> {
  try {
    // Obtener datos del asesor para el registro
    const asesorResponse = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${asesorId}&select=NOMBRE,WHATSAPP`);
    const asesores = await asesorResponse.json();
    const asesor = asesores[0];
    const asesorNombre = asesor?.NOMBRE || 'Asesor Desconocido';
    
    // Crear cliente usando la misma función que Hotmart
    const nuevoCliente = await createCliente({
      NOMBRE: vip.NOMBRE || 'VIP Sin Nombre',
      WHATSAPP: vip.WHATSAPP,
      ESTADO: 'LISTA-VIP',
      ID_ASESOR: asesorId,
      NOMBRE_ASESOR: asesorNombre,
      WHA_ASESOR: asesor?.WHATSAPP, // Incluir WhatsApp del asesor como Hotmart
      FECHA_CREACION: Math.floor(Date.now() / 1000) // Timestamp como Hotmart
    });
    
    const clienteId = nuevoCliente[0]?.ID;
    
    console.log(`✅ Cliente creado desde VIP: ID ${clienteId}, Nombre: ${vip.NOMBRE || 'VIP Sin Nombre'}`);
    
    // Crear registro del evento VIP usando la misma función que Hotmart
    const currentTimestamp = Math.floor(Date.now() / 1000);
    try {
      await insertRegistro({
        ID_CLIENTE: clienteId,
        TIPO_EVENTO: 'ASIGNACION_VIP',
        FECHA_EVENTO: currentTimestamp
      });
      console.log(`✅ Registro VIP creado para cliente ${clienteId}`);
    } catch (error) {
      console.error('❌ Error creando registro VIP:', error);
    }
    
    return clienteId;
    
  } catch (error) {
    console.error('❌ Error creando cliente desde VIP:', error);
    throw error;
  }
}

// Asignar VIP a un asesor y crear cliente automáticamente
export async function asignarVIPAsesor(vipId: number, asesorId: number): Promise<void> {
  try {
    // 1. Obtener datos del VIP
    const vipResponse = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?ID=eq.${vipId}&select=*`);
    if (!vipResponse.ok) {
      throw new Error(`Error obteniendo VIP: ${vipResponse.status}`);
    }
    const vips = await vipResponse.json();
    const vip = vips[0];
    
    if (!vip) {
      throw new Error(`VIP ${vipId} no encontrado`);
    }
    
    // 2. Crear cliente desde VIP
    const clienteId = await crearClienteDesdeVIP(vip, asesorId);
    
    // 3. Actualizar VIP como asignado y convertido a cliente
    const updateResponse = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?ID=eq.${vipId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ASESOR_ASIGNADO: asesorId,
        ESTADO_CONTACTO: 'asignado',
        YA_ES_CLIENTE: true,
        CLIENTE_ID: clienteId,
        FECHA_CONVERSION_CLIENTE: new Date().toISOString(),
        FECHA_ULTIMA_ACTUALIZACION: new Date().toISOString()
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`❌ Error actualizando VIP ${vipId}: ${updateResponse.status} - ${errorText}`);
      console.warn(`⚠️ Cliente ${clienteId} ya fue creado, pero VIP no se actualizó correctamente`);
      // No lanzamos error aquí porque el cliente ya fue creado exitosamente
    }

    // 4. Obtener datos del asesor para notificación
    const asesorResponse = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${asesorId}&select=NOMBRE,ID_TG`);
    const asesores = await asesorResponse.json();
    const asesor = asesores[0];
    
    // 5. Enviar notificación por Telegram si el asesor tiene ID_TG
    if (asesor?.ID_TG) {
      try {
        const mensaje = crearMensajeVIPAsignado(vip);
        const messageId = telegramQueue.enqueueMessage(
          asesor.ID_TG,
          mensaje,
          undefined, // No hay webhookLogId para VIPs
          {
            type: 'vip_assignment',
            asesor: asesor.NOMBRE,
            vip_id: vipId,
            cliente_id: clienteId,
            nivel_conciencia: vip.NIVEL_CONCIENCIA,
            whatsapp: vip.WHATSAPP
          },
          {
            inline_keyboard: [[
              {
                text: "🚀 Ir a la Plataforma",
                url: "https://sistema-cierres-ger.automscc.com"
              }
            ]]
          }
        );
        console.log(`📱 Notificación VIP encolada para ${asesor.NOMBRE}: ${messageId}`);
      } catch (error) {
        console.error(`❌ Error encolando notificación VIP para asesor ${asesorId}:`, error);
        // No falla la asignación por un error de notificación
      }
    } else {
      console.warn(`⚠️ Asesor ${asesorId} sin ID de Telegram configurado, no se envió notificación VIP`);
    }
    
    console.log(`✅ VIP ${vipId} asignado a asesor ${asesorId} y convertido a cliente ${clienteId}`);
  } catch (error) {
    console.error('❌ Error asignando VIP:', error);
    throw error;
  }
}


// Actualizar estado de contacto de VIP
export async function actualizarEstadoVIP(vipId: number, estado: string, notas?: string): Promise<void> {
  try {
    const datos: any = {
      ESTADO_CONTACTO: estado,
      FECHA_ULTIMA_ACTUALIZACION: new Date().toISOString()
    };
    
    if (estado === 'contactado' && !datos.FECHA_CONTACTO) {
      datos.FECHA_CONTACTO = new Date().toISOString();
    }
    
    if (notas) {
      datos.NOTAS = notas;
    }
    
    const response = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?ID=eq.${vipId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    });
    
    if (!response.ok) {
      throw new Error(`Error actualizando estado VIP: ${response.status}`);
    }
    
    console.log(`✅ VIP ${vipId} actualizado a estado: ${estado}`);
  } catch (error) {
    console.error('❌ Error actualizando estado VIP:', error);
    throw error;
  }
}

// Obtener VIPs asignados a un asesor específico
export async function getVIPsPorAsesor(asesorId: number): Promise<VIP[]> {
  try {
    const response = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?ASESOR_ASIGNADO=eq.${asesorId}&YA_ES_CLIENTE=eq.false&select=*&order=FECHA_ULTIMA_ACTUALIZACION.desc`);
    
    if (!response.ok) {
      throw new Error(`Error obteniendo VIPs del asesor: ${response.status}`);
    }
    
    const vips = await response.json();
    return vips;
  } catch (error) {
    console.error('❌ Error obteniendo VIPs del asesor:', error);
    throw error;
  }
}

// Obtener VIPs que ya están en el sistema (cruzados con clientes)
export async function getVIPsEnSistema(): Promise<any[]> {
  try {
    console.log('🔄 Obteniendo VIPs que ya están en el sistema...');
    
    // Obtener todos los VIPs importados
    const vipsResponse = await fetch(`${POSTGREST_URL}/GERSSON_CUPOS_VIP?select=*&order=POSICION_CSV.asc.nullslast`);
    if (!vipsResponse.ok) {
      throw new Error('Error obteniendo VIPs importados');
    }
    const vipsImportados = await vipsResponse.json();
    
    // Obtener todos los clientes del sistema
    const clientesResponse = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?select=ID,NOMBRE,WHATSAPP,ESTADO,ID_ASESOR,NOMBRE_ASESOR,FECHA_COMPRA,MONTO_COMPRA`);
    if (!clientesResponse.ok) {
      throw new Error('Error obteniendo clientes');
    }
    const clientes = await clientesResponse.json();
    
    // Normalizar números de WhatsApp para comparación (últimos 7 dígitos como el sistema)
    const normalizeWhatsApp = (wha: string): string => {
      const soloNumeros = wha.replace(/\D/g, '');
      return soloNumeros.slice(-7); // Usar últimos 7 dígitos como el sistema existente
    };
    
    // Cruzar VIPs con clientes existentes
    const vipsEnSistema = [];
    for (const vip of vipsImportados) {
      const whaNormalizado = normalizeWhatsApp(vip.WHATSAPP || '');
      
      // Buscar cliente correspondiente
      const cliente = clientes.find((c: any) => {
        const clienteWha = normalizeWhatsApp(c.WHATSAPP || '');
        return clienteWha === whaNormalizado;
      });
      
      if (cliente) {
        // Log para debugging (solo los primeros 3)
        if (vipsEnSistema.length < 3) {
          console.log(`🎯 VIP en sistema: ${vip.NOMBRE} | VIP WhatsApp: ${vip.WHATSAPP} (${whaNormalizado}) | Cliente WhatsApp: ${cliente.WHATSAPP} | Match encontrado`);
        }
        
        // Determinar estado del cliente para el Kanban
        // ✅ CORREGIDO: Usar estados que SÍ están disponibles en el sistema
        let estadoKanban = 'lead'; // Default
        
        if (cliente.MONTO_COMPRA && cliente.MONTO_COMPRA > 0) {
          estadoKanban = 'comprador';
        } else if (cliente.ESTADO === 'SEGUIMIENTO') {
          // ✅ ANTES: buscaba 'activo' o 'en_seguimiento' (nunca disponibles)
          // ✅ AHORA: usa 'SEGUIMIENTO' que SÍ está disponible
          estadoKanban = 'interesado';
        } else if (cliente.ESTADO === 'NO INTERESADO') {
          // ✅ ANTES: buscaba 'rechazado' o 'no_interesado' (nunca disponibles)
          // ✅ AHORA: usa 'NO INTERESADO' que SÍ está disponible
          estadoKanban = 'no_interesado';
        } else {
          estadoKanban = 'lead';
        }
        
        vipsEnSistema.push({
          ...vip,
          cliente: cliente,
          estadoKanban: estadoKanban,
          yaEsCliente: true
        });
      }
    }
    
    console.log(`✅ ${vipsEnSistema.length} VIPs encontrados en el sistema de ${vipsImportados.length} VIPs importados`);
    return vipsEnSistema;
    
  } catch (error) {
    console.error('❌ Error obteniendo VIPs en sistema:', error);
    throw error;
  }
}

// Obtener VIPs en pipeline por asesor con estados reales basados en actividad
export async function getVIPsEnPipelinePorAsesor(): Promise<any[]> {
  try {
    console.log('🔄 Obteniendo VIPs en pipeline agrupados por asesor...');
    
    // Obtener todos los VIPs que ya están en el sistema
    const vipsEnSistema = await getVIPsEnSistema();
    
    // Obtener todos los asesores
    const asesoresResponse = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?select=ID,NOMBRE&order=NOMBRE.asc`);
    if (!asesoresResponse.ok) {
      const errorText = await asesoresResponse.text();
      throw new Error(`Error obteniendo asesores: ${asesoresResponse.status} - ${errorText}`);
    }
    const asesores = await asesoresResponse.json();
    
    // Obtener todas las conversaciones para determinar contactos
    const conversacionesResponse = await fetch(`${POSTGREST_URL}/conversaciones?select=id_cliente,wha_cliente,id_asesor,timestamp&order=timestamp.desc`);
    if (!conversacionesResponse.ok) {
      const errorText = await conversacionesResponse.text();
      throw new Error(`Error obteniendo conversaciones: ${conversacionesResponse.status} - ${errorText}`);
    }
    const conversaciones = await conversacionesResponse.json();
    
    // Normalizar números de WhatsApp para comparación
    const normalizeWhatsApp = (wha: string): string => {
      const soloNumeros = wha.replace(/\D/g, '');
      return soloNumeros.slice(-7);
    };
    
    // Crear un mapa de conversaciones por cliente (actualizado para capturar timestamp más reciente)
    const conversacionesPorCliente = new Map();
    conversaciones.forEach((conv: any) => {
      const key = conv.id_cliente || normalizeWhatsApp(conv.wha_cliente || '');
      if (!conversacionesPorCliente.has(key) || conv.timestamp > conversacionesPorCliente.get(key).ultimaConversacion) {
        conversacionesPorCliente.set(key, {
          tieneConversaciones: true,
          ultimaConversacion: conv.timestamp,
          asesorId: conv.id_asesor
        });
      }
    });
    
    // Función auxiliar para validar actividad del asesor anterior a compra (conversación O reporte)
    const validarActividadAnteriorACompra = async (cliente: any, conversacionesPorCliente: Map<any, any>): Promise<boolean> => {
      if (!cliente?.FECHA_COMPRA || !cliente?.ID_ASESOR) return false;
      
      const fechaCompraTimestamp = typeof cliente.FECHA_COMPRA === 'string' 
        ? parseInt(cliente.FECHA_COMPRA) 
        : cliente.FECHA_COMPRA;
      
      // 1. Verificar conversación previa
      const clienteKey = cliente.ID;
      const conversacionInfo = conversacionesPorCliente.get(clienteKey);
      
      if (conversacionInfo && conversacionInfo.ultimaConversacion && conversacionInfo.ultimaConversacion < fechaCompraTimestamp) {
        return true; // Hay conversación previa
      }
      
      // 2. Verificar reporte previo del asesor
      try {
        const reportesResponse = await fetch(
          `${POSTGREST_URL}/GERSSON_REPORTES?ID_CLIENTE=eq.${cliente.ID}&ID_ASESOR=eq.${cliente.ID_ASESOR}&select=FECHA_REPORTE&order=FECHA_REPORTE.desc&limit=1`
        );
        
        if (reportesResponse.ok) {
          const reportes = await reportesResponse.json();
          if (reportes && reportes.length > 0) {
            const ultimoReporte = reportes[0];
            if (ultimoReporte.FECHA_REPORTE && ultimoReporte.FECHA_REPORTE < fechaCompraTimestamp) {
              return true; // Hay reporte previo
            }
          }
        }
      } catch (error) {
        console.warn('Error verificando reportes previos:', error);
      }
      
      return false; // No hay conversación ni reporte previo
    };

    // Determinar el estado del pipeline para cada VIP (primera pasada - identificar candidatos)
    // ✅ CORREGIDO: Usar estados que SÍ están disponibles en el sistema
    // ✅ NUEVO: Validar actividad previa (conversación O reporte) para estados de venta
    const determinarEstadoPipeline = (vip: any): string => {
      const cliente = vip.cliente;
      const clienteKey = cliente?.ID || normalizeWhatsApp(vip.WHATSAPP || '');
      const tieneConversaciones = conversacionesPorCliente.has(clienteKey);
      
      // 1. Venta consolidada - marcamos como candidato para validación async
      if (cliente?.ESTADO === 'VENTA CONSOLIDADA') {
        return 'venta-consolidada-pendiente';
      }
      
      // 2. Pagado - marcamos como candidato para validación async
      if (cliente?.ESTADO === 'PAGADO') {
        return 'pagado-pendiente';
      }
      
      // 3. Interesado - estado SEGUIMIENTO reportado por asesor
      // ✅ ANTES: buscaba 'interesado' o 'muy_interesado' (nunca disponibles)
      // ✅ AHORA: usa 'SEGUIMIENTO' que SÍ está disponible
      if (cliente?.ESTADO === 'SEGUIMIENTO') {
        return 'interesado';
      }
      
      // 4. En seguimiento - estado NO CONTESTÓ (cliente que necesita seguimiento)
      // ✅ ANTES: buscaba 'activo' o 'en_seguimiento' (nunca disponibles)
      // ✅ AHORA: usa 'NO CONTESTÓ' que SÍ está disponible para diferenciar
      if (cliente?.ESTADO === 'NO CONTESTÓ') {
        return 'en-seguimiento';
      }
      
      // 5. Contactado - tiene conversaciones registradas
      // ✅ Cliente con actividad de chat registrada
      if (tieneConversaciones) {
        return 'contactado';
      }
      
      // 6. No Interesado - estado NO INTERESADO reportado por asesor
      // ✅ Cliente que no está interesado en comprar
      if (cliente?.ESTADO === 'NO INTERESADO') {
        return 'no-interesado';
      }
      
      // 7. No Contactar - estado NO CONTACTAR reportado por asesor
      // ✅ Cliente que no debe ser contactado
      if (cliente?.ESTADO === 'NO CONTACTAR') {
        return 'no-contactar';
      }
      
      // 8. Listado VIP - sin contacto aún (estado por defecto)
      // ✅ Cliente VIP sin reportes ni actividad registrada
      return 'listado-vip';
    };
    
    // Agrupar VIPs por asesor
    const vipsPorAsesor = new Map();
    
    // Inicializar todos los asesores
    asesores.forEach((asesor: any) => {
      vipsPorAsesor.set(asesor.ID, {
        asesor: asesor,
        vips: [],
        estadisticas: {
          'listado-vip': 0,
          'contactado': 0,
          'en-seguimiento': 0,
          'interesado': 0,
          'pagado': 0,
          'venta-consolidada': 0,
          'no-interesado': 0,
          'no-contactar': 0,
          total: 0
        }
      });
    });
    
    // Asignar VIPs a asesores y calcular estadísticas (con validación async para ventas)
    for (const vip of vipsEnSistema) {
      const asesorId = vip.cliente?.ID_ASESOR;
      if (asesorId && vipsPorAsesor.has(asesorId)) {
        let estadoPipeline = determinarEstadoPipeline(vip);
        
        // Validar async para estados de venta pendientes
        if (estadoPipeline === 'venta-consolidada-pendiente') {
          const tieneActividad = await validarActividadAnteriorACompra(vip.cliente, conversacionesPorCliente);
          estadoPipeline = tieneActividad ? 'venta-consolidada' : 'listado-vip';
        } else if (estadoPipeline === 'pagado-pendiente') {
          const tieneActividad = await validarActividadAnteriorACompra(vip.cliente, conversacionesPorCliente);
          estadoPipeline = tieneActividad ? 'pagado' : 'listado-vip';
        }
        
        const vipConEstado = {
          ...vip,
          estadoPipeline: estadoPipeline
        };
        
        const asesorData = vipsPorAsesor.get(asesorId);
        asesorData.vips.push(vipConEstado);
        asesorData.estadisticas[estadoPipeline]++;
        asesorData.estadisticas.total++;
      }
    }
    
    // Convertir a array y filtrar asesores sin VIPs asignados
    const resultado = Array.from(vipsPorAsesor.values())
      .filter((asesorData: any) => asesorData.estadisticas.total > 0)
      .sort((a: any, b: any) => b.estadisticas.total - a.estadisticas.total);
    
    console.log(`✅ ${resultado.length} asesores con VIPs en pipeline cargados`);
    return resultado;
    
  } catch (error) {
    console.error('❌ Error obteniendo VIPs en pipeline por asesor:', error);
    throw error;
  }
}

// Nueva función para obtener estadísticas detalladas para vista de tabla VIP
export async function getVIPsTableData(): Promise<any[]> {
  try {
    console.log('🔄 Obteniendo datos de VIPs para vista de tabla con métricas...');
    
    // Obtener VIPs pipeline por asesor
    const vipsPorAsesor = await getVIPsEnPipelinePorAsesor();
    
    // Para cada asesor, calcular métricas adicionales
    const resultado = [];
    
    for (const asesorData of vipsPorAsesor) {
      const asesor = asesorData.asesor;
      const vips = asesorData.vips;
      const estadisticas = asesorData.estadisticas;
      
      // Obtener IDs de clientes del asesor que son VIPs
      const clientesVIPIds = vips
        .map((vip: any) => vip.cliente?.ID)
        .filter((id: any) => id);
      
      if (clientesVIPIds.length === 0) {
        continue;
      }
      
      // Calcular % contactado (cualquier estado reportado = contacto realizado)
      // ✅ LÓGICA ACTUALIZADA: Si el asesor reportó cualquier estado, es obvio que hizo contacto
      const clientesContactados = vips.filter((vip: any) => 
        ['contactado', 'en-seguimiento', 'interesado', 'pagado', 'venta-consolidada', 'no-interesado', 'no-contactar'].includes(vip.estadoPipeline)
      ).length;
      
      const porcentajeContactado = estadisticas.total > 0 
        ? Math.round((clientesContactados / estadisticas.total) * 100) 
        : 0;
      
      // Calcular % reportado (clientes con reportes en GERSSON_REPORTES)
      let clientesReportados = 0;
      try {
        const reportesResponse = await fetch(
          `${POSTGREST_URL}/GERSSON_REPORTES?ID_CLIENTE=in.(${clientesVIPIds.join(',')})&ID_ASESOR=eq.${asesor.ID}&select=ID_CLIENTE`
        );
        
        if (reportesResponse.ok) {
          const reportes = await reportesResponse.json();
          // Contar clientes únicos que tienen reportes
          const clientesConReporte = new Set(reportes.map((r: any) => r.ID_CLIENTE));
          clientesReportados = clientesConReporte.size;
        }
      } catch (error) {
        console.warn(`⚠️  Error obteniendo reportes para asesor ${asesor.NOMBRE}:`, error);
      }
      
      const porcentajeReportado = estadisticas.total > 0 
        ? Math.round((clientesReportados / estadisticas.total) * 100) 
        : 0;
      
      // Calcular conversión (pagados + consolidadas)
      const clientesConversion = estadisticas.pagado + estadisticas['venta-consolidada'];
      const porcentajeConversion = estadisticas.total > 0 
        ? Math.round((clientesConversion / estadisticas.total) * 100) 
        : 0;
      
      resultado.push({
        asesor: asesor,
        estadisticas: estadisticas,
        metricas: {
          totalVIPs: estadisticas.total,
          sinContacto: estadisticas['listado-vip'],
          contactados: clientesContactados, // ✅ Usar la misma lógica que el porcentaje
          enSeguimiento: estadisticas['en-seguimiento'],
          interesados: estadisticas.interesado,
          pagados: estadisticas.pagado,
          consolidadas: estadisticas['venta-consolidada'],
          noInteresados: estadisticas['no-interesado'],
          noContactar: estadisticas['no-contactar'],
          porcentajeContactado: porcentajeContactado,
          porcentajeReportado: porcentajeReportado,
          porcentajeConversion: porcentajeConversion,
          clientesReportados: clientesReportados
        }
      });
    }
    
    // Ordenar por total de VIPs descendente
    resultado.sort((a, b) => b.metricas.totalVIPs - a.metricas.totalVIPs);
    
    console.log(`✅ Datos de tabla VIP generados para ${resultado.length} asesores`);
    return resultado;
    
  } catch (error) {
    console.error('❌ Error obteniendo datos de tabla VIP:', error);
    throw error;
  }
}

 
// Nueva función para obtener todos los clientes VIP de un asesor (para el modal)
export async function getTodosClientesVIPPorAsesor(asesorId: number): Promise<any[]> {
  try {
    console.log(`🔄 Obteniendo todos los clientes VIP del asesor ${asesorId}...`);
    
    // Usar la misma lógica que getVIPsEnPipelinePorAsesor
    // Obtener todos los VIPs que ya están en el sistema
    const vipsEnSistema = await getVIPsEnSistema();
    console.log(`🔍 DEBUG: Total de VIPs en sistema: ${vipsEnSistema.length}`);
    
    // Obtener todas las conversaciones para determinar contactos
    const conversacionesResponse = await fetch(`${POSTGREST_URL}/conversaciones?select=id_cliente,wha_cliente,id_asesor,timestamp&order=timestamp.desc`);
    if (!conversacionesResponse.ok) {
      throw new Error(`Error obteniendo conversaciones: ${conversacionesResponse.status}`);
    }
    const conversaciones = await conversacionesResponse.json();
    
    // Normalizar números de WhatsApp para comparación
    const normalizeWhatsApp = (wha: string): string => {
      const soloNumeros = wha.replace(/\D/g, '');
      return soloNumeros.slice(-7);
    };
    
    // Crear un mapa de conversaciones por cliente (actualizado para capturar timestamp más reciente)
    const conversacionesPorCliente = new Map();
    conversaciones.forEach((conv: any) => {
      const key = conv.id_cliente || normalizeWhatsApp(conv.wha_cliente || '');
      if (!conversacionesPorCliente.has(key) || conv.timestamp > conversacionesPorCliente.get(key).ultimaConversacion) {
        conversacionesPorCliente.set(key, {
          tieneConversaciones: true,
          ultimaConversacion: conv.timestamp,
          asesorId: conv.id_asesor
        });
      }
    });
    
    // Función auxiliar para validar actividad del asesor anterior a compra (conversación O reporte)
    const validarActividadAnteriorACompra = async (cliente: any, conversacionesPorCliente: Map<any, any>): Promise<boolean> => {
      if (!cliente?.FECHA_COMPRA || !cliente?.ID_ASESOR) return false;
      
      const fechaCompraTimestamp = typeof cliente.FECHA_COMPRA === 'string' 
        ? parseInt(cliente.FECHA_COMPRA) 
        : cliente.FECHA_COMPRA;
      
      // 1. Verificar conversación previa
      const clienteKey = cliente.ID;
      const conversacionInfo = conversacionesPorCliente.get(clienteKey);
      
      if (conversacionInfo && conversacionInfo.ultimaConversacion && conversacionInfo.ultimaConversacion < fechaCompraTimestamp) {
        return true; // Hay conversación previa
      }
      
      // 2. Verificar reporte previo del asesor
      try {
        const reportesResponse = await fetch(
          `${POSTGREST_URL}/GERSSON_REPORTES?ID_CLIENTE=eq.${cliente.ID}&ID_ASESOR=eq.${cliente.ID_ASESOR}&select=FECHA_REPORTE&order=FECHA_REPORTE.desc&limit=1`
        );
        
        if (reportesResponse.ok) {
          const reportes = await reportesResponse.json();
          if (reportes && reportes.length > 0) {
            const ultimoReporte = reportes[0];
            if (ultimoReporte.FECHA_REPORTE && ultimoReporte.FECHA_REPORTE < fechaCompraTimestamp) {
              return true; // Hay reporte previo
            }
          }
        }
      } catch (error) {
        console.warn('Error verificando reportes previos:', error);
      }
      
      return false; // No hay conversación ni reporte previo
    };
    
    // Determinar el estado del pipeline para cada VIP (primera pasada - identificar candidatos)
    const determinarEstadoPipeline = (vip: any): string => {
      const cliente = vip.cliente;
      const clienteKey = cliente?.ID || normalizeWhatsApp(vip.WHATSAPP || '');
      const tieneConversaciones = conversacionesPorCliente.has(clienteKey);
      
      // 1. Venta consolidada - marcamos como candidato para validación async
      if (cliente?.ESTADO === 'VENTA CONSOLIDADA') {
        return 'venta-consolidada-pendiente';
      }
      
      // 2. Pagado - marcamos como candidato para validación async
      if (cliente?.ESTADO === 'PAGADO') {
        return 'pagado-pendiente';
      }
      
      // 3. Interesado
      if (cliente?.ESTADO === 'SEGUIMIENTO') {
        return 'interesado';
      }
      
      // 4. En seguimiento
      if (cliente?.ESTADO === 'NO CONTESTÓ') {
        return 'en-seguimiento';
      }
      
      // 5. Contactado
      if (tieneConversaciones) {
        return 'contactado';
      }
      
      // 6. No Interesado
      if (cliente?.ESTADO === 'NO INTERESADO') {
        return 'no-interesado';
      }
      
      // 7. No Contactar
      if (cliente?.ESTADO === 'NO CONTACTAR') {
        return 'no-contactar';
      }
      
      // 8. Listado VIP (por defecto)
      return 'listado-vip';
    };
    
    // Filtrar VIPs que pertenecen al asesor específico
    const vipsDelAsesor = vipsEnSistema.filter(vip => {
      const cliente = vip.cliente;
      return cliente && cliente.ID_ASESOR === asesorId;
    });
    
    console.log(`🔍 DEBUG: VIPs del asesor ${asesorId}: ${vipsDelAsesor.length}`);
    
    // Convertir a formato del modal (con validación async para ventas)
    const todosLosClientes = [];
    for (const vip of vipsDelAsesor) {
      const cliente = vip.cliente;
      let estadoPipeline = determinarEstadoPipeline(vip);
      
      // Validar async para estados de venta pendientes
      if (estadoPipeline === 'venta-consolidada-pendiente') {
        const tieneActividad = await validarActividadAnteriorACompra(cliente, conversacionesPorCliente);
        estadoPipeline = tieneActividad ? 'venta-consolidada' : 'listado-vip';
      } else if (estadoPipeline === 'pagado-pendiente') {
        const tieneActividad = await validarActividadAnteriorACompra(cliente, conversacionesPorCliente);
        estadoPipeline = tieneActividad ? 'pagado' : 'listado-vip';
      }
      
      todosLosClientes.push({
        ID: cliente.ID,
        NOMBRE: cliente.NOMBRE,
        WHATSAPP: cliente.WHATSAPP,
        EMAIL: cliente.EMAIL || '',
        FUENTE: vip.FUENTE || '',
        estadoPipeline: estadoPipeline,
        tipo: 'cliente-existente',
        fechaCreacion: cliente.FECHA_CREACION,
        fechaCompra: cliente.FECHA_COMPRA,
        montoCompra: cliente.MONTO_COMPRA
      });
    }
    
    console.log(`✅ Total de ${todosLosClientes.length} clientes VIP obtenidos para el asesor ${asesorId}`);
    return todosLosClientes;
    
  } catch (error) {
    console.error(`❌ Error obteniendo clientes VIP del asesor ${asesorId}:`, error);
    throw error;
  }
}

 