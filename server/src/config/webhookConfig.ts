import fs from 'fs';
import path from 'path';
import { 
  getWebhookConfigFromDB, 
  updateWebhookConfigInDB, 
  resetWebhookConfigInDB 
} from '../dbClient';

// Interfaz para la configuración de webhooks
export interface WebhookConfig {
  hotmart: {
    numericos: {
      CARRITOS: string;
      RECHAZADOS: string;
      COMPRAS: string;
      TICKETS: string;
    };
    flodesk: {
      CARRITOS: string;
      RECHAZADOS: string;
      COMPRAS: string;
      TICKETS: string;
    };
    tokens: {
      manychat: string;
      flodesk: string;
      telegram: string;
    };
    telegram: {
      groupChatId: string;
      threadId: string;
    };
  };
  // Aquí puedes agregar más plataformas en el futuro
  // stripe: { ... }
  // paypal: { ... }
}

// Configuración por defecto
const DEFAULT_CONFIG: WebhookConfig = {
  hotmart: {
    numericos: {
      CARRITOS: "content20250222080111_909145",
      RECHAZADOS: "content20250222082908_074257",
      COMPRAS: "content20250222083048_931507",
      TICKETS: "content20250222083004_157122"
    },
    flodesk: {
      CARRITOS: "112554445482493399",
      RECHAZADOS: "112554438393071296",
      COMPRAS: "112554427903116632",
      TICKETS: "147071027455723326"
    },
    tokens: {
      manychat: process.env.MANYCHAT_TOKEN || "288702267651723:f96a1f26344892df99c98292741de8c9",
      flodesk: process.env.FLODESK_TOKEN || "fd_key_62533317a47c4da09b593dbca41a5fe5.vVzT3lmlnQg1Q8arCbjKXnOyZDJQCDKINkBM9hocCsT7xrKUYxEFRd9j1IXkb4bkon89xZk8ozWNoCrmwRMsDQCEn3PCrfXJLVGEIXrI45LIa5ItnwfN8n9drHsEZdRR3417444zrfVVNznmrDdkWnNy8UCUGGpcPnJv4gtTRkgv14P9N5qScIZa8lb5FGqw",
      telegram: process.env.TELEGRAM_BOT_TOKEN || "8117750846:AAExGxB3Mbwv2YBb6b7rMAvP6vsIPeH8EIM"
    },
    telegram: {
      groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || "-1002176532359",
      threadId: process.env.TELEGRAM_THREAD_ID || "807"
    }
  }
};

// Ruta del archivo de configuración
const CONFIG_FILE = path.join(__dirname, '../../data/webhook-config.json');

// Función para cargar la configuración
export async function loadWebhookConfig(): Promise<WebhookConfig> {
  try {
    console.log('Cargando configuración desde base de datos...');
    
    // Intentar cargar desde la base de datos
    const dbConfig = await getWebhookConfigFromDB('hotmart');
    
    if (dbConfig && Object.keys(dbConfig).length > 0) {
      console.log('Configuración cargada exitosamente desde base de datos');
      
      // Construir la configuración completa
      const config: WebhookConfig = {
        hotmart: {
          numericos: dbConfig.numericos || DEFAULT_CONFIG.hotmart.numericos,
          flodesk: dbConfig.flodesk || DEFAULT_CONFIG.hotmart.flodesk,
          tokens: {
            ...DEFAULT_CONFIG.hotmart.tokens,
            ...dbConfig.tokens
          },
          telegram: {
            ...DEFAULT_CONFIG.hotmart.telegram,
            ...dbConfig.telegram
          }
        }
      };
      
      return config;
    } else {
      console.log('No hay configuración en BD, usando valores por defecto');
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error('Error cargando configuración desde BD, usando archivo local como fallback:', error);
    
    // Fallback al archivo local si la BD falla
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(configData);
        if (config.hotmart) {
          console.log('Configuración cargada desde archivo local como fallback');
          return config;
        }
      }
    } catch (fileError) {
      console.error('Error cargando archivo local:', fileError);
    }
    
    return DEFAULT_CONFIG;
  }
}

