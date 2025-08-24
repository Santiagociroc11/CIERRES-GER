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
    mailer: {
      CARRITOS: string;
      RECHAZADOS: string;
      COMPRAS: string;
      TICKETS: string;
    };
    tablas: {
      CARRITOS: string;
      RECHAZADOS: string;
      COMPRAS: string;
      TICKETS: string;
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
    mailer: {
      CARRITOS: "112554445482493399",
      RECHAZADOS: "112554438393071296",
      COMPRAS: "112554427903116632",
      TICKETS: "147071027455723326"
    },
    tablas: {
      CARRITOS: "FECHA_ABANDONADO",
      RECHAZADOS: "FECHA_RECHAZADO",
      COMPRAS: "FECHA_COMPRA",
      TICKETS: "FECHA_TICKET"
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
    if (!config.hotmart || !config.hotmart.numericos || !config.hotmart.mailer || !config.hotmart.tablas) {
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
