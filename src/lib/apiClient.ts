// Clase de error personalizada para capturar la esencia del fallo
export class APIError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

// Cliente API: el corazón palpitante que conecta con tu PostgREST
export class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Método genérico que orquesta las peticiones con estilo
  async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(method !== 'GET' && { 'Prefer': 'return=representation' }) // 👈 Solo en `POST`, `PATCH`, `DELETE`
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    // ✅ Manejar respuestas sin JSON (204 No Content y 200 sin cuerpo)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      console.log(`ℹ️ Respuesta ${response.status} en ${endpoint}, sin JSON.`);
      return {} as T; // Retorna un objeto vacío para evitar errores
    }

    // ✅ Intentar parsear JSON, pero manejar errores si la respuesta no es JSON
    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error("❌ Respuesta inesperada de la API:", responseText);
      throw new APIError(`Error ${response.status}: ${responseText}`, response.status);
    }
  }

}

// Instancia del cliente con la URL desde las variables de entorno
export const apiClient = new APIClient(import.meta.env.VITE_POSTGREST_URL);

// Definición de tipos para mayor claridad y seguridad en tiempo de compilación
export type Reporte = {
  ID_CLIENTE: string;
  ESTADO_ANTERIOR: string;
  ESTADO_NUEVO: String;
};


// Función para eliminar el reporte con la elegancia de un poeta y la precisión de un cirujano
export const eliminarReporte = async (reporteId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    // 1️⃣: Extraemos el reporte; como una oda al pasado, buscamos la verdad en los datos
    const reportes = await apiClient.request<Reporte[]>(
      `/GERSSON_REPORTES?ID=eq.${reporteId}&select=ID_CLIENTE,ESTADO_ANTERIOR,ESTADO_NUEVO`
    );
    const reporte = reportes[0];
    if (!reporte) throw new Error('Reporte no encontrado o inaccesible.');

    // 2️⃣: Restauramos el estado del cliente, devolviéndole su esencia anterior
    await apiClient.request(
      `/GERSSON_CLIENTES?ID=eq.${reporte.ID_CLIENTE}`,
      'PATCH',
      { ESTADO: reporte.ESTADO_ANTERIOR }
    );

    // 2.1️⃣: Si el reporte a eliminar tiene el ESTADO_NUEVO "VENTA CONSOLIDADA", marcamos todos los reportes de ese cliente como consolidado:false
    if (reporte.ESTADO_NUEVO === "VENTA CONSOLIDADA") {
      await apiClient.request(
        `/GERSSON_REPORTES?ID_CLIENTE=eq.${reporte.ID_CLIENTE}`,
        'PATCH',
        { consolidado: false }
      );
    }

    // 3️⃣: Eliminamos el reporte, cerrando un ciclo y abriendo paso a lo nuevo
    await apiClient.request(
      `/GERSSON_REPORTES?ID=eq.${reporteId}`,
      'DELETE'
    );

    console.log('✅ Reporte eliminado y estado del cliente restaurado con maestría.');
    return { success: true };
  } catch (error: any) {
    console.error('⚠️ Error en eliminarReporte:', error);
    return { success: false, message: error.message || 'Error desconocido' };
  }
};

// Función para eliminar registros con la sabiduría del tiempo y la precisión del destino
export const eliminarRegistro = async (registroId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    // 1️⃣: Buscamos el registro destinado a ser eliminado, como un arqueólogo del tiempo
    const registros = await apiClient.request<any[]>(
      `/GERSSON_REGISTROS?ID=eq.${registroId}&select=ID,ID_CLIENTE,TIPO_EVENTO,FECHA_EVENTO`
    );
    const registro = registros[0];
    if (!registro) throw new Error('Registro no encontrado en los anales del tiempo.');

    // 2️⃣: Buscamos el último reporte antes de este registro para restaurar el estado correcto
    const reportesAnteriores = await apiClient.request<any[]>(
      `/GERSSON_REPORTES?ID_CLIENTE=eq.${registro.ID_CLIENTE}&FECHA_REPORTE=lt.${registro.FECHA_EVENTO}&order=FECHA_REPORTE.desc&limit=1&select=ESTADO_NUEVO`
    );

    // 3️⃣: Determinamos el estado correcto al que restaurar
    let estadoAnterior = 'SEGUIMIENTO'; // Estado por defecto
    
    if (reportesAnteriores.length > 0) {
      // Si hay un reporte anterior, usamos ese estado
      estadoAnterior = reportesAnteriores[0].ESTADO_NUEVO;
    } else {
      // Si no hay reportes anteriores, buscamos el estado original al crear el cliente
      const cliente = await apiClient.request<any[]>(
        `/GERSSON_CLIENTES?ID=eq.${registro.ID_CLIENTE}&select=ESTADO`
      );
      if (cliente.length > 0 && cliente[0].ESTADO) {
        // Mantenemos el estado actual si no encontramos información anterior
        console.log(`🔍 No hay reportes anteriores al registro. Estado actual: ${cliente[0].ESTADO}`);
        estadoAnterior = 'SEGUIMIENTO'; // Siempre defaultear a SEGUIMIENTO si no hay reportes anteriores
      }
    }

    // 4️⃣: Eliminamos el registro primero
    await apiClient.request(
      `/GERSSON_REGISTROS?ID=eq.${registroId}`,
      'DELETE'
    );

    // 5️⃣: Actualizamos el estado del cliente al estado anterior correcto
    await apiClient.request(
      `/GERSSON_CLIENTES?ID=eq.${registro.ID_CLIENTE}`,
      'PATCH',
      { ESTADO: estadoAnterior }
    );

    console.log(`✅ Registro "${registro.TIPO_EVENTO}" eliminado y estado del cliente restaurado a: ${estadoAnterior}`);
    return { 
      success: true, 
      message: `Registro "${registro.TIPO_EVENTO}" eliminado. Estado restaurado a: ${estadoAnterior}` 
    };
  } catch (error: any) {
    console.error('⚠️ Error en eliminarRegistro:', error);
    return { success: false, message: error.message || 'Error desconocido al eliminar registro' };
  }
};

