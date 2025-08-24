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

// Cache para evitar múltiples llamadas a getCustomFields
let whatsappFieldId: number | null = null;

// Función para obtener el ID del custom field de WhatsApp dinámicamente
async function getWhatsAppCustomFieldId(token: string): Promise<number | null> {
  if (whatsappFieldId !== null) {
    return whatsappFieldId;
  }
  
  try {
    const response = await fetch(`${MANYCHAT_API_BASE}/page/getCustomFields`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Error obteniendo custom fields de ManyChat');
      return null;
    }

    const data = await response.json();
    
    // Buscar un field que contenga "wha", "numero" o "phone" en el nombre
    const whatsappField = data.data?.find((field: any) => 
      field.name.toLowerCase().includes('wha') || 
      field.name.toLowerCase().includes('numero') || 
      field.name.toLowerCase().includes('phone')
    );

    if (whatsappField) {
      whatsappFieldId = whatsappField.id;
      console.log(`Custom field WhatsApp encontrado: ${whatsappField.name} (ID: ${whatsappField.id})`);
      return whatsappFieldId;
    } else {
      console.warn('No se encontró custom field de WhatsApp en ManyChat');
      return null;
    }
  } catch (error) {
    console.error('Error obteniendo custom fields:', error);
    return null;
  }
}

export async function findManyChatSubscriber(phoneNumber: string): Promise<ManyChatResponse> {
  const config = await getHotmartConfig();
  const MANYCHAT_TOKEN = config.tokens.manychat || '';
  try {
    // Preparar formatos del número
    const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : phoneNumber;
    const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    
    // 1. PRIMERO: Buscar por custom field si existe
    const whatsappFieldId = await getWhatsAppCustomFieldId(MANYCHAT_TOKEN);
    if (whatsappFieldId) {
      const customFieldResponse = await fetch(`${MANYCHAT_API_BASE}/subscriber/findByCustomField?field_id=${whatsappFieldId}&field_value=${encodeURIComponent(cleanPhone)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (customFieldResponse.ok) {
        const customFieldData = await customFieldResponse.json();
        if (customFieldData.status === 'success' && customFieldData.data?.length > 0) {
          return { success: true, data: customFieldData };
        }
      }
    }
    
    // 2. SEGUNDO: Buscar por phone field (system field)
    const phoneResponse = await fetch(`${MANYCHAT_API_BASE}/subscriber/findBySystemField?field_name=phone&field_value=${encodeURIComponent(fullPhone)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (phoneResponse.ok) {
      const phoneData = await phoneResponse.json();
      if (phoneData.status === 'success' && phoneData.data?.length > 0) {
        return { success: true, data: phoneData };
      }
    }
    
    // 3. ÚLTIMO: Buscar por nombre (con +)
    const nameResponse = await fetch(`${MANYCHAT_API_BASE}/subscriber/findByName?name=${encodeURIComponent(fullPhone)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (nameResponse.ok) {
      const nameData = await nameResponse.json();
      if (nameData.status === 'success' && nameData.data?.length > 0) {
        return { success: true, data: nameData };
      }
    }
    
    // Si llegamos aquí, no se encontró el subscriber
    return { success: true, data: { status: 'success', data: [] } };
    
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}

export async function createManyChatSubscriber(nombre: string, phoneNumber: string): Promise<ManyChatResponse> {
  const config = await getHotmartConfig();
  const MANYCHAT_TOKEN = config.tokens.manychat || '';
  
  try {
    // Preparar formatos del número
    const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : phoneNumber;
    
    // Preparar el payload con el formato correcto según documentación
    const payload: any = {
      first_name: nombre,          // Usar el nombre real, no el teléfono
      last_name: "",              // Opcional
      whatsapp_phone: fullPhone,  // Con + para WhatsApp
      phone: fullPhone,           // Con + para phone field (requiere permisos especiales)
      has_opt_in_sms: true,       // Requerido para phone field
      consent_phrase: "webhook"   // Requerido para phone field
    };
    
    // Obtener el ID del custom field de WhatsApp dinámicamente
    const whatsappFieldId = await getWhatsAppCustomFieldId(MANYCHAT_TOKEN);
    
    if (whatsappFieldId) {
      // Agregar custom field si existe
      payload.custom_fields = [
        {
          field_id: whatsappFieldId,
          field_value: cleanPhone // Sin + para búsquedas actuales
        }
      ];
    }
    
    const response = await fetch(`${MANYCHAT_API_BASE}/subscriber/createSubscriber`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    // Manejar diferentes tipos de respuesta
    if (response.ok) {
      // Éxito (200)
      if (data.status === 'success') {
        return { success: true, data };
      } else {
        return { success: false, error: `Response status: ${data.status}` };
      }
    } else if (response.status === 400) {
      // Error de validación (400) - subscriber ya existe
      if (data.status === 'error' && data.details?.messages?.wa_id?.message?.includes('already exists')) {
        // Extraer el número del mensaje de error y devolverlo para manejo especial
        return { 
          success: false, 
          error: data.details.messages.wa_id.message[0] || 'WhatsApp ID already exists',
          data: { 
            already_exists: true,
            phone: cleanPhone 
          }
        };
      } else {
        return { success: false, error: `Error ${response.status}: ${JSON.stringify(data)}` };
      }
    } else {
      return { success: false, error: `Error ${response.status}: ${JSON.stringify(data)}` };
    }

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