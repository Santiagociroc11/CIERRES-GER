export interface Asesor {
  ID: number;
  NOMBRE: string;
  WHATSAPP: string;
  LINK?: number;
  RECHAZADOS?: number;
  CARRITOS?: number;
  TICKETS?: number;
  COMPRAS?: number;
  ES_ADMIN?: boolean;
  ID_TG: string;
  MASIVOS?: number;
  PRIORIDAD?: number;
  LIMITE_DIARIO?: number;
  BLOQUEADO?: boolean;
  PAUSADO?: boolean;
  FECHA_INICIO_REGLA?: string;
  FECHA_FIN_REGLA?: string;
  HISTORIAL?: string;
}

export type AdminRole = 'admin' | 'supervisor';

export interface Admin {
  id: string;
  nombre: string;
  whatsapp: string;
  rol: AdminRole;
  fecha_creacion?: string;
}

export interface AsesorStats {
  total_clientes: number;
  tasa_conversion: number;
  alerta?: string;
}

export interface Cliente {
  ID: number;
  ID_CLIENTE: number;
  NOMBRE: string;
  TELEFONO: string;
  FECHA_CREACION: string;
  FECHA_ASIGNACION: string | null;
  ID_ASESOR: number | null;
  ESTADO: string;
  FUENTE: string;
  FECHA_ULTIMO_REPORTE: string | null;
  FECHA_ULTIMA_VENTA: string | null;
  FECHA_ULTIMO_SEGUIMIENTO: string | null;
  FECHA_ULTIMA_ACTIVIDAD: string | null;
  MONTO_ULTIMA_VENTA: number | null;
  TIPO_ULTIMA_VENTA: string | null;
  REPORTES_COUNT: number;
  VENTAS_COUNT: number;
  SEGUIMIENTOS_COUNT: number;
  DIAS_SIN_ACTIVIDAD: number | null;
  DIAS_SIN_REPORTE: number | null;
  DIAS_SIN_SEGUIMIENTO: number | null;
  DIAS_SIN_VENTA: number | null;
  WHATSAPP: string;
  // Campos CRM de soporte
  soporte_tipo?: string | null;
  soporte_prioridad?: string | null;
  soporte_duda?: string | null;
  soporte_descripcion?: string | null;
  soporte_fecha_ultimo?: number | null;
  // Campos de temperatura y etiquetas para seguimientos
  temperatura?: 'CALIENTE' | 'TIBIO' | 'FRIO' | null;
  etiquetas?: string | null; // Separadas por comas
  temperatura_fecha?: number | null;
}

// Tipos de temperatura para leads
export type TemperaturaLead = 'CALIENTE' | 'TIBIO' | 'FRIO';

