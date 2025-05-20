const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;

export async function insertConversacion(data: {
  id_asesor: number;
  id_cliente?: number | null;
  wha_cliente: string;
  modo: 'entrante' | 'saliente';
  timestamp: number;
  mensaje: string;
}) {
  const response = await fetch(`${POSTGREST_URL}/conversaciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al insertar conversación: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getAsesores(): Promise<{ ID: number; NOMBRE: string }[]> {
  const response = await fetch(`${POSTGREST_URL}/asesores?select=ID,NOMBRE`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener asesores: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getClienteByWhatsapp(wha: string): Promise<{ ID: number } | null> {
  // Limpiar el número (solo dígitos)
  const soloNumeros = wha.replace(/\D/g, '');
  const ultimos7 = soloNumeros.slice(-7);
  if (!ultimos7) return null;
  // Buscar clientes cuyo whatsapp contenga los últimos 7 dígitos
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?WHATSAPP=ilike.*${ultimos7}*&select=ID`);
  if (!response.ok) return null;
  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
} 