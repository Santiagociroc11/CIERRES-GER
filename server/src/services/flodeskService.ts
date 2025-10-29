export interface FlodeskResponse {
  success: boolean;
  data?: any;
  error?: string;
}

import { getHotmartConfig } from '../config/webhookConfig';

const FLODESK_API_BASE = 'https://api.flodesk.com/v1';

export async function addSubscriberToFlodesk(email: string, segmentId: string): Promise<FlodeskResponse> {
  const config = await getHotmartConfig();
  const FLODESK_TOKEN = config.tokens.flodesk || '';
  
  try {
    // Flodesk usa Basic Auth con el token como username y password vacía
    const basicAuth = Buffer.from(`${FLODESK_TOKEN}:`).toString('base64');
    
    // Paso 1: Crear o actualizar el subscriber
    const createResponse = await fetch(`${FLODESK_API_BASE}/subscribers`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hotmart Integration (hotmart-webhook-processor)'
      },
      body: JSON.stringify({
        email: email,
        segment_ids: [segmentId]  // ✅ Campo correcto según la API de Flodesk
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      return { success: false, error: `Error ${createResponse.status}: ${errorData}` };
    }

    const subscriberData = await createResponse.json();
    
    // Paso 2: Asegurar que se añadió al segmento usando el endpoint específico
    // Esto es importante porque si el subscriber ya existía, puede que no se haya añadido al segmento
    const addSegmentResponse = await fetch(`${FLODESK_API_BASE}/subscribers/${encodeURIComponent(email)}/segments`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hotmart Integration (hotmart-webhook-processor)'
      },
      body: JSON.stringify({
        segment_ids: [segmentId]
      })
    });

    if (!addSegmentResponse.ok) {
      const errorData = await addSegmentResponse.text();
      // Si falla añadir al segmento pero el subscriber se creó/actualizó, aún retornamos éxito parcial
      // pero registramos el warning
      console.warn(`⚠️ Subscriber creado/actualizado pero error añadiendo al segmento: ${errorData}`);
      // Retornamos éxito porque al menos el subscriber existe
      return { success: true, data: subscriberData, error: `Warning: No se pudo añadir al segmento: ${errorData}` };
    }

    const segmentData = await addSegmentResponse.json();
    
    // Retornar los datos actualizados del subscriber con los segmentos incluidos
    return { success: true, data: segmentData };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}