// Interface para etiquetas personalizadas (creadas por cada asesor)
export interface EtiquetaCliente {
  id: number;
  id_asesor: number;
  nombre: string;
  color: string;
  emoji?: string | null;
  uso_count: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Colores disponibles para etiquetas
export const COLORES_ETIQUETAS = [
  { id: 'red', nombre: 'Rojo', class: 'bg-red-100 text-red-800 border-red-300' },
  { id: 'orange', nombre: 'Naranja', class: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: 'yellow', nombre: 'Amarillo', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { id: 'green', nombre: 'Verde', class: 'bg-green-100 text-green-800 border-green-300' },
  { id: 'blue', nombre: 'Azul', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'purple', nombre: 'Morado', class: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'pink', nombre: 'Rosa', class: 'bg-pink-100 text-pink-800 border-pink-300' },
  { id: 'gray', nombre: 'Gris', class: 'bg-gray-100 text-gray-800 border-gray-300' },
] as const;

export interface Reporte {
  ID_REPORTE: number;
  ID_CLIENTE: number;
  ID_ASESOR: number;
  FECHA_REPORTE: string;
  ESTADO_CLIENTE: string;
  DETALLE: string;
  SEGUIMIENTO_REQUERIDO: boolean;
  FECHA_SEGUIMIENTO: string | null;
  SEGUIMIENTO_COMPLETADO: boolean;
  VENTA_REALIZADA: boolean;
  TIPO_VENTA: string | null;
  MONTO_VENTA: number | null;
  CREATED_AT: string;
  UPDATED_AT: string;
  ID: number;
  ESTADO_ANTERIOR: string | null;
  ESTADO_NUEVO: string;
  COMENTARIO: string | null;
  NOMBRE_ASESOR: string;
  COMPLETADO: boolean | null;
  IMAGEN_CONVERSACION_URL: string | null;
  IMAGEN_PAGO_URL: string | null;
  PAIS_CLIENTE: string | null;
  CORREO_INSCRIPCION: string | null;
  TELEFONO_CLIENTE: string | null;
  CORREO_PAGO: string | null;
  MEDIO_PAGO: string | null;
  consolidado: boolean | null;
  imagen_inicio_conversacion: string | null;
  imagen_fin_conversacion: string | null;
  video_conversacion: string | null;
  PRODUCTO: string | null;
  verificada: boolean | null;
  estado_verificacion: string | null;
  comentario_rechazo: string | null;
  auditor1_decision: string | null;
  auditor1_comentario: string | null;
  auditor1_timestamp: number | null;
  auditor1_id: string | null;
  auditor2_decision: string | null;
  auditor2_comentario: string | null;
  auditor2_timestamp: number | null;
  auditor2_id: string | null;
  estado_doble_verificacion: string | null;
  supervisor_resolution_timestamp: number | null;
  supervisor_resolution_comment: string | null;
  // Campos de temperatura y etiquetas
  temperatura?: 'CALIENTE' | 'TIBIO' | 'FRIO' | null;
  etiquetas?: string | null;
}

/** Comentarios usados cuando el asesor solo marca "Esperando respuesta" sin reporte completo */
export const COMENTARIO_SOLO_ESPERANDO = 'Marcado en espera de respuesta';
export const COMENTARIO_SOLO_ESPERANDO_RAPIDO = 'Marcado en espera de respuesta (acción rápida)';

/**
 * Un reporte "completo" cuenta para administración (el asesor reportó con comentarios/seguimiento).
 * Los reportes que son solo "Esperando respuesta" (acción rápida o modal sin comentario) NO cuentan:
 * el cliente sigue figurando como "sin reporte" hasta que haga un reporte con contenido.
 */
export function esReporteCompleto(r: { ESTADO_NUEVO?: string; COMENTARIO?: string | null }): boolean {
  if (r.ESTADO_NUEVO !== 'ESPERANDO RESPUESTA') return true;
  const c = (r.COMENTARIO || '').trim();
  return c !== COMENTARIO_SOLO_ESPERANDO && c !== COMENTARIO_SOLO_ESPERANDO_RAPIDO;
}

export interface Registro {
  ID: number;
  ID_CLIENTE: number;
  TIPO_EVENTO: string;
  FECHA_EVENTO: string;
}

export interface QuickReply {
  id: number;
  id_asesor: number;
  texto: string;
  categoria: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

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

export interface EstadisticasAsesor {
  totalClientes: number;
  clientesReportados: number;
  ventasRealizadas: number;
  ventasPrincipal: number;
  ventasDownsell: number;
  ventasReportadas: number;
  ventasSinReportar: number;
  seguimientosPendientes: number;
  seguimientosCompletados: number;
  porcentajeCierre: number;
  ventasPorMes: number;
  tiempoPromedioConversion: number;
  tasaRespuesta: number;
}

export interface EstadisticasDetalladas extends EstadisticasAsesor {
  clientesSinReporte: number;
  clientesSinReporteVIP: number;
  clientesSinReporteNoVIP: number;
  totalClientesVIP: number;
  totalClientesNoVIP: number;
  porcentajeCierreVIP: number;
  porcentajeCierreNoVIP: number;
  clientesConReporte: number;
  clientesEnSeguimiento: number;
  clientesRechazados: number;
  clientesCriticos: number;
  clientesNoContactados: number;
  clientesSinMensaje20Min: number;
  tiempoPromedioRespuesta: number;
  tiempoPromedioHastaReporte: number;
  tiempoPromedioHastaVenta: number;
  tiempoHastaPrimerMensaje: number;
  reportesPorCliente: number;
  reportesConSeguimiento: number;
  montoPromedioVenta: number;
  ultimaActividad: number | null;
  ultimoReporte: number | null;
  ultimoSeguimiento: number | null;
  ultimaVenta: number | null;
  ultimoMensaje: number | null;
}

export type EstadoCritico = 'CARRITOS' | 'RECHAZADOS' | 'TICKETS' | 'LINK_ALTA_PRIORIDAD';
export type EstadoNoCritico = 'LINK' | 'PAGADO' | 'VENTA CONSOLIDADA' | 'MASIVOS';
export type EstadoAsesor = 'SEGUIMIENTO' | 'ESPERANDO RESPUESTA' | 'NO CONTACTAR' | 'NO CONTESTÓ' | 'NO INTERESADO';
export type EstadoCliente = EstadoCritico | EstadoNoCritico | EstadoAsesor;

export const esEstadoCritico = (estado: EstadoCliente, cliente?: { ESTADO: string; soporte_prioridad?: string | null }): estado is EstadoCritico => {
  // Estados críticos tradicionales
  if (['CARRITOS', 'RECHAZADOS', 'TICKETS'].includes(estado)) {
    return true;
  }
  
  // Estado LINK con prioridad alta o media (prospectos críticos de soporte)
  if (estado === 'LINK' && (cliente?.soporte_prioridad === 'ALTA' || cliente?.soporte_prioridad === 'MEDIA')) {
    return true;
  }
  
  return false;
};

export interface ListaGeneralClientesProps {
  clientes: Cliente[];
  reportes: Reporte[];
  onActualizarEstado: (cliente: Cliente) => void;
  onReportarVenta: (cliente: Cliente) => void;
  readOnly?: boolean;
}

export type OrdenAsesor = 
  | 'ventas' 
  | 'tasa' 
  | 'tiempo' 
  | 'actividad'
  | 'clientes'
  | 'sin_reporte'
  | 'criticos'
  | 'tiempo_primer_mensaje'
  | 'seguimientos'
  | 'conexiones_desconectadas'
  | 'whatsapp_desconectado'
  | 'telegram_sin_configurar';