import React, { useState, useMemo } from 'react';
import { apiClient } from '../lib/apiClient';
import { Asesor, Registro } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Clock, Ban, Star, AlertTriangle, CheckCircle2, Info, X, History, RefreshCcw, TrendingUp, TrendingDown, DollarSign, MessageSquare, FileText, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { safeJsonParseArray, safeJsonParseReglaHistorial } from '../utils/safeJsonParse';
import { safeTrim, safeIsEmpty } from '../utils/safeStringUtils';

interface GestionAsignacionesProps {
  asesores: Asesor[];
  onUpdate: () => void;
  estadisticas?: Record<number, any>; // Accept statistics as a prop
}

// Tipo separado para las reglas de prioridad
type TipoPrioridad = 'BONUS' | 'PENALIZACION';

// Tipo para las reglas normales
type ReglaTipo = 'BLOQUEO';

// Tipo combinado para todas las reglas
type TipoReglaCompleto = ReglaTipo | TipoPrioridad;

interface ReglaAsignacion {
  tipo: ReglaTipo;
  valor: number;
  fechaInicio?: Date; // Para UI
  fechaFin?: Date; // Para UI
  fechaInicioEpoch?: number; // Para BD (timestamp Unix en segundos)
  fechaFinEpoch?: number; // Para BD (timestamp Unix en segundos)
  motivo?: string;
  duracion?: 'horas' | 'dias' | 'semanas' | 'personalizado';
  cantidadDuracion?: number;
}

interface ReglaDescripcion {
  titulo: string;
  descripcion: string;
  consecuencias: string;
  ejemplos: string[];
  icono: JSX.Element;
  color: string;
}

interface ReglaHistorial {
  fecha: number; // Timestamp en formato epoch (Unix timestamp)
  tipo: TipoReglaCompleto;
  configuracion: {
    valor?: number;
    fechaInicio?: number; // Timestamp en formato epoch (Unix timestamp)
    fechaFin?: number; // Timestamp en formato epoch (Unix timestamp)
    motivo: string;
    prioridadAnterior?: number;
    prioridadNueva?: number;
  };
}

// Función utilitaria para calcular la fecha de fin basada en duración
const calcularFechaFinDesdeDuracion = (cantidad: number, unidad: 'horas' | 'dias' | 'semanas' | 'personalizado'): Date => {
  // Usar Date para cálculos, asegurando que se maneja en UTC para almacenamiento
  const ahora = new Date();
  const fechaFin = new Date(ahora);
  
  switch(unidad) {
    case 'horas':
      fechaFin.setHours(fechaFin.getHours() + cantidad);
      break;
    case 'dias':
      fechaFin.setDate(fechaFin.getDate() + cantidad);
      break;
    case 'semanas':
      fechaFin.setDate(fechaFin.getDate() + (cantidad * 7));
      break;
    default:
      // No hacer nada para personalizado
      break;
  }
  
  return fechaFin;
};

// Función para convertir epoch UTC a fecha local (UTC-5)
const epochToLocalDate = (epochTimestamp: number): Date => {
  // Crear fecha UTC desde epoch
  const utcDate = new Date(epochTimestamp * 1000);
  // Ajustar a UTC-5
  const offsetHours = -5;
  utcDate.setHours(utcDate.getHours() + offsetHours);
  return utcDate;
};

// Función para convertir fecha local a epoch UTC
const localDateToEpoch = (localDate: Date): number => {
  // Ajustar de UTC-5 a UTC
  const utcDate = new Date(localDate);
  const offsetHours = 5;
  utcDate.setHours(utcDate.getHours() + offsetHours);
  return Math.floor(utcDate.getTime() / 1000);
};

// Función para formatear fecha de manera más concisa (usando epoch)
const formatearFechaConcisa = (epochTimestamp: number): string => {
  if (!epochTimestamp) return 'Fecha no disponible';
  
  // Convertir epoch a fecha local (UTC-5)
  const fechaLocal = epochToLocalDate(epochTimestamp);
  
  // Formatear solo la fecha (sin año si es el año actual)
  const esAnioActual = fechaLocal.getFullYear() === new Date().getFullYear();
  const formatoFecha = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: esAnioActual ? undefined : 'numeric',
    timeZone: 'America/Lima'
  }).format(fechaLocal);
  
  // Formatear la hora
  const formatoHora = new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Lima'
  }).format(fechaLocal);
  
  return `${formatoFecha}, ${formatoHora}`;
};

// Función para mostrar periodo de bloqueo de manera más limpia
const mostrarPeriodoBloqueo = (fechaInicio: Date | null, fechaFin: Date | null): JSX.Element => {
  if (!fechaInicio) return <></>;
  
  // Convertir las fechas Date a epoch UTC
  const fechaInicioEpoch = fechaInicio ? localDateToEpoch(fechaInicio) : 0;
  const fechaFinEpoch = fechaFin ? localDateToEpoch(fechaFin) : 0;
  
  if (!fechaFin) {
    return (
      <div className="flex flex-col">
        <div className="font-medium">Desde: {formatearFechaConcisa(fechaInicioEpoch)}</div>
        <div className="text-red-600 font-medium">Bloqueo indefinido</div>
      </div>
    );
  }

  // Si ambas fechas son del mismo día, simplificamos aún más
  const fechaInicioLocal = epochToLocalDate(fechaInicioEpoch);
  const fechaFinLocal = epochToLocalDate(fechaFinEpoch);
  
  const mismodia = fechaInicioLocal.getDate() === fechaFinLocal.getDate() && 
                  fechaInicioLocal.getMonth() === fechaFinLocal.getMonth() && 
                  fechaInicioLocal.getFullYear() === fechaFinLocal.getFullYear();

  if (mismodia) {
    const fecha = formatearFechaConcisa(fechaInicioEpoch).split(',')[0];
    const horaInicio = new Intl.DateTimeFormat('es-PE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Lima'
    }).format(fechaInicioLocal);
    
    const horaFin = new Intl.DateTimeFormat('es-PE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Lima'
    }).format(fechaFinLocal);
    
    return (
      <div className="flex flex-col">
        <div className="font-medium">{fecha}</div>
        <div className="text-gray-600">{horaInicio} → {horaFin}</div>
      </div>
    );
  }
  
  // Si son días diferentes
  return (
    <div className="flex flex-col space-y-1">
      <div className="font-medium">
        <span className="text-gray-700">Desde:</span> {formatearFechaConcisa(fechaInicioEpoch)}
      </div>
      <div className="font-medium">
        <span className="text-gray-700">Hasta:</span> {formatearFechaConcisa(fechaFinEpoch)}
      </div>
    </div>
  );
};

// Función para calcular tiempo restante hasta que termine el bloqueo
const calcularTiempoRestante = (fechaFin: Date): string => {
  const ahoraLocal = new Date();
  const fechaFinLocal = epochToLocalDate(localDateToEpoch(fechaFin));
  
  // Si la fecha fin ya pasó
  if (fechaFinLocal <= ahoraLocal) {
    return "Finalizado";
  }
  
  const diferenciaSeg = Math.floor((fechaFinLocal.getTime() - ahoraLocal.getTime()) / 1000);
  
  // Convertir segundos a días, horas, minutos
  const dias = Math.floor(diferenciaSeg / (60 * 60 * 24));
  const horas = Math.floor((diferenciaSeg % (60 * 60 * 24)) / (60 * 60));
  const minutos = Math.floor((diferenciaSeg % (60 * 60)) / 60);
  
  if (dias > 0) {
    return `${dias}d ${horas}h restantes`;
  } else if (horas > 0) {
    return `${horas}h ${minutos}m restantes`;
  } else {
    return `${minutos} minutos restantes`;
  }
};

// Add these constants at the top of the component, after the useState declarations
// Define the objective performance range
const OBJETIVO_TASA_CIERRE = {
  MIN: 19,  // Límite inferior del rango objetivo
  MAX: 22,  // Límite superior del rango objetivo
};

// Performance status helper function
const getPerformanceStatus = (tasaCierre: number): 'superior' | 'objetivo' | 'inferior' => {
  if (tasaCierre > OBJETIVO_TASA_CIERRE.MAX) return 'superior';
  if (tasaCierre >= OBJETIVO_TASA_CIERRE.MIN && tasaCierre <= OBJETIVO_TASA_CIERRE.MAX) return 'objetivo';
  return 'inferior';
};

