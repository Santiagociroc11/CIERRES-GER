import winston from 'winston';
import { getHotmartConfig } from '../config/webhookConfig';

// Configurar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'hotmart-api.log' })
  ]
});

interface HotmartTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  jti: string;
}

interface HotmartUser {
  user: {
    ucode: string;
    name: string;
    email: string;
    phone?: string;
    cellphone?: string;
    address?: {
      country?: string;
      city?: string;
      state?: string;
    };
    documents?: Array<{
      type: string;
      value: string;
    }>;
  };
  role: 'BUYER' | 'PRODUCER' | 'COPRODUCER';
}

interface HotmartTransactionResponse {
  items: Array<{
    product: {
      name: string;
      id: number;
    };
    transaction: string;
    users: HotmartUser[];
  }>;
  page_info: {
    results_per_page: number;
    total_results: number;
  };
}

interface HotmartApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Cache del token para evitar requests innecesarios
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * Obtener token de autenticación de Hotmart
 */
export async function getHotmartAuthToken(): Promise<HotmartApiResponse> {
  try {
    // Verificar si tenemos un token válido en cache
    if (tokenCache && Date.now() < tokenCache.expiresAt) {
      return {
        success: true,
        data: { access_token: tokenCache.token }
      };
    }

    const config = await getHotmartConfig();
    
    // Obtener credenciales de la configuración
    const clientId = config.api?.client_id;
    const clientSecret = config.api?.client_secret;
    
    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Credenciales de Hotmart API no configuradas'
      };
    }

    // Crear Authorization header básico
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Error obteniendo token de Hotmart', {
        status: response.status,
        error: errorText
      });
      return {
        success: false,
        error: `Error ${response.status}: ${errorText}`
      };
    }

    const tokenData: HotmartTokenResponse = await response.json();
    
    // Guardar en cache (expirar 5 minutos antes del tiempo real)
    tokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in - 300) * 1000
    };

    logger.info('Token de Hotmart obtenido exitosamente', {
      expires_in: tokenData.expires_in
    });

    return {
      success: true,
      data: tokenData
    };

  } catch (error) {
    logger.error('Error obteniendo token de Hotmart', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtener datos completos de una transacción desde Hotmart API
 */
export async function getTransactionData(transactionId: string): Promise<HotmartApiResponse> {
  try {
    // Obtener token de autenticación
    const tokenResult = await getHotmartAuthToken();
    
    if (!tokenResult.success || !tokenResult.data?.access_token) {
      return {
        success: false,
        error: 'No se pudo obtener token de autenticación: ' + tokenResult.error
      };
    }

    const token = tokenResult.data.access_token;

    // Consultar datos de la transacción
    const response = await fetch(`https://developers.hotmart.com/payments/api/v1/sales/users?transaction=${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Error consultando transacción en Hotmart', {
        transactionId,
        status: response.status,
        error: errorText
      });
      return {
        success: false,
        error: `Error ${response.status}: ${errorText}`
      };
    }

    const transactionData: HotmartTransactionResponse = await response.json();
    
    logger.info('Datos de transacción obtenidos exitosamente', {
      transactionId,
      totalUsers: transactionData.items[0]?.users?.length || 0
    });

    return {
      success: true,
      data: transactionData
    };

  } catch (error) {
    logger.error('Error obteniendo datos de transacción', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Extraer datos del comprador desde la respuesta de Hotmart API
 */
export function extractBuyerDataFromTransaction(transactionData: HotmartTransactionResponse): {
  nombre?: string;
  correo?: string;
  numero?: string;
  pais?: string;
} {
  try {
    const item = transactionData.items?.[0];
    if (!item?.users) {
      return {};
    }

    // Buscar el usuario con role "BUYER"
    const buyer = item.users.find(user => user.role === 'BUYER');
    if (!buyer?.user) {
      return {};
    }

    const user = buyer.user;
    
    // Extraer datos del comprador
    const buyerData = {
      nombre: user.name,
      correo: user.email,
      numero: user.phone || user.cellphone || undefined,
      pais: user.address?.country
    };

    logger.info('Datos del comprador extraídos', {
      hasName: !!buyerData.nombre,
      hasEmail: !!buyerData.correo,
      hasPhone: !!buyerData.numero,
      hasCountry: !!buyerData.pais
    });

    return buyerData;

  } catch (error) {
    logger.error('Error extrayendo datos del comprador', error);
    return {};
  }
}

/**
 * Función principal: Obtener datos faltantes del comprador
 * Usa la API de Hotmart cuando el webhook no incluye información completa
 */
export async function getCompleteBuyerData(transactionId: string, currentData: any): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  source: 'webhook' | 'hotmart_api';
}> {
  try {
    // Si ya tenemos datos completos del webhook, no necesitamos consultar la API
    if (currentData.numero && currentData.nombre && currentData.correo) {
      return {
        success: true,
        data: currentData,
        source: 'webhook'
      };
    }

    logger.info('Consultando API de Hotmart para datos faltantes', {
      transactionId,
      hasPhone: !!currentData.numero,
      hasName: !!currentData.nombre,
      hasEmail: !!currentData.correo
    });

    // Consultar API de Hotmart
    const apiResult = await getTransactionData(transactionId);
    
    if (!apiResult.success) {
      return {
        success: false,
        error: apiResult.error,
        source: 'hotmart_api'
      };
    }

    // Extraer datos del comprador
    const buyerData = extractBuyerDataFromTransaction(apiResult.data);
    
    // Combinar datos del webhook con datos de la API (prioridad a webhook)
    const completeData = {
      nombre: currentData.nombre || buyerData.nombre,
      correo: currentData.correo || buyerData.correo,
      numero: currentData.numero || buyerData.numero,
      pais: currentData.pais || buyerData.pais
    };

    logger.info('Datos completos del comprador obtenidos', {
      transactionId,
      finalHasPhone: !!completeData.numero,
      finalHasName: !!completeData.nombre,
      finalHasEmail: !!completeData.correo,
      source: 'combined'
    });

    return {
      success: true,
      data: completeData,
      source: 'hotmart_api'
    };

  } catch (error) {
    logger.error('Error obteniendo datos completos del comprador', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      source: 'hotmart_api'
    };
  }
}