// Función para guardar la configuración
export function saveWebhookConfig(config: WebhookConfig): boolean {
  try {
    // Crear directorio si no existe
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error guardando configuración de webhooks:', error);
    return false;
  }
}

// Función para obtener configuración específica de Hotmart
export async function getHotmartConfig() {
  console.log('getHotmartConfig() llamado');
  const config = await loadWebhookConfig();
  console.log('Configuración cargada:', {
    hasTokens: !!config.hotmart.tokens,
    telegramToken: config.hotmart.tokens.telegram ? '***configurado***' : 'no configurado',
    groupChatId: config.hotmart.telegram.groupChatId,
    threadId: config.hotmart.telegram.threadId
  });
  return config.hotmart;
}

// Función para actualizar configuración específica de Hotmart
export async function updateHotmartConfig(hotmartConfig: WebhookConfig['hotmart']): Promise<boolean> {
  try {
    console.log('Actualizando configuración de Hotmart en BD...');
    
    // Actualizar cada sección en la base de datos
    const numericosSuccess = await updateWebhookConfigInDB('hotmart', 'numericos', hotmartConfig.numericos, 'system');
    const flodeskSuccess = await updateWebhookConfigInDB('hotmart', 'flodesk', hotmartConfig.flodesk, 'system');
    const tokensSuccess = await updateWebhookConfigInDB('hotmart', 'tokens', hotmartConfig.tokens, 'system');
    const telegramSuccess = await updateWebhookConfigInDB('hotmart', 'telegram', hotmartConfig.telegram, 'system');
    
    const allSuccess = numericosSuccess && flodeskSuccess && tokensSuccess && telegramSuccess;
    
    if (allSuccess) {
      console.log('Configuración de Hotmart actualizada exitosamente en BD');
    } else {
      console.error('Error actualizando alguna sección de la configuración');
    }
    
    return allSuccess;
  } catch (error) {
    console.error('Error actualizando configuración de Hotmart:', error);
    return false;
  }
}

// Función para validar y fusionar configuración sin perder datos existentes
function validateAndMergeConfig(existingConfigData: string): WebhookConfig {
  try {
    // Intentar parsear la configuración existente
    let existingConfig;
    try {
      existingConfig = JSON.parse(existingConfigData);
    } catch {
      existingConfig = {};
    }

    // Crear configuración base con valores por defecto
    const mergedConfig = { ...DEFAULT_CONFIG };

    // Fusionar con configuración existente, preservando tokens y configuraciones importantes
    if (existingConfig.hotmart) {
      // Preservar tokens existentes si están configurados
      if (existingConfig.hotmart.tokens) {
        mergedConfig.hotmart.tokens = {
          ...mergedConfig.hotmart.tokens,
          ...existingConfig.hotmart.tokens
        };
      }

      // Preservar configuración de Telegram existente
      if (existingConfig.hotmart.telegram) {
        mergedConfig.hotmart.telegram = {
          ...mergedConfig.hotmart.telegram,
          ...existingConfig.hotmart.telegram
        };
      }

      // Preservar IDs de flujo si están configurados
      if (existingConfig.hotmart.numericos) {
        mergedConfig.hotmart.numericos = {
          ...mergedConfig.hotmart.numericos,
          ...existingConfig.hotmart.numericos
        };
      }

      if (existingConfig.hotmart.flodesk) {
        mergedConfig.hotmart.flodesk = {
          ...mergedConfig.hotmart.flodesk,
          ...existingConfig.hotmart.flodesk
        };
      }
    }

    console.log('Configuración fusionada exitosamente, preservando datos existentes');
    return mergedConfig;
  } catch (error) {
    console.error('Error fusionando configuración:', error);
    return DEFAULT_CONFIG;
  }
}

// Función para resetear a configuración por defecto
export async function resetToDefault(): Promise<boolean> {
  try {
    console.log('Reseteando configuración de Hotmart a valores por defecto...');
    const success = await resetWebhookConfigInDB('hotmart');
    
    if (success) {
      console.log('Configuración reseteada exitosamente en BD');
    } else {
      console.error('Error reseteando configuración en BD');
    }
    
    return success;
  } catch (error) {
    console.error('Error reseteando configuración:', error);
    return false;
  }
}
