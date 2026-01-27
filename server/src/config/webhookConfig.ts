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
      CARRITOS?: string;
      RECHAZADOS?: string;
      COMPRAS?: string;
      TICKETS?: string;
    };
    flodesk: {
      CARRITOS?: string;
      RECHAZADOS?: string;
      COMPRAS?: string;
      TICKETS?: string;
    };
    tokens: {
      manychat?: string;
      flodesk?: string;
      telegram?: string;
    };
    telegram: {
      groupChatId?: string;
      threadId?: string;
      botName?: string;
      botUsername?: string;
    };
    api?: {
      client_id?: string;
      client_secret?: string;
    };
  };
  soporte: {
    phoneNumbers: {
      academySupport?: string; // Número para clientes que ya compraron
    };
    pageConfig?: {
      title?: string;
      subtitle?: string;
      primaryColor?: string;
    };
  };
  pagosExternos: {
    telegram: {
      groupChatId?: string; // ID del grupo de Telegram para pagos externos
      threadId?: string; // ID del tema/hilo dentro del grupo
    };
  };
  cuposVip: {
    telegram: {
      groupChatId?: string; // ID del grupo de Telegram para cupos VIP
      threadId?: string; // ID del tema/hilo dentro del grupo
    };
  };
  // Aquí puedes agregar más plataformas en el futuro
  // stripe: { ... }
  // paypal: { ... }
}



// Ruta del archivo de configuración
const CONFIG_FILE = path.join(__dirname, '../../data/webhook-config.json');

