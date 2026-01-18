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
      const config = await getHotmartConfig();
      this.botToken = config.tokens.telegram || null;
      
      if (!this.botToken) {
        console.warn('⚠️ [TelegramBot] Token no configurado en webhookconfig');
        return;
      }

      // Verificar información del bot
      try {
        const botInfo = await this.getBotInfo();
        console.log(`✅ [TelegramBot] Bot conectado: @${botInfo.username} (${botInfo.first_name})`);
      } catch (error) {
        console.error('❌ [TelegramBot] Error obteniendo info del bot:', error);
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

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Error obteniendo info del bot: ${data.description}`);
    }
    
    return data.result;
  }

  /**
   * Procesar un update recibido desde webhook
   */
  async processWebhookUpdate(update: TelegramUpdate): Promise<void> {
    try {
      const message = update.message;
      if (!message || !message.text) return;

      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text.trim();
      const firstName = message.from.first_name;

      console.log(`📨 [TelegramBot] Mensaje recibido de ${firstName} (${userId}): "${text}"`);

      // Responder a comandos
      if (text.startsWith('/')) {
        console.log(`🔧 [TelegramBot] Comando detectado: "${text}"`);
        await this.handleCommand(chatId, text, firstName, userId);
      }
    } catch (error) {
      console.error(`❌ [TelegramBot] Error procesando update ${update.update_id}:`, error);
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

🚀 **¡Escribe** \`/autoid\` **para comenzar!**`;

    await this.sendMessage(chatId, message, 'Markdown');
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

    await this.sendMessage(chatId, message, 'Markdown');
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

🚀 **Usar:** \`/autoid\``;

    await this.sendMessage(chatId, message, 'Markdown');
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
  private async sendMessage(chatId: number, text: string, parseMode: string = 'Markdown') {
    if (!this.botToken) {
      console.error('❌ [TelegramBot] No hay token configurado, no se puede enviar mensaje');
      return;
    }

    try {
      console.log(`📤 [TelegramBot] Enviando mensaje a chat ${chatId}...`);
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true
        })
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
    if (!this.botToken) {
      return {
        success: false,
        message: 'Token no configurado'
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          drop_pending_updates: true // Limpiar updates pendientes
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log(`✅ [TelegramBot] Webhook configurado: ${webhookUrl}`);
        return {
          success: true,
          message: `Webhook configurado exitosamente: ${webhookUrl}`
        };
      } else {
        console.error('❌ [TelegramBot] Error configurando webhook:', data);
        return {
          success: false,
          message: `Error: ${data.description || 'Error desconocido'}`
        };
      }
    } catch (error) {
      console.error('❌ [TelegramBot] Error configurando webhook:', error);
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
      return null;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getWebhookInfo`);
      const data = await response.json();
      
      if (data.ok) {
        return data.result;
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
    if (!this.botToken) {
      return {
        success: false,
        message: 'Token no configurado'
      };
    }

    const webhookUrl = `${publicUrl}/webhook/telegram`;
    
    // Verificar si ya está configurado con la misma URL
    const currentWebhook = await this.getWebhookInfo();
    if (currentWebhook?.url === webhookUrl) {
      console.log(`✅ [TelegramBot] Webhook ya está configurado correctamente: ${webhookUrl}`);
      return {
        success: true,
        message: `Webhook ya estaba configurado: ${webhookUrl}`
      };
    }
    
    console.log(`🔧 [TelegramBot] Auto-configurando webhook: ${webhookUrl}`);
    
    return await this.setWebhook(webhookUrl);
  }
}

// Crear instancia única del bot
const telegramBot = new TelegramBot();

export default telegramBot;
