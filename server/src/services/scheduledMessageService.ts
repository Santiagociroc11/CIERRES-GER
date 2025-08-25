import { apiClient } from '../dbClient';

export interface ScheduledMessage {
  id: number;
  id_asesor: number;
  id_cliente: number;
  wha_cliente: string;
  mensaje: string;
  fecha_envio: string;
  estado: 'pendiente' | 'enviado' | 'cancelado' | 'error';
  intentos: number;
  max_intentos: number;
  error_message?: string;
  created_at: string;
  enviado_at?: string;
}

export class ScheduledMessageService {
  private static instance: ScheduledMessageService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): ScheduledMessageService {
    if (!ScheduledMessageService.instance) {
      ScheduledMessageService.instance = new ScheduledMessageService();
    }
    return ScheduledMessageService.instance;
  }

  /**
   * Inicia el servicio de mensajes programados
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 [SCHEDULED MESSAGES] Servicio iniciado');
    
    // Verificar cada minuto si hay mensajes para enviar
    this.intervalId = setInterval(() => {
      this.processScheduledMessages();
    }, 60000); // 1 minuto
  }

  /**
   * Detiene el servicio de mensajes programados
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('🛑 [SCHEDULED MESSAGES] Servicio detenido');
  }

  /**
   * Procesa todos los mensajes programados pendientes
   */
  private async processScheduledMessages(): Promise<void> {
    try {
      const now = new Date();
      const messages = await this.getPendingMessages(now);
      
      if (messages.length === 0) return;
      
      console.log(`📅 [SCHEDULED MESSAGES] Procesando ${messages.length} mensajes programados`);
      
      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('❌ [SCHEDULED MESSAGES] Error procesando mensajes:', error);
    }
  }

  /**
   * Obtiene mensajes pendientes para la fecha/hora actual
   */
  private async getPendingMessages(now: Date): Promise<ScheduledMessage[]> {
    try {
      const response = await apiClient.request<ScheduledMessage[]>(
        `/chat_scheduled_messages?estado=eq.pendiente&fecha_envio=lte.${now.toISOString()}&order=fecha_envio.asc`
      );
      
      return response || [];
    } catch (error) {
      console.error('Error obteniendo mensajes programados:', error);
      return [];
    }
  }

  /**
   * Procesa un mensaje programado individual
   */
  private async processMessage(message: ScheduledMessage): Promise<void> {
    try {
      console.log(`📤 [SCHEDULED MESSAGES] Enviando mensaje programado ID: ${message.id}`);
      
      // Marcar como procesando
      await this.updateMessageStatus(message.id, 'enviando');
      
      // Enviar mensaje a Evolution API
      const success = await this.sendToEvolutionAPI(message);
      
      if (success) {
        // Marcar como enviado
        await this.updateMessageStatus(message.id, 'enviado', new Date().toISOString());
        console.log(`✅ [SCHEDULED MESSAGES] Mensaje ${message.id} enviado exitosamente`);
      } else {
        // Incrementar intentos
        const newAttempts = message.intentos + 1;
        const newStatus = newAttempts >= message.max_intentos ? 'error' : 'pendiente';
        
        await this.updateMessageAttempts(message.id, newAttempts, newStatus);
        
        if (newStatus === 'error') {
          console.log(`❌ [SCHEDULED MESSAGES] Mensaje ${message.id} falló después de ${newAttempts} intentos`);
        } else {
          console.log(`🔄 [SCHEDULED MESSAGES] Mensaje ${message.id} reintentará (intento ${newAttempts}/${message.max_intentos})`);
        }
      }
    } catch (error) {
      console.error(`❌ [SCHEDULED MESSAGES] Error procesando mensaje ${message.id}:`, error);
      
      // Marcar como error
      await this.updateMessageStatus(message.id, 'error', undefined, error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  /**
   * Envía mensaje a Evolution API
   */
  private async sendToEvolutionAPI(message: ScheduledMessage): Promise<boolean> {
    try {
      const evolutionApiUrl = process.env.VITE_EVOLUTIONAPI_URL;
      const evolutionApiKey = process.env.VITE_EVOLUTIONAPI_TOKEN;
      
      if (!evolutionApiUrl || !evolutionApiKey) {
        throw new Error('Configuración de Evolution API no encontrada');
      }

      // Obtener nombre del asesor para la instancia
      const asesorResponse = await apiClient.request<any[]>(
        `/GERSSON_ASESORES?ID=eq.${message.id_asesor}&select=NOMBRE`
      );
      
      if (!asesorResponse || asesorResponse.length === 0) {
        throw new Error('Asesor no encontrado');
      }
      
      const instance = asesorResponse[0].NOMBRE;
      const number = message.wha_cliente.replace(/\D/g, '');
      
      const response = await fetch(
        `${evolutionApiUrl}/message/sendText/${encodeURIComponent(instance)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({ 
            number, 
            text: message.mensaje 
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error enviando mensaje a Evolution API: ${response.status} - ${errorText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error enviando a Evolution API:', error);
      return false;
    }
  }

  /**
   * Actualiza el estado de un mensaje programado
   */
  private async updateMessageStatus(
    id: number, 
    estado: string, 
    enviado_at?: string,
    error_message?: string
  ): Promise<void> {
    try {
      const updateData: any = { estado };
      
      if (enviado_at) {
        updateData.enviado_at = enviado_at;
      }
      
      if (error_message) {
        updateData.error_message = error_message;
      }
      
      await apiClient.request(
        `/chat_scheduled_messages?id=eq.${id}`,
        'PATCH',
        updateData
      );
    } catch (error) {
      console.error('Error actualizando estado del mensaje:', error);
    }
  }

  /**
   * Actualiza los intentos de un mensaje programado
   */
  private async updateMessageAttempts(
    id: number, 
    intentos: number, 
    estado: string
  ): Promise<void> {
    try {
      await apiClient.request(
        `/chat_scheduled_messages?id=eq.${id}`,
        'PATCH',
        { intentos, estado }
      );
    } catch (error) {
      console.error('Error actualizando intentos del mensaje:', error);
    }
  }

  /**
   * Programa un nuevo mensaje
   */
  public async scheduleMessage(messageData: Omit<ScheduledMessage, 'id' | 'created_at'>): Promise<number> {
    try {
      const response = await apiClient.request(
        '/chat_scheduled_messages',
        'POST',
        messageData
      );
      
      if (response && response.id) {
        console.log(`📅 [SCHEDULED MESSAGES] Mensaje programado ID: ${response.id}`);
        return response.id;
      }
      
      throw new Error('No se pudo crear el mensaje programado');
    } catch (error) {
      console.error('Error programando mensaje:', error);
      throw error;
    }
  }

  /**
   * Cancela un mensaje programado
   */
  public async cancelMessage(id: number): Promise<void> {
    try {
      await this.updateMessageStatus(id, 'cancelado');
      console.log(`❌ [SCHEDULED MESSAGES] Mensaje ${id} cancelado`);
    } catch (error) {
      console.error('Error cancelando mensaje:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const scheduledMessageService = ScheduledMessageService.getInstance();
