export interface FlodeskResponse {
  success: boolean;
  data?: any;
  error?: string;
}

import { getHotmartConfig } from '../config/webhookConfig';

const FLODESK_API_BASE = 'https://api.flodesk.com/v1';

export async function addSubscriberToFlodesk(email: string, segmentId: string): Promise<FlodeskResponse> {
  const config = getHotmartConfig();
  const FLODESK_TOKEN = config.tokens.flodesk;
  
  try {
    // Flodesk usa Basic Auth con el token como username y password vacía
    const basicAuth = Buffer.from(`${FLODESK_TOKEN}:`).toString('base64');
    
    const response = await fetch(`${FLODESK_API_BASE}/subscribers`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hotmart Integration (hotmart-webhook-processor)'
      },
      body: JSON.stringify({
        email: email,
        segments: [segmentId]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Error ${response.status}: ${errorData}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}