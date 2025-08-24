export interface EvolutionApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTIONAPI_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTIONAPI_TOKEN;

export async function checkWhatsAppNumber(instanceName: string, phoneNumber: string): Promise<EvolutionApiResponse> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return { success: false, error: 'Evolution API no configurada' };
    }

    const response = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        numbers: [phoneNumber]
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