// Función para cargar la configuración
export async function loadWebhookConfig(): Promise<WebhookConfig> {
  try {
    console.log('Cargando configuración ÚNICAMENTE desde base de datos...');
    
    // Cargar configuración desde la base de datos
    const hotmartConfig = await getWebhookConfigFromDB('hotmart');
    
    // Intentar cargar configuración de soporte también
    let soporteConfig;
    try {
      soporteConfig = await getWebhookConfigFromDB('soporte');
    } catch (error) {
      console.log('No hay configuración de soporte en BD, usando vacía');
      soporteConfig = {};
    }
    
    // Intentar cargar configuración de pagos externos
    let pagosExternosConfig;
    try {
      pagosExternosConfig = await getWebhookConfigFromDB('pagosExternos');
    } catch (error) {
      console.log('No hay configuración de pagos externos en BD, usando vacía');
      pagosExternosConfig = {};
    }
    
    // Intentar cargar configuración de cupos VIP
    let cuposVipConfig;
    try {
      cuposVipConfig = await getWebhookConfigFromDB('cuposVip');
    } catch (error) {
      console.log('No hay configuración de cupos VIP en BD, usando vacía');
      cuposVipConfig = {};
    }
    
    if (hotmartConfig && Object.keys(hotmartConfig).length > 0) {
      console.log('Configuración cargada exitosamente desde base de datos');
      
      // Usar valores de la base de datos
      const config: WebhookConfig = {
        hotmart: {
          numericos: hotmartConfig.numericos || {},
          flodesk: hotmartConfig.flodesk || {},
          tokens: hotmartConfig.tokens || {},
          telegram: hotmartConfig.telegram || {},
          api: hotmartConfig.api || {}
        },
        soporte: {
          phoneNumbers: soporteConfig?.phoneNumbers || {},
          pageConfig: soporteConfig?.pageConfig || undefined
        },
        pagosExternos: {
          telegram: pagosExternosConfig?.telegram || {}
        },
        cuposVip: {
          telegram: cuposVipConfig?.telegram || {}
        }
      };
      
      return config;
    } else {
      console.log('No hay configuración en BD, devolviendo configuración vacía');
      // Devolver configuración vacía en lugar de defaults
      return {
        hotmart: {
          numericos: {},
          flodesk: {},
          tokens: {},
          telegram: {},
          api: {}
        },
        soporte: {
          phoneNumbers: {},
          pageConfig: undefined
        },
        pagosExternos: {
          telegram: {}
        },
        cuposVip: {
          telegram: {}
        }
      };
    }
  } catch (error) {
    console.error('Error cargando configuración desde BD:', error);
    // No usar fallbacks, solo log del error
    throw new Error(`No se pudo cargar la configuración desde la base de datos: ${error}`);
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
    
    // Actualizar cada sección individualmente con manejo de errores individual
    const updateResults = {
      numericos: false,
      flodesk: false,
      tokens: false,
      telegram: false,
      api: false
    };

    // Intentar actualizar numericos
    try {
      updateResults.numericos = await updateWebhookConfigInDB('hotmart', 'numericos', hotmartConfig.numericos, 'system');
      console.log('Sección numericos actualizada:', updateResults.numericos);
    } catch (error) {
      console.error('Error actualizando numericos:', error);
    }

    // Intentar actualizar flodesk
    try {
      updateResults.flodesk = await updateWebhookConfigInDB('hotmart', 'flodesk', hotmartConfig.flodesk, 'system');
      console.log('Sección flodesk actualizada:', updateResults.flodesk);
    } catch (error) {
      console.error('Error actualizando flodesk:', error);
    }

    // Intentar actualizar tokens
    try {
      updateResults.tokens = await updateWebhookConfigInDB('hotmart', 'tokens', hotmartConfig.tokens, 'system');
      console.log('Sección tokens actualizada:', updateResults.tokens);
    } catch (error) {
      console.error('Error actualizando tokens:', error);
    }

    // Intentar actualizar telegram
    try {
      updateResults.telegram = await updateWebhookConfigInDB('hotmart', 'telegram', hotmartConfig.telegram, 'system');
      console.log('Sección telegram actualizada:', updateResults.telegram);
    } catch (error) {
      console.error('Error actualizando telegram:', error);
    }

    // Intentar actualizar api
    try {
      updateResults.api = await updateWebhookConfigInDB('hotmart', 'api', hotmartConfig.api, 'system');
      console.log('Sección api actualizada:', updateResults.api);
    } catch (error) {
      console.error('Error actualizando api:', error);
    }
    
    const allSuccess = updateResults.numericos && updateResults.flodesk && updateResults.tokens && updateResults.telegram && updateResults.api;
    const someSuccess = updateResults.numericos || updateResults.flodesk || updateResults.tokens || updateResults.telegram || updateResults.api;
    
    if (allSuccess) {
      console.log('Configuración de Hotmart actualizada exitosamente en BD');
    } else if (someSuccess) {
      console.warn('Configuración parcialmente actualizada. Resultados:', updateResults);
    } else {
      console.error('Error actualizando todas las secciones de la configuración');
    }
    
    // Retornar true si al menos una sección se actualizó correctamente
    return someSuccess;
  } catch (error) {
    console.error('Error actualizando configuración de Hotmart:', error);
    return false;
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

// Función para obtener configuración específica de Soporte
export async function getSoporteConfig() {
  console.log('getSoporteConfig() llamado');
  const config = await loadWebhookConfig();
  console.log('Configuración de soporte cargada:', {
    hasPhoneNumbers: !!config.soporte.phoneNumbers,
    academySupport: config.soporte.phoneNumbers.academySupport ? '***configurado***' : 'no configurado'
  });
  return config.soporte;
}

// Función para actualizar configuración específica de Soporte
export async function updateSoporteConfig(soporteConfig: WebhookConfig['soporte']): Promise<boolean> {
  try {
    console.log('Actualizando configuración de Soporte en BD...');
    
    // Actualizar configuración de soporte - phoneNumbers
    let updateResult = false;
    try {
      updateResult = await updateWebhookConfigInDB('soporte', 'phoneNumbers', soporteConfig.phoneNumbers, 'system');
      console.log('Sección phoneNumbers actualizada:', updateResult);
    } catch (error) {
      console.error('Error actualizando phoneNumbers:', error);
    }
    
    // Actualizar configuración de la página si existe
    if (soporteConfig.pageConfig) {
      try {
        const pageConfigResult = await updateWebhookConfigInDB('soporte', 'pageConfig', soporteConfig.pageConfig, 'system');
        console.log('Sección pageConfig actualizada:', pageConfigResult);
        updateResult = updateResult && pageConfigResult;
      } catch (error) {
        console.error('Error actualizando pageConfig:', error);
      }
    }
    
    if (updateResult) {
      console.log('Configuración de Soporte actualizada exitosamente en BD');
    } else {
      console.error('Error actualizando configuración de Soporte');
    }
    
    return updateResult;
  } catch (error) {
    console.error('Error actualizando configuración de Soporte:', error);
    return false;
  }
}

// Función para obtener configuración específica de Pagos Externos
export async function getPagosExternosConfig() {
  console.log('getPagosExternosConfig() llamado');
  const config = await loadWebhookConfig();
  console.log('Configuración de pagos externos cargada:', {
    hasTelegram: !!config.pagosExternos.telegram,
    groupChatId: config.pagosExternos.telegram.groupChatId ? '***configurado***' : 'no configurado',
    threadId: config.pagosExternos.telegram.threadId ? '***configurado***' : 'no configurado'
  });
  return config.pagosExternos;
}

// Función para obtener configuración específica de Cupos VIP
export async function getCuposVipConfig() {
  console.log('getCuposVipConfig() llamado');
  const config = await loadWebhookConfig();
  console.log('Configuración de cupos VIP cargada:', {
    hasTelegram: !!config.cuposVip.telegram,
    groupChatId: config.cuposVip.telegram.groupChatId ? '***configurado***' : 'no configurado',
    threadId: config.cuposVip.telegram.threadId ? '***configurado***' : 'no configurado'
  });
  return config.cuposVip;
}

// Función para actualizar configuración específica de Cupos VIP
export async function updateCuposVipConfig(cuposVipConfig: WebhookConfig['cuposVip']): Promise<boolean> {
  try {
    console.log('Actualizando configuración de Cupos VIP en BD...');
    
    // Actualizar configuración de telegram
    let updateResult = false;
    try {
      updateResult = await updateWebhookConfigInDB('cuposVip', 'telegram', cuposVipConfig.telegram, 'system');
      console.log('Sección telegram actualizada:', updateResult);
    } catch (error) {
      console.error('Error actualizando telegram:', error);
    }
    
    if (updateResult) {
      console.log('Configuración de Cupos VIP actualizada exitosamente en BD');
    } else {
      console.error('Error actualizando configuración de Cupos VIP');
    }
    
    return updateResult;
  } catch (error) {
    console.error('Error actualizando configuración de Cupos VIP:', error);
    return false;
  }
}

// Función para actualizar configuración específica de Pagos Externos
export async function updatePagosExternosConfig(pagosExternosConfig: WebhookConfig['pagosExternos']): Promise<boolean> {
  try {
    console.log('Actualizando configuración de Pagos Externos en BD...');
    
    // Actualizar configuración de telegram
    let updateResult = false;
    try {
      updateResult = await updateWebhookConfigInDB('pagosExternos', 'telegram', pagosExternosConfig.telegram, 'system');
      console.log('Sección telegram actualizada:', updateResult);
    } catch (error) {
      console.error('Error actualizando telegram:', error);
    }
    
    if (updateResult) {
      console.log('Configuración de Pagos Externos actualizada exitosamente en BD');
    } else {
      console.error('Error actualizando configuración de Pagos Externos');
    }
    
    return updateResult;
  } catch (error) {
    console.error('Error actualizando configuración de Pagos Externos:', error);
    return false;
  }
}
