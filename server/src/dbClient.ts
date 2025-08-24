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
  telegram_status?: 'success' | 'error' | 'skipped';
  telegram_chat_id?: string;
  telegram_message_id?: string;
  telegram_error?: string;
  raw_webhook_data?: any;
  processing_time_ms?: number;
  error_message?: string;
  error_stack?: string;
  received_at?: Date;
  processed_at?: Date;
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
  telegram_status?: 'success' | 'error' | 'skipped';
  telegram_chat_id?: string;
  telegram_message_id?: string;
  telegram_error?: string;
  processing_time_ms?: number;
  error_message?: string;
  error_stack?: string;
  processed_at?: Date;
}

export async function insertConversacion(data: {
  id_asesor: number;
  id_cliente?: number | null;
  wha_cliente: string;
  modo: 'entrante' | 'saliente';
  timestamp: number;
  mensaje: string;
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

export async function getAsesores(): Promise<{ ID: number; NOMBRE: string }[]> {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?select=ID,NOMBRE`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener asesores: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getClienteByWhatsapp(wha: string): Promise<{ ID: number; ESTADO: string; ID_ASESOR?: number; NOMBRE_ASESOR?: string } | null> {
  // Limpiar el número (solo dígitos)
  const soloNumeros = wha.replace(/\D/g, '');
  const ultimos7 = soloNumeros.slice(-7);
  if (!ultimos7) return null;
  // Buscar clientes cuyo whatsapp contenga los últimos 7 dígitos
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?WHATSAPP=ilike.*${ultimos7}*&select=ID,ESTADO,ID_ASESOR,NOMBRE_ASESOR&limit=1`);
  if (!response.ok) return null;
  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
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
      throw new Error(`Error getting webhook config: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result[0]?.config || {};
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
    console.log(`POSTGREST_URL: ${POSTGREST_URL}`);
    console.log(`Payload:`, JSON.stringify({
      p_platform: platform,
      p_config_key: configKey,
      p_config_value: configValue,
      p_updated_by: updatedBy
    }));
    
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
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error HTTP ${response.status} actualizando webhook config (${platform}.${configKey}): ${errorText}`);
      
      // Crear error más descriptivo pero no hacer throw para que el proceso continue
      const errorMessage = `Failed to update ${platform}.${configKey}: HTTP ${response.status} - ${errorText}`;
      console.error(errorMessage);
      return false; // Retornar false en lugar de throw
    }
    
    const result = await response.json();
    console.log(`Response result:`, result);
    // PostgREST devuelve directamente true/false para funciones RPC
    const success = result === true || result === 'true';
    console.log(`Resultado actualización ${platform}.${configKey}:`, success);
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