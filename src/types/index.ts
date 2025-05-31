import React from 'react';

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
}

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
}

export interface Registro {
  ID: number;
  ID_CLIENTE: number;
  TIPO_EVENTO: string;
  FECHA_EVENTO: string;
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

export type EstadoCritico = 'CARRITOS' | 'RECHAZADOS' | 'TICKETS';
export type EstadoNoCritico = 'LINK' | 'PAGADO' | 'VENTA CONSOLIDADA' | 'MASIVOS';
export type EstadoAsesor = 'SEGUIMIENTO' | 'NO CONTACTAR' | 'NO CONTESTÓ' | 'NO INTERESADO';
export type EstadoCliente = EstadoCritico | EstadoNoCritico | EstadoAsesor;

export const esEstadoCritico = (estado: EstadoCliente): estado is EstadoCritico => {
  return ['CARRITOS', 'RECHAZADOS', 'TICKETS'].includes(estado);
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