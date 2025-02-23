import React from 'react';

export interface Asesor {
  ID: number;
  NOMBRE: string;
  WHATSAPP: string;
  LINK: number;
  RECHAZADOS: number;
  CARRITOS: number;
  TICKETS: number;
  ES_ADMIN?: boolean;
}

export interface Cliente {
  ID: number;
  NOMBRE: string;
  ESTADO: EstadoCliente;
  WHATSAPP: string;
  ID_ASESOR: number;
  NOMBRE_ASESOR: string;
  WHA_ASESOR: string;
  FECHA_CREACION: string;
  FECHA_COMPRA: string;
  MEDIO_COMPRA: string;
  MONTO_COMPRA: number;
  MONEDA_COMPRA: 'COP' | 'USD';
}

export interface Reporte {
  ID: number;
  ID_CLIENTE: number;
  ID_ASESOR: number;
  ESTADO_ANTERIOR: string;
  ESTADO_NUEVO: string;
  COMENTARIO: string;
  FECHA_REPORTE: number;
  NOMBRE_ASESOR: string;
  FECHA_SEGUIMIENTO: number;
  IMAGEN_PAGO_URL?: string;
  COMPLETADO?: boolean;
  cliente?: Cliente;
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
  tiempoPromedioRespuesta: number;
  tiempoPromedioHastaReporte: number;
  tiempoPromedioHastaVenta: number;
  reportesPorCliente: number;
  reportesConSeguimiento: number;
  montoPromedioVenta: number;
  ultimaActividad: number | null;
  ultimoReporte: number | null;
  ultimoSeguimiento: number | null;
  ultimaVenta: number | null;
}

// Estados críticos que vienen del backend (alta intención de compra)
export type EstadoCritico = 'CARRITOS' | 'RECHAZADOS' | 'TICKETS';

// Estados no críticos que vienen del backend
export type EstadoNoCritico = 'LINK' | 'PAGADO';

// Estados que puede asignar el asesor
export type EstadoAsesor = 'SEGUIMIENTO' | 'NO INTERESADO' | 'NO CONTESTÓ';

// Tipo unión de todos los estados posibles
export type EstadoCliente = EstadoCritico | EstadoNoCritico | EstadoAsesor;

// Función para verificar si un estado es crítico
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