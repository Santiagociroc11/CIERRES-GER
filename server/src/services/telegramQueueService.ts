import winston from 'winston';
import { updateWebhookLog } from '../dbClient';

export interface ProcessingStep {
  step: string;
  status: string;
  timestamp?: Date;
  message_id?: string;
  chat_id?: string;
  result?: string;
  telegram_message_id?: string;
  completed_at?: Date;
  [key: string]: any; // For additional properties
}

// Configurar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'telegram-queue.log' })
  ]
});

interface TelegramMessage {
  id: string;
  chatId: string;
  text: string;
  webhookLogId?: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt: Date;
  metadata?: any;
}

class TelegramQueueService {
  private queue: TelegramMessage[] = [];
  private isProcessing = false;
  private readonly RATE_LIMIT = 15; // 15 mensajes por minuto por precaución
  private readonly INTERVAL = 60000; // 1 minuto en milisegundos
  private readonly MESSAGE_INTERVAL = this.INTERVAL / this.RATE_LIMIT; // ~4 segundos entre mensajes
  private lastSentTime = 0;
  private messagesSentInCurrentMinute = 0;
  private currentMinuteStart = Date.now();

  constructor() {
    // Iniciar el procesador de cola
    this.startQueueProcessor();
    
    // Reset del contador cada minuto
    setInterval(() => {
      this.resetRateLimit();
    }, this.INTERVAL);

    logger.info('TelegramQueueService inicializado', {
      rateLimit: this.RATE_LIMIT,
      messageInterval: this.MESSAGE_INTERVAL
    });
  }

  /**
   * Agregar mensaje a la cola
   */
  public enqueueMessage(
    chatId: string, 
    text: string, 
    webhookLogId?: number, 
    metadata?: any
  ): string {
    const messageId = this.generateMessageId();
    const now = new Date();
    
    const message: TelegramMessage = {
      id: messageId,
      chatId,
      text,
      webhookLogId,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      scheduledAt: this.calculateNextAvailableSlot(),
      metadata
    };

    this.queue.push(message);
    
    logger.info('Mensaje agregado a la cola de Telegram', {
      messageId,
      chatId,
      queueSize: this.queue.length,
      scheduledAt: message.scheduledAt,
      webhookLogId
    });

    // Ordenar cola por tiempo programado
    this.queue.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return messageId;
  }

  /**
   * Calcular el próximo slot disponible para enviar mensaje
   */
  private calculateNextAvailableSlot(): Date {
    const now = Date.now();
    
    // Si no hemos alcanzado el límite en el minuto actual
    if (this.messagesSentInCurrentMinute < this.RATE_LIMIT) {
      // Calcular cuándo podemos enviar el próximo mensaje
      const timeSinceLastMessage = now - this.lastSentTime;
      if (timeSinceLastMessage >= this.MESSAGE_INTERVAL) {
        return new Date(now);
      } else {
        return new Date(this.lastSentTime + this.MESSAGE_INTERVAL);
      }
    } else {
      // Esperar al próximo minuto
      const nextMinute = this.currentMinuteStart + this.INTERVAL;
      return new Date(nextMinute);
    }
  }

  /**
   * Reset del rate limiting cada minuto
   */
  private resetRateLimit(): void {
    this.messagesSentInCurrentMinute = 0;
    this.currentMinuteStart = Date.now();
    
    logger.debug('Rate limit reseteado', {
      currentMinuteStart: this.currentMinuteStart,
      queueSize: this.queue.length
    });
  }

