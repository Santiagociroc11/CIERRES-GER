/**
 * 🤖 TELEGRAM BOT SERVICE (Webhook-based)
 * 
 * Bot de Telegram que responde a comandos /start y /autoid para ayudar a los asesores
 * a obtener su ID de Telegram y configurarlo en el sistema.
 * 
 * Usa webhooks (no polling) para recibir mensajes.
 */

import { getHotmartConfig } from '../config/webhookConfig';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
    entities?: Array<{
      offset: number;
      length: number;
      type: string;
    }>;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
    };
    data: string;
  };
}

class TelegramBot {
  private botToken: string | null = null;

  constructor() {
    this.initializeBot();
  }

  /**
   * Inicializar el bot obteniendo el token de la configuración
   */
  private async initializeBot() {
    try {
      console.log('🔧 [TelegramBot] Iniciando inicialización del bot...');
      const config = await getHotmartConfig();
      this.botToken = config.tokens.telegram || null;
      
      if (!this.botToken) {
        console.warn('⚠️ [TelegramBot] Token no configurado en webhookconfig');
        console.warn('⚠️ [TelegramBot] Configura el token en la sección de configuración de webhooks');
        return;
      }

      console.log(`✅ [TelegramBot] Token cargado (longitud: ${this.botToken.length} caracteres)`);

      // Verificar información del bot
      try {
        console.log('🔍 [TelegramBot] Verificando información del bot con Telegram API...');
        const botInfo = await this.getBotInfo();
        console.log(`✅ [TelegramBot] Bot conectado correctamente:`);
        console.log(`   - Username: @${botInfo.username}`);
        console.log(`   - Nombre: ${botInfo.first_name}`);
        console.log(`   - ID: ${botInfo.id}`);
      } catch (error) {
        console.error('❌ [TelegramBot] Error obteniendo info del bot:', error);
        console.error('❌ [TelegramBot] El token podría ser inválido o hay un problema de conexión');
      }
    } catch (error) {
      console.error('❌ [TelegramBot] Error inicializando bot:', error);
    }
  }

  /**
   * Obtener información del bot
   */
  private async getBotInfo() {
    if (!this.botToken) {
      throw new Error('Token no configurado');
    }

    console.log('📡 [TelegramBot] Llamando a Telegram API: getMe');
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
    const data = await response.json();
    
    if (!data.ok) {
      console.error(`❌ [TelegramBot] Error en getMe: ${data.error_code} - ${data.description}`);
      throw new Error(`Error obteniendo info del bot: ${data.description}`);
    }
    
    console.log(`✅ [TelegramBot] Respuesta de getMe recibida correctamente`);
    return data.result;
  }