// Función para formatear tiempo en minutos de forma legible
const formatearTiempoMinutos = (minutos: number | null) => {
  if (minutos === null) return 'Nunca';
  
  if (minutos < 60) {
    return `${minutos}m`;
  } else if (minutos < 1440) { // menos de 24h
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}m` : `${horas}h`;
  } else { // más de 24h
    const dias = Math.floor(minutos / 1440);
    const horasRestantes = Math.floor((minutos % 1440) / 60);
    return horasRestantes > 0 ? `${dias}d ${horasRestantes}h` : `${dias}d`;
  }
};

// Función para obtener color según el tiempo transcurrido
const getColorTiempo = (minutos: number | null, limite: number = 60) => {
  if (minutos === null) return 'bg-gray-200 text-gray-600';
  if (minutos <= limite) return 'bg-green-100 text-green-700';
  if (minutos <= limite * 3) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

export default function GestionAsignaciones({ asesores, onUpdate, estadisticas = {} }: GestionAsignacionesProps) {
  // Función auxiliar para verificar si un asesor está bloqueado
  const isAsesorBloqueado = (asesor: Asesor, ahoraEpoch: number): boolean => {
    if (!asesor.FECHA_INICIO_REGLA) return false;
    
    const fechaInicioEpoch = Number(asesor.FECHA_INICIO_REGLA);
    const fechaFinEpoch = asesor.FECHA_FIN_REGLA ? Number(asesor.FECHA_FIN_REGLA) : null;
    
    // Bloqueo indefinido
    if (!fechaFinEpoch) return true;
    
    // Bloqueo temporal dentro del rango de fechas
    return ahoraEpoch >= fechaInicioEpoch && ahoraEpoch <= fechaFinEpoch;
  };

  // 🔍 Debug: Log para verificar prioridades desde BD
  console.log('🎯 [GestionAsignaciones] Asesores con prioridades:', 
    asesores.map(a => ({ 
      id: a.ID, 
      nombre: a.NOMBRE, 
      prioridadBD: a.PRIORIDAD,
      prioridadCalculada: a.PRIORIDAD || 1
    }))
  );
  
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalPrioridad, setMostrarModalPrioridad] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [motivoPrioridad, setMotivoPrioridad] = useState('');
  const [tipoPrioridadSeleccionada, setTipoPrioridadSeleccionada] = useState<TipoPrioridad>('BONUS');
  const [registros, setRegistros] = useState<Registro[]>([]);
  
  // Cargar registros para obtener las fuentes
  React.useEffect(() => {
    const cargarRegistros = async () => {
      try {
        const data = await apiClient.request<Registro[]>('/GERSSON_REGISTROS?order=FECHA_EVENTO.desc');
        setRegistros(data || []);
      } catch (error) {
        console.error('Error al cargar registros:', error);
      }
    };
    
    cargarRegistros();
  }, []);

  // Función para obtener la fuente de un cliente
  const getFuente = (clienteId: number): string => {
    const registrosCliente = registros.filter(r => r.ID_CLIENTE === clienteId);
    if (registrosCliente.length > 0) {
      // Ordenar por fecha más antigua primero para obtener la fuente original
      registrosCliente.sort((a, b) => {
        const fechaA = typeof a.FECHA_EVENTO === 'string' ? parseInt(a.FECHA_EVENTO) : a.FECHA_EVENTO;
        const fechaB = typeof b.FECHA_EVENTO === 'string' ? parseInt(b.FECHA_EVENTO) : b.FECHA_EVENTO;
        return fechaA - fechaB;
      });
      return registrosCliente[0].TIPO_EVENTO?.trim() || 'Desconocido';
    }
    return 'Desconocido';
  };

  // Estado para clientes por asesor y función para cargarlos
  const [clientesPorAsesor, setClientesPorAsesor] = useState<Record<number, any[]>>({});

  React.useEffect(() => {
    const cargarClientesPorAsesor = async () => {
      try {
        const promesasClientes = asesores.map(async (asesor) => {
          try {
            const clientes = await apiClient.request<any[]>(`/GERSSON_CLIENTES?ID_ASESOR=eq.${asesor.ID}&order=FECHA_CREACION.desc&limit=1`);
            return { asesorId: asesor.ID, clientes: clientes || [] };
          } catch (error) {
            console.error(`Error cargando clientes para asesor ${asesor.NOMBRE}:`, error);
            return { asesorId: asesor.ID, clientes: [] };
          }
        });
        
        const resultados = await Promise.all(promesasClientes);
        const clientesMap: Record<number, any[]> = {};
        
        resultados.forEach(({ asesorId, clientes }) => {
          clientesMap[asesorId] = clientes;
        });
        
        setClientesPorAsesor(clientesMap);
      } catch (error) {
        console.error('Error al cargar clientes por asesor:', error);
      }
    };
    
    if (asesores.length > 0) {
      cargarClientesPorAsesor();
    }
  }, [asesores]);

  // Función para obtener el último cliente asignado de un asesor
  const getUltimoClienteAsignado = (asesorId: number) => {
    const clientes = clientesPorAsesor[asesorId] || [];
    return clientes.length > 0 ? clientes[0] : null;
  };

  // Inicializar con valores por defecto incluidas fechas para reglas temporales
  const [nuevaRegla, setNuevaRegla] = useState<ReglaAsignacion>(() => {
    // Para bloqueos con duración predeterminada, establecer fechas 
    const fechaInicio = new Date();
    const fechaFin = calcularFechaFinDesdeDuracion(24, 'horas'); // 24 horas por defecto
    
    // Convertir a epoch para BD
    const fechaInicioEpoch = Math.floor(fechaInicio.getTime() / 1000);
    const fechaFinEpoch = Math.floor(fechaFin.getTime() / 1000);
    
    console.log("Inicializando estado de nueva regla con fechas:", {
      fechaInicio,
      fechaFin,
      fechaInicioEpoch,
      fechaFinEpoch
    });
    
    return {
      tipo: 'BLOQUEO',
      valor: 0,
      motivo: '',
      duracion: 'personalizado',
      cantidadDuracion: 24,
      fechaInicio,
      fechaFin,
      fechaInicioEpoch,
      fechaFinEpoch
    };
  });
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [ordenamiento, setOrdenamiento] = useState<'nombre' | 'prioridad' | 'tasa_cierre'>('tasa_cierre');
  const [mostrarModalAsignacionPuntos, setMostrarModalAsignacionPuntos] = useState(false);
  const [detallesAsignacionPuntos, setDetallesAsignacionPuntos] = useState<{
    actualizaciones: Array<{
      nombre: string;
      cambio: number;
      tasaCierre: number;
      prioridadActual: number;
      motivo: string;
    }>;
    promedioTasaCierre: number;
  }>({
    actualizaciones: [],
    promedioTasaCierre: 0
  });
  const [mostrarModalRestablecerPrioridades, setMostrarModalRestablecerPrioridades] = useState(false);

  // Ordenar asesores según el criterio seleccionado
  const asesoresOrdenados = useMemo(() => {
    return [...asesores].sort((a, b) => {
      // Primero verificar si están bloqueados
      const ahoraEpoch = Math.floor(Date.now() / 1000);
      
      const aBloqueado = isAsesorBloqueado(a, ahoraEpoch);
      const bBloqueado = isAsesorBloqueado(b, ahoraEpoch);
      
      // Si uno está bloqueado y el otro no, el bloqueado va al final
      if (aBloqueado && !bBloqueado) return 1;
      if (!aBloqueado && bBloqueado) return -1;
      
      // Si ambos están bloqueados o ambos no están bloqueados, ordenar por el criterio seleccionado
      if (ordenamiento === 'prioridad') {
        const prioridadA = a.PRIORIDAD || 1;
        const prioridadB = b.PRIORIDAD || 1;
        // Si las prioridades son iguales, ordenar por tasa de cierre
        if (prioridadB === prioridadA) {
          const tasaA = estadisticas[a.ID]?.porcentajeCierre || 0;
          const tasaB = estadisticas[b.ID]?.porcentajeCierre || 0;
          return tasaB - tasaA;
        }
        return prioridadB - prioridadA;
      }
      if (ordenamiento === 'tasa_cierre') {
        const tasaA = estadisticas[a.ID]?.porcentajeCierre || 0;
        const tasaB = estadisticas[b.ID]?.porcentajeCierre || 0;
        // Si las tasas son iguales, ordenar por prioridad
        if (tasaB === tasaA) {
          const prioridadA = a.PRIORIDAD || 1;
          const prioridadB = b.PRIORIDAD || 1;
          return prioridadB - prioridadA;
        }
        return tasaB - tasaA;
      }
      // Por defecto, ordenar por nombre pero considerar prioridad si los nombres son iguales
      const comparacionNombre = a.NOMBRE.localeCompare(b.NOMBRE);
      if (comparacionNombre === 0) {
        const prioridadA = a.PRIORIDAD || 1;
        const prioridadB = b.PRIORIDAD || 1;
        return prioridadB - prioridadA;
      }
      return comparacionNombre;
    });
  }, [asesores, ordenamiento, estadisticas]);

  const reglasDescripciones: Record<ReglaTipo, ReglaDescripcion> = {
   
    BLOQUEO: {
      titulo: 'Bloqueo',
      descripcion: 'Detiene temporalmente o indefinidamente la asignación de nuevos clientes.',
      consecuencias: 'El asesor no recibirá nuevos clientes hasta que se levante el bloqueo.',
      ejemplos: [
        'Bloqueo por vacaciones programadas',
        'Bloqueo temporal por sobrecarga de trabajo',
        'Bloqueo por ausencia'
      ],
      icono: <Ban className="h-6 w-6" />,
      color: 'text-red-600'
    }
  };

  const aplicarRegla = async (asesorId: number, regla: ReglaAsignacion) => {
    try {
      const asesorActual = asesores.find(a => a.ID === asesorId);
      if (!asesorActual) throw new Error('Asesor no encontrado');
      
      const historialActual: ReglaHistorial[] = safeJsonParseReglaHistorial(asesorActual.HISTORIAL) as ReglaHistorial[];
      const prioridadActual = asesorActual.PRIORIDAD || 1;

      // Convertir fechas locales a UTC epoch
      const fechaInicioEpoch = regla.fechaInicioEpoch !== undefined ? regla.fechaInicioEpoch :
                               regla.fechaInicio ? localDateToEpoch(regla.fechaInicio) : undefined;
      const fechaFinEpoch = regla.fechaFinEpoch !== undefined ? regla.fechaFinEpoch :
                            regla.fechaFin ? localDateToEpoch(regla.fechaFin) : undefined;

      // Crear nueva entrada en el historial con el motivo
      const nuevaEntrada: ReglaHistorial = {
        fecha: Math.floor(Date.now() / 1000), // Guardar la fecha como epoch
        tipo: regla.tipo,
        configuracion: {
          valor: regla.valor,
          fechaInicio: fechaInicioEpoch,
          fechaFin: fechaFinEpoch,
          motivo: regla.motivo || '',
          prioridadAnterior: prioridadActual,
          prioridadNueva: prioridadActual
        }
      };

      const historialActualizado = [...historialActual, nuevaEntrada];

      // Preparar el payload asegurando que los timestamps sean números
      const payload: Record<string, any> = {
        HISTORIAL: JSON.stringify(historialActualizado)
      };
      
  
      // Construir el endpoint con los parámetros de tipo correcto
      let endpoint = `${import.meta.env.VITE_POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${asesorId}`;
      
      // Agregar los campos de fecha como números (epoch UTC)
      if (fechaInicioEpoch !== undefined) {
        payload.FECHA_INICIO_REGLA = Number(fechaInicioEpoch);
      }
      
      if (fechaFinEpoch !== undefined) {
        payload.FECHA_FIN_REGLA = Number(fechaFinEpoch);
      }
      
      console.log('Enviando PATCH a PostgREST:', {
        ...payload,
        regla_original: regla,
        fechas_epoch: { fechaInicioEpoch, fechaFinEpoch }
      });

      // Intentar enviar la solicitud
      try {
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Respuesta exitosa:', data);
        toast.success('Regla aplicada correctamente');
      } catch (fetchError: any) {
        console.error('Error detallado en fetch:', fetchError);
        throw fetchError;
      }

      onUpdate();
      setMostrarModal(false);
    } catch (error: any) {
      console.error('Error al aplicar regla:', error);
      toast.error('Error al aplicar la regla');
    }
  };

  // Función para quitar el bloqueo de un asesor
  const quitarBloqueo = async (asesorId: number) => {
    try {
      const asesorActual = asesores.find(a => a.ID === asesorId);
      if (!asesorActual) throw new Error('Asesor no encontrado');
      
      const historialActual: ReglaHistorial[] = safeJsonParseReglaHistorial(asesorActual.HISTORIAL) as ReglaHistorial[];
      const prioridadActual = asesorActual.PRIORIDAD || 1;

      // Crear nueva entrada en el historial para registrar la eliminación del bloqueo
      const nuevaEntrada: ReglaHistorial = {
        fecha: Math.floor(Date.now() / 1000),
        tipo: 'BLOQUEO',
        configuracion: {
          motivo: `Bloqueo eliminado por administrador`,
          prioridadAnterior: prioridadActual,
          prioridadNueva: prioridadActual
        }
      };

      const historialActualizado = [...historialActual, nuevaEntrada];

      // Preparar el payload para quitar el bloqueo
      const payload: Record<string, any> = {
        FECHA_INICIO_REGLA: null, // Eliminar fecha de inicio
        FECHA_FIN_REGLA: null,    // Eliminar fecha de fin
        HISTORIAL: JSON.stringify(historialActualizado)
      };
      
      console.log('Enviando PATCH para quitar bloqueo:', payload);

      // Enviar la solicitud
      try {
        const response = await fetch(`${import.meta.env.VITE_POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${asesorId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Bloqueo eliminado con éxito:', data);
        toast.success('Bloqueo eliminado correctamente');
        
        onUpdate();
      } catch (fetchError: any) {
        console.error('Error al quitar bloqueo:', fetchError);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Error al quitar bloqueo:', error);
      toast.error('Error al quitar el bloqueo');
    }
  };

  const aplicarPrioridad = async (asesorId: number, tipo: TipoPrioridad, motivo: string) => {
    try {
      const asesorActual = asesores.find(a => a.ID === asesorId);
      if (!asesorActual) throw new Error('Asesor no encontrado');
      
      const historialActual: ReglaHistorial[] = safeJsonParseReglaHistorial(asesorActual.HISTORIAL) as ReglaHistorial[];
      const prioridadActual = asesorActual.PRIORIDAD || 1;
      
      // Calcular la nueva prioridad con límites estrictos: máximo +3 (prioridad 4), mínimo 1
      const nuevaPrioridad = tipo === 'BONUS' 
        ? Math.min(prioridadActual + 1, 4)  // Máximo 4 (base 1 + 3)
        : Math.max(prioridadActual - 1, 1);  // Mínimo 1
      
      // Validar que no se exceda el límite máximo de +3
      if (tipo === 'BONUS' && prioridadActual >= 4) {
        toast.error('El asesor ya tiene la prioridad máxima (+3). No se puede aumentar más.');
        setMostrarModalPrioridad(false);
        return;
      }
      
      // Validar que no se exceda el límite mínimo
      if (tipo === 'PENALIZACION' && prioridadActual <= 1) {
        toast.error('El asesor ya tiene la prioridad mínima. No se puede reducir más.');
        setMostrarModalPrioridad(false);
        return;
      }

      // Crear nueva entrada en el historial con epoch
      const nuevaEntrada: ReglaHistorial = {
        fecha: Math.floor(Date.now() / 1000), // Guardar como epoch
        tipo: tipo,
        configuracion: {
          motivo: motivo,
          prioridadAnterior: prioridadActual,
          prioridadNueva: nuevaPrioridad
        }
      };

      const historialActualizado = [...historialActual, nuevaEntrada];
      
      // Preparar el payload con tipado correcto
      const payload: Record<string, any> = {
        PRIORIDAD: nuevaPrioridad,
        HISTORIAL: JSON.stringify(historialActualizado)
      };
      
      console.log('Enviando PATCH de prioridad a PostgREST:', payload);

      // Intentar enviar la solicitud
      try {
        const response = await fetch(`${import.meta.env.VITE_POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${asesorId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Respuesta exitosa:', data);
        toast.success(tipo === 'BONUS' ? 'Bonificación aplicada correctamente' : 'Penalización aplicada correctamente');
      } catch (fetchError: any) {
        console.error('Error detallado en fetch:', fetchError);
        throw fetchError;
      }

      onUpdate();
      setMostrarModalPrioridad(false);
    } catch (error: any) {
      console.error('Error al aplicar prioridad:', error);
      toast.error('Error al modificar la prioridad');
    }
  };

  const renderHistorialItem = (entrada: ReglaHistorial) => {
    let icono;
    let colorTexto;
    let colorFondo;
    let colorBorde;
    let etiqueta;
    
    switch (entrada.tipo) {
      case 'BLOQUEO':
        icono = <Ban className="h-5 w-5" />;
        colorTexto = 'text-red-700';
        colorFondo = 'bg-red-50';
        colorBorde = 'border-red-200';
        etiqueta = 'Bloqueo';
        break;
      case 'BONUS':
        icono = <ArrowUpCircle className="h-5 w-5" />;
        colorTexto = 'text-green-700';
        colorFondo = 'bg-green-50';
        colorBorde = 'border-green-200';
        etiqueta = 'Bonificación';
        break;
      case 'PENALIZACION':
        icono = <ArrowDownCircle className="h-5 w-5" />;
        colorTexto = 'text-orange-700';
        colorFondo = 'bg-orange-50';
        colorBorde = 'border-orange-200';
        etiqueta = 'Penalización';
        break;
    }

    const cambioTexto = entrada.configuracion.prioridadAnterior !== undefined && entrada.configuracion.prioridadNueva !== undefined ?
      `${entrada.configuracion.prioridadAnterior} → ${entrada.configuracion.prioridadNueva}` : '';
    
    // Calcular si la regla está activa usando timestamps epoch
    const ahoraEpoch = Math.floor(Date.now() / 1000);
    const fechaInicioEpoch = entrada.configuracion.fechaInicio || null;
    const fechaFinEpoch = entrada.configuracion.fechaFin || null;
    // Convertimos a Date para mostrar en la UI si es necesario
    const fechaInicio = fechaInicioEpoch ? new Date(fechaInicioEpoch * 1000) : null;
    const fechaFin = fechaFinEpoch ? new Date(fechaFinEpoch * 1000) : null;
    
    const estaActiva = fechaInicioEpoch && (
      !fechaFinEpoch || // bloqueo indefinido
      (ahoraEpoch >= fechaInicioEpoch && ahoraEpoch <= fechaFinEpoch) // dentro del rango de fechas
    );

    return (
      <div className={`p-4 bg-white rounded-lg shadow border ${colorBorde} mb-3 relative overflow-hidden`}>
        {/* Indicador visual del tipo de regla */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorFondo}`}></div>
        
        {/* Cabecera con tipo y fecha */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full ${colorFondo} flex items-center justify-center ${colorTexto}`}>
              {icono}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${colorTexto}`}>
                  {etiqueta}
                </span>
                {estaActiva && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Activa
                  </span>
                )}
                {cambioTexto && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded-md text-xs font-medium">
                    Prioridad: {cambioTexto}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {formatearFechaConcisa(entrada.fecha)}
              </span>
            </div>
          </div>
          
         
        </div>
        
        {/* Fechas de bloqueo si existen */}
        {(entrada.tipo === 'BLOQUEO' && (entrada.configuracion.fechaInicio || entrada.configuracion.fechaFin)) && (
          <div className="mb-2 p-2 bg-gray-50 rounded-md border border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              {entrada.configuracion.fechaInicio && (
                <div>
                  <span className="text-xs text-gray-500 block">Inicio</span>
                  <span className="text-sm font-medium">{formatearFechaConcisa(entrada.configuracion.fechaInicio)}</span>
                </div>
              )}
              {entrada.configuracion.fechaFin ? (
                <div>
                  <span className="text-xs text-gray-500 block">Fin</span>
                  <span className="text-sm font-medium">{formatearFechaConcisa(entrada.configuracion.fechaFin)}</span>
                </div>
              ) : (
                <div>
                  <span className="text-xs text-gray-500 block">Duración</span>
                  <span className="text-sm font-medium text-red-600">Indefinido</span>
                </div>
              )}
            </div>
            
            {fechaFin && ahoraEpoch <= (fechaFin.getTime() / 1000) && (
              <div className="mt-1 text-right">
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                  {calcularTiempoRestante(fechaFin)}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Motivo de la regla */}
        <div className="mt-1">
          <span className="text-xs text-gray-500 block">Motivo</span>
          <p className="text-sm text-gray-700">
            {entrada.configuracion.motivo}
          </p>
        </div>
      </div>
    );
  };

  const prepararAsignacionPuntos = () => {
    // Validar que hay estadísticas disponibles
    if (Object.keys(estadisticas).length === 0) {
      toast.error('No hay estadísticas disponibles para asignar puntos');
      return;
    }

    // Calcular el promedio de tasa de cierre
    const promedioTasaCierre = Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) / Object.keys(estadisticas).length;

    // Preparar un arreglo de actualizaciones
    const actualizaciones: Array<{
      nombre: string;
      cambio: number;
      tasaCierre: number;
      prioridadActual: number;
      motivo: string;
    }> = [];

    // Iterar sobre cada asesor
    asesores.forEach(asesor => {
      const stats = estadisticas[asesor.ID];
      const prioridadActual = asesor.PRIORIDAD || 1;  // Asegurar que la prioridad mínima sea 1
      
      if (!stats) {
        console.warn(`Sin estadísticas para asesor ${asesor.NOMBRE}`);
        return;
      }

      const tasaCierre = stats.porcentajeCierre;
      let cambio = 0;
      let motivo = '';

      if (tasaCierre > OBJETIVO_TASA_CIERRE.MAX) {
        // Solo aumentar si la prioridad actual es menor que 4 (máximo +3)
        cambio = prioridadActual < 4 ? 1 : 0;
        motivo = prioridadActual < 4
          ? `Rendimiento superior al rango objetivo (${tasaCierre.toFixed(1)}% > ${OBJETIVO_TASA_CIERRE.MAX}%)`
          : `Rendimiento superior al rango objetivo, pero prioridad máxima alcanzada (+3)`;
      } else if (tasaCierre < OBJETIVO_TASA_CIERRE.MIN) {
        // Solo restar si la prioridad actual es mayor que 1
        cambio = prioridadActual > 1 ? -1 : 0;
        motivo = prioridadActual > 1 
          ? `Rendimiento inferior al rango objetivo (${tasaCierre.toFixed(1)}% < ${OBJETIVO_TASA_CIERRE.MIN}%)` 
          : `Rendimiento inferior al rango objetivo, pero prioridad mínima alcanzada`;
      } else {
        motivo = `Rendimiento dentro del rango objetivo (${tasaCierre.toFixed(1)}%)`;
      }

      if (cambio !== 0) {
        actualizaciones.push({
          nombre: asesor.NOMBRE,
          cambio,
          tasaCierre,
          prioridadActual,
          motivo
        });
      }
    });

    // Ordenar actualizaciones para tener un orden consistente
    actualizaciones.sort((a, b) => b.tasaCierre - a.tasaCierre);

    // Mostrar modal de confirmación
    setDetallesAsignacionPuntos({
      actualizaciones,
      promedioTasaCierre
    });
    setMostrarModalAsignacionPuntos(true);
  };

  const restablecerPrioridadesATodos = async () => {
    try {
      // Preparar actualizaciones para todos los asesores
      const actualizaciones: Array<{
        asesorId: number;
        nombre: string;
        prioridadActual: number;
      }> = [];

      // Iterar sobre cada asesor
      asesores.forEach(asesor => {
        const prioridadActual = asesor.PRIORIDAD || 1;
        
        // Solo incluir si la prioridad no es ya 1
        if (prioridadActual !== 1) {
          actualizaciones.push({
            asesorId: asesor.ID,
            nombre: asesor.NOMBRE,
            prioridadActual
          });
        }
      });

      // Si no hay cambios, mostrar mensaje
      if (actualizaciones.length === 0) {
        toast('Todas las prioridades ya están en 1', {
          icon: '📊',
          duration: 3000
        });
        setMostrarModalRestablecerPrioridades(false);
        return;
      }

      // Realizar las actualizaciones en lote
      const resultados: Array<{nombre: string, exito: boolean, error?: string}> = [];
      for (const actualizacion of actualizaciones) {
        try {
          // Find the current advisor
          const asesorActual = asesores.find(a => a.ID === actualizacion.asesorId);
          
          // Parse existing history or start with an empty array
          const historialActual: ReglaHistorial[] = safeJsonParseReglaHistorial(asesorActual?.HISTORIAL) as ReglaHistorial[];
          
          // Create a new entry for the priority reset
          const nuevaEntrada: ReglaHistorial = {
            fecha: Math.floor(Date.now() / 1000),
            tipo: 'PENALIZACION',
            configuracion: {
              motivo: 'Restablecimiento global de prioridades',
              prioridadAnterior: actualizacion.prioridadActual,
              prioridadNueva: 1
            }
          };

          // Append the new entry to the existing history
          const historialActualizado = [...historialActual, nuevaEntrada];

          // Preparar payload
          const payload: Record<string, any> = {
            PRIORIDAD: 1,
            HISTORIAL: JSON.stringify(historialActualizado)
          };

          // Enviar solicitud
          const response = await fetch(`${import.meta.env.VITE_POSTGREST_URL}/GERSSON_ASESORES?ID=eq.${actualizacion.asesorId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
          }

          resultados.push({ 
            nombre: actualizacion.nombre, 
            exito: true 
          });
        } catch (error) {
          console.error(`Error al restablecer ${actualizacion.nombre}:`, error);
          resultados.push({ 
            nombre: actualizacion.nombre, 
            exito: false, 
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }

      // Generar mensaje detallado
      const exitosos = resultados.filter(r => r.exito);
      const fallidos = resultados.filter(r => !r.exito);

      if (exitosos.length > 0) {
        toast.success(`Prioridades restablecidas: ${exitosos.length} asesores actualizados`, {
          duration: 4000,
          position: 'top-center'
        });
      }

      if (fallidos.length > 0) {
        toast.error(`Errores al restablecer prioridades: ${fallidos.length} asesores no actualizados`, {
          duration: 4000,
          position: 'top-center'
        });
        console.error('Detalles de errores:', fallidos);
      }

      // Forzar actualización de la vista
      onUpdate();
      setMostrarModalRestablecerPrioridades(false);
    } catch (error) {
      console.error('Error crítico al restablecer prioridades:', error);
      toast.error('Error crítico al restablecer prioridades');
    }
  };

  // Añadir la función para formatear el tiempo transcurrido después de formatearFechaConcisa
  // Función para formatear tiempo transcurrido
  const formatTiempoTranscurrido = (epochTimestamp: number): string => {
    if (!epochTimestamp) return 'Fecha no disponible';
    
    const ahora = Math.floor(Date.now() / 1000);
    const segundosTranscurridos = ahora - epochTimestamp;
    
    if (segundosTranscurridos < 60) {
      return 'Hace unos segundos';
    } else if (segundosTranscurridos < 3600) {
      const minutos = Math.floor(segundosTranscurridos / 60);
      return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
    } else if (segundosTranscurridos < 86400) {
      const horas = Math.floor(segundosTranscurridos / 3600);
      return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    } else if (segundosTranscurridos < 2592000) {
      const dias = Math.floor(segundosTranscurridos / 86400);
      return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
    } else if (segundosTranscurridos < 31536000) {
      const meses = Math.floor(segundosTranscurridos / 2592000);
      return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    } else {
      const años = Math.floor(segundosTranscurridos / 31536000);
      return `Hace ${años} ${años === 1 ? 'año' : 'años'}`;
    }
  };

  // Calculate advisor counts
  const ahoraEpoch = Math.floor(Date.now() / 1000);
  const recuentoAsesores = useMemo(() => {
    let activos = 0;
    let bloqueados = 0;
    let pausados = 0;

    asesores.forEach(asesor => {
      const estaBloqueado = isAsesorBloqueado(asesor, ahoraEpoch);
      
      if (estaBloqueado) {
        bloqueados++;
      } else if (asesor.PAUSADO) {
        pausados++;
      } else {
        activos++;
      }
    });

    return { activos, bloqueados, pausados, total: asesores.length };
  }, [asesores, ahoraEpoch]);

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Gestión de Asignaciones</h2>
            <p className="text-gray-600 mt-2">
              Administra las reglas de asignación para cada asesor.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={ordenamiento}
              onChange={(e) => setOrdenamiento(e.target.value as 'nombre' | 'prioridad' | 'tasa_cierre')}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="nombre">Ordenar por nombre</option>
              <option value="prioridad">Ordenar por prioridad</option>
              <option value="tasa_cierre">Ordenar por tasa de cierre</option>
            </select>
            <button
              onClick={prepararAsignacionPuntos}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
              title="Realizar asignación periódica de prioridades basada en rendimiento"
            >
              <Star className="h-4 w-4" />
              Asignación Periódica de Prioridades
            </button>
            <button
              onClick={() => setMostrarAyuda(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
              title="Ver guía de reglas"
            >
              <Info className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

     

      {/* Leyenda de Tasa de Conversión */}
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            Referencia de Tasa de Conversión
          </h3>
          <div className="text-xs text-gray-500">
            Objetivo: {OBJETIVO_TASA_CIERRE.MIN}% - {OBJETIVO_TASA_CIERRE.MAX}%
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Rendimiento Superior */}
          <div className="bg-white rounded-md p-3 border-l-2 border-green-500 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-semibold text-green-700">Superior</span>
            </div>
            <div className="text-sm font-bold text-green-600 mb-1">
              &gt; {OBJETIVO_TASA_CIERRE.MAX}%
            </div>
            <div className="text-xs text-gray-600">
              ↗ Candidato a bonificación
            </div>
          </div>

          {/* Rendimiento Objetivo */}
          <div className="bg-white rounded-md p-3 border-l-2 border-blue-500 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs font-semibold text-blue-700">Objetivo</span>
            </div>
            <div className="text-sm font-bold text-blue-600 mb-1">
              {OBJETIVO_TASA_CIERRE.MIN}% - {OBJETIVO_TASA_CIERRE.MAX}%
            </div>
            <div className="text-xs text-gray-600">
              ✓ Mantener el trabajo
            </div>
          </div>

          {/* Rendimiento Inferior */}
          <div className="bg-white rounded-md p-3 border-l-2 border-red-500 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-xs font-semibold text-red-700">Inferior</span>
            </div>
            <div className="text-sm font-bold text-red-600 mb-1">
              &lt; {OBJETIVO_TASA_CIERRE.MIN}%
            </div>
            <div className="text-xs text-gray-600">
              ⚠ Requiere seguimiento
            </div>
          </div>
        </div>
      </div>

       {/* Recuento de Asesores */}
       <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            Estado del Equipo
          </h3>
          <div className="text-sm text-gray-500">
            Total: {recuentoAsesores.total}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Asesores Activos */}
          <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-3">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">{recuentoAsesores.activos}</div>
                  <div className="text-sm text-green-600">Activos</div>
                </div>
              </div>
              <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                {recuentoAsesores.total > 0 ? Math.round((recuentoAsesores.activos / recuentoAsesores.total) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Asesores Bloqueados */}
          <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center mr-3">
                  <Ban className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold text-red-700">{recuentoAsesores.bloqueados}</div>
                  <div className="text-sm text-red-600">Bloqueados</div>
                </div>
              </div>
              <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                {recuentoAsesores.total > 0 ? Math.round((recuentoAsesores.bloqueados / recuentoAsesores.total) * 100) : 0}%
              </div>
            </div>
          </div>

        </div>
        
        
      </div>

      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-lg border border-gray-200">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                Asesor
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                Prioridad
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                Tasa de Cierre
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                Estado
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                Última Actividad
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                Reglas Activas
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {asesoresOrdenados.map((asesor, index) => (
              <tr key={asesor.ID} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                <td className="px-4 py-6 text-center border-r border-gray-200">
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</div>
                    <div className="text-xs text-gray-500 mt-1">ID: {asesor.ID}</div>
                  </div>
                </td>
                <td className="px-4 py-6 text-center border-r border-gray-200">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="flex items-center justify-center">
                      {(asesor.PRIORIDAD ?? 1) > 1 ? (
                        <div className="flex items-center text-green-600">
                          <ArrowUpCircle className="h-5 w-5" />
                          <span className="ml-1 font-medium">
                            Prioridad {asesor.PRIORIDAD ?? 1}
                            {(asesor.PRIORIDAD ?? 1) >= 4 && 
                              <span className="ml-1 px-1 py-0.5 bg-green-200 text-green-800 rounded text-xs">MAX</span>
                            }
                          </span>
                        </div>
                      ) : (asesor.PRIORIDAD ?? 0) < 1 ? (
                        <div className="flex items-center text-red-600">
                          <ArrowDownCircle className="h-5 w-5" />
                          <span className="ml-1 font-medium">
                            Penalizado ({asesor.PRIORIDAD})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-500">
                          <span className="font-medium">Normal (1)</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => {
                          setAsesorSeleccionado(asesor);
                          setTipoPrioridadSeleccionada('BONUS');
                          setMostrarModalPrioridad(true);
                        }}
                        disabled={(asesor.PRIORIDAD ?? 1) >= 4}
                        className={`p-2 rounded-full transition-colors ${
                          (asesor.PRIORIDAD ?? 1) >= 4 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={(asesor.PRIORIDAD ?? 1) >= 4 ? 'Prioridad máxima alcanzada (+3)' : 'Premiar asesor'}
                      >
                        <ArrowUpCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setAsesorSeleccionado(asesor);
                          setTipoPrioridadSeleccionada('PENALIZACION');
                          setMostrarModalPrioridad(true);
                        }}
                        disabled={(asesor.PRIORIDAD ?? 1) <= 1}
                        className={`p-2 rounded-full transition-colors ${
                          (asesor.PRIORIDAD ?? 1) <= 1 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                        title={(asesor.PRIORIDAD ?? 1) <= 1 ? 'Prioridad mínima alcanzada' : 'Penalizar asesor'}
                      >
                        <ArrowDownCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-6 text-center border-r border-gray-200">
                  {estadisticas[asesor.ID] ? (
                    <div className="flex flex-col items-center space-y-2">
                      {/* Tasa principal */}
                      <div className="flex flex-col items-center">
                        <div className="font-bold text-2xl text-blue-600">
                          {estadisticas[asesor.ID].porcentajeCierre.toFixed(1)}%
                        </div>
                        {/* Separación VIP/No VIP */}
                        {(estadisticas[asesor.ID].porcentajeCierreVIP !== undefined || estadisticas[asesor.ID].porcentajeCierreNoVIP !== undefined) && (
                          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                            <div>VIP: {estadisticas[asesor.ID].porcentajeCierreVIP?.toFixed(1) || '0.0'}%</div>
                            <div>Otros: {estadisticas[asesor.ID].porcentajeCierreNoVIP?.toFixed(1) || '0.0'}%</div>
                          </div>
                        )}
                        {(() => {
                          const tasa = estadisticas[asesor.ID].porcentajeCierre;
                          if (tasa > OBJETIVO_TASA_CIERRE.MAX) {
                            return (
                              <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <TrendingUp className="h-3 w-3 text-green-600" />
                                <span className="text-xs text-green-700 font-semibold">Superior</span>
                              </div>
                            );
                          } else if (tasa >= OBJETIVO_TASA_CIERRE.MIN && tasa <= OBJETIVO_TASA_CIERRE.MAX) {
                            return (
                              <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-xs text-blue-700 font-semibold">Objetivo</span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <TrendingDown className="h-3 w-3 text-red-600" />
                                <span className="text-xs text-red-700 font-semibold">Inferior</span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                      
                      {/* Métricas adicionales */}
                      <div className="text-xs text-gray-600 space-y-1 text-center">
                        <div className="flex justify-between">
                          <span>Ventas:</span>
                          <span className="font-medium">
                            {estadisticas[asesor.ID].ventasRealizadas} / {estadisticas[asesor.ID].totalClientes}
                          </span>
                        </div>
                        {/* Separación VIP/No VIP para total clientes */}
                        {(estadisticas[asesor.ID].totalClientesVIP !== undefined || estadisticas[asesor.ID].totalClientesNoVIP !== undefined) && (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>VIP:</span>
                            <span>{estadisticas[asesor.ID].totalClientesVIP || 0}</span>
                          </div>
                        )}
                        {(estadisticas[asesor.ID].totalClientesVIP !== undefined || estadisticas[asesor.ID].totalClientesNoVIP !== undefined) && (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Otros:</span>
                            <span>{estadisticas[asesor.ID].totalClientesNoVIP || 0}</span>
                          </div>
                        )}
                        
                        {/* Diferencia con el objetivo */}
                        <div className="flex justify-between">
                          <span>Vs. objetivo:</span>
                          {(() => {
                            const tasa = estadisticas[asesor.ID].porcentajeCierre;
                            const objetivo = (OBJETIVO_TASA_CIERRE.MIN + OBJETIVO_TASA_CIERRE.MAX) / 2;
                            const diferencia = tasa - objetivo;
                            return (
                              <span className={`font-medium ${diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diferencia >= 0 ? '+' : ''}{diferencia.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </div>
                        
                        {/* Recomendación basada en rendimiento */}
                        <div className="mt-2">
                          {(() => {
                            const tasa = estadisticas[asesor.ID].porcentajeCierre;
                            const prioridadActual = asesor.PRIORIDAD || 1;
                            
                            if (tasa > OBJETIVO_TASA_CIERRE.MAX && prioridadActual <= 1) {
                              return (
                                <div className="flex items-center gap-1 text-green-600">
                                  <ArrowUpCircle className="h-3 w-3" />
                                  <span className="font-medium text-xs">Merece bonificación</span>
                                </div>
                              );
                            } else if (tasa < OBJETIVO_TASA_CIERRE.MIN && prioridadActual >= 1) {
                              return (
                                <div className="flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="font-medium text-xs">Requiere seguimiento</span>
                                </div>
                              );
                            } else if (tasa >= OBJETIVO_TASA_CIERRE.MIN && tasa <= OBJETIVO_TASA_CIERRE.MAX) {
                              return (
                                <div className="flex items-center gap-1 text-blue-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span className="font-medium text-xs">Rendimiento óptimo</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <span className="text-gray-400 text-sm">No disponible</span>
                      <span className="text-xs text-gray-300">Sin datos suficientes</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-6 text-center border-r border-gray-200">
                  <div className="space-y-2 max-w-xs mx-auto">
                    {estadisticas[asesor.ID] ? (
                      <>
                        {/* Velocidad de Ventas - Compacto */}
                        <div className="bg-blue-50 p-2 rounded-md border border-blue-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-blue-600 flex items-center">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Velocidad
                            </span>
                            {/* Calcular velocidad de ventas */}
                            {(() => {
                              const ventasRealizadas = estadisticas[asesor.ID].ventasRealizadas || 0;
                              const totalClientes = estadisticas[asesor.ID].totalClientes || 0;
                              const ultimaVenta = estadisticas[asesor.ID].ultimaVenta;
                              
                              // Calcular días desde la primera asignación (asumiendo 30 días por defecto)
                              const diasOperativos = 30; // Esto podría ser dinámico basado en fecha de inicio del asesor
                              const ventasPorDia = totalClientes > 0 ? (ventasRealizadas / diasOperativos) : 0;
                              
                              let colorClase = 'bg-gray-100 text-gray-600';
                              let textoVelocidad = '0/día';
                              
                              if (ventasPorDia > 0) {
                                textoVelocidad = ventasPorDia >= 1 
                                  ? `${ventasPorDia.toFixed(1)}/día`
                                  : `${(ventasPorDia * 7).toFixed(1)}/sem`;
                                
                                if (ventasPorDia >= 1) {
                                  colorClase = 'bg-green-100 text-green-700';
                                } else if (ventasPorDia >= 0.5) {
                                  colorClase = 'bg-yellow-100 text-yellow-700';
                                } else if (ventasPorDia > 0) {
                                  colorClase = 'bg-orange-100 text-orange-700';
                                }
                              }
                              
                              return (
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${colorClase}`}>
                                  {textoVelocidad}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-blue-600 text-center">
                            {estadisticas[asesor.ID].ventasRealizadas || 0} ventas
                          </div>
                        </div>

                        {/* Último Cliente Asignado - Compacto */}
                        <div className="bg-purple-50 p-2 rounded-md border border-purple-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-purple-600 flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              Último Cliente Asignado
                            </span>
                            {(() => {
                              const ultimoCliente = getUltimoClienteAsignado(asesor.ID);
                              if (!ultimoCliente) {
                                return (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    Sin clientes
                                  </span>
                                );
                              }

                              const fechaCreacion = typeof ultimoCliente.FECHA_CREACION === 'string' 
                                ? parseInt(ultimoCliente.FECHA_CREACION) 
                                : ultimoCliente.FECHA_CREACION;
                              const ahora = Math.floor(Date.now() / 1000);
                              const minutosDesdeAsignacion = Math.floor((ahora - fechaCreacion) / 60);
                              
                              return (
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${getColorTiempo(minutosDesdeAsignacion, 60)}`}>
                                  {formatearTiempoMinutos(minutosDesdeAsignacion)}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-purple-600">
                            {(() => {
                              const ultimoCliente = getUltimoClienteAsignado(asesor.ID);
                              if (!ultimoCliente) {
                                return <span className="text-center block">No hay clientes</span>;
                              }
                              
                              const fuente = getFuente(ultimoCliente.ID);
                              return (
                                <div className="space-y-1">

                                  <div className="flex justify-center">
                                    <span className= {`px-1 py-0.5 rounded text-xs font-medium ${
                                      fuente === 'LINK' ? 'bg-green-100 text-green-700' :
                                      fuente === 'MASIVOS' ? 'bg-blue-100 text-blue-700' :
                                      fuente === 'HOTMART' ? 'bg-orange-100 text-orange-700' :
                                      fuente === 'VIP' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {fuente}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Actividades en Grid 2x2 para mayor compacidad */}
                        <div className="grid grid-cols-2 gap-1">
                          {/* Última venta */}
                          <div className="bg-gray-50 p-1.5 rounded border border-gray-200">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center mb-1">
                                <DollarSign className="h-3 w-3 text-gray-600 mr-1" />
                                <span className="text-xs font-medium text-gray-600">Última Venta</span>
                              </div>
                              {(() => {
                                const ahora = Math.floor(Date.now() / 1000);
                                const ultimaVenta = estadisticas[asesor.ID].ultimaVenta;
                                const minutosDesdeVenta = ultimaVenta ? Math.floor((ahora - ultimaVenta) / 60) : null;
                                
                                return (
                                  <span className={`text-xs font-semibold px-1 py-0.5 rounded-full ${getColorTiempo(minutosDesdeVenta, 1440)}`}>
                                    {formatearTiempoMinutos(minutosDesdeVenta)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          
                          {/* Último mensaje */}
                          <div className="bg-gray-50 p-1.5 rounded border border-gray-200">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center mb-1">
                                <MessageSquare className="h-3 w-3 text-gray-600 mr-1" />
                                <span className="text-xs font-medium text-gray-600">Último Mensaje Enviado</span>
                              </div>
                              {(() => {
                                const ahora = Math.floor(Date.now() / 1000);
                                const ultimoMensaje = estadisticas[asesor.ID].ultimoMensaje;
                                const minutosDesdeMensaje = ultimoMensaje ? Math.floor((ahora - ultimoMensaje) / 60) : null;
                                
                                return (
                                  <span className={`text-xs font-semibold px-1 py-0.5 rounded-full ${getColorTiempo(minutosDesdeMensaje, 30)}`}>
                                    {formatearTiempoMinutos(minutosDesdeMensaje)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          
                          {/* Último reporte */}
                          <div className="bg-gray-50 p-1.5 rounded border border-gray-200 col-span-2">
                            <div className="flex items-center justify-center">
                              <div className="flex items-center mr-2">
                                <FileText className="h-3 w-3 text-gray-600 mr-1" />
                                <span className="text-xs font-medium text-gray-600">Último Reporte:</span>
                              </div>
                              {(() => {
                                const ahora = Math.floor(Date.now() / 1000);
                                const ultimoReporte = estadisticas[asesor.ID].ultimoReporte;
                                const minutosDesdeReporte = ultimoReporte ? Math.floor((ahora - ultimoReporte) / 60) : null;
                                
                                return (
                                  <span className={`text-xs font-semibold px-1 py-0.5 rounded-full ${getColorTiempo(minutosDesdeReporte, 60)}`}>
                                    {formatearTiempoMinutos(minutosDesdeReporte)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                          <AlertTriangle className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-center font-medium text-xs">Sin datos</p>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-6 text-center border-r border-gray-200">
                  <div className="flex flex-col items-center space-y-3">
                   
                    
                    {/* Bloqueo */}
                    {(() => {
                      const ahoraEpoch = Math.floor(Date.now() / 1000); // Timestamp actual en segundos (epoch)
                      // Las fechas en la BD ahora son epoch (timestamp unix en segundos)
                      const fechaInicioEpoch = asesor.FECHA_INICIO_REGLA ? Number(asesor.FECHA_INICIO_REGLA) : null;
                      const fechaFinEpoch = asesor.FECHA_FIN_REGLA ? Number(asesor.FECHA_FIN_REGLA) : null;
                      
                      // Para debug/display convertimos a Date (sólo para visualización)
                      const fechaInicio = fechaInicioEpoch ? new Date(fechaInicioEpoch * 1000) : null;
                      const fechaFin = fechaFinEpoch ? new Date(fechaFinEpoch * 1000) : null;
                      
                      const bloqueado = (fechaInicioEpoch && !fechaFinEpoch) || 
                                      (fechaInicioEpoch && fechaFinEpoch && 
                                       ahoraEpoch >= fechaInicioEpoch && ahoraEpoch <= fechaFinEpoch);
                      
                      if (bloqueado) {
                        console.log('Asesor bloqueado (detalles):', {
                          id: asesor.ID,
                          nombre: asesor.NOMBRE,
                          fechaInicioEpoch: fechaInicioEpoch,
                          fechaFinEpoch: fechaFinEpoch,
                          fechaInicioParsed: fechaInicio,
                          fechaFinParsed: fechaFin,
                          ahoraEpoch: ahoraEpoch
                        });
                        return (
                          <div className="flex flex-col items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200 max-w-xs">
                            <div className="flex items-center gap-2">
                              <Ban className="h-5 w-5 text-red-600 flex-shrink-0" />
                              <span className="font-medium text-red-700 text-sm">Bloqueo activo</span>
                            </div>
                            <div className="text-center">
                              {mostrarPeriodoBloqueo(fechaInicio, fechaFin)}
                              
                              {fechaFin && (
                                <div className="mt-2">
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium text-xs">
                                    {calcularTiempoRestante(fechaFin)}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Botón para quitar bloqueo */}
                            <button
                              onClick={() => {
                                if (confirm('¿Estás seguro de quitar el bloqueo?')) {
                                  quitarBloqueo(asesor.ID);
                                }
                              }}
                              className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-md 
                                        text-xs font-medium hover:bg-red-50 transition-colors flex items-center gap-1"
                            >
                              <X className="h-3 w-3" />
                              <span>Quitar bloqueo</span>
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Historial button */}
                    <button
                      onClick={() => {
                        setAsesorSeleccionado(asesor);
                        setMostrarModalHistorial(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2
                        bg-gradient-to-b from-white to-blue-50 
                        text-blue-700 text-sm
                        rounded-lg 
                        border border-blue-200 
                        shadow-sm hover:shadow-md 
                        transform hover:-translate-y-0.5 
                        transition-all duration-150
                        group"
                    >
                      <History className="h-4 w-4 group-hover:text-blue-800" />
                      <span className="font-medium group-hover:text-blue-800">Historial</span>
                      {asesor.HISTORIAL ? (
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-medium shadow-inner">
                          {safeJsonParseReglaHistorial(asesor.HISTORIAL).length}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-6 text-center">
                  <button
                    onClick={() => {
                      setAsesorSeleccionado(asesor);
                      setMostrarModal(true);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    Otras Reglas
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Ayuda */}
      {mostrarAyuda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Guía de Reglas de Asignación</h3>
              <button
                onClick={() => setMostrarAyuda(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {Object.entries(reglasDescripciones).map(([tipo, regla]) => (
                <div key={tipo} className="border-b pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${regla.color}`}>
                      {regla.icono}
                    </div>
                    <h4 className="text-lg font-semibold">{regla.titulo}</h4>
                  </div>
                  <p className="text-gray-700 mb-2">{regla.descripcion}</p>
                  <p className="text-gray-600 mb-2">{regla.consecuencias}</p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium text-gray-700 mb-1">Ejemplos de uso:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {regla.ejemplos.map((ejemplo, index) => (
                        <li key={index}>{ejemplo}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reglas */}
      {mostrarModal && asesorSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Gestionar Reglas - {asesorSeleccionado.NOMBRE}</h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Regla</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={nuevaRegla.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as ReglaTipo;
                    setNuevaRegla({ ...nuevaRegla, tipo });
                  }}
                >
                 
                  <option value="BLOQUEO">Bloqueo</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {reglasDescripciones[nuevaRegla.tipo].descripcion}
                </p>
              </div>

             

              {nuevaRegla.tipo === 'BLOQUEO' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duración del Bloqueo</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={nuevaRegla.duracion || 'personalizado'}
                      onChange={(e) => {
                        const duracion = e.target.value as 'horas' | 'dias' | 'semanas' | 'personalizado';
                        
                        // Si tiene una cantidad de duración y no es personalizado, recalcular las fechas
                        if (duracion !== 'personalizado' && nuevaRegla.cantidadDuracion) {
                          const fechaInicio = new Date();
                          const fechaFin = calcularFechaFinDesdeDuracion(nuevaRegla.cantidadDuracion, duracion);
                          
                          // Convertimos a epoch para la BD
                          const fechaInicioEpoch = Math.floor(fechaInicio.getTime() / 1000);
                          const fechaFinEpoch = Math.floor(fechaFin.getTime() / 1000);
                          
                          console.log("Cambiando duración:", {
                            duracion,
                            cantidad: nuevaRegla.cantidadDuracion,
                            fechaInicio, 
                            fechaFin,
                            fechaInicioEpoch,
                            fechaFinEpoch
                          });
                          
                          setNuevaRegla({ 
                            ...nuevaRegla, 
                            duracion,
                            fechaInicio,
                            fechaFin,
                            fechaInicioEpoch,
                            fechaFinEpoch
                          });
                        } else {
                          // Si es personalizado, solo cambiar el tipo de duración
                          setNuevaRegla({ 
                            ...nuevaRegla,
                            duracion
                          });
                        }
                      }}
                    >
                      <option value="horas">Horas</option>
                      <option value="dias">Días</option>
                      <option value="semanas">Semanas</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                  </div>
                  
                  {nuevaRegla.duracion !== 'personalizado' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Cantidad ({nuevaRegla.duracion})
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={nuevaRegla.cantidadDuracion || 1}
                        onChange={(e) => {
                          const cantidad = parseInt(e.target.value);
                          const fechaInicio = new Date(); // La fecha de inicio siempre es ahora
                          const fechaFin = calcularFechaFinDesdeDuracion(cantidad, nuevaRegla.duracion || 'horas');
                          
                          // Convertimos a epoch para la BD
                          const fechaInicioEpoch = Math.floor(fechaInicio.getTime() / 1000);
                          const fechaFinEpoch = Math.floor(fechaFin.getTime() / 1000);
                          
                          console.log("Calculando bloqueo:", {
                            cantidad,
                            duracion: nuevaRegla.duracion,
                            fechaInicio,
                            fechaFin,
                            fechaInicioEpoch,
                            fechaFinEpoch
                          });
                          
                          // Establece explícitamente las fechas en el estado
                          setNuevaRegla({ 
                            ...nuevaRegla, 
                            cantidadDuracion: cantidad,
                            fechaInicio: fechaInicio,
                            fechaFin: fechaFin,
                            fechaInicioEpoch: fechaInicioEpoch,
                            fechaFinEpoch: fechaFinEpoch
                          });
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha y Hora de Inicio</label>
                        <input
                          type="datetime-local"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          onChange={(e) => setNuevaRegla({ ...nuevaRegla, fechaInicio: new Date(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha y Hora de Fin</label>
                        <input
                          type="datetime-local"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          onChange={(e) => setNuevaRegla({ ...nuevaRegla, fechaFin: new Date(e.target.value) })}
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Dejar en blanco para un bloqueo indefinido.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Motivo
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  value={nuevaRegla.motivo || ''}
                  onChange={(e) => setNuevaRegla({ ...nuevaRegla, motivo: e.target.value })}
                  placeholder="Explica detalladamente el motivo de esta regla..."
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Este motivo se guardará en el historial para futuras referencias.
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setMostrarModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!nuevaRegla.motivo) {
                      return;
                    }
                    
                    // Asegurarse de que las fechas estén en epoch para la BD
                    const reglaConEpoch = {
                      ...nuevaRegla,
                      // Las fechas de bloqueo deben estar en epoch para la BD
                      fechaInicioEpoch: nuevaRegla.fechaInicio ? Math.floor(nuevaRegla.fechaInicio.getTime() / 1000) : undefined,
                      fechaFinEpoch: nuevaRegla.fechaFin ? Math.floor(nuevaRegla.fechaFin.getTime() / 1000) : undefined
                    };
                    
                    console.log("Aplicando regla con valores:", reglaConEpoch);
                    
                    // Aplicar la regla con las fechas de epoch en lugar de Date objects
                    const reglaParaEnviar = {
                      ...nuevaRegla,
                      fechaInicio: undefined, // No enviamos los objetos Date
                      fechaFin: undefined,
                      // Asignamos explícitamente los valores de epoch
                      fechaInicioEpoch: reglaConEpoch.fechaInicioEpoch,
                      fechaFinEpoch: reglaConEpoch.fechaFinEpoch
                    };
                    
                    aplicarRegla(asesorSeleccionado.ID, reglaParaEnviar);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Aplicar Regla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Prioridad */}
      {mostrarModalPrioridad && asesorSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {tipoPrioridadSeleccionada === 'BONUS' ? 'Premiar' : 'Penalizar'} - {asesorSeleccionado.NOMBRE}
              </h3>
              <button
                onClick={() => {
                  setMostrarModalPrioridad(false);
                  setMotivoPrioridad('');
                  setAsesorSeleccionado(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={motivoPrioridad}
                  onChange={(e) => setMotivoPrioridad(e.target.value)}
                  placeholder={`Explica el motivo ${tipoPrioridadSeleccionada === 'BONUS' ? 'del premio' : 'de la penalización'}...`}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setMostrarModalPrioridad(false);
                    setMotivoPrioridad('');
                    setAsesorSeleccionado(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (safeIsEmpty(motivoPrioridad)) {
                      return;
                    }
                    aplicarPrioridad(asesorSeleccionado.ID, tipoPrioridadSeleccionada, motivoPrioridad);
                  }}
                  className={`px-4 py-2 text-white rounded-md ${
                    tipoPrioridadSeleccionada === 'BONUS'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {tipoPrioridadSeleccionada === 'BONUS' ? 'Premiar' : 'Penalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial */}
      {mostrarModalHistorial && asesorSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <History className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Historial de Reglas
                  </h3>
                  <p className="text-sm text-gray-600">
                    {asesorSeleccionado.NOMBRE} - {asesorSeleccionado.HISTORIAL ? safeJsonParseReglaHistorial(asesorSeleccionado.HISTORIAL).length : 0} registros
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMostrarModalHistorial(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(80vh-8rem)] bg-gray-50">
              {asesorSeleccionado.HISTORIAL ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-500">
                      Mostrando todas las reglas aplicadas ordenadas por fecha
                    </p>
                    <div className="flex gap-1">
                      
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium">
                        BLOQUEO: {safeJsonParseReglaHistorial(asesorSeleccionado.HISTORIAL).filter((r: any) => r.tipo === 'BLOQUEO').length}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
                        BONUS: {safeJsonParseReglaHistorial(asesorSeleccionado.HISTORIAL).filter((r: any) => r.tipo === 'BONUS').length}
                      </span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">
                        PENALIZACIÓN: {safeJsonParseReglaHistorial(asesorSeleccionado.HISTORIAL).filter((r: any) => r.tipo === 'PENALIZACION').length}
                      </span>
                    </div>
                  </div>
                  {safeJsonParseReglaHistorial(asesorSeleccionado.HISTORIAL)
                    .sort((a: any, b: any) => 
                      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
                    )
                    .map((entrada: any, index: number) => 
                      <div key={entrada.fecha + '-' + index}>
                        {renderHistorialItem(entrada)}
                      </div>
                    )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                    <AlertTriangle className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-center font-medium">No hay historial de reglas disponible</p>
                  <p className="text-gray-400 text-center text-sm mt-1">Las reglas aplicadas aparecerán aquí</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignación Automática de Puntos */}
      {mostrarModalAsignacionPuntos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Asignación Automática de Puntos</h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Info className="h-6 w-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-blue-800">Información Importante</h3>
                </div>
                <p className="text-blue-700 text-sm">
                  Esta asignación de puntos se realiza cada 6 horas y afecta directamente la asignación de clientes. 
                  Los cambios en la prioridad pueden impactar significativamente el rendimiento del equipo.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-semibold mb-3">Resumen de Cambios</h4>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Promedio de Tasa de Cierre del Equipo:</span>{' '}
                    <span className="text-blue-600">{detallesAsignacionPuntos.promedioTasaCierre.toFixed(1)}%</span>
                  </p>
                  <p>
                    <span className="font-medium">Rango Objetivo:</span>{' '}
                    <span className="text-green-600">{OBJETIVO_TASA_CIERRE.MIN}% - {OBJETIVO_TASA_CIERRE.MAX}%</span>
                  </p>
                </div>
              </div>

              {detallesAsignacionPuntos.actualizaciones.length > 0 ? (
                <div>
                  <h4 className="text-md font-semibold mb-3">Asesores Afectados</h4>
                  <div className="divide-y divide-gray-200">
                    {detallesAsignacionPuntos.actualizaciones.map((actualizacion, index) => (
                      <div key={index} className="py-2 flex justify-between items-center">
                        <div>
                          <span className="font-medium">{actualizacion.nombre}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                            actualizacion.cambio > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {actualizacion.cambio > 0 ? '+1' : '-1'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span>Tasa Cierre: {actualizacion.tasaCierre.toFixed(1)}%</span>
                          <span className="ml-2">Prioridad: {actualizacion.prioridadActual} → {actualizacion.prioridadActual + actualizacion.cambio}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-yellow-800 font-medium">
                    No hay cambios que realizar. Todos los asesores están dentro del rango objetivo o en los límites de prioridad.
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setMostrarModalAsignacionPuntos(false);
                    setMostrarModalRestablecerPrioridades(true);
                  }}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Restablecer Prioridades
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setMostrarModalAsignacionPuntos(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      // Existing confirmation logic remains the same
                      if (detallesAsignacionPuntos.actualizaciones.length === 0) {
                        toast('No hay cambios que realizar', {
                          icon: '📊',
                          duration: 3000
                        });
                        setMostrarModalAsignacionPuntos(false);
                        return;
                      }

                      try {
                        // Existing batch update logic remains the same
                        const resultados: Array<{nombre: string, exito: boolean, error?: string}> = [];
                        for (const actualizacion of detallesAsignacionPuntos.actualizaciones) {
                          try {
                            const asesor = asesores.find(a => a.NOMBRE === actualizacion.nombre);
                            if (!asesor) continue;

                            await aplicarPrioridad(
                              asesor.ID, 
                              actualizacion.cambio > 0 ? 'BONUS' : 'PENALIZACION', 
                              actualizacion.motivo
                            );
                            
                            resultados.push({ 
                              nombre: actualizacion.nombre, 
                              exito: true 
                            });
                          } catch (error) {
                            console.error(`Error al actualizar ${actualizacion.nombre}:`, error);
                            resultados.push({ 
                              nombre: actualizacion.nombre, 
                              exito: false, 
                              error: error instanceof Error ? error.message : 'Error desconocido'
                            });
                          }
                        }

                        // Existing result handling logic remains the same
                        const exitosos = resultados.filter(r => r.exito);
                        const fallidos = resultados.filter(r => !r.exito);

                        if (exitosos.length > 0) {
                          toast.success(`Puntos asignados: ${exitosos.length} asesores actualizados`, {
                            duration: 4000,
                            position: 'top-center'
                          });
                        }

                        if (fallidos.length > 0) {
                          toast.error(`Errores al asignar puntos: ${fallidos.length} asesores no actualizados`, {
                            duration: 4000,
                            position: 'top-center'
                          });
                          console.error('Detalles de errores:', fallidos);
                        }

                        // Forzar actualización de la vista
                        onUpdate();
                        setMostrarModalAsignacionPuntos(false);
                      } catch (error) {
                        console.error('Error crítico al asignar puntos:', error);
                        toast.error('Error crítico al asignar puntos');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Confirmar Asignación
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restablecimiento de Prioridades */}
      {mostrarModalRestablecerPrioridades && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Restablecer Prioridades</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
                  <h3 className="text-lg font-semibold text-yellow-800">Confirmación Requerida</h3>
                </div>
                <p className="text-yellow-700 text-sm">
                  Esta acción restablecerá la prioridad de TODOS los asesores a 1. 
                  Esto puede afectar significativamente la asignación de clientes.
                </p>
              </div>

              <div>
                <h4 className="text-md font-semibold mb-2">Resumen de Cambio</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Asesores Afectados:</span>{' '}
                    <span className="text-blue-600">
                      {asesores.filter(a => (a.PRIORIDAD || 1) !== 1).length}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setMostrarModalRestablecerPrioridades(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  onClick={restablecerPrioridadesATodos}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Restablecer Prioridades
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 