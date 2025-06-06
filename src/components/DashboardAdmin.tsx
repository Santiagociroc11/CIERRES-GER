import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../lib/apiClient';
import { Asesor, EstadisticasDetalladas, OrdenAsesor } from '../types';
import {
  BarChart,
  LogOut,
  Users,
  Calendar,
  Target,
  Clock,
  Download,
  AlertCircle,
  AlertTriangle,
  Bell,
  Search,
  Filter,
  RefreshCcw,
  MessageSquare,
  Shield,
  TrendingUp,
  Settings,
  PieChart,
  UserCheck,
  Smartphone,
  Send,
  FileText,
  DollarSign,
} from 'lucide-react';
import {
  formatDateOnly,
  formatInactivityTime,
  formatDate,
} from '../utils/dateUtils';
import DetalleAsesor from './DetalleAsesor';
import HistorialCliente from './HistorialCliente';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ReasignarCliente from "./ReasignarCliente";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { parse } from 'date-fns';
import CrearClienteModal from './CrearClienteModal';
import ChatModal from './ChatModal';
import GestionAsignaciones from './GestionAsignaciones';
import CrearAsesorModal from './CrearAsesorModal';

interface DashboardAdminProps {
  onLogout: () => void;
}

export default function DashboardAdmin({ onLogout }: DashboardAdminProps) {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [estadisticas, setEstadisticas] = useState<Record<number, EstadisticasDetalladas>>({});
  const [clientes, setClientes] = useState<any[]>([]);
  const [reportes, setReportes] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [conversaciones, setConversaciones] = useState<any[]>([]);
  const [conexionesEstado, setConexionesEstado] = useState<Record<number, {
    whatsapp: 'conectado' | 'desconectado' | 'verificando';
    telegram: boolean;
  }>>({});
  
  // 🆕 Estados de carga y rendimiento
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [cargandoConexiones, setCargandoConexiones] = useState(false);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [tiempoCarga, setTiempoCarga] = useState<number | null>(null);
  
  const itemsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'año' | 'mes' | 'semana' | 'personalizado'>('personalizado');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenarPor, setOrdenarPor] = useState<OrdenAsesor>('ventas');
  const [ordenDireccion, setOrdenDireccion] = useState<'asc' | 'desc'>('desc');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [mostrarModalCrearCliente, setMostrarModalCrearCliente] = useState(false);
  const [clienteParaChat, setClienteParaChat] = useState<any | null>(null);
  const [mostrarModalCrearAsesor, setMostrarModalCrearAsesor] = useState(false);

  // Estado para alternar entre vista de Asesores y Clientes
  const [vistaAdmin, setVistaAdmin] = useState<'resumen' | 'asesores' | 'clientes' | 'gestion'>('asesores');
  // Estado para el modal de historial de cliente
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);

  const evolutionServerUrl = import.meta.env.VITE_EVOLUTIONAPI_URL;
  const evolutionApiKey = import.meta.env.VITE_EVOLUTIONAPI_TOKEN;

  const handleLogout = async () => {
    localStorage.removeItem('userSession');
    onLogout();
  };

  // Función para refrescar manualmente
  const handleRefresh = async () => {
    await cargarDatos();
  };

  // 🆕 Nueva función para refrescar solo las conexiones (más rápida)
  const refrescarSoloConexiones = async () => {
    if (asesores.length > 0) {
      setCargandoConexiones(true);
      console.log("🔄 Refrescando solo estados de conexión...");
      try {
        await verificarEstadosConexion(asesores);
      } finally {
        setCargandoConexiones(false);
      }
    }
  };

  // Función para verificar estado de WhatsApp de un asesor
  const verificarEstadoWhatsApp = async (nombreAsesor: string): Promise<'conectado' | 'desconectado'> => {
    try {
      if (!evolutionServerUrl || !evolutionApiKey) {
        return 'desconectado';
      }

      const instanceName = encodeURIComponent(nombreAsesor);
      const url = `${evolutionServerUrl}/instance/fetchInstances?instanceName=${instanceName}`;
      
      // ⚡ OPTIMIZACIÓN: Agregar timeout de 5 segundos para evitar que una verificación lenta bloquee las demás
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 20000);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        signal: timeoutController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return 'desconectado';
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const instance = data[0];
        return instance.connectionStatus === "open" ? 'conectado' : 'desconectado';
      }
      
      return 'desconectado';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`⏱️ Timeout verificando WhatsApp para ${nombreAsesor} (5s)`);
      } else {
        console.warn(`⚠️ Error verificando WhatsApp para ${nombreAsesor}:`, error);
      }
      return 'desconectado';
    }
  };

  // 🚀 OPTIMIZACIÓN: Función para verificar estados de conexión de forma más eficiente
  const verificarEstadosConexion = async (asesoresData: Asesor[]) => {
    console.log(`🔍 Iniciando verificaciones de conexión para ${asesoresData.length} asesores (en background)...`);
    
    const nuevosEstados: Record<number, {
      whatsapp: 'conectado' | 'desconectado' | 'verificando';
      telegram: boolean;
    }> = {};

    // Inicializar estados
    asesoresData.forEach(asesor => {
      nuevosEstados[asesor.ID] = {
        whatsapp: 'verificando',
        telegram: Boolean(asesor.ID_TG && asesor.ID_TG.trim())
      };
    });
    
    setConexionesEstado(nuevosEstados);

    // ⚡ OPTIMIZACIÓN: Procesar verificaciones en lotes de 3 para no sobrecargar la API
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < asesoresData.length; i += BATCH_SIZE) {
      batches.push(asesoresData.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const verificacionesBatch = batch.map(async (asesor) => {
        try {
          const estadoWhatsApp = await verificarEstadoWhatsApp(asesor.NOMBRE);
          setConexionesEstado(prev => ({
            ...prev,
            [asesor.ID]: {
              ...prev[asesor.ID],
              whatsapp: estadoWhatsApp
            }
          }));
          console.log(`✅ WhatsApp ${asesor.NOMBRE}: ${estadoWhatsApp}`);
        } catch (error) {
          console.warn(`❌ Error verificando ${asesor.NOMBRE}:`, error);
          setConexionesEstado(prev => ({
            ...prev,
            [asesor.ID]: {
              ...prev[asesor.ID],
              whatsapp: 'desconectado'
            }
          }));
        }
      });

      // Esperar que termine el lote antes de continuar con el siguiente
      await Promise.allSettled(verificacionesBatch);
      
      // Pequeña pausa entre lotes para no sobrecargar la API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log("✅ Verificaciones de conexión completadas");
  };

  const fetchAllPages = async (
    endpoint: string,
    filter: string,
    pageSize = 1000 // 🚀 Aumentamos pageSize por defecto de 100 a 1000
  ): Promise<any[]> => {
    console.log(`🔄 Cargando datos de ${endpoint}...`);
    const startTime = performance.now();
    
    try {
      // 🚀 OPTIMIZACIÓN 1: Primero hacer un request para estimar el total
      const firstPageUrl = `${endpoint}?${filter}&limit=${pageSize}&offset=0`;
      const firstPage = await apiClient.request<any[]>(firstPageUrl);
      
      if (firstPage.length === 0) {
        console.log(`✅ ${endpoint}: 0 registros (${Math.round(performance.now() - startTime)}ms)`);
        return [];
      }
      
      // Si la primera página no está llena, ya tenemos todos los datos
      if (firstPage.length < pageSize) {
        console.log(`✅ ${endpoint}: ${firstPage.length} registros en 1 página (${Math.round(performance.now() - startTime)}ms)`);
        return firstPage;
      }
      
      // 🚀 OPTIMIZACIÓN 2: Estimar páginas restantes y hacer requests paralelos
      const estimatedTotal = firstPage.length * 3; // Estimación conservadora
      const estimatedPages = Math.ceil(estimatedTotal / pageSize);
      const maxParallelRequests = Math.min(estimatedPages - 1, 5); // Máximo 5 requests paralelos
      
      console.log(`📊 ${endpoint}: Estimando ~${estimatedTotal} registros, cargando ${maxParallelRequests + 1} páginas en paralelo...`);
      
      // 🚀 OPTIMIZACIÓN 3: Requests paralelos para las páginas restantes
      const parallelPromises: Promise<any[]>[] = [];
      for (let i = 1; i <= maxParallelRequests; i++) {
        const offset = i * pageSize;
        const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
        parallelPromises.push(apiClient.request<any[]>(url));
      }
      
      const parallelResults = await Promise.all(parallelPromises);
      let allData = [...firstPage];
      
      // Combinar resultados y verificar si necesitamos más páginas
      for (const pageData of parallelResults) {
        if (pageData.length > 0) {
          allData = [...allData, ...pageData];
        }
      }
      
      // 🚀 OPTIMIZACIÓN 4: Si la última página paralela está llena, continuar secuencialmente
      const lastParallelPage = parallelResults[parallelResults.length - 1];
      if (lastParallelPage && lastParallelPage.length === pageSize) {
        let offset = (maxParallelRequests + 1) * pageSize;
        let hasMore = true;
        
        while (hasMore) {
          const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
          const pageData = await apiClient.request<any[]>(url);
          
          if (pageData.length > 0) {
            allData = [...allData, ...pageData];
            offset += pageSize;
            
            // Si esta página no está llena, hemos terminado
            if (pageData.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
      }
      
      const loadTime = Math.round(performance.now() - startTime);
      console.log(`✅ ${endpoint}: ${allData.length} registros cargados en ${loadTime}ms (${Math.round(allData.length / loadTime * 1000)} reg/s)`);
      
      return allData;
      
    } catch (error) {
      const loadTime = Math.round(performance.now() - startTime);
      console.error(`❌ Error cargando ${endpoint} en ${loadTime}ms:`, error);
      throw error;
    }
  };

  // 🚀 FUNCIÓN ULTRA-OPTIMIZADA para datasets muy grandes (>10k registros)
  const fetchAllPagesUltraFast = async (
    endpoint: string,
    filter: string,
    pageSize = 2000
  ): Promise<any[]> => {
    console.log(`🚀 Carga ultra-rápida de ${endpoint}...`);
    const startTime = performance.now();
    
    try {
      // Primer request para estimar tamaño
      const sampleUrl = `${endpoint}?${filter}&limit=1`;
      await apiClient.request<any[]>(sampleUrl);
      
      // Hacer 8 requests paralelos inmediatamente
      const maxParallelRequests = 8;
      const parallelPromises: Promise<any[]>[] = [];
      
      for (let i = 0; i < maxParallelRequests; i++) {
        const offset = i * pageSize;
        const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
        parallelPromises.push(apiClient.request<any[]>(url));
      }
      
      const parallelResults = await Promise.all(parallelPromises);
      let allData: any[] = [];
      
      // Combinar todos los resultados
      for (const pageData of parallelResults) {
        if (pageData.length > 0) {
          allData = [...allData, ...pageData];
        }
      }
      
      // Si la última página estaba llena, continuar con más requests
      const lastPage = parallelResults[parallelResults.length - 1];
      if (lastPage && lastPage.length === pageSize) {
        let offset = maxParallelRequests * pageSize;
        let hasMore = true;
        
        while (hasMore) {
          // Hacer 4 requests paralelos más
          const morePromises: Promise<any[]>[] = [];
          for (let i = 0; i < 4; i++) {
            const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset + (i * pageSize)}`;
            morePromises.push(apiClient.request<any[]>(url));
          }
          
          const moreResults = await Promise.all(morePromises);
          let foundData = false;
          
          for (const pageData of moreResults) {
            if (pageData.length > 0) {
              allData = [...allData, ...pageData];
              foundData = true;
            }
          }
          
          if (!foundData || moreResults[moreResults.length - 1].length < pageSize) {
            hasMore = false;
          } else {
            offset += 4 * pageSize;
          }
        }
      }
      
      const loadTime = Math.round(performance.now() - startTime);
      console.log(`🚀 ${endpoint}: ${allData.length} registros ultra-rápidos en ${loadTime}ms (${Math.round(allData.length / loadTime * 1000)} reg/s)`);
      
      return allData;
      
    } catch (error) {
      console.error(`❌ Error en carga ultra-rápida de ${endpoint}:`, error);
      // Fallback a método normal
      return await fetchAllPages(endpoint, filter, pageSize);
    }
  };

  // Cargar datos al cambiar filtros
  useEffect(() => {
    cargarDatos();
  }, [periodoSeleccionado, fechaInicio, fechaFin]);

  const refrescarClientes = async () => {
    console.log("🔄 Refrescando solo datos de clientes...");
    setCargandoClientes(true);
    try {
      // Solo recargar clientes y reportes relacionados
      const [clientesActualizados, reportesActualizados] = await Promise.all([
        fetchAllPages('/GERSSON_CLIENTES', 'select=*'),
        fetchAllPages('/GERSSON_REPORTES', 'select=*')
      ]);
      
      setClientes(clientesActualizados);
      setReportes(reportesActualizados);
      setLastUpdated(new Date());
      
      console.log("✅ Datos de clientes refrescados:", {
        clientes: clientesActualizados.length,
        reportes: reportesActualizados.length
      });
    } catch (error) {
      console.error("❌ Error refrescando clientes:", error);
    } finally {
      setCargandoClientes(false);
    }
  };

  const cargarDatos = async () => {
    const inicioTiempo = performance.now();
    setCargandoDatos(true);
    
    try {
      console.log("🚀 Cargando datos desde PostgREST...");
      
      // Paso 1: Obtener asesores ordenados por nombre
      const asesoresData = await apiClient.request<any[]>('/GERSSON_ASESORES?select=*&order=NOMBRE');
      if (!asesoresData || asesoresData.length === 0) return;
      setAsesores(asesoresData);
      console.log("✅ Asesores obtenidos:", asesoresData.length);

      // 🚀 OPTIMIZACIÓN: Ejecutar verificaciones de conexión EN PARALELO, no en serie
      // Las verificaciones de conexión se ejecutan en background sin bloquear la carga principal
      setCargandoConexiones(true);
      verificarEstadosConexion(asesoresData)
        .catch(error => {
          console.warn("⚠️ Error en verificaciones de conexión (no crítico):", error);
        })
        .finally(() => {
          setCargandoConexiones(false);
        });

      // Paso 2: Cargar datos principales INMEDIATAMENTE (sin esperar verificaciones)
      console.log("🔄 Cargando datos principales con estrategias optimizadas...");
      
      // 🚀 ESTRATEGIA OPTIMIZADA: Usar la función correcta según el tamaño esperado del dataset
      const [clientesData, reportesData, registrosData, conversacionesData] = await Promise.all([
        fetchAllPages('/GERSSON_CLIENTES', 'select=*'),           // Optimizada normal (clientes ~5k)
        fetchAllPages('/GERSSON_REPORTES', 'select=*'),           // Optimizada normal (reportes ~10k)
        fetchAllPages('/GERSSON_REGISTROS', 'select=*'),          // Optimizada normal (registros ~3k)
        fetchAllPagesUltraFast('/conversaciones', 'select=*'),   // Ultra-fast (conversaciones >50k)
      ]);
      
      console.log("✅ Datos principales cargados:", {
        clientes: clientesData.length,
        reportes: reportesData.length,
        registros: registrosData.length,
        conversaciones: conversacionesData.length
      });

      // Paso 3: Actualizar estado inmediatamente
      setClientes(clientesData);
      setReportes(reportesData);
      setRegistros(registrosData);
      setConversaciones(conversacionesData);

      // Paso 4: Calcular estadísticas
      const nuevasEstadisticas: Record<number, EstadisticasDetalladas> = {};
      asesoresData.forEach((asesor: any) => {
        const clientesAsesor = clientesData.filter((c: any) => c.ID_ASESOR === asesor.ID);
        const reportesAsesor = reportesData.filter((r: any) => r.ID_ASESOR === asesor.ID);
        const conversacionesAsesor = conversacionesData.filter((c: any) => c.id_asesor === asesor.ID);
        nuevasEstadisticas[asesor.ID] = calcularEstadisticasDetalladas(
          clientesAsesor,
          reportesAsesor,
          conversacionesAsesor,
          periodoSeleccionado,
          fechaInicio,
          fechaFin
        );
      });
      setEstadisticas(nuevasEstadisticas);
      
      // 📊 Calcular tiempo de carga
      const tiempoTotal = Math.round(performance.now() - inicioTiempo);
      setTiempoCarga(tiempoTotal);
      setLastUpdated(new Date());
      
      console.log(`✅ Dashboard listo en ${tiempoTotal}ms! Las verificaciones de conexión continúan en background.`);
      
    } catch (error) {
      console.error("❌ Error al cargar datos:", error);
    } finally {
      setCargandoDatos(false);
    }
  };


  // Función para determinar la fuente del cliente (se puede adaptar según PRODUCTO)
  const getFuente = (clienteId: number, registros: any[]) => {
    const registrosCliente = registros.filter(r => r.ID_CLIENTE === clienteId);
    if (registrosCliente.length > 0) {
      registrosCliente.sort((a, b) => new Date(a.FECHA_EVENTO).getTime() - new Date(b.FECHA_EVENTO).getTime());
      return registrosCliente[0].TIPO_EVENTO?.trim() || 'Desconocido';
    }
    return 'Desconocido';
  };

  const calculateTeamStatsByFuente = (clientes: any[], reportes: any[], registros: any[]) => {
    const stats: Record<string, { total: number; cerrados: number }> = {};
    clientes.forEach(cliente => {
      const fuente = getFuente(cliente.ID, registros);
      if (!stats[fuente]) stats[fuente] = { total: 0, cerrados: 0 };
      stats[fuente].total += 1;
      if (reportes.some(r => r.ID_CLIENTE === cliente.ID && (r.ESTADO_NUEVO === 'PAGADO'))) {
        stats[fuente].cerrados += 1;
      }
    });
    const result: Record<string, number> = {};
    for (const fuente in stats) {
      const { total, cerrados } = stats[fuente];
      result[fuente] = total > 0 ? (cerrados / total) * 100 : 0;
    }
    return result;
  };

  const calculateBestRateByFuente = (clientes: any[], reportes: any[], registros: any[]) => {
    const bestRates: Record<string, { rate: number; advisorName: string }> = {};
    asesores.forEach(advisor => {
      const advisorClients = clientes.filter(c => c.ID_ASESOR === advisor.ID);
      const stats: Record<string, { total: number; cerrados: number }> = {};
      advisorClients.forEach(cliente => {
        const fuente = getFuente(cliente.ID, registros);
        if (!stats[fuente]) stats[fuente] = { total: 0, cerrados: 0 };
        stats[fuente].total += 1;
        if (reportes.some(r => r.ID_CLIENTE === cliente.ID && (r.ESTADO_NUEVO === 'PAGADO'))) {
          stats[fuente].cerrados += 1;
        }
      });
      for (const fuente in stats) {
        const { total, cerrados } = stats[fuente];
        if (total < 3) continue;
        const rate = total > 0 ? (cerrados / total) * 100 : 0;
        console.log(`Asesor ${advisor.NOMBRE} - Fuente: ${fuente}, total: ${total}, cerrados: ${cerrados}, rate: ${rate}`);
        if (!(fuente in bestRates) || rate > bestRates[fuente].rate) {
          bestRates[fuente] = { rate, advisorName: advisor.NOMBRE };
        }
      }
    });
    
    // Convert to simple rate record for type compatibility
    const bestRatesSimple: Record<string, number> = {};
    for (const fuente in bestRates) {
      bestRatesSimple[fuente] = bestRates[fuente].rate;
    }
    
    return bestRatesSimple;
  };

  const calcularEstadisticasDetalladas = (
    clientesAsesor: any[],
    reportesAsesor: any[],
    conversacionesAsesor: any[],
    periodo: 'año' | 'mes' | 'semana' | 'personalizado',
    inicio?: string,
    fin?: string
  ): EstadisticasDetalladas => {
    const hoy = new Date();
    let fechaInicioFiltro = new Date();
    let fechaFinFiltro = new Date();

    switch (periodo) {
      case 'año':
        fechaInicioFiltro = new Date(hoy.getFullYear(), 0, 1); // 1 de enero del año actual
        break;
      case 'mes':
        fechaInicioFiltro.setMonth(hoy.getMonth() - 1);
        break;
      case 'semana':
        fechaInicioFiltro.setDate(hoy.getDate() - 7);
        break;
      case 'personalizado':
        if (inicio) fechaInicioFiltro = new Date(inicio);
        if (fin) fechaFinFiltro = new Date(fin);
        break;
    }

    // Convertir fechas a timestamps para comparar con FECHA_REPORTE
    const inicioTimestamp = Math.floor(fechaInicioFiltro.getTime() / 1000);
    const finTimestamp = Math.floor(fechaFinFiltro.getTime() / 1000);

    const reportesFiltrados = reportesAsesor.filter((r: any) => {
      return r.FECHA_REPORTE >= inicioTimestamp && r.FECHA_REPORTE <= finTimestamp;
    });

    const clientesReportados = new Set(reportesAsesor.map((r: any) => r.ID_CLIENTE)).size;
    const clientesSinReporte = clientesAsesor.filter(
      (c: any) => !reportesAsesor.find((r: any) => r.ID_CLIENTE === c.ID)
    ).length;

    // Agrupar ventas únicas por cliente según producto
    const uniqueVentasPrincipal = reportesFiltrados
      .filter((r: any) =>
        (r.ESTADO_NUEVO === 'PAGADO') &&
        r.PRODUCTO === 'PRINCIPAL'
      )
      .reduce((acc: Record<number, boolean>, r: any) => {
        acc[r.ID_CLIENTE] = true;
        return acc;
      }, {});
    const ventasPrincipal = Object.keys(uniqueVentasPrincipal).length;

    const uniqueVentasDownsell = reportesFiltrados
      .filter((r: any) =>
        (r.ESTADO_NUEVO === 'PAGADO') &&
        r.PRODUCTO === 'DOWNSELL'
      )
      .reduce((acc: Record<number, boolean>, r: any) => {
        acc[r.ID_CLIENTE] = true;
        return acc;
      }, {});
    const ventasDownsell = Object.keys(uniqueVentasDownsell).length;

    const ventasRealizadas = ventasPrincipal + ventasDownsell;

    const tiemposRespuesta = reportesAsesor
      .filter((r: any) => r.FECHA_SEGUIMIENTO && r.COMPLETADO)
      .map((r: any) => r.FECHA_SEGUIMIENTO - r.FECHA_REPORTE);
    const tiempoPromedioRespuesta = tiemposRespuesta.length
      ? tiemposRespuesta.reduce((a: number, b: number) => a + b, 0) / tiemposRespuesta.length / 3600
      : 0;

    const reportesPorCliente = clientesAsesor.length ? reportesAsesor.length / clientesAsesor.length : 0;
    const reportesConSeguimiento = reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO).length;
    
    // 🔄 NUEVA LÓGICA: Calcular última actividad real considerando TODAS las actividades
    const actividades: number[] = [];
    
    // 1. Último reporte creado
    if (reportesAsesor.length > 0) {
      actividades.push(Math.max(...reportesAsesor.map((r: any) => r.FECHA_REPORTE)));
    }
    
    // 2. Último seguimiento completado
    const seguimientosCompletados = reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO && r.COMPLETADO);
    if (seguimientosCompletados.length > 0) {
      actividades.push(Math.max(...seguimientosCompletados.map((r: any) => r.FECHA_SEGUIMIENTO)));
    }
    
    // 3. Último mensaje enviado por el asesor
    const mensajesAsesor = conversacionesAsesor.filter((c: any) => c.modo === 'saliente');
    if (mensajesAsesor.length > 0) {
      actividades.push(Math.max(...mensajesAsesor.map((m: any) => m.timestamp)));
    }
    
    // 4. Último cliente creado/asignado
    if (clientesAsesor.length > 0) {
      actividades.push(Math.max(...clientesAsesor.map((c: any) => parseInt(c.FECHA_CREACION))));
    }
    
    // Tomar la actividad más reciente de todas
    const ultimaActividad = actividades.length > 0 ? Math.max(...actividades) : null;
    
    // 🔍 Debug: Log para verificar cálculo de última actividad
    if (clientesAsesor.length > 0) {
      const nombreAsesor = clientesAsesor[0]?.NOMBRE_ASESOR || 'Sin nombre';
      console.log(`⏰ [${nombreAsesor}] Última actividad calculada:`, {
        ultimaActividad: ultimaActividad ? new Date(ultimaActividad * 1000).toLocaleString() : 'Nunca',
        horasDesdeActividad: ultimaActividad ? Math.floor((Date.now() - ultimaActividad * 1000) / (1000 * 60 * 60)) : 'N/A',
        actividades: {
          ultimoReporte: reportesAsesor.length > 0 ? new Date(Math.max(...reportesAsesor.map((r: any) => r.FECHA_REPORTE)) * 1000).toLocaleString() : 'Nunca',
          ultimoSeguimiento: seguimientosCompletados.length > 0 ? new Date(Math.max(...seguimientosCompletados.map((r: any) => r.FECHA_SEGUIMIENTO)) * 1000).toLocaleString() : 'Nunca',
          ultimoMensaje: mensajesAsesor.length > 0 ? new Date(Math.max(...mensajesAsesor.map((m: any) => m.timestamp)) * 1000).toLocaleString() : 'Nunca',
          ultimoCliente: clientesAsesor.length > 0 ? new Date(Math.max(...clientesAsesor.map((c: any) => parseInt(c.FECHA_CREACION))) * 1000).toLocaleString() : 'Nunca'
        },
        contadores: {
          totalReportes: reportesAsesor.length,
          seguimientosCompletados: seguimientosCompletados.length,
          mensajesEnviados: mensajesAsesor.length,
          clientesAsignados: clientesAsesor.length
        }
      });
    }
    
    // Para backward compatibility, el ultimoReporte ya está incluido en las actividades
    const ultimoReporte = reportesAsesor.length > 0
      ? Math.max(...reportesAsesor.map((r: any) => r.FECHA_REPORTE))
      : null;
      
    // Última venta del asesor (reporte con ESTADO_NUEVO = 'PAGADO')
    const reportesVenta = reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO');
    const ultimaVenta = reportesVenta.length > 0
      ? Math.max(...reportesVenta.map((r: any) => r.FECHA_REPORTE))
      : null;
    
    // Último mensaje saliente del asesor  
    const ultimoMensaje = mensajesAsesor.length > 0
      ? Math.max(...mensajesAsesor.map((m: any) => m.timestamp))
      : null;

    const tiemposHastaReporte = clientesAsesor
      .map((cliente: any) => {
        const primerReporte = reportesAsesor
          .filter((r: any) => r.ID_CLIENTE === cliente.ID)
          .sort((a: any, b: any) => a.FECHA_REPORTE - b.FECHA_REPORTE)[0];
        return primerReporte ? (primerReporte.FECHA_REPORTE - cliente.FECHA_CREACION) / 3600 : null;
      })
      .filter((t: number | null) => t !== null) as number[];
    const tiempoPromedioHastaReporte = tiemposHastaReporte.length
      ? tiemposHastaReporte.reduce((a, b) => a + b, 0) / tiemposHastaReporte.length
      : 0;

    const tiemposHastaVenta = clientesAsesor
      .filter((c: any) => c.ESTADO === 'PAGADO' || c.ESTADO === 'VENTA CONSOLIDADA')
      .map((cliente: any) => {
        const reporteVenta = reportesAsesor
          .filter((r: any) => r.ID_CLIENTE === cliente.ID && (r.ESTADO_NUEVO === 'PAGADO'))
          .sort((a: any, b: any) => a.FECHA_REPORTE - b.FECHA_REPORTE)[0];
        return reporteVenta ? (reporteVenta.FECHA_REPORTE - cliente.FECHA_CREACION) / 3600 : null;
      })
      .filter((t: number | null) => t !== null) as number[];
    const tiempoPromedioHastaVenta = tiemposHastaVenta.length
      ? tiemposHastaVenta.reduce((a, b) => a + b, 0) / tiemposHastaVenta.length
      : 0;

    // Calcular tiempo hasta primer mensaje MANUAL (excluyendo automáticos < 1 minuto)
    const tiemposHastaPrimerMensaje = clientesAsesor
      .map((cliente: any) => {
        // 🔄 CORRECCIÓN: Buscar primer mensaje MANUAL (no automático)
        const fechaCreacionCliente = parseInt(cliente.FECHA_CREACION);
        const mensajesSalientes = conversacionesAsesor
          .filter((c: any) => c.id_cliente === cliente.ID && c.modo === 'saliente')
          .sort((a: any, b: any) => a.timestamp - b.timestamp);
        
        // Filtrar mensajes automáticos (enviados en menos de 1 minuto tras creación)
        const mensajesManuales = mensajesSalientes.filter((mensaje: any) => {
          const tiempoDesdeCreacion = (mensaje.timestamp - fechaCreacionCliente) / 60; // en minutos
          return tiempoDesdeCreacion >= 1; // Solo mensajes enviados después de 1 minuto
        });
        
        // Tomar el primer mensaje manual
        const primerMensajeManual = mensajesManuales.length > 0 ? mensajesManuales[0] : null;
        
        return {
          clienteId: cliente.ID,
          tiempo: primerMensajeManual ? (primerMensajeManual.timestamp - fechaCreacionCliente) / 60 : null,
          fechaCreacion: fechaCreacionCliente,
          tieneMensajeManual: primerMensajeManual !== null,
          totalMensajes: mensajesSalientes.length,
          totalMensajesManuales: mensajesManuales.length,
          mensajesAutomaticos: mensajesSalientes.length - mensajesManuales.length
        };
      });

    const ahora = Math.floor(Date.now() / 1000);
    const clientesSinMensaje20Min = tiemposHastaPrimerMensaje
      .filter(({ tiempo, fechaCreacion }) => {
        // Si ya tiene un mensaje (tiempo !== null), no lo contamos
        if (tiempo !== null) return false;
        // Si no tiene mensaje, verificar si fue creado hace más de 20 minutos
        return (ahora - fechaCreacion) / 60 > 20;
      })
      .length;

    const tiemposValidos = tiemposHastaPrimerMensaje
      .filter(({ tiempo }) => tiempo !== null)
      .map(({ tiempo }) => tiempo as number);

    const tiempoHastaPrimerMensaje = tiemposValidos.length
      ? tiemposValidos.reduce((a, b) => a + b, 0) / tiemposValidos.length
      : 0;

    // 📊 Métricas adicionales sobre el primer mensaje manual
    const clientesConMensajeManual = tiemposHastaPrimerMensaje.filter(({ tieneMensajeManual }) => tieneMensajeManual).length;
    const promedioMensajesPorCliente = tiemposHastaPrimerMensaje.length > 0 
      ? tiemposHastaPrimerMensaje.reduce((acc, { totalMensajes }) => acc + totalMensajes, 0) / tiemposHastaPrimerMensaje.length 
      : 0;
    const promedioMensajesManuales = tiemposHastaPrimerMensaje.length > 0 
      ? tiemposHastaPrimerMensaje.reduce((acc, { totalMensajesManuales }) => acc + totalMensajesManuales, 0) / tiemposHastaPrimerMensaje.length 
      : 0;

    console.log(`📈 [${clientesAsesor[0]?.NOMBRE_ASESOR || 'Sin nombre'}] Análisis de mensajes MANUALES:`, {
      totalClientes: clientesAsesor.length,
      clientesConMensajeManual,
      porcentajeConMensajeManual: clientesAsesor.length > 0 ? (clientesConMensajeManual / clientesAsesor.length * 100).toFixed(1) + '%' : '0%',
      promedioMensajesPorCliente: promedioMensajesPorCliente.toFixed(1),
      promedioMensajesManuales: promedioMensajesManuales.toFixed(1),
      tiempoPromedioRespuestaManual: tiempoHastaPrimerMensaje.toFixed(1) + ' min',
      // 🔍 Debug: Verificar filtro de mensajes automáticos vs manuales
      clientesSinMensajeManual: tiemposHastaPrimerMensaje.filter(({ tiempo }) => tiempo === null).length,
      clientesConRespuestaManual: tiemposHastaPrimerMensaje.filter(({ tiempo }) => tiempo !== null).length,
      totalConversaciones: conversacionesAsesor.length,
      mensajesAutomaticosPromedio: tiemposHastaPrimerMensaje.length > 0 
        ? (tiemposHastaPrimerMensaje.reduce((acc, { mensajesAutomaticos }) => acc + mensajesAutomaticos, 0) / tiemposHastaPrimerMensaje.length).toFixed(1) 
        : '0'
    });

    return {
      totalClientes: clientesAsesor.length,
      clientesReportados,
      ventasRealizadas,
      ventasPrincipal,
      ventasDownsell,
      seguimientosPendientes: reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO && !r.COMPLETADO).length,
      seguimientosCompletados: reportesAsesor.filter((r: any) => r.COMPLETADO).length,
      porcentajeCierre: clientesAsesor.length ? (ventasRealizadas / clientesAsesor.length) * 100 : 0,
      ventasPorMes: ventasRealizadas,
      tiempoPromedioConversion: tiempoPromedioHastaVenta / 24,
      tasaRespuesta: reportesConSeguimiento
        ? (reportesAsesor.filter((r: any) => r.COMPLETADO).length / reportesConSeguimiento) * 100
        : 0,
      tiempoPromedioRespuesta,
      tiempoPromedioHastaReporte,
      tiempoPromedioHastaVenta,
      tiempoHastaPrimerMensaje,
      clientesSinMensaje20Min,
      reportesPorCliente,
      reportesConSeguimiento,
      clientesSinReporte,
      clientesConReporte: clientesReportados,
      clientesEnSeguimiento: reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'SEGUIMIENTO').length,
      clientesRechazados: reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'NO INTERESADO').length,
      clientesCriticos: clientesAsesor.filter((c: any) =>
        ['CARRITOS', 'RECHAZADOS', 'TICKETS'].includes(c.ESTADO)
      ).length,
      clientesNoContactados: clientesAsesor.filter(
        (c: any) => !reportesAsesor.find((r: any) => r.ID_CLIENTE === c.ID)
      ).length,
      montoPromedioVenta: 0,
      ultimaActividad,
      ultimoReporte,
      ultimoSeguimiento: null,
      ultimaVenta, // Usar la variable que calculamos
      ultimoMensaje, // Usar la variable que calculamos
      ventasReportadas: ventasRealizadas,
      ventasSinReportar: 0
    };
  };

  // Hook para obtener datos del gráfico, agrupando ventas únicas por día y por cliente
  const getSalesData = useMemo(() => {
    // Definir el filtro de fechas según el período seleccionado
    const now = new Date();
    let fechaInicioFiltro = new Date();
    let fechaFinFiltro = now;

    switch (periodoSeleccionado) {
      case 'año':
        fechaInicioFiltro = new Date(now.getFullYear(), 0, 1); // 1 de enero del año actual
        break;
      case 'mes':
        fechaInicioFiltro.setMonth(now.getMonth() - 1);
        break;
      case 'semana':
        fechaInicioFiltro.setDate(now.getDate() - 7);
        break;
      case 'personalizado':
        if (fechaInicio) fechaInicioFiltro = new Date(fechaInicio);
        if (fechaFin) fechaFinFiltro = new Date(fechaFin);
        break;
    }

    // Convertir fechas a timestamps para comparar con FECHA_REPORTE
    const inicioTimestamp = Math.floor(fechaInicioFiltro.getTime() / 1000);
    const finTimestamp = Math.floor(fechaFinFiltro.getTime() / 1000);

    // Filtrar reportes por el período
    const reportesFiltrados = reportes.filter((r: any) => {
      return r.FECHA_REPORTE >= inicioTimestamp && r.FECHA_REPORTE <= finTimestamp;
    });

    // Agrupar por fecha y luego por cliente, priorizando "PRINCIPAL" si existen ambos
    const ventasPorDia: Record<string, Record<number, 'PRINCIPAL' | 'DOWNSELL'>> = {};
    reportesFiltrados.forEach((r: any) => {
      if (r.ESTADO_NUEVO === 'PAGADO') {
        const fecha = formatDateOnly(r.FECHA_REPORTE);
        if (!ventasPorDia[fecha]) {
          ventasPorDia[fecha] = {};
        }
        const current = ventasPorDia[fecha][r.ID_CLIENTE];
        // Si no existe registro, lo asignamos
        if (!current) {
          ventasPorDia[fecha][r.ID_CLIENTE] = r.PRODUCTO;
        } else {
          // Si ya existe y es DOWNSELL, y el nuevo es PRINCIPAL, actualizamos
          if (current === 'DOWNSELL' && r.PRODUCTO === 'PRINCIPAL') {
            ventasPorDia[fecha][r.ID_CLIENTE] = 'PRINCIPAL';
          }
        }
      }
    });

    // Transformar la agrupación en un array de datos para el gráfico
    const data = Object.entries(ventasPorDia).map(([fecha, clientesObj]) => {
      let countPrincipal = 0;
      let countDownsell = 0;
      Object.values(clientesObj).forEach(producto => {
        if (producto === 'PRINCIPAL') countPrincipal++;
        else if (producto === 'DOWNSELL') countDownsell++;
      });
      return {
        date: fecha,
        principal: countPrincipal,
        downsell: countDownsell,
      };
    });

    return data.sort((a, b) => {
      const dateA = parse(a.date, 'dd/MM/yyyy', new Date());
      const dateB = parse(b.date, 'dd/MM/yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });
  }, [reportes, periodoSeleccionado, fechaInicio, fechaFin]);

  // Efecto para ajustar dirección por defecto según el criterio de ordenamiento
  useEffect(() => {
    // Para ciertos criterios, el orden ascendente es más útil por defecto
    if (['tiempo', 'tiempo_primer_mensaje'].includes(ordenarPor)) {
      setOrdenDireccion('asc');
    } else {
      // Para la mayoría de métricas, descendente es más útil (más ventas, más clientes, etc.)
      setOrdenDireccion('desc');
    }
  }, [ordenarPor]);

  const asesoresFiltrados = asesores.filter((asesor) => {
    const coincideBusqueda =
      asesor.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
      asesor.WHATSAPP.includes(busqueda);
    if (mostrarInactivos) {
      const stats = estadisticas[asesor.ID];
      const ultimaActividadDate = stats?.ultimaActividad ? new Date(stats.ultimaActividad * 1000) : null;
      const horasSinActividad = ultimaActividadDate
        ? Math.floor((Date.now() - ultimaActividadDate.getTime()) / (1000 * 60 * 60))
        : Infinity;
      return coincideBusqueda && horasSinActividad >= 10;
    }
    return coincideBusqueda;
  });

  const asesoresOrdenados = [...asesoresFiltrados].sort((a, b) => {
    const statsA = estadisticas[a.ID];
    const statsB = estadisticas[b.ID];

    let resultado = 0;

    switch (ordenarPor) {
      case 'ventas':
        resultado = (statsB?.ventasRealizadas || 0) - (statsA?.ventasRealizadas || 0);
        break;
      case 'tasa':
        resultado = (statsB?.porcentajeCierre || 0) - (statsA?.porcentajeCierre || 0);
        break;
      case 'tiempo':
        resultado = (statsA?.tiempoPromedioConversion || 0) - (statsB?.tiempoPromedioConversion || 0);
        break;
      case 'actividad': {
        const fechaA = statsA?.ultimaActividad ? new Date(statsA.ultimaActividad * 1000) : new Date(0);
        const fechaB = statsB?.ultimaActividad ? new Date(statsB.ultimaActividad * 1000) : new Date(0);
        resultado = fechaB.getTime() - fechaA.getTime();
        break;
      }
      case 'clientes':
        resultado = (statsB?.totalClientes || 0) - (statsA?.totalClientes || 0);
        break;
      case 'sin_reporte':
        resultado = (statsB?.clientesSinReporte || 0) - (statsA?.clientesSinReporte || 0);
        break;
      case 'criticos':
        resultado = (statsB?.clientesCriticos || 0) - (statsA?.clientesCriticos || 0);
        break;
      case 'tiempo_primer_mensaje':
        resultado = (statsA?.tiempoHastaPrimerMensaje || 0) - (statsB?.tiempoHastaPrimerMensaje || 0);
        break;
      case 'seguimientos':
        resultado = (statsB?.seguimientosPendientes || 0) - (statsA?.seguimientosPendientes || 0);
        break;
      case 'conexiones_desconectadas': {
        const estadoA = conexionesEstado[a.ID];
        const estadoB = conexionesEstado[b.ID];
        const desconectadosA = (estadoA?.whatsapp !== 'conectado' ? 1 : 0) + (estadoA?.telegram ? 0 : 1);
        const desconectadosB = (estadoB?.whatsapp !== 'conectado' ? 1 : 0) + (estadoB?.telegram ? 0 : 1);
        resultado = desconectadosB - desconectadosA;
        break;
      }
      case 'whatsapp_desconectado': {
        const estadoA = conexionesEstado[a.ID];
        const estadoB = conexionesEstado[b.ID];
        const desconectadoA = estadoA?.whatsapp !== 'conectado' ? 1 : 0;
        const desconectadoB = estadoB?.whatsapp !== 'conectado' ? 1 : 0;
        resultado = desconectadoB - desconectadoA;
        break;
      }
      case 'telegram_sin_configurar': {
        const estadoA = conexionesEstado[a.ID];
        const estadoB = conexionesEstado[b.ID];
        const sinConfigurarA = estadoA?.telegram ? 0 : 1;
        const sinConfigurarB = estadoB?.telegram ? 0 : 1;
        resultado = sinConfigurarB - sinConfigurarA;
        break;
      }
      default:
        resultado = 0;
    }

    // Aplicar dirección de ordenamiento
    return ordenDireccion === 'asc' ? -resultado : resultado;
  });

  // Exportar datos a CSV (incluyendo ventas separadas)
  const exportarDatos = () => {
    const data = asesores.map((asesor) => ({
      Nombre: asesor.NOMBRE,
      WhatsApp: asesor.WHATSAPP,
      'Total Clientes': estadisticas[asesor.ID]?.totalClientes || 0,
      'Clientes Sin Reporte': estadisticas[asesor.ID]?.clientesSinReporte || 0,
      'Clientes Con Reporte': estadisticas[asesor.ID]?.clientesConReporte || 0,
      'Clientes En Seguimiento': estadisticas[asesor.ID]?.clientesEnSeguimiento || 0,
      'Clientes Rechazados': estadisticas[asesor.ID]?.clientesRechazados || 0,
      'Clientes Críticos': estadisticas[asesor.ID]?.clientesCriticos || 0,
      'Clientes Sin Contactar': estadisticas[asesor.ID]?.clientesNoContactados || 0,
      'Ventas Principal': estadisticas[asesor.ID]?.ventasPrincipal || 0,
      'Ventas Downsell': estadisticas[asesor.ID]?.ventasDownsell || 0,
      'Ventas Totales': estadisticas[asesor.ID]?.ventasRealizadas || 0,
      'Tasa de Cierre': `${estadisticas[asesor.ID]?.porcentajeCierre.toFixed(1)}%`,
      'Tiempo Promedio': `${estadisticas[asesor.ID]?.tiempoPromedioConversion.toFixed(1)} días`,
      'Tiempo de Completado': `${estadisticas[asesor.ID]?.tiempoPromedioRespuesta.toFixed(1)} horas`,
      'Última Actividad': estadisticas[asesor.ID]?.ultimaActividad
        ? formatDateOnly(estadisticas[asesor.ID]?.ultimaActividad)
        : 'Sin actividad',
    }));

    const csvContent = [
      Object.keys(data[0]).join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `reporte_asesores_${formatDateOnly(Date.now() / 1000)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Add a helper function to get state colors, similar to the one in ListaGeneralClientes
  const getClienteEstadoColor = (estado: string) => {
    switch (estado) {
      case 'VENTA CONSOLIDADA':
        return 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500';
      case 'PAGADO':
        return 'bg-green-100 text-green-800';
      case 'SEGUIMIENTO':
        return 'bg-blue-100 text-blue-800';
      case 'NO CONTACTAR':
        return 'bg-red-100 text-red-800';
      case 'LINK':
        return 'bg-purple-200 text-purple-800 border-2 border-purple-400 font-bold';
      case 'CARRITOS':
        return 'bg-amber-100 text-amber-800 border-2 border-amber-500';
      case 'RECHAZADOS':
        return 'bg-rose-100 text-rose-800 border-2 border-rose-500';
      case 'TICKETS':
        return 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500';
      case 'NO CONTESTÓ':
        return 'bg-orange-100 text-orange-800';
      case 'MASIVOS':
        return 'bg-teal-100 text-teal-800 border-2 border-teal-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Función para obtener asesores inactivos (sin mensajes salientes en las últimas 2 horas)
  const getAsesoresInactivos = () => {
    return asesores.map(asesor => {
      const stats = estadisticas[asesor.ID];
      const horasSinActividad = stats?.ultimaActividad 
        ? Math.floor((Date.now() - stats.ultimaActividad * 1000) / (1000 * 60 * 60))
        : 24;
      return {
        asesor,
        horasSinActividad,
        stats
      };
    }).filter(({ horasSinActividad }) => horasSinActividad >= 2)
      .sort((a, b) => b.horasSinActividad - a.horasSinActividad);
  };

  // Función para obtener asesores con clientes sin primer mensaje
  const getAsesoresClientesSinMensaje = () => {
    return asesores.map(asesor => {
      const stats = estadisticas[asesor.ID];
      return {
        asesor,
        clientesSinMensaje: stats?.clientesSinMensaje20Min || 0,
        stats
      };
    }).filter(({ clientesSinMensaje }) => clientesSinMensaje > 0)
      .sort((a, b) => b.clientesSinMensaje - a.clientesSinMensaje);
  };

  // Función para obtener asesores con baja tasa de cierre
  const getAsesoresBajaCierre = () => {
    const promedioEquipo = Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) / Object.keys(estadisticas).length;
    return asesores.map(asesor => {
      const stats = estadisticas[asesor.ID];
      return {
        asesor,
        porcentajeCierre: stats?.porcentajeCierre || 0,
        diferencia: (stats?.porcentajeCierre || 0) - promedioEquipo,
        stats
      };
    }).filter(({ diferencia }) => diferencia < -5) // 5% por debajo del promedio
      .sort((a, b) => a.porcentajeCierre - b.porcentajeCierre);
  };

  // Función para calcular el período de 3 meses
  const calcularPeriodoTresMeses = () => {
    const hoy = new Date();
    const mesYMedioAtras = new Date(hoy);
    const mesYMedioAdelante = new Date(hoy);
    
    mesYMedioAtras.setDate(15); // Mitad del mes
    mesYMedioAtras.setMonth(hoy.getMonth() - 1); // Un mes completo hacia atrás
    mesYMedioAtras.setDate(1); // Inicio del mes

    mesYMedioAdelante.setDate(15); // Mitad del mes
    mesYMedioAdelante.setMonth(hoy.getMonth() + 2); // Un mes completo hacia adelante
    mesYMedioAdelante.setDate(mesYMedioAdelante.getDate() + 14); // Fin del mes

    return {
      inicio: mesYMedioAtras.toISOString().split('T')[0],
      fin: mesYMedioAdelante.toISOString().split('T')[0]
    };
  };

  // Establecer fechas iniciales y manejar cambios de período
  useEffect(() => {
    let inicio: Date;
    let fin: Date;

    switch (periodoSeleccionado) {
      case 'personalizado':
        const { inicio: tresMesesInicio, fin: tresMesesFin } = calcularPeriodoTresMeses();
        setFechaInicio(tresMesesInicio);
        setFechaFin(tresMesesFin);
        break;
      case 'año':
        inicio = new Date(new Date().getFullYear(), 0, 1); // 1 de enero del año actual
        fin = new Date(); // Fecha actual
        setFechaInicio(inicio.toISOString().split('T')[0]);
        setFechaFin(fin.toISOString().split('T')[0]);
        break;
      case 'mes':
        fin = new Date();
        inicio = new Date();
        inicio.setMonth(inicio.getMonth() - 1);
        setFechaInicio(inicio.toISOString().split('T')[0]);
        setFechaFin(fin.toISOString().split('T')[0]);
        break;
      case 'semana':
        fin = new Date();
        inicio = new Date();
        inicio.setDate(inicio.getDate() - 7);
        setFechaInicio(inicio.toISOString().split('T')[0]);
        setFechaFin(fin.toISOString().split('T')[0]);
        break;
    }
  }, [periodoSeleccionado]);

  // Establecer fechas iniciales al cargar
  useEffect(() => {
    const { inicio, fin } = calcularPeriodoTresMeses();
    setFechaInicio(inicio);
    setFechaFin(fin);
  }, []);

  const cargarSoloAsesores = async () => {
    try {
      const asesoresData = await apiClient.request<any[]>('/GERSSON_ASESORES?select=*&order=NOMBRE');
      setAsesores(asesoresData);
    } catch (error) {
      console.error("Error al cargar asesores:", error);
    }
  };

  // Función para manejar la reasignación exitosa de clientes
  const handleClienteReasignado = (clienteId: number, nuevoAsesorId: number) => {
    console.log(`🔄 Cliente ${clienteId} reasignado al asesor ${nuevoAsesorId}`);
    
    // Obtener información del nuevo asesor
    const nuevoAsesor = asesores.find(a => a.ID === nuevoAsesorId);
    
    // Actualizar el estado local de clientes
    setClientes(prevClientes => 
      prevClientes.map(cliente => 
        cliente.ID === clienteId 
          ? { 
              ...cliente, 
              ID_ASESOR: nuevoAsesorId,
              NOMBRE_ASESOR: nuevoAsesor?.NOMBRE || 'Desconocido',
              WHA_ASESOR: nuevoAsesor?.WHATSAPP || null
            }
          : cliente
      )
    );

    // Si estamos viendo el detalle de un asesor específico, actualizar las estadísticas
    if (asesorSeleccionado) {
      // Recalcular estadísticas para el asesor actual (sin el cliente reasignado)
      const clientesAsesorActualizados = clientes.filter((c: any) => 
        c.ID_ASESOR === asesorSeleccionado.ID && c.ID !== clienteId
      );
      const reportesAsesor = reportes.filter((r: any) => r.ID_ASESOR === asesorSeleccionado.ID);
      const conversacionesAsesor: any[] = []; // Se puede agregar si es necesario
      
      const nuevasEstadisticas = calcularEstadisticasDetalladas(
        clientesAsesorActualizados,
        reportesAsesor,
        conversacionesAsesor,
        periodoSeleccionado,
        fechaInicio,
        fechaFin
      );
      
      setEstadisticas(prevEstadisticas => ({
        ...prevEstadisticas,
        [asesorSeleccionado.ID]: nuevasEstadisticas
      }));
      
      console.log(`✅ Estadísticas actualizadas para asesor ${asesorSeleccionado.NOMBRE}: ${clientesAsesorActualizados.length} clientes restantes`);
    }
  };

  // Función para calcular último reporte, mensaje y venta de un asesor
  const getUltimasActividades = (asesorId: number) => {
    const ahora = Math.floor(Date.now() / 1000);
    
    // Último reporte del asesor
    const reportesAsesor = reportes.filter((r: any) => r.ID_ASESOR === asesorId);
    const ultimoReporte = reportesAsesor.length > 0 
      ? Math.max(...reportesAsesor.map((r: any) => r.FECHA_REPORTE))
      : null;
    
    // Última venta del asesor (reporte con ESTADO_NUEVO = 'PAGADO')
    const reportesVenta = reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO');
    const ultimaVenta = reportesVenta.length > 0
      ? Math.max(...reportesVenta.map((r: any) => r.FECHA_REPORTE))
      : null;
    
    // Último mensaje saliente del asesor
    const conversacionesAsesor = conversaciones.filter((c: any) => c.id_asesor === asesorId && c.modo === 'saliente');
    const ultimoMensaje = conversacionesAsesor.length > 0
      ? Math.max(...conversacionesAsesor.map((c: any) => c.timestamp))
      : null;
    
    // Calcular minutos transcurridos
    const minutosDesdeReporte = ultimoReporte ? Math.floor((ahora - ultimoReporte) / 60) : null;
    const minutosDesdeVenta = ultimaVenta ? Math.floor((ahora - ultimaVenta) / 60) : null;
    const minutosDesdeMensaje = ultimoMensaje ? Math.floor((ahora - ultimoMensaje) / 60) : null;
    
    return {
      ultimoReporte: {
        timestamp: ultimoReporte,
        minutosTranscurridos: minutosDesdeReporte,
        fecha: ultimoReporte ? new Date(ultimoReporte * 1000) : null
      },
      ultimaVenta: {
        timestamp: ultimaVenta,
        minutosTranscurridos: minutosDesdeVenta,
        fecha: ultimaVenta ? new Date(ultimaVenta * 1000) : null
      },
      ultimoMensaje: {
        timestamp: ultimoMensaje, 
        minutosTranscurridos: minutosDesdeMensaje,
        fecha: ultimoMensaje ? new Date(ultimoMensaje * 1000) : null
      }
    };
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
    if (minutos === null) return 'text-gray-400';
    if (minutos <= limite) return 'text-green-600';
    if (minutos <= limite * 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Moderno */}
      <div className="bg-white shadow-xl border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Principal */}
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo y Título */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="h-7 w-7 lg:h-8 lg:w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl lg:text-3xl font-bold text-gray-900">
                  Panel de <span className="text-purple-600">Administración</span>
                </h1>
                <p className="text-sm lg:text-base text-gray-500 mt-0.5">Control total del sistema de ventas</p>
              </div>
            </div>

            {/* Indicadores de Estado */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Contador de Alertas */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <Bell className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">
                  {getAsesoresInactivos().length + 
                   getAsesoresClientesSinMensaje().length + 
                   getAsesoresBajaCierre().length +
                   asesores.filter(asesor => {
                     const estado = conexionesEstado[asesor.ID];
                     return estado?.whatsapp !== 'conectado' || !estado?.telegram;
                   }).length} alertas
                </span>
              </div>

              {/* Estado del Sistema */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-green-700">Sistema Activo</span>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center space-x-2 lg:space-x-3">
              <button
                onClick={() => setMostrarModalCrearAsesor(true)}
                className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <UserCheck className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">Crear Asesor</span>
              </button>
              <button
                onClick={exportarDatos}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">Exportar</span>
              </button>
              <button
                onClick={() => verificarEstadosConexion(asesores)}
                className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <RefreshCcw className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">Verificar Conexiones</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">Salir</span>
              </button>
            </div>
          </div>

          {/* Navegación Principal */}
          <div className="border-t border-gray-100 pt-4 pb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Pestañas de Navegación */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setVistaAdmin('resumen')}
                  className={`
                    flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative group
                    ${vistaAdmin === 'resumen'
                      ? 'bg-blue-600 text-white shadow-lg border-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md border-2 border-transparent'
                    }
                  `}
                >
                  <PieChart className="h-5 w-5" />
                  <span className="font-semibold">Resumen</span>
                  <div className="text-xs opacity-75 hidden sm:block">Dashboard principal</div>
                </button>
                
                <button
                  onClick={() => setVistaAdmin('asesores')}
                  className={`
                    flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative group
                    ${vistaAdmin === 'asesores'
                      ? 'bg-green-600 text-white shadow-lg border-2 border-green-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md border-2 border-transparent'
                    }
                  `}
                >
                  <UserCheck className="h-5 w-5" />
                  <span className="font-semibold">Asesores</span>
                  <div className="text-xs opacity-75 hidden sm:block">Gestión del equipo</div>
                  <span className="ml-2 bg-white bg-opacity-20 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {asesores.length}
                  </span>
                </button>
                
                <button
                  onClick={() => setVistaAdmin('clientes')}
                  className={`
                    flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative group
                    ${vistaAdmin === 'clientes'
                      ? 'bg-purple-600 text-white shadow-lg border-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md border-2 border-transparent'
                    }
                  `}
                >
                  <Users className="h-5 w-5" />
                  <span className="font-semibold">Clientes</span>
                  <div className="text-xs opacity-75 hidden sm:block">Base de datos</div>
                  <span className="ml-2 bg-white bg-opacity-20 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {clientes.length}
                  </span>
                </button>
                
                <button
                  onClick={() => setVistaAdmin('gestion')}
                  className={`
                    flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative group
                    ${vistaAdmin === 'gestion'
                      ? 'bg-orange-600 text-white shadow-lg border-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md border-2 border-transparent'
                    }
                  `}
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-semibold">Gestión</span>
                  <div className="text-xs opacity-75 hidden sm:block">Asignaciones</div>
                </button>
              </div>

              {/* Métricas Rápidas */}
              <div className="hidden xl:flex items-center space-x-4 bg-gray-50 rounded-xl p-3">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {Object.values(estadisticas).reduce((acc, stats) => acc + (stats.ventasPrincipal || 0), 0)} Principal
                  </span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {Object.values(estadisticas).reduce((acc, stats) => acc + (stats.ventasDownsell || 0), 0)} Downsell
                  </span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {(Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) / Object.keys(estadisticas).length).toFixed(1)}% Cierre
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-8xl mx-auto px-4 py-6">
        {vistaAdmin === 'resumen' ? (
          <div className="space-y-6">

             {/* Métricas del Equipo */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tasa de Reporte */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tasa de Reporte</h3>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">
                      {(Object.values(estadisticas).reduce((acc, stats) => 
                        acc + (stats.clientesReportados / stats.totalClientes * 100), 0) / 
                        Object.keys(estadisticas).length).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-500">Promedio del equipo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {Object.values(estadisticas).reduce((acc, stats) => acc + stats.clientesReportados, 0)} reportados
                    </p>
                    <p className="text-sm text-gray-500">
                      {Object.values(estadisticas).reduce((acc, stats) => acc + (stats.totalClientes - stats.clientesReportados), 0)} sin reporte
                    </p>
                  </div>
                </div>
              </div>

              {/* Tiempo de Respuesta */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tiempo de Respuesta</h3>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {(Object.values(estadisticas).reduce((acc, stats) => acc + stats.tiempoHastaPrimerMensaje, 0) / Object.keys(estadisticas).length).toFixed(1)}m
                    </p>
                    <p className="text-sm text-gray-500">Promedio primer mensaje</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {(Object.values(estadisticas).reduce((acc, stats) => acc + stats.tiempoPromedioRespuesta, 0) / Object.keys(estadisticas).length).toFixed(1)}h
                    </p>
                    <p className="text-sm text-gray-500">Tiempo de completado</p>
                  </div>
                </div>
              </div>

              {/* Tasa de Cierre */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tasa de Cierre</h3>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-purple-600">
                      {(Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) / Object.keys(estadisticas).length).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-500">Promedio del equipo</p>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600">Principal:</span>
                        <span className="text-sm text-gray-900">
                          {Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasPrincipal, 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-600">Downsell:</span>
                        <span className="text-sm text-gray-900">
                          {Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasDownsell, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rankings */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Rankings de Desempeño</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">

{/* Ranking Tasa de Reporte */}
<div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Tasa de Reporte</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-green-600 mb-2">Top 3 Mejores</h4>
                      <div className="space-y-2">
                        {asesores
                          .map(asesor => ({
                            asesor,
                            stats: estadisticas[asesor.ID],
                            tasaReporte: estadisticas[asesor.ID]?.clientesReportados / 
                                       (estadisticas[asesor.ID]?.totalClientes || 1) * 100
                          }))
                          .sort((a, b) => b.tasaReporte - a.tasaReporte)
                          .slice(0, 3)
                          .map(({ asesor, tasaReporte }, index) => (
                            <div key={`mejor-reporte-${asesor.ID}`} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                                <span className="text-sm text-gray-900">{asesor.NOMBRE}</span>
                              </div>
                              <span className="text-sm font-medium text-green-600">
                                {tasaReporte.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-2">3 Más Bajos</h4>
                      <div className="space-y-2">
                        {asesores
                          .map(asesor => ({
                            asesor,
                            stats: estadisticas[asesor.ID],
                            tasaReporte: estadisticas[asesor.ID]?.clientesReportados / 
                                       (estadisticas[asesor.ID]?.totalClientes || 1) * 100
                          }))
                          .sort((a, b) => a.tasaReporte - b.tasaReporte)
                          .slice(0, 3)
                          .map(({ asesor, tasaReporte }, index) => (
                            <div key={`peor-reporte-${asesor.ID}`} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">#{asesores.length - index}</span>
                                <span className="text-sm text-gray-900">{asesor.NOMBRE}</span>
                              </div>
                              <span className="text-sm font-medium text-red-600">
                                {tasaReporte.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

{/* Ranking Tiempo Primer Mensaje */}
<div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Tiempo Primer Mensaje</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-green-600 mb-2">Top 3 Más Rápidos</h4>
                      <div className="space-y-2">
                        {asesores
                          .map(asesor => ({
                            asesor,
                            stats: estadisticas[asesor.ID]
                          }))
                          .sort((a, b) => (a.stats?.tiempoHastaPrimerMensaje || 0) - (b.stats?.tiempoHastaPrimerMensaje || 0))
                          .slice(0, 3)
                          .map(({ asesor, stats }, index) => (
                            <div key={`mejor-tiempo-${asesor.ID}`} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                                <span className="text-sm text-gray-900">{asesor.NOMBRE}</span>
                              </div>
                              <span className="text-sm font-medium text-green-600">
                                {stats?.tiempoHastaPrimerMensaje.toFixed(1)}m
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-2">3 Más Lentos</h4>
                      <div className="space-y-2">
                        {asesores
                          .map(asesor => ({
                            asesor,
                            stats: estadisticas[asesor.ID]
                          }))
                          .sort((a, b) => (b.stats?.tiempoHastaPrimerMensaje || 0) - (a.stats?.tiempoHastaPrimerMensaje || 0))
                          .slice(0, 3)
                          .map(({ asesor, stats }, index) => (
                            <div key={`peor-tiempo-${asesor.ID}`} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">#{asesores.length - index}</span>
                                <span className="text-sm text-gray-900">{asesor.NOMBRE}</span>
                              </div>
                              <span className="text-sm font-medium text-red-600">
                                {stats?.tiempoHastaPrimerMensaje.toFixed(1)}m
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ranking Tasa de Cierre */}
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Tasa de Cierre</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-green-600 mb-2">Top 3 Mejores</h4>
                      <div className="space-y-2">
                        {asesores
                          .map(asesor => ({
                            asesor,
                            stats: estadisticas[asesor.ID]
                          }))
                          .sort((a, b) => (b.stats?.porcentajeCierre || 0) - (a.stats?.porcentajeCierre || 0))
                          .slice(0, 3)
                          .map(({ asesor, stats }, index) => (
                            <div key={`mejor-cierre-${asesor.ID}`} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                                <span className="text-sm text-gray-900">{asesor.NOMBRE}</span>
                              </div>
                              <span className="text-sm font-medium text-green-600">
                                {stats?.porcentajeCierre.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-2">3 Más Bajos</h4>
                      <div className="space-y-2">
                        {asesores
                          .map(asesor => ({
                            asesor,
                            stats: estadisticas[asesor.ID]
                          }))
                          .sort((a, b) => (a.stats?.porcentajeCierre || 0) - (b.stats?.porcentajeCierre || 0))
                          .slice(0, 3)
                          .map(({ asesor, stats }, index) => (
                            <div key={`peor-cierre-${asesor.ID}`} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-500">#{asesores.length - index}</span>
                                <span className="text-sm text-gray-900">{asesor.NOMBRE}</span>
                              </div>
                              <span className="text-sm font-medium text-red-600">
                                {stats?.porcentajeCierre.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                

                
              </div>
            </div>
            {/* Alertas Críticas */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Alertas Críticas</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {/* Conexiones Desconectadas */}
                {asesores.filter(asesor => {
                  const estado = conexionesEstado[asesor.ID];
                  return estado?.whatsapp !== 'conectado' || !estado?.telegram;
                }).map((asesor) => {
                  const estado = conexionesEstado[asesor.ID];
                  const whatsappDesconectado = estado?.whatsapp !== 'conectado';
                  const telegramSinConfigurar = !estado?.telegram;
                  
                  return (
                    <div key={`conexion-${asesor.ID}`} className="p-4 hover:bg-gray-50 transition-colors duration-150">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
                            <div className="flex flex-col space-y-1">
                              {whatsappDesconectado && (
                                <p className="text-sm text-orange-600 flex items-center">
                                  <Smartphone className="h-3 w-3 mr-1" />
                                  WhatsApp desconectado
                                </p>
                              )}
                              {telegramSinConfigurar && (
                                <p className="text-sm text-orange-600 flex items-center">
                                  <Send className="h-3 w-3 mr-1" />
                                  Telegram sin configurar
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          Conexiones pendientes
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Asesores Inactivos */}
                {getAsesoresInactivos().map(({ asesor, horasSinActividad, stats }) => (
                  <div key={`inactivo-${asesor.ID}`} className="p-4 hover:bg-gray-50 transition-colors duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
                          <p className="text-sm text-red-600">
                            {horasSinActividad} horas sin actividad
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {stats?.clientesSinReporte || 0} clientes sin reporte
                      </div>
                    </div>
                  </div>
                ))}

                {/* Clientes sin Primer Mensaje */}
                {getAsesoresClientesSinMensaje().map(({ asesor, clientesSinMensaje, stats }) => (
                  <div key={`sin-mensaje-${asesor.ID}`} className="p-4 hover:bg-gray-50 transition-colors duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
                          <p className="text-sm text-yellow-600">
                            {clientesSinMensaje} clientes sin primer mensaje (+20min)
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Tiempo promedio: {stats?.tiempoHastaPrimerMensaje.toFixed(1)}m
                      </div>
                    </div>
                  </div>
                ))}

                {/* Baja Tasa de Cierre */}
                {getAsesoresBajaCierre().map(({ asesor, porcentajeCierre, stats }) => (
                  <div key={`baja-cierre-${asesor.ID}`} className="p-4 hover:bg-gray-50 transition-colors duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
                          <p className="text-sm text-orange-600">
                            Tasa de cierre: {porcentajeCierre.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {stats?.ventasRealizadas || 0} ventas / {stats?.totalClientes || 0} clientes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

           

            
          </div>
        ) : vistaAdmin === 'asesores' ? (
          <>
            {/* Resumen y lista de asesores */}
            <div className="max-w-8xl mx-auto px-4 py-6">
              {/* KPIs Principales Modernos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                {/* Total Asesores */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Users className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Asesores</div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">{asesores.length}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Activos</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">
                      {asesores.filter(a => {
                        const stats = estadisticas[a.ID];
                        const ultimaActividad = stats?.ultimaActividad;
                        if (!ultimaActividad) return false;
                        const horasSinActividad = Math.floor((Date.now() - ultimaActividad * 1000) / (1000 * 60 * 60));
                        return horasSinActividad < 10;
                      }).length}
                    </span>
                  </div>
                </div>

                {/* Ventas Principal */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <Target className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Ventas Principal</div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        {Object.values(estadisticas).reduce((acc, stats) => acc + (stats.ventasPrincipal || 0), 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Principal</span>
                    </div>
                  </div>
                </div>

                {/* Ventas Downsell */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Target className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Ventas Downsell</div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        {Object.values(estadisticas).reduce((acc, stats) => acc + (stats.ventasDownsell || 0), 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600">Downsell</span>
                    </div>
                  </div>
                </div>

                {/* Total Clientes */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <Users className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Clientes</div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">{clientes.length}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Base de datos</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-sm font-medium text-purple-600">
                        {(Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) / Object.keys(estadisticas).length).toFixed(1)}% conversión
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estado de Conexiones */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                      <Settings className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Conexiones COMPLETAS</div>
                      <div className="text-lg font-bold text-gray-900 mt-1">
                        {Object.values(conexionesEstado).filter(c => c.whatsapp === 'conectado' && c.telegram).length}/
                        {asesores.length}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Smartphone className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600">WhatsApp</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-green-600">
                          {Object.values(conexionesEstado).filter(c => c.whatsapp === 'conectado').length}
                        </span>
                        <span className="text-xs text-gray-500">/</span>
                        <span className="text-sm font-medium text-red-600">
                          {Object.values(conexionesEstado).filter(c => c.whatsapp !== 'conectado').length}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Send className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-600">Telegram</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-green-600">
                          {Object.values(conexionesEstado).filter(c => c.telegram).length}
                        </span>
                        <span className="text-xs text-gray-500">/</span>
                        <span className="text-sm font-medium text-red-600">
                          {Object.values(conexionesEstado).filter(c => !c.telegram).length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de ventas mejorado */}
              {getSalesData.length > 0 && (
                <div className="mb-8">
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-gray-900">Tendencia de Ventas</h2>
                            <p className="text-sm text-gray-500">Evolución de conversiones por día</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-600">Principal</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-600">Downsell</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={getSalesData}>
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={{ stroke: '#e5e7eb' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={{ stroke: '#e5e7eb' }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="principal" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="downsell" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Filtros mejorados */}
              <div className="mb-8">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    {/* Buscador */}
                    <div className="flex-1 relative max-w-md">
                      <input
                        type="text"
                        placeholder="Buscar asesor por nombre o WhatsApp..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      />
                      <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    </div>
                    
                    {/* Controles de Filtro */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Período */}
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-2">Período de análisis</label>
                        <select
                          value={periodoSeleccionado}
                          onChange={(e) => setPeriodoSeleccionado(e.target.value as 'año' | 'mes' | 'semana' | 'personalizado')}
                          className="w-full sm:w-48 px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="personalizado">3 meses (recomendado)</option>
                          <option value="año">Este año</option>
                          <option value="mes">Último mes</option>
                          <option value="semana">Última semana</option>
                        </select>
                      </div>

                      {/* Fechas personalizadas */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-2">Desde</label>
                          <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => {
                              setFechaInicio(e.target.value);
                              setPeriodoSeleccionado('personalizado');
                            }}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-2">Hasta</label>
                          <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => {
                              setFechaFin(e.target.value);
                              setPeriodoSeleccionado('personalizado');
                            }}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Ordenar por */}
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-2">Ordenar por</label>
                        <div className="flex items-center space-x-2">
                          <select
                            value={ordenarPor}
                            onChange={(e) => setOrdenarPor(e.target.value as OrdenAsesor)}
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="ventas">Ventas totales</option>
                            <option value="tasa">Tasa de cierre</option>
                            <option value="tiempo">Tiempo de conversión</option>
                            <option value="actividad">Última actividad</option>
                            <option value="clientes">Total de clientes</option>
                            <option value="sin_reporte">Clientes sin reporte</option>
                            <option value="criticos">Clientes críticos</option>
                            <option value="tiempo_primer_mensaje">Tiempo primer mensaje</option>
                            <option value="seguimientos">Seguimientos pendientes</option>
                            <option value="conexiones_desconectadas">🔴 Conexiones desconectadas</option>
                            <option value="whatsapp_desconectado">📱 WhatsApp desconectado</option>
                            <option value="telegram_sin_configurar">📨 Telegram sin configurar</option>
                          </select>
                          <button
                            onClick={() => setOrdenDireccion(ordenDireccion === 'desc' ? 'asc' : 'desc')}
                            className={`px-3 py-3 border border-gray-200 rounded-xl transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              ordenDireccion === 'desc' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                            }`}
                            title={
                              ordenDireccion === 'desc' 
                                ? 'Mayor a menor (click para cambiar a menor a mayor)'
                                : 'Menor a mayor (click para cambiar a mayor a menor)'
                            }
                          >
                            {ordenDireccion === 'desc' ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-blue-600">↓</span>
                                <span className="text-xs text-blue-600 font-medium">DESC</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-gray-600">↑</span>
                                <span className="text-xs text-gray-600 font-medium">ASC</span>
                              </div>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Toggle inactivos */}
                      <div className="flex flex-col justify-end">
                        <div className="flex items-center space-x-3 bg-gray-50 rounded-xl p-3">
                          <span className="text-sm font-medium text-gray-700">
                            {mostrarInactivos ? 'Solo inactivos' : 'Todos'}
                          </span>
                          <button
                            onClick={() => setMostrarInactivos(!mostrarInactivos)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              mostrarInactivos ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                            role="switch"
                            aria-checked={mostrarInactivos}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                mostrarInactivos ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botón restablecer cuando NO estás en el período recomendado de 3 meses */}
                  {periodoSeleccionado !== 'personalizado' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setPeriodoSeleccionado('personalizado');
                          const { inicio, fin } = calcularPeriodoTresMeses();
                          setFechaInicio(inicio);
                          setFechaFin(fin);
                        }}
                        className="inline-flex items-center px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors duration-200 border border-blue-200"
                      >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        📊 Cambiar a período recomendado (3 meses)
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        El período de 3 meses ofrece el balance ideal para análisis de rendimiento
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Asesores */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Rendimiento de Asesores</h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4">
                    {asesoresOrdenados.map((asesor) => {
                      const stats = estadisticas[asesor.ID];
                      const ultimaActividadDate = stats?.ultimaActividad ? new Date(stats.ultimaActividad * 1000) : null;
                      const horasSinActividad = ultimaActividadDate
                        ? Math.floor((Date.now() - ultimaActividadDate.getTime()) / (1000 * 60 * 60))
                        : null;
                      
                      const estadoConexion = conexionesEstado[asesor.ID];
                      const actividades = getUltimasActividades(asesor.ID);
                      
                      return (
                        <div key={asesor.ID} className="bg-gray-50 rounded-lg p-4">
                          {/* Encabezado del asesor */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center">
                              <Users className="h-8 w-8 text-blue-500" />
                              <div className="ml-3">
                                <h3 className="text-lg font-semibold">{asesor.NOMBRE}</h3>
                                {horasSinActividad !== null && (
                                  <p className={`text-sm ${horasSinActividad > 10 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {formatInactivityTime(stats?.ultimaActividad)}
                                  </p>
                                )}
                                {/* Indicadores de Conexión */}
                                <div className="flex items-center space-x-3 mt-2">
                                  {/* Estado WhatsApp */}
                                  <div className="flex items-center space-x-1">
                                    <Smartphone className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs font-medium">WhatsApp:</span>
                                    {estadoConexion?.whatsapp === 'verificando' ? (
                                      <span className="text-xs text-gray-500 animate-pulse">Verificando...</span>
                                    ) : (
                                      <div className="flex items-center space-x-1">
                                        <div className={`w-2 h-2 rounded-full ${
                                          estadoConexion?.whatsapp === 'conectado' 
                                            ? 'bg-green-500' 
                                            : 'bg-red-500'
                                        }`}></div>
                                        <span className={`text-xs font-medium ${
                                          estadoConexion?.whatsapp === 'conectado' 
                                            ? 'text-green-600' 
                                            : 'text-red-600'
                                        }`}>
                                          {estadoConexion?.whatsapp === 'conectado' ? 'Conectado' : 'Desconectado'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Estado Telegram */}
                                  <div className="flex items-center space-x-1">
                                    <Send className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs font-medium">Telegram:</span>
                                    <div className="flex items-center space-x-1">
                                      <div className={`w-2 h-2 rounded-full ${
                                        estadoConexion?.telegram 
                                          ? 'bg-green-500' 
                                          : 'bg-red-500'
                                      }`}></div>
                                      <span className={`text-xs font-medium ${
                                        estadoConexion?.telegram 
                                          ? 'text-green-600' 
                                          : 'text-red-600'
                                      }`}>
                                        {estadoConexion?.telegram ? 'Configurado' : 'Sin configurar'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <BarChart className="h-6 w-6 text-green-500" />
                              <span className="text-lg font-bold">{stats?.porcentajeCierre.toFixed(1)}% Cierre</span>
                            </div>
                          </div>
                          {/* Estadísticas del asesor */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Métricas de Tiempo */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Tiempos de Respuesta</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Primer Mensaje:</span>
                                  <div className="text-right">
                                    <span className={`font-semibold ${stats?.tiempoHastaPrimerMensaje >
                                        Object.values(estadisticas).reduce((acc, s) => acc + s.tiempoHastaPrimerMensaje, 0) / Object.keys(estadisticas).length
                                        ? 'text-red-500'
                                        : 'text-green-500'
                                      }`}>
                                      {stats?.tiempoHastaPrimerMensaje.toFixed(1)}m
                                    </span>
                                    <span className="text-xs text-gray-500 block">
                                      vs {(Object.values(estadisticas).reduce((acc, s) => acc + s.tiempoHastaPrimerMensaje, 0) / Object.keys(estadisticas).length).toFixed(1)}m equipo
                                    </span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tiempo de Completado:</span>
                                  <span className="font-semibold">{stats?.tiempoPromedioRespuesta.toFixed(1)}h</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tiempo hasta Reporte:</span>
                                  <span className="font-semibold">{stats?.tiempoPromedioHastaReporte.toFixed(1)}h</span>
                                </div>
                              </div>
                            </div>
                            {/* Estado de Clientes */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Estado de Clientes</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Total:</span>
                                  <span className="font-semibold">{stats?.totalClientes}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-red-500 flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    Sin reporte:
                                  </span>
                                  <span className="font-semibold text-red-500">{stats?.clientesSinReporte}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-500 flex items-center">
                                    <Clock className="h-4 w-4 mr-1" />
                                    En seguimiento:
                                  </span>
                                  <span className="font-semibold text-blue-500">{stats?.clientesEnSeguimiento}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-amber-500 flex items-center">
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    Críticos (EVENTOS HOTMART):
                                  </span>
                                  <span className="font-semibold text-amber-500">{stats?.clientesCriticos}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-red-500 flex items-center">
                                    <Clock className="h-4 w-4 mr-1" />
                                    Sin primer mensaje +20min:
                                  </span>
                                  <span className="font-semibold text-red-500">{stats?.clientesSinMensaje20Min}</span>
                                </div>
                              </div>
                            </div>
                            {/* Seguimientos */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Seguimientos</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Pendientes:</span>
                                  <span className="font-semibold text-yellow-500">{stats?.seguimientosPendientes}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Completados:</span>
                                  <span className="font-semibold text-green-500">{stats?.seguimientosCompletados}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tasa de respuesta:</span>
                                  <span className="font-semibold">{stats?.tasaRespuesta.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                            {/* Ventas */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Ventas</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Ventas:</span>
                                  <span className="font-semibold text-green-500">
                                    {stats?.ventasReportadas}
                                    {stats?.ventasSinReportar > 0 && (
                                      <span className="text-xs text-red-500 ml-1">
                                        ({stats.ventasSinReportar} sin reportar - no incluidas)
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tiempo promedio:</span>
                                  <span className="font-semibold">{stats?.tiempoPromedioConversion.toFixed(1)} días</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tasa de cierre:</span>
                                  <span className="font-semibold">{stats?.porcentajeCierre.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Últimas Actividades */}
                          <div className="mt-4 bg-white p-4 rounded-lg shadow">
                            <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                              <Clock className="h-4 w-4 mr-2" />
                              Últimas Actividades
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Último Reporte */}
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-600 flex items-center">
                                    <FileText className="h-4 w-4 mr-1" />
                                    Último Reporte
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    actividades.ultimoReporte.minutosTranscurridos === null 
                                      ? 'bg-gray-200 text-gray-600'
                                      : actividades.ultimoReporte.minutosTranscurridos <= 60
                                      ? 'bg-green-100 text-green-700'
                                      : actividades.ultimoReporte.minutosTranscurridos <= 180
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {formatearTiempoMinutos(actividades.ultimoReporte.minutosTranscurridos)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {actividades.ultimoReporte.fecha 
                                    ? actividades.ultimoReporte.fecha.toLocaleDateString() + ' ' + 
                                      actividades.ultimoReporte.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                    : 'Sin reportes aún'
                                  }
                                </div>
                              </div>

                              {/* Última Venta */}
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-600 flex items-center">
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Última Venta
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    actividades.ultimaVenta.minutosTranscurridos === null 
                                      ? 'bg-gray-200 text-gray-600'
                                      : actividades.ultimaVenta.minutosTranscurridos <= 1440 // 24 horas
                                      ? 'bg-green-100 text-green-700'
                                      : actividades.ultimaVenta.minutosTranscurridos <= 4320 // 3 días
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {formatearTiempoMinutos(actividades.ultimaVenta.minutosTranscurridos)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {actividades.ultimaVenta.fecha 
                                    ? actividades.ultimaVenta.fecha.toLocaleDateString() + ' ' + 
                                      actividades.ultimaVenta.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                    : 'Sin ventas registradas'
                                  }
                                </div>
                              </div>

                              {/* Último Mensaje Saliente */}
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-600 flex items-center">
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Último Mensaje saliente
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    actividades.ultimoMensaje.minutosTranscurridos === null 
                                      ? 'bg-gray-200 text-gray-600'
                                      : actividades.ultimoMensaje.minutosTranscurridos <= 30
                                      ? 'bg-green-100 text-green-700'
                                      : actividades.ultimoMensaje.minutosTranscurridos <= 120
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {formatearTiempoMinutos(actividades.ultimoMensaje.minutosTranscurridos)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {actividades.ultimoMensaje.fecha 
                                    ? actividades.ultimoMensaje.fecha.toLocaleDateString() + ' ' + 
                                      actividades.ultimoMensaje.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                    : 'Sin mensajes enviados'
                                  }
                                </div>
                              </div>

                              {/* Indicador de Estado General */}
                              <div className="md:col-span-3 mt-2">
                                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                                  <span className="text-sm font-medium text-blue-800">Estado de Actividad:</span>
                                  <div className="flex items-center">
                                    {actividades.ultimoMensaje.minutosTranscurridos !== null && 
                                     actividades.ultimoMensaje.minutosTranscurridos <= 30 ? (
                                      <div className="flex items-center text-green-600">
                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                        <span className="text-sm font-medium">Activo</span>
                                      </div>
                                    ) : actividades.ultimoMensaje.minutosTranscurridos !== null && 
                                           actividades.ultimoMensaje.minutosTranscurridos <= 120 ? (
                                      <div className="flex items-center text-yellow-600">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                        <span className="text-sm font-medium">Moderadamente Activo</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center text-red-600">
                                        <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                        <span className="text-sm font-medium">Inactivo</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Alertas individuales */}
                          {(stats?.clientesSinReporte > 0 ||
                            (horasSinActividad !== null && horasSinActividad > 10) ||
                            stats?.clientesCriticos > 0 ||
                            stats?.clientesNoContactados > 0 ||
                            stats?.tiempoPromedioRespuesta > 24) && (
                              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                                  <Bell className="h-4 w-4 mr-2" />
                                  Alertas
                                </h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {stats?.clientesSinReporte > 0 && (
                                    <li className="text-sm text-red-700">
                                      Tiene {stats.clientesSinReporte} cliente(s) sin reporte
                                    </li>
                                  )}
                                  {horasSinActividad !== null && horasSinActividad > 10 && (
                                    <li className="text-sm text-red-700">
                                      No ha registrado actividad en las últimas {horasSinActividad} hora(s)
                                    </li>
                                  )}
                                  {stats?.clientesCriticos > 0 && (
                                    <li className="text-sm text-red-700">
                                      Tiene {stats.clientesCriticos} cliente(s) críticos sin atender
                                    </li>
                                  )}
                                  {stats?.ventasSinReportar > 0 && (
                                    <li className="text-sm text-red-700">
                                      Tiene {stats.ventasSinReportar} venta(s) sin reportar
                                    </li>
                                  )}
                                  {stats?.clientesNoContactados > 0 && (
                                    <li className="text-sm text-red-700">
                                      {stats.clientesNoContactados} cliente(s) sin contactar en las últimas 48 horas
                                    </li>
                                  )}
                                  {stats?.tiempoPromedioRespuesta > 24 && (
                                    <li className="text-sm text-red-700">
                                      Tiempo de completado superior a 24 horas
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          {/* Botón para ver detalle */}
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={() => setAsesorSeleccionado(asesor)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                              Ver Detalle
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {asesoresOrdenados.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No se encontraron asesores que coincidan con los filtros aplicados
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Modal de Detalle de Asesor */}
            {asesorSeleccionado && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-full max-w-7xl bg-white shadow-xl rounded-lg">
                  {asesorSeleccionado && asesorSeleccionado.ID && asesorSeleccionado.NOMBRE && (
                    <DetalleAsesor
                      asesor={asesorSeleccionado as Asesor}
                      estadisticas={estadisticas[asesorSeleccionado.ID]}
                      clientes={clientes.filter((c) => c.ID_ASESOR === asesorSeleccionado.ID)}
                      reportes={reportes.filter((r) => r.ID_ASESOR === asesorSeleccionado.ID)}
                      registros={registros}
                      promedioEquipo={{
                        tasaCierre:
                          Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) /
                          Object.keys(estadisticas).length,
                        tiempoRespuesta:
                          Object.values(estadisticas).reduce((acc, stats) => acc + stats.tiempoPromedioRespuesta, 0) /
                          Object.keys(estadisticas).length,
                        ventasPorMes:
                          Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasPorMes, 0) /
                          Object.keys(estadisticas).length,
                      }}
                      teamStatsByFuente={calculateTeamStatsByFuente(clientes, reportes, registros)}
                      bestRateByFuente={calculateBestRateByFuente(clientes, reportes, registros)}
                      onBack={() => setAsesorSeleccionado(null)}
                      onChat={setClienteParaChat}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        ) : vistaAdmin === 'clientes' ? (
          <div className="p-4 space-y-8">
            {/* Botón para crear cliente */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setMostrarModalCrearCliente(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Crear Cliente
              </button>
            </div>
            {/* Filtros */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Buscador */}
              <div className="relative w-full md:w-1/3">
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {/* Filtro por estado */}
              <div className="w-full md:w-1/4">
                <select
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-3 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="SEGUIMIENTO">Seguimiento</option>
                  <option value="NO CONTESTÓ">No Contestó</option>
                  <option value="NO CONTACTAR">No Contactar</option>
                </select>
              </div>
              {/* Botón de refrescar y último update */}
              <div className="flex items-center gap-2">
                <button
                  onClick={refrescarClientes}
                  disabled={cargandoClientes}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCcw className={`h-5 w-5 mr-2 ${cargandoClientes ? 'animate-spin' : ''}`} />
                  {cargandoClientes ? 'Refrescando...' : 'Refrescar'}
                </button>
                <span className="text-xs text-gray-500">
                  Actualizado: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </div>
            {/* Tabla de Clientes */}
            <div className="overflow-x-auto">
              {(() => {
                const filteredClients = clientes
                  .filter(
                    (c) =>
                      (c.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
                        c.WHATSAPP.includes(busqueda)) &&
                      (filtroEstado ? c.ESTADO === filtroEstado : true)
                  )
                  .filter((cliente) =>
                    asesores.some((a) => a.ID === cliente.ID_ASESOR)
                  )
                  .sort((a, b) => b.FECHA_CREACION - a.FECHA_CREACION);

                const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
                const paginatedClients = filteredClients.slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                );

                return (
                  <>
                    <table className="min-w-full bg-white shadow rounded-lg">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            WhatsApp
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            <div className="flex flex-col">
                              <span>Fecha de</span>
                              <span>Creación</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            <div className="flex flex-col">
                              <span>Último</span>
                              <span>Reporte</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            <div className="flex flex-col">
                              <span>Asesor</span>
                              <span>Asignado</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedClients.map((cliente) => {
                          const asesorAsignado = asesores.find(
                            (a) => a.ID === cliente.ID_ASESOR
                          );
                          const ultimoReporte = reportes
                            .filter((r) => r.ID_CLIENTE === cliente.ID)
                            .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];

                          const borderClass = ultimoReporte
                            ? "border-l-4 border-green-500"
                            : "border-l-4 border-red-500";

                          const tiempoReporte = ultimoReporte
                            ? (() => {
                              const diff = ultimoReporte.FECHA_REPORTE - cliente.FECHA_CREACION;
                              const hours = Math.floor(diff / 3600);
                              if (hours < 24) return `(${hours}h)`;
                              const days = Math.floor(hours / 24);
                              const remainingHours = hours % 24;
                              return `(${days}d ${remainingHours}h)`;
                            })()
                            : null;

                          const tiempoSinReporte = !ultimoReporte
                            ? formatDistanceToNow(new Date(cliente.FECHA_CREACION * 1000), {
                              addSuffix: true,
                              locale: es,
                            })
                            : null;

                          return (
                            <tr key={cliente.ID} className="hover:bg-gray-50">
                              <td className={`px-4 py-3 text-sm text-gray-800 ${borderClass}`}>
                                <div className="truncate max-w-[150px]">
                                  {cliente.NOMBRE}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="truncate max-w-[120px]">
                                  {cliente.WHATSAPP}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="flex flex-col">
                                  <span>{formatDate(cliente.FECHA_CREACION).split(' ')[0]}</span>
                                  <span className="text-xs text-gray-500">{formatDate(cliente.FECHA_CREACION).split(' ')[1]}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full w-fit inline-block ${getClienteEstadoColor(cliente.ESTADO)}`}>
                                  {cliente.ESTADO || "Sin definir"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="truncate max-w-[100px]">
                                  {ultimoReporte ? ultimoReporte.PRODUCTO : 'Sin definir'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {ultimoReporte ? (
                                  <div className="flex flex-col">
                                    <span className="text-gray-700 truncate">
                                      {formatDate(ultimoReporte.FECHA_REPORTE)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {tiempoReporte}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-block text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-semibold">
                                    Sin reporte – {tiempoSinReporte}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {asesorAsignado ? (
                                  <span className={`truncate max-w-[120px] inline-block ${!ultimoReporte ? "text-red-700 font-bold" : "text-gray-800"}`}>
                                    {asesorAsignado.NOMBRE}
                                  </span>
                                ) : (
                                  "Sin asignar"
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-1">
                                  {asesorAsignado && (
                                    <div>
                                      <ReasignarCliente
                                        clienteId={cliente.ID}
                                        asesorActual={asesorAsignado.NOMBRE}
                                        onReasignSuccess={handleClienteReasignado}
                                      />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setClienteSeleccionado(cliente)}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                                  >
                                    Ver Historial
                                  </button>
                                  <button
                                    onClick={() => setClienteParaChat(cliente)}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                    Chat
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex justify-end items-center space-x-2 mt-4">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Página {currentPage} de {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ) : vistaAdmin === 'gestion' ? (
          <GestionAsignaciones 
            asesores={asesores} 
            onUpdate={cargarSoloAsesores}
            estadisticas={estadisticas}
          />
        ) : (
          <div className="p-4 space-y-8">
            {/* Botón para crear cliente */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setMostrarModalCrearCliente(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Crear Cliente
              </button>
            </div>
            {/* Filtros */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Buscador */}
              <div className="relative w-full md:w-1/3">
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {/* Filtro por estado */}
              <div className="w-full md:w-1/4">
                <select
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-3 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="SEGUIMIENTO">Seguimiento</option>
                  <option value="NO CONTESTÓ">No Contestó</option>
                  <option value="NO CONTACTAR">No Contactar</option>
                </select>
              </div>
              {/* Botón de refrescar y último update */}
              <div className="flex items-center gap-2">
                <button
                  onClick={refrescarClientes}
                  disabled={cargandoClientes}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCcw className={`h-5 w-5 mr-2 ${cargandoClientes ? 'animate-spin' : ''}`} />
                  {cargandoClientes ? 'Refrescando...' : 'Refrescar'}
                </button>
                <span className="text-xs text-gray-500">
                  Actualizado: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </div>
            {/* Tabla de Clientes */}
            <div className="overflow-x-auto">
              {(() => {
                const filteredClients = clientes
                  .filter(
                    (c) =>
                      (c.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
                        c.WHATSAPP.includes(busqueda)) &&
                      (filtroEstado ? c.ESTADO === filtroEstado : true)
                  )
                  .filter((cliente) =>
                    asesores.some((a) => a.ID === cliente.ID_ASESOR)
                  )
                  .sort((a, b) => b.FECHA_CREACION - a.FECHA_CREACION);

                const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
                const paginatedClients = filteredClients.slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                );

                return (
                  <>
                    <table className="min-w-full bg-white shadow rounded-lg">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            WhatsApp
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            <div className="flex flex-col">
                              <span>Fecha de</span>
                              <span>Creación</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            <div className="flex flex-col">
                              <span>Último</span>
                              <span>Reporte</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            <div className="flex flex-col">
                              <span>Asesor</span>
                              <span>Asignado</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedClients.map((cliente) => {
                          const asesorAsignado = asesores.find(
                            (a) => a.ID === cliente.ID_ASESOR
                          );
                          const ultimoReporte = reportes
                            .filter((r) => r.ID_CLIENTE === cliente.ID)
                            .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];

                          const borderClass = ultimoReporte
                            ? "border-l-4 border-green-500"
                            : "border-l-4 border-red-500";

                          const tiempoReporte = ultimoReporte
                            ? (() => {
                              const diff = ultimoReporte.FECHA_REPORTE - cliente.FECHA_CREACION;
                              const hours = Math.floor(diff / 3600);
                              if (hours < 24) return `(${hours}h)`;
                              const days = Math.floor(hours / 24);
                              const remainingHours = hours % 24;
                              return `(${days}d ${remainingHours}h)`;
                            })()
                            : null;

                          const tiempoSinReporte = !ultimoReporte
                            ? formatDistanceToNow(new Date(cliente.FECHA_CREACION * 1000), {
                              addSuffix: true,
                              locale: es,
                            })
                            : null;

                          return (
                            <tr key={cliente.ID} className="hover:bg-gray-50">
                              <td className={`px-4 py-3 text-sm text-gray-800 ${borderClass}`}>
                                <div className="truncate max-w-[150px]">
                                  {cliente.NOMBRE}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="truncate max-w-[120px]">
                                  {cliente.WHATSAPP}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="flex flex-col">
                                  <span>{formatDate(cliente.FECHA_CREACION).split(' ')[0]}</span>
                                  <span className="text-xs text-gray-500">{formatDate(cliente.FECHA_CREACION).split(' ')[1]}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full w-fit inline-block ${getClienteEstadoColor(cliente.ESTADO)}`}>
                                  {cliente.ESTADO || "Sin definir"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="truncate max-w-[100px]">
                                  {ultimoReporte ? ultimoReporte.PRODUCTO : 'Sin definir'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {ultimoReporte ? (
                                  <div className="flex flex-col">
                                    <span className="text-gray-700 truncate">
                                      {formatDate(ultimoReporte.FECHA_REPORTE)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {tiempoReporte}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-block text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-semibold">
                                    Sin reporte – {tiempoSinReporte}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {asesorAsignado ? (
                                  <span className={`truncate max-w-[120px] inline-block ${!ultimoReporte ? "text-red-700 font-bold" : "text-gray-800"}`}>
                                    {asesorAsignado.NOMBRE}
                                  </span>
                                ) : (
                                  "Sin asignar"
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-1">
                                  {asesorAsignado && (
                                    <div>
                                      <ReasignarCliente
                                        clienteId={cliente.ID}
                                        asesorActual={asesorAsignado.NOMBRE}
                                        onReasignSuccess={handleClienteReasignado}
                                      />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setClienteSeleccionado(cliente)}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                                  >
                                    Ver Historial
                                  </button>
                                  <button
                                    onClick={() => setClienteParaChat(cliente)}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                    Chat
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex justify-end items-center space-x-2 mt-4">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Página {currentPage} de {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Historial de Cliente */}
      {clienteSeleccionado && (
        <HistorialCliente
          cliente={clienteSeleccionado}
          reportes={reportes.filter((r) => r.ID_CLIENTE === clienteSeleccionado.ID)}
          asesor={asesores.find((a) => a.ID === clienteSeleccionado.ID_ASESOR)}
          admin={true}
          onClose={() => setClienteSeleccionado(null)}
        />
      )}

      {mostrarModalCrearCliente && (
        <CrearClienteModal
          asesores={asesores}
          onClose={() => setMostrarModalCrearCliente(false)}
          onClienteCreado={refrescarClientes}
        />
      )}

      {mostrarModalCrearAsesor && (
        <CrearAsesorModal
          onClose={() => setMostrarModalCrearAsesor(false)}
          onAsesorCreado={cargarDatos}
        />
      )}

      {/* Modal de Detalle de Asesor */}
      {asesorSeleccionado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-7xl bg-white shadow-xl rounded-lg">
            {asesorSeleccionado && (
              <DetalleAsesor
                asesor={asesorSeleccionado!}
                estadisticas={estadisticas[asesorSeleccionado.ID]}
                clientes={clientes.filter((c) => c.ID_ASESOR === asesorSeleccionado.ID)}
                reportes={reportes.filter((r) => r.ID_ASESOR === asesorSeleccionado.ID)}
                registros={registros}
                promedioEquipo={{
                  tasaCierre:
                    Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) /
                    Object.keys(estadisticas).length,
                  tiempoRespuesta:
                    Object.values(estadisticas).reduce((acc, stats) => acc + stats.tiempoPromedioRespuesta, 0) /
                    Object.keys(estadisticas).length,
                  ventasPorMes:
                    Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasPorMes, 0) /
                    Object.keys(estadisticas).length,
                }}
                teamStatsByFuente={calculateTeamStatsByFuente(clientes, reportes, registros)}
                bestRateByFuente={calculateBestRateByFuente(clientes, reportes, registros)}
                onBack={() => setAsesorSeleccionado(null)}
                onChat={setClienteParaChat}
              />
            )}
          </div>
        </div>
      )}

      {/* Add the ChatModal component */}
      {clienteParaChat && (
        <ChatModal
          isOpen={!!clienteParaChat}
          onClose={() => setClienteParaChat(null)}
          cliente={clienteParaChat}
          asesor={asesorSeleccionado ? { ID: asesorSeleccionado.ID, NOMBRE: asesorSeleccionado.NOMBRE } : { ID: 0, NOMBRE: 'Admin' }}
        />
      )}

    </div>
  );
}