  /**
   * Procesar un update recibido desde webhook
   */
  async processWebhookUpdate(update: TelegramUpdate): Promise<void> {
    try {
      console.log(`🔍 [TelegramBot] Procesando update ${update.update_id}...`);
      
      // Manejar callback_query (botones inline)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message?.chat.id;
        const userId = callbackQuery.from.id;
        const firstName = callbackQuery.from.first_name;
        const data = callbackQuery.data;
        
        if (!chatId) {
          console.warn(`⚠️ [TelegramBot] Callback query sin chat ID`);
          return;
        }
        
        console.log(`🔘 [TelegramBot] Callback query recibido:`);
        console.log(`   - Update ID: ${update.update_id}`);
        console.log(`   - Callback ID: ${callbackQuery.id}`);
        console.log(`   - De: ${firstName} (${userId})`);
        console.log(`   - Chat ID: ${chatId}`);
        console.log(`   - Data: "${data}"`);
        
        // Responder al callback para quitar el "cargando" del botón
        await this.answerCallbackQuery(callbackQuery.id);
        
        // Procesar el callback
        await this.handleCallbackQuery(chatId, data, firstName, userId);
        return;
      }
      
      // Manejar mensajes de texto
      const message = update.message;
      if (!message) {
        console.log(`⚠️ [TelegramBot] Update ${update.update_id} no tiene mensaje ni callback_query`);
        return;
      }
      
      if (!message.text) {
        console.log(`⚠️ [TelegramBot] Mensaje ${message.message_id} no tiene texto (puede ser foto, sticker, etc.)`);
        return;
      }

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text.trim();
      const firstName = message.from.first_name;

      console.log(`📨 [TelegramBot] Mensaje recibido:`);
      console.log(`   - Update ID: ${update.update_id}`);
      console.log(`   - Message ID: ${message.message_id}`);
      console.log(`   - De: ${firstName} (${userId})`);
      console.log(`   - Chat ID: ${chatId}`);
      console.log(`   - Texto: "${text}"`);

      // Responder a comandos
      if (text.startsWith('/')) {
        console.log(`🔧 [TelegramBot] Comando detectado: "${text}"`);
        await this.handleCommand(chatId, text, firstName, userId);
      } else {
        console.log(`💬 [TelegramBot] Mensaje de texto normal (no es comando), ignorando`);
      }
    } catch (error) {
      console.error(`❌ [TelegramBot] Error procesando update ${update.update_id}:`, error);
      if (error instanceof Error) {
        console.error(`   Stack: ${error.stack}`);
      }
    }
  }

  /**
   * Responder a un callback query (quitar el estado "cargando" del botón)
   */
  private async answerCallbackQuery(callbackQueryId: string) {
    if (!this.botToken) return;

    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId
        })
      });
    } catch (error) {
      console.error('❌ [TelegramBot] Error respondiendo callback query:', error);
    }
  }

  /**
   * Manejar callback queries (botones inline)
   */
  private async handleCallbackQuery(chatId: number, data: string, firstName: string, userId: number) {
    console.log(`🔘 [TelegramBot] Procesando callback: ${data}`);
    
    switch (data) {
      case 'get_autoid':
        await this.sendAutoIdMessage(chatId, firstName, userId);
        break;
      
      case 'help':
        await this.sendHelpMessage(chatId);
        break;
      
      case 'start_menu':
        await this.sendStartMessage(chatId, firstName);
        break;
      
      default:
        console.warn(`⚠️ [TelegramBot] Callback desconocido: ${data}`);
        break;
    }
  }

  /**
   * Manejar comandos del bot
   */
  private async handleCommand(chatId: number, command: string, firstName: string, userId: number) {
    try {
      // Extraer el comando base (sin parámetros) y convertir a minúsculas
      const commandBase = command.toLowerCase().split(' ')[0].split('@')[0];
      
      console.log(`🔧 [TelegramBot] Ejecutando comando: ${commandBase}`);
      
      switch (commandBase) {
      case '/start':
        await this.sendStartMessage(chatId, firstName);
        break;
      
      case '/autoid':
        await this.sendAutoIdMessage(chatId, firstName, userId);
        break;
      
      case '/help':
        await this.sendHelpMessage(chatId);
        break;
      
      default:
        await this.sendUnknownCommandMessage(chatId);
        break;
      }
    } catch (error) {
      console.error(`❌ [TelegramBot] Error en handleCommand:`, error);
      await this.sendMessage(chatId, '❌ Ocurrió un error al procesar tu comando. Por favor, intenta nuevamente.');
    }
  }

  /**
   * Enviar mensaje de bienvenida
   */
  private async sendStartMessage(chatId: number, firstName: string) {
    const config = await getHotmartConfig();
    const botName = config.telegram?.botName || 'este bot';
    
    const message = `👋 ¡Hola ${firstName}!

🤖 Soy ${botName} para ayudarte a configurar tu ID de Telegram.

📋 **Comandos disponibles:**
• \`/autoid\` - Obtener tu ID de Telegram
• \`/help\` - Ver esta ayuda

💡 **¿Para qué sirve?**
Con tu ID de Telegram podrás recibir notificaciones automáticas cuando tengas nuevos clientes asignados.

🚀 **¡Presiona el botón de abajo para obtener tu ID!**`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🆔 Obtener mi ID de Telegram',
            callback_data: 'get_autoid'
          }
        ],
        [
          {
            text: '❓ Ayuda',
            callback_data: 'help'
          }
        ]
      ]
    };

    await this.sendMessage(chatId, message, 'Markdown', replyMarkup);
  }

  /**
   * Enviar mensaje con el ID de Telegram del usuario
   */
  private async sendAutoIdMessage(chatId: number, firstName: string, userId: number) {
    const config = await getHotmartConfig();
    
    const message = `🆔 **Tu ID de Telegram es:**

\`${userId}\`

📋 **Instrucciones:**
1. **Copia** el número de arriba (toca para seleccionar)
2. Ve al sistema web
3. Pega el número en el campo "ID de Telegram"
4. ¡Listo! Ya recibirás notificaciones automáticas

✅ **¡${firstName}, ya puedes configurar tu ID en el sistema!**

💡 **Nota:** Este es tu ID único de Telegram que nunca cambia.`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🔄 Obtener ID nuevamente',
            callback_data: 'get_autoid'
          }
        ],
        [
          {
            text: '🏠 Menú principal',
            callback_data: 'start_menu'
          }
        ]
      ]
    };

    await this.sendMessage(chatId, message, 'Markdown', replyMarkup);
  }

  /**
   * Enviar mensaje de ayuda
   */
  private async sendHelpMessage(chatId: number) {
    const config = await getHotmartConfig();
    const botName = config.telegram?.botName || 'Bot de ayuda';
    
    const message = `🆘 **Ayuda - ${botName}**

📋 **Comandos disponibles:**
• \`/start\` - Mensaje de bienvenida
• \`/autoid\` - Obtener tu ID de Telegram
• \`/help\` - Ver esta ayuda

🤔 **¿Qué hace este bot?**
Te ayuda a obtener tu ID de Telegram para configurarlo en el sistema y recibir notificaciones automáticas de nuevos clientes.

🚀 **Usa los botones de abajo o escribe** \`/autoid\``;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🆔 Obtener mi ID',
            callback_data: 'get_autoid'
          }
        ],
        [
          {
            text: '🏠 Menú principal',
            callback_data: 'start_menu'
          }
        ]
      ]
    };

    await this.sendMessage(chatId, message, 'Markdown', replyMarkup);
  }

  /**
   * Enviar mensaje de comando desconocido
   */
  private async sendUnknownCommandMessage(chatId: number) {
    const message = `❓ **Comando no reconocido**

📋 **Comandos disponibles:**
• \`/autoid\` - Obtener tu ID de Telegram
• \`/help\` - Ver ayuda

💡 Escribe \`/autoid\` para obtener tu ID.`;

    await this.sendMessage(chatId, message, 'Markdown');
  }

  /**
   * Enviar mensaje a un chat
   */
  private async sendMessage(
    chatId: number, 
    text: string, 
    parseMode: string = 'Markdown',
    replyMarkup?: any
  ) {
    if (!this.botToken) {
      console.error('❌ [TelegramBot] No hay token configurado, no se puede enviar mensaje');
      return;
    }

    try {
      console.log(`📤 [TelegramBot] Enviando mensaje a chat ${chatId}...`);
      if (replyMarkup) {
        console.log(`📤 [TelegramBot] Incluyendo menú con botones`);
      }
      
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      };
      
      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }
      
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!data.ok) {
        console.error('❌ [TelegramBot] Error enviando mensaje:', data);
        console.error('❌ [TelegramBot] Detalles:', JSON.stringify(data, null, 2));
      } else {
        console.log(`✅ [TelegramBot] Mensaje enviado exitosamente a chat ${chatId}`);
      }
    } catch (error) {
      console.error('❌ [TelegramBot] Error enviando mensaje:', error);
    }
  }

  /**
   * Configurar webhook en Telegram
   */
  async setWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    console.log(`🔧 [TelegramBot] setWebhook llamado con URL: ${webhookUrl}`);
    
    if (!this.botToken) {
      console.error('❌ [TelegramBot] No se puede configurar webhook: token no configurado');
      return {
        success: false,
        message: 'Token no configurado'
      };
    }

    // Validar que la URL sea HTTPS
    if (!webhookUrl.startsWith('https://')) {
      console.error(`❌ [TelegramBot] URL inválida: debe ser HTTPS (recibida: ${webhookUrl})`);
      return {
        success: false,
        message: 'La URL del webhook debe ser HTTPS (requisito de Telegram)'
      };
    }

    try {
      console.log('📡 [TelegramBot] Llamando a Telegram API: setWebhook');
      console.log(`   URL: ${webhookUrl}`);
      console.log(`   Token: ${this.botToken.substring(0, 10)}...`);
      
      const requestBody = {
        url: webhookUrl,
        drop_pending_updates: true
      };
      
      console.log(`📤 [TelegramBot] Enviando request:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      console.log(`📥 [TelegramBot] Respuesta de setWebhook:`, JSON.stringify(data, null, 2));
      
      if (data.ok) {
        console.log(`✅ [TelegramBot] Webhook configurado exitosamente: ${webhookUrl}`);
        console.log(`✅ [TelegramBot] Telegram ahora enviará updates a: ${webhookUrl}`);
        
        // Verificar que quedó configurado correctamente
        const verifyInfo = await this.getWebhookInfo();
        if (verifyInfo?.url === webhookUrl) {
          console.log(`✅ [TelegramBot] Webhook verificado: ${verifyInfo.url}`);
        } else {
          console.warn(`⚠️ [TelegramBot] Webhook configurado pero verificación no coincide`);
        }
        
        return {
          success: true,
          message: `Webhook configurado exitosamente: ${webhookUrl}`
        };
      } else {
        console.error('❌ [TelegramBot] Error configurando webhook:');
        console.error(`   Código: ${data.error_code}`);
        console.error(`   Descripción: ${data.description}`);
        console.error(`   Parámetros: ${JSON.stringify(data.parameters || {})}`);
        return {
          success: false,
          message: `Error: ${data.description || 'Error desconocido'}`
        };
      }
    } catch (error) {
      console.error('❌ [TelegramBot] Error de conexión configurando webhook:', error);
      return {
        success: false,
        message: `Error de conexión: ${error}`
      };
    }
  }

  /**
   * Obtener información del webhook actual
   */
  async getWebhookInfo(): Promise<{ url?: string; pending_update_count?: number } | null> {
    if (!this.botToken) {
      console.warn('⚠️ [TelegramBot] No se puede obtener info del webhook: token no configurado');
      return null;
    }

    try {
      console.log('📡 [TelegramBot] Llamando a Telegram API: getWebhookInfo');
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getWebhookInfo`);
      const data = await response.json();
      
      console.log(`📥 [TelegramBot] Respuesta de getWebhookInfo:`, JSON.stringify(data, null, 2));
      
      if (data.ok) {
        const result = data.result;
        if (result.url) {
          console.log(`✅ [TelegramBot] Webhook configurado: ${result.url}`);
          console.log(`   - Updates pendientes: ${result.pending_update_count || 0}`);
          console.log(`   - Último error: ${result.last_error_message || 'ninguno'}`);
          console.log(`   - Última fecha de error: ${result.last_error_date || 'nunca'}`);
        } else {
          console.log(`⚠️ [TelegramBot] No hay webhook configurado`);
        }
        return result;
      }
      return null;
    } catch (error) {
      console.error('❌ [TelegramBot] Error obteniendo info del webhook:', error);
      return null;
    }
  }

  /**
   * Eliminar webhook
   */
  async deleteWebhook(): Promise<{ success: boolean; message: string }> {
    if (!this.botToken) {
      return {
        success: false,
        message: 'Token no configurado'
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`, {
        method: 'POST',
        body: JSON.stringify({ drop_pending_updates: true })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ [TelegramBot] Webhook eliminado exitosamente');
        return {
          success: true,
          message: 'Webhook eliminado exitosamente'
        };
      } else {
        return {
          success: false,
          message: `Error: ${data.description || 'Error desconocido'}`
        };
      }
    } catch (error) {
      console.error('❌ [TelegramBot] Error eliminando webhook:', error);
      return {
        success: false,
        message: `Error de conexión: ${error}`
      };
    }
  }

  /**
   * Obtener estado del bot
   */
  getStatus() {
    return {
      hasToken: !!this.botToken
    };
  }

  /**
   * Recargar token desde la configuración
   */
  async reloadToken() {
    try {
      const config = await getHotmartConfig();
      this.botToken = config.tokens.telegram || null;
      return !!this.botToken;
    } catch (error) {
      console.error('❌ [TelegramBot] Error recargando token:', error);
      return false;
    }
  }

  /**
   * Auto-configurar webhook usando URL pública
   */
  async autoConfigureWebhook(publicUrl: string): Promise<{ success: boolean; message: string }> {
    console.log(`🔧 [TelegramBot] autoConfigureWebhook llamado con URL pública: ${publicUrl}`);
    
    if (!this.botToken) {
      console.error('❌ [TelegramBot] No se puede auto-configurar: token no configurado');
      return {
        success: false,
        message: 'Token no configurado'
      };
    }

    // Limpiar la URL pública (remover trailing slash si existe)
    const cleanPublicUrl = publicUrl.replace(/\/$/, '');
    const webhookUrl = `${cleanPublicUrl}/webhook/telegram`;
    
    console.log(`🔍 [TelegramBot] Verificando webhook actual...`);
    
    // Verificar si ya está configurado con la misma URL
    const currentWebhook = await this.getWebhookInfo();
    
    if (currentWebhook?.url) {
      console.log(`🔍 [TelegramBot] Webhook actual detectado: ${currentWebhook.url}`);
      
      if (currentWebhook.url === webhookUrl) {
        console.log(`✅ [TelegramBot] Webhook ya está configurado correctamente: ${webhookUrl}`);
        console.log(`   No es necesario reconfigurar.`);
        return {
          success: true,
          message: `Webhook ya estaba configurado: ${webhookUrl}`
        };
      } else {
        console.log(`⚠️ [TelegramBot] Webhook configurado con URL diferente:`);
        console.log(`   Actual: ${currentWebhook.url}`);
        console.log(`   Esperado: ${webhookUrl}`);
        console.log(`   Reconfigurando...`);
      }
    } else {
      console.log(`⚠️ [TelegramBot] No hay webhook configurado actualmente`);
      console.log(`   Configurando nuevo webhook...`);
    }
    
    console.log(`🔧 [TelegramBot] Auto-configurando webhook: ${webhookUrl}`);
    
    return await this.setWebhook(webhookUrl);
  }
}

// Crear instancia única del bot
const telegramBot = new TelegramBot();

export default telegramBot;
