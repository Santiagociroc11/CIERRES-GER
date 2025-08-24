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
  const response = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?select=ID,NOMBRE`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener asesores: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function getClienteByWhatsapp(wha: string): Promise<{ ID: number; ESTADO: string; ID_ASESOR?: number; NOMBRE_ASESOR?: string } | null> {
  // Limpiar el número (solo dígitos)
  const soloNumeros = wha.replace(/\D/g, '');
  const ultimos7 = soloNumeros.slice(-7);
  if (!ultimos7) return null;
  // Buscar clientes cuyo whatsapp contenga los últimos 7 dígitos
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?WHATSAPP=ilike.*${ultimos7}*&select=ID,ESTADO,ID_ASESOR,NOMBRE_ASESOR&limit=1`);
  if (!response.ok) return null;
  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
}

export async function getNextAsesorPonderado(): Promise<{ ID: number } | null> {
  const response = await fetch(`${POSTGREST_URL}/rpc/get_next_asesor_ponderado`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return null;
  const asesorId = await response.json();
  
  // La función retorna directamente el ID (INTEGER), no un objeto
  if (typeof asesorId === 'number' && asesorId > 0) {
    return { ID: asesorId };
  }
  return null;
}

export async function getAsesorById(id: number): Promise<{ ID: number; NOMBRE: string; WHATSAPP: string; ID_TG: string } | null> {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${id}&select=ID,NOMBRE,WHATSAPP,ID_TG`);
  if (!response.ok) return null;
  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
}

export async function createCliente(clienteData: {
  NOMBRE: string;
  ESTADO: string;
  WHATSAPP: string;
  ID_ASESOR?: number;
  NOMBRE_ASESOR?: string;
  WHA_ASESOR?: string;
  FECHA_CREACION: number;
  FECHA_COMPRA?: number;
  MEDIO_COMPRA?: string;
}) {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(clienteData)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear cliente: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function updateCliente(id: number, updates: Partial<{
  NOMBRE: string;
  ESTADO: string;
  WHATSAPP: string;
  FECHA_COMPRA: number;
  MEDIO_COMPRA: string;
}>) {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar cliente: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function updateAsesorCounter(asesorId: number, flujo: string) {
  const validFlujos = ['CARRITOS', 'RECHAZADOS', 'COMPRAS', 'TICKETS', 'LINK', 'MASIVOS'];
  if (!validFlujos.includes(flujo)) {
    throw new Error(`Flujo inválido: ${flujo}`);
  }

  const response = await fetch(`${POSTGREST_URL}/rpc/increment_asesor_counter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      asesor_id: asesorId,
      counter_field: flujo
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar contador: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function insertRegistro(data: {
  ID_CLIENTE: number;
  TIPO_EVENTO: string;
  FECHA_EVENTO: number;
}) {
  const response = await fetch(`${POSTGREST_URL}/GERSSON_REGISTROS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al insertar registro: ${response.status} - ${errorText}`);
  }
  return response.json();
} 