  /**
   * Procesar cola de mensajes
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (!this.isProcessing && this.queue.length > 0) {
        await this.processQueue();
      }
    }, 1000); // Verificar cada segundo
  }

  /**
   * Procesar mensajes en cola
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();
      
      // Buscar mensajes listos para enviar
      const readyMessages = this.queue.filter(msg => 
        msg.scheduledAt.getTime() <= now
      );

      for (const message of readyMessages) {
        if (this.messagesSentInCurrentMinute >= this.RATE_LIMIT) {
          logger.debug('Rate limit alcanzado, esperando próximo minuto');
          break;
        }

        try {
          await this.sendMessage(message);
          
          // Remover mensaje exitoso de la cola
          this.removeFromQueue(message.id);
          
          // Actualizar contadores
          this.messagesSentInCurrentMinute++;
          this.lastSentTime = Date.now();
          
          logger.info('Mensaje de Telegram enviado exitosamente', {
            messageId: message.id,
            chatId: message.chatId,
            attempts: message.attempts + 1,
            webhookLogId: message.webhookLogId
          });

        } catch (error) {
          await this.handleMessageError(message, error);
        }
      }
    } catch (error) {
      logger.error('Error en el procesador de cola de Telegram', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Enviar mensaje a Telegram
   */
  private async sendMessage(message: TelegramMessage): Promise<any> {
    // Obtener token desde configuración de BD (igual que otros servicios)
    const { getHotmartConfig } = await import('../config/webhookConfig');
    const config = await getHotmartConfig();
    const botToken = config.tokens.telegram;
    
    if (!botToken) {
      throw new Error('Token de Telegram no configurado en la configuración del sistema');
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: message.chatId,
        text: message.text,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    
    // Actualizar webhook log si existe
    if (message.webhookLogId) {
      try {
        // Obtener log actual para actualizar processing_steps
        const { getWebhookLogById } = await import('../dbClient');
        const currentLog = await getWebhookLogById(message.webhookLogId);
        
        // Actualizar processing_steps para marcar telegram como completed
        let updatedSteps = currentLog?.processing_steps || [];
        const telegramStepIndex = updatedSteps.findIndex((step: ProcessingStep) => 
          step.step === 'telegram_integration' && step.message_id === message.id
        );
        
        if (telegramStepIndex !== -1) {
          updatedSteps[telegramStepIndex] = {
            ...updatedSteps[telegramStepIndex],
            status: 'completed',
            result: 'message_sent',
            telegram_message_id: result.result?.message_id?.toString(),
            completed_at: new Date()
          };
        }
        
        await updateWebhookLog({
          id: message.webhookLogId,
          telegram_status: 'success',
          telegram_message_id: result.result?.message_id?.toString() || message.id,
          processing_steps: updatedSteps
        });
        
        logger.info('Webhook log actualizado con éxito de Telegram', {
          webhookLogId: message.webhookLogId,
          telegramMessageId: result.result?.message_id,
          originalMessageId: message.id
        });
      } catch (updateError) {
        logger.error('Error actualizando webhook log después del envío exitoso', {
          webhookLogId: message.webhookLogId,
          messageId: message.id,
          error: updateError
        });
        // No fallar el envío por error de actualización de log
      }
    }

    return result;
  }

  /**
   * Manejar errores de envío
   */
  private async handleMessageError(message: TelegramMessage, error: any): Promise<void> {
    message.attempts++;
    
    logger.error('Error enviando mensaje de Telegram', {
      messageId: message.id,
      chatId: message.chatId,
      attempts: message.attempts,
      maxAttempts: message.maxAttempts,
      error: error.message,
      webhookLogId: message.webhookLogId
    });

    if (message.attempts >= message.maxAttempts) {
      // Actualizar webhook log si existe
      if (message.webhookLogId) {
        try {
          await updateWebhookLog({
            id: message.webhookLogId,
            telegram_status: 'error',
            telegram_error: error.message || 'Error enviando mensaje después de 3 intentos'
          });
          
          logger.info('Webhook log actualizado con error permanente de Telegram', {
            webhookLogId: message.webhookLogId,
            messageId: message.id,
            finalError: error.message
          });
        } catch (updateError) {
          logger.error('Error actualizando webhook log después del fallo permanente', {
            webhookLogId: message.webhookLogId,
            messageId: message.id,
            error: updateError
          });
        }
      }
      
      // Remover mensaje fallido permanentemente
      this.removeFromQueue(message.id);
      
      logger.error('Mensaje de Telegram falló permanentemente', {
        messageId: message.id,
        chatId: message.chatId,
        finalError: error.message,
        webhookLogId: message.webhookLogId
      });
    } else {
      // Re-programar para reintento con backoff exponencial
      const backoffMinutes = Math.pow(2, message.attempts - 1); // 1, 2, 4 minutos
      message.scheduledAt = new Date(Date.now() + (backoffMinutes * 60000));
      
      logger.info('Mensaje re-programado para reintento', {
        messageId: message.id,
        attempts: message.attempts,
        nextAttempt: message.scheduledAt,
        backoffMinutes
      });
    }
  }

  /**
   * Remover mensaje de la cola
   */
  private removeFromQueue(messageId: string): void {
    const index = this.queue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Generar ID único para mensaje
   */
  private generateMessageId(): string {
    return `tg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas de la cola
   */
  public getQueueStats(): any {
    const now = Date.now();
    const pendingCount = this.queue.length;
    const readyCount = this.queue.filter(msg => msg.scheduledAt.getTime() <= now).length;
    const waitingCount = pendingCount - readyCount;

    return {
      totalPending: pendingCount,
      readyToSend: readyCount,
      waiting: waitingCount,
      messagesSentThisMinute: this.messagesSentInCurrentMinute,
      rateLimit: this.RATE_LIMIT,
      nextReset: new Date(this.currentMinuteStart + this.INTERVAL),
      isProcessing: this.isProcessing
    };
  }

  /**
   * Obtener cola completa (para debugging)
   */
  public getQueue(): TelegramMessage[] {
    return [...this.queue]; // Copia para evitar modificaciones externas
  }

  /**
   * Limpiar cola (para testing)
   */
  public clearQueue(): void {
    this.queue = [];
    logger.info('Cola de Telegram limpiada');
  }
}

// Singleton instance
export const telegramQueue = new TelegramQueueService();
export default telegramQueue;
