/**
 * 🤖 TELEGRAM BOT SERVICE
 * 
 * Bot de Telegram que responde al comando /autoid para ayudar a los asesores
 * a obtener su ID de Telegram y configurarlo en el sistema.
 * 
 * Usa polling (no webhooks) para obtener mensajes.
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

interface TelegramApiResponse {
  ok: boolean;
  result: TelegramUpdate[];
}

class TelegramBot {
  private botToken: string | null = null;
  private isRunning = false;
  private lastUpdateId = 0;
  private pollingInterval: NodeJS.Timeout | null = null;

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

      console.log('🤖 [TelegramBot] Bot inicializado correctamente');
      await this.startPolling();
    } catch (error) {
      console.error('❌ [TelegramBot] Error inicializando bot:', error);
    }
  }

  /**
   * Iniciar polling para recibir mensajes
   */
  async startPolling() {
    if (this.isRunning || !this.botToken) {
      return;
    }

    this.isRunning = true;

    // Obtener información del bot
    try {
      const botInfo = await this.getBotInfo();
      console.log(`✅ [TelegramBot] Bot conectado: @${botInfo.username} (${botInfo.first_name})`);
    } catch (error) {
      console.error('❌ [TelegramBot] Error obteniendo info del bot:', error);
      this.isRunning = false;
      return;
    }

    // Iniciar polling cada 2 segundos
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollUpdates();
      } catch (error) {
        console.error('❌ [TelegramBot] Error en polling:', error);
      }
    }, 2000);
  }

  /**
   * Detener polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isRunning = false;
  
  }

  /**
   * Obtener información del bot
   */
  private async getBotInfo() {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Error obteniendo info del bot: ${data.description}`);
    }
    
    return data.result;
  }

  /**
   * Hacer polling para obtener actualizaciones
   */
  private async pollUpdates() {
    if (!this.botToken) return;

    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`
    );
    
    const data: TelegramApiResponse = await response.json();
    
    if (!data.ok) {
      console.error('❌ [TelegramBot] Error en getUpdates:', data);
      return;
    }

    // Procesar cada actualización
    for (const update of data.result) {
      this.lastUpdateId = update.update_id;
      await this.processUpdate(update);
    }
  }

  /**
   * Procesar una actualización recibida
   */
  private async processUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text.trim();
    const firstName = message.from.first_name;
    const username = message.from.username;

    // Responder a comandos
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, firstName, userId);
    }
  }

  /**
   * Manejar comandos del bot
   */
  private async handleCommand(chatId: number, command: string, firstName: string, userId: number) {
    switch (command.toLowerCase()) {
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
  }

  /**
   * Enviar mensaje de bienvenida
   */
  private async sendStartMessage(chatId: number, firstName: string) {
    const message = `👋 ¡Hola ${firstName}!

🤖 Soy el bot de **Repartidor TD** para ayudarte a configurar tu ID de Telegram.

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
    const message = `🆔 **Tu ID de Telegram es:**

\`${userId}\`

📋 **Instrucciones:**
1. **Copia** el número de arriba (toca para seleccionar)
2. Ve al sistema web de Repartidor TD
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
    const message = `🆘 **Ayuda - Bot Repartidor TD**

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
    if (!this.botToken) return;

    try {
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
      }
    } catch (error) {
      console.error('❌ [TelegramBot] Error enviando mensaje:', error);
    }
  }

  /**
   * Reiniciar el bot con nueva configuración
   */
  async restart() {
    console.log('🔄 [TelegramBot] Reiniciando bot...');
    this.stopPolling();
    await this.initializeBot();
  }

  /**
   * Obtener estado del bot
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasToken: !!this.botToken,
      lastUpdateId: this.lastUpdateId
    };
  }
}

// Crear instancia única del bot
const telegramBot = new TelegramBot();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 [TelegramBot] Cerrando bot...');
  telegramBot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 [TelegramBot] Cerrando bot...');
  telegramBot.stopPolling();
  process.exit(0);
});

export default telegramBot;
