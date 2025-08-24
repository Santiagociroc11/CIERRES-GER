import fs from 'fs';
import path from 'path';

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
export function loadWebhookConfig(): WebhookConfig {
  try {
    // Crear directorio si no existe
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Si el archivo no existe, crear con configuración por defecto
    if (!fs.existsSync(CONFIG_FILE)) {
      saveWebhookConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    
    // Validar que el archivo no esté vacío
    if (!configData.trim()) {
      console.warn('Archivo de configuración vacío, usando configuración por defecto');
      saveWebhookConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    
    let config;
    try {
      config = JSON.parse(configData);
    } catch (parseError) {
      console.error('Error parseando configuración JSON:', parseError);
      saveWebhookConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    
    // Validar que la configuración tenga la estructura correcta
    if (!config.hotmart || !config.hotmart.numericos || !config.hotmart.flodesk || !config.hotmart.tokens || !config.hotmart.telegram) {
      console.warn('Configuración inválida, usando configuración por defecto');
      saveWebhookConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    return config;
  } catch (error) {
    console.error('Error cargando configuración de webhooks:', error);
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
export function getHotmartConfig() {
  const config = loadWebhookConfig();
  return config.hotmart;
}

// Función para actualizar configuración específica de Hotmart
export function updateHotmartConfig(hotmartConfig: WebhookConfig['hotmart']): boolean {
  try {
    const config = loadWebhookConfig();
    config.hotmart = hotmartConfig;
    return saveWebhookConfig(config);
  } catch (error) {
    console.error('Error actualizando configuración de Hotmart:', error);
    return false;
  }
}

// Función para resetear a configuración por defecto
export function resetToDefault(): boolean {
  return saveWebhookConfig(DEFAULT_CONFIG);
}
