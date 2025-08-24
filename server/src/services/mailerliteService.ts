export interface MailerLiteResponse {
  success: boolean;
  data?: any;
  error?: string;
}

import { getHotmartConfig } from '../config/webhookConfig';

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';

export async function addSubscriberToMailerLite(email: string, groupId: string): Promise<MailerLiteResponse> {
  const config = getHotmartConfig();
  const MAILERLITE_TOKEN = config.tokens.mailerlite;
  try {
    const response = await fetch(`${MAILERLITE_API_BASE}/subscribers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MAILERLITE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        groups: [groupId]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Error ${response.status}: ${errorData}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Error de conexión: ${error}` };
  }
}