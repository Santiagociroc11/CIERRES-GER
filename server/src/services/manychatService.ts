export interface ManyChatSubscriber {
  id: string;
  first_name?: string;
  whatsapp_phone?: string;
}

export interface ManyChatResponse {
  success: boolean;
  data?: any;
  error?: string;
}

import { getHotmartConfig } from '../config/webhookConfig';

const MANYCHAT_API_BASE = 'https://api.manychat.com/fb';

export async function findManyChatSubscriber(phoneNumber: string): Promise<ManyChatResponse> {
  const config = await getHotmartConfig();
  const MANYCHAT_TOKEN = config.tokens.manychat || '';
  try {
    const response = await fetch(`${MANYCHAT_API_BASE}/subscriber/findByName?name=${encodeURIComponent(`+${phoneNumber}`)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: `Error ${response.status}: ${JSON.stringify(data)}` };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}

export async function createManyChatSubscriber(nombre: string, phoneNumber: string): Promise<ManyChatResponse> {
  const config = await getHotmartConfig();
  const MANYCHAT_TOKEN = config.tokens.manychat || '';
  
  try {
    const response = await fetch(`${MANYCHAT_API_BASE}/subscriber/createSubscriber`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        first_name: nombre,
        whatsapp_phone: phoneNumber
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: `Error ${response.status}: ${JSON.stringify(data)}` };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}

export async function sendManyChatFlow(subscriberId: string, flowId: string): Promise<ManyChatResponse> {
  const config = await getHotmartConfig();
  const MANYCHAT_TOKEN = config.tokens.manychat || '';
  
  try {
    const response = await fetch(`${MANYCHAT_API_BASE}/sending/sendFlow`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        flow_ns: flowId
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: `Error ${response.status}: ${JSON.stringify(data)}` };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}