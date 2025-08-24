export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  message_thread_id?: number;
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>>;
  };
}

export interface TelegramResponse {
  success: boolean;
  data?: any;
  error?: string;
}

import { getHotmartConfig } from '../config/webhookConfig';

export async function sendTelegramMessage(message: TelegramMessage): Promise<TelegramResponse> {
  const config = getHotmartConfig();
  const TELEGRAM_BOT_TOKEN = config.tokens.telegram;
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: `Error ${response.status}: ${JSON.stringify(data)}` };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}

export function createVentaMessage(hotmartData: any, asesorNombre?: string): TelegramMessage {
  const config = getHotmartConfig();
  
  const transaction = hotmartData.purchase?.transaction || 'N/A';
  const buyerName = hotmartData.buyer?.name || 'N/A';
  const pais = hotmartData.buyer?.address?.country || 'N/A';
  const buyerEmail = hotmartData.buyer?.email || 'N/A';
  const productName = hotmartData.product?.name || 'N/A';
  const purchaseDate = new Date(hotmartData.purchase?.order_date).toLocaleString();
  const cerrador = asesorNombre || 'SIN CERRADOR';

  const text = `<b>Notificación de VENTA</b>\n\n` +
    `<b>Producto:</b> ${productName}\n` +
    `<b>País:</b> ${pais}\n` +
    `<b>Comprador:</b> ${buyerName}\n` +
    `<b>Correo:</b> ${buyerEmail}\n` +
    `<b>Transacción:</b> ${transaction}\n` +
    `<b>CERRADOR:</b> ${cerrador}\n` +
    `<b>Fecha de compra:</b> ${purchaseDate}\n`;

  return {
    chat_id: config.telegram.groupChatId,
    message_thread_id: parseInt(config.telegram.threadId, 10),
    text,
    parse_mode: 'HTML'
  };
}

export function createAsesorNotificationMessage(
  evento: string, 
  nombreCliente: string, 
  numeroCliente: string, 
  chatAsesor: string, 
  motivo?: string
): TelegramMessage {
  const mensajes = {
    'CARRITOS': `🚨 *CARRITOS ABANDONADOS* 🚨\n\n👤 *Cliente:* ${nombreCliente}\n📲 *WhatsApp:* ${numeroCliente}\n🛒 *Estado:* Abandonó el carrito.`,
    'TICKETS': `🎟️ *SEGUIMIENTO A TICKET* 🎟️\n\n👤 *Cliente:* ${nombreCliente}\n📲 *WhatsApp:* ${numeroCliente}\n💳 *Estado:* Generó un ticket de pago.`,
    'RECHAZADOS': `❌ *COMPRA RECHAZADA* ❌\n\n👤 *Cliente:* ${nombreCliente}\n📲 *WhatsApp:* ${numeroCliente}\n⚠️ *Motivo:* ${motivo || 'Motivo no especificado'}`
  };

  const mensaje = mensajes[evento as keyof typeof mensajes] || '';

  return {
    chat_id: chatAsesor,
    text: mensaje,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'IR A ATENDER',
          url: `https://wa.me/${numeroCliente}`
        }],
        [{
          text: 'REPORTAR ESTADO',
          url: 'https://sistema-cierres-ger.automscc.com/'
        }]
      ]
    }
  };
}