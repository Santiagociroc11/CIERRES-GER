import { useEffect, useState, useMemo, useRef } from 'react';
import { apiClient, withRetry } from '../lib/apiClient';
import { Asesor, EstadisticasDetalladas, OrdenAsesor, AdminRole, esReporteCompleto } from '../types';
import { getEvolutionStatusConfig } from '../types/evolutionApi';
import {
  BarChart,
  LogOut,
  Users,
  Target,
  Clock,
  Download,
  AlertCircle,
  AlertTriangle,
  Bell,
  Search,
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
  Webhook,
  Edit,
  Grid3X3,
  List,
  Copy,
  Crown,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import EditarAsesorModal from './EditarAsesorModal';
import WebhookConfig from './WebhookConfig';
import WebhookLogs from './WebhookLogs';
import DashboardAsesor from './DashboardAsesor';
import DuplicateModal from './DuplicateModal';

interface DashboardAdminProps {
  asesor: Asesor;
  adminRole: AdminRole;
  onLogout: () => void;
}

export default function DashboardAdmin({ asesor, adminRole, onLogout }: DashboardAdminProps) {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [estadisticas, setEstadisticas] = useState<Record<number, EstadisticasDetalladas>>({});
  const [clientes, setClientes] = useState<any[]>([]);
  const [reportes, setReportes] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [conversaciones, setConversaciones] = useState<any[]>([]);
  const loadIdRef = useRef(0);

  // 🆕 Estados para Chat Global
  const [asesorSeleccionadoChat, setAsesorSeleccionadoChat] = useState<Asesor | null>(null);
  const [conversacionesChat, setConversacionesChat] = useState<any[]>([]);
  const [conversacionActivaChat, setConversacionActivaChat] = useState<any>(null);
  const [mensajesChat, setMensajesChat] = useState<any[]>([]);
  const [cargandoConversacionesChat, setCargandoConversacionesChat] = useState(false);
  const [cargandoMensajesChat, setCargandoMensajesChat] = useState(false);
  const [filtroChatGlobal, setFiltroChatGlobal] = useState<'todos'>('todos');
  const [anchoListaChat, setAnchoListaChat] = useState(500); // Ancho inicial de la lista de chats
  const [redimensionando, setRedimensionando] = useState(false);

  // 🆕 Estados para gestión de VIPs
  const [vistaVIP, setVistaVIP] = useState<'importar' | 'pendientes' | 'en-sistema'>('importar');
  const [archivoCsv, setArchivoCsv] = useState<File | null>(null);
  const [procesandoCsv, setProcesandoCsv] = useState(false);
  const [resultadoProceso, setResultadoProceso] = useState<any>(null);
  const [vipsPendientes, setVipsPendientes] = useState<any[]>([]);
  const [cargandoVips, setCargandoVips] = useState(false);
  const [vipsEnSistema, setVipsEnSistema] = useState<any[]>([]);
  const [cargandoVipsEnSistema, setCargandoVipsEnSistema] = useState(false);
  const [vipsPipelinePorAsesor, setVipsPipelinePorAsesor] = useState<any[]>([]);
  const [cargandoPipeline, setCargandoPipeline] = useState(false);
  const [vipsTablaData, setVipsTablaData] = useState<any[]>([]);
  const [cargandoTablaVips, setCargandoTablaVips] = useState(false);
  const [sortVipsBy, setSortVipsBy] = useState<string>('asesor');
  const [sortVipsOrder, setSortVipsOrder] = useState<'asc' | 'desc'>('asc');
  
  // Estados para asignación masiva
  const [asignacionMasiva, setAsignacionMasiva] = useState<{[asesorId: number]: number}>({});
  const [procesandoAsignacion, setProcesandoAsignacion] = useState(false);
  
  // 🆕 Función para obtener nombre del cliente
  const obtenerNombreCliente = (conversacion: any) => {
    // Si tiene id_cliente, buscar en la base de clientes
    if (conversacion.id_cliente) {
      const cliente = clientes.find(c => c.ID === conversacion.id_cliente);
      if (cliente) {
        return cliente.NOMBRE;
      }
    }
    
    // Si no tiene id_cliente pero tiene wha_cliente
    if (conversacion.wha_cliente) {
      // Verificar si es un LID sin mapear
      if (conversacion.wha_cliente.includes('@lid')) {
        return `LID Sin Mapear: ${conversacion.wha_cliente}`;
      }
      
      // Buscar por WhatsApp en la base de clientes
      const cliente = clientes.find(c => c.WHATSAPP === conversacion.wha_cliente);
      if (cliente) {
        return cliente.NOMBRE;
      }
      
      // Si no se encuentra, mostrar como desconocido
      return `Cliente Desconocido: ${conversacion.wha_cliente}`;
    }
    
    // Fallback
    return 'Cliente Sin Identificar';
  };
  
  // 🆕 Función para obtener estado del cliente
  const obtenerEstadoCliente = (conversacion: any) => {
    if (conversacion.id_cliente) {
      const cliente = clientes.find(c => c.ID === conversacion.id_cliente);
      if (cliente) {
        return cliente.ESTADO;
      }
    }
    
    if (conversacion.wha_cliente && !conversacion.wha_cliente.includes('@lid')) {
      const cliente = clientes.find(c => c.WHATSAPP === conversacion.wha_cliente);
      if (cliente) {
        return cliente.ESTADO;
      }
    }
    
    return null;
  };
  
  // 🆕 Función para obtener tipo de cliente
  const obtenerTipoCliente = (conversacion: any) => {
    if (conversacion.wha_cliente && conversacion.wha_cliente.includes('@lid')) {
      return 'lid-sin-mapear';
    }
    
    if (conversacion.id_cliente || (conversacion.wha_cliente && !conversacion.wha_cliente.includes('@lid'))) {
      return 'cliente-mapeado';
    }
    
    return 'desconocido';
  };
  
  // 🆕 Función para filtrar conversaciones según el filtro seleccionado
  const conversacionesFiltradas = useMemo(() => {
    return conversacionesChat;
  }, [conversacionesChat]);

  // 🆕 Funciones para redimensionar la lista de chats
  const iniciarRedimensionamiento = (e: React.MouseEvent) => {
    e.preventDefault();
    setRedimensionando(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const redimensionar = (e: MouseEvent) => {
    if (!redimensionando) return;
    
    const nuevoAncho = e.clientX;
    if (nuevoAncho >= 250 && nuevoAncho <= 600) { // Límites mínimo y máximo
      setAnchoListaChat(nuevoAncho);
    }
  };

  const detenerRedimensionamiento = () => {
    setRedimensionando(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // 🆕 Event listeners para el redimensionamiento
  useEffect(() => {
    if (redimensionando) {
      document.addEventListener('mousemove', redimensionar);
      document.addEventListener('mouseup', detenerRedimensionamiento);
      
      return () => {
        document.removeEventListener('mousemove', redimensionar);
        document.removeEventListener('mouseup', detenerRedimensionamiento);
      };
    }
  }, [redimensionando]);
  
  const [conexionesEstado, setConexionesEstado] = useState<Record<number, {
    whatsapp: 'conectado' | 'desconectado' | 'conectando' | 'verificando';
    telegram: {
      hasId: boolean;
      status: 'verificando' | 'ok' | 'no_chat_id' | 'no_token' | 'invalid_token' | 'chat_not_reachable' | 'error';
      details?: string;
    };
  }>>({});
  
  // 🆕 Estados de carga y rendimiento
  const [, setCargandoDatos] = useState(false);
  const [, setCargandoConexiones] = useState(false);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [, setTiempoCarga] = useState<number | null>(null);
  
  const itemsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'año' | 'mes' | 'semana' | 'personalizado'>('personalizado');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenarPor, setOrdenarPor] = useState<OrdenAsesor>('ventas');
  const [ordenDireccion, setOrdenDireccion] = useState<'asc' | 'desc'>('desc');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [, setMostrarFiltros] = useState(false);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  // const [, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [mostrarModalCrearCliente, setMostrarModalCrearCliente] = useState(false);
  const [clienteParaChat, setClienteParaChat] = useState<any | null>(null);
  const [mostrarModalCrearAsesor, setMostrarModalCrearAsesor] = useState(false);
  const [asesorParaEditar, setAsesorParaEditar] = useState<Asesor | null>(null);
  const [modalDuplicados, setModalDuplicados] = useState<{isOpen: boolean, clienteId: number, clienteName: string}>({
    isOpen: false,
    clienteId: 0,
    clienteName: ''
  });
  const [vistaAsesores, setVistaAsesores] = useState<'cards' | 'tabla'>('cards');
  const [vipModalAsesor, setVipModalAsesor] = useState<Asesor | null>(null);
  const [vipClientes, setVipClientes] = useState<any[]>([]);
  const [loadingVipClientes, setLoadingVipClientes] = useState(false);

  // Estado para alternar entre vista de Asesores y Clientes
  const [vistaAdmin, setVistaAdmin] = useState<'resumen' | 'asesores' | 'clientes' | 'gestion' | 'webhooks' | 'vips' | 'chat-global'>('asesores');
  
  // Estado para alternar entre modo admin y asesor
  const [modoAsesor, setModoAsesor] = useState(false);
  const [asesorModoActivo, setAsesorModoActivo] = useState<Asesor | null>(null);
  // Estado para el modal de historial de cliente
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
  // Estado para la sub-vista de webhooks
  const [vistaWebhook, setVistaWebhook] = useState<'config' | 'logs'>('config');

  const evolutionServerUrl = import.meta.env.VITE_EVOLUTIONAPI_URL;
  const evolutionApiKey = import.meta.env.VITE_EVOLUTIONAPI_TOKEN;

  const handleLogout = async () => {
    localStorage.removeItem('userSession');
    onLogout();
  };

  // Función para refrescar manualmente
  // const handleRefresh = async () => {
  //   await cargarDatos();
  // };

  // // 🆕 Nueva función para refrescar solo las conexiones (más rápida)
  // const refrescarSoloConexiones = async () => {
  //   if (asesores.length > 0) {
  //     setCargandoConexiones(true);
  //     console.log("🔄 Refrescando solo estados de conexión...");
  //     try {
  //       await verificarEstadosConexion(asesores);
  //     } finally {
  //       setCargandoConexiones(false);
  //     }
  //   }
  // };

  /** Una sola llamada a Evolution API: obtiene todas las instancias y devuelve mapa nombre → estado */
  const fetchAllWhatsAppStates = async (): Promise<Record<string, 'conectado' | 'desconectado' | 'conectando'>> => {
    const map: Record<string, 'conectado' | 'desconectado' | 'conectando'> = {};
    if (!evolutionServerUrl || !evolutionApiKey) return map;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${evolutionServerUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) return map;
      const data = await response.json();
      if (!Array.isArray(data)) return map;
      for (const instance of data) {
        const name = instance.instanceName ?? instance.instance ?? instance.name ?? '';
        if (!name) continue;
        const status = instance.connectionStatus;
        if (status === 'open') map[name] = 'conectado';
        else if (status === 'connecting' || status === 'qr' || status === 'loading') map[name] = 'conectando';
        else map[name] = 'desconectado';
      }
    } catch (e) {
      console.warn('⚠️ Error obteniendo instancias WhatsApp:', e);
    }
    return map;
  };

  // 🚀 Verificación rápida: 1 request WhatsApp (todas las instancias) + Telegram en paralelo sin pausas
  const verificarEstadosConexion = async (asesoresData: Asesor[]) => {
    console.log(`🔍 Verificando conexiones para ${asesoresData.length} asesores (modo rápido)...`);
    
    const nuevosEstados: Record<number, {
      whatsapp: 'conectado' | 'desconectado' | 'conectando' | 'verificando';
      telegram: {
        hasId: boolean;
        status: 'verificando' | 'ok' | 'no_chat_id' | 'no_token' | 'invalid_token' | 'chat_not_reachable' | 'error';
        details?: string;
      };
    }> = {};

    asesoresData.forEach(asesor => {
      const hasId = Boolean(asesor.ID_TG && asesor.ID_TG.trim());
      nuevosEstados[asesor.ID] = {
        whatsapp: 'verificando',
        telegram: { hasId, status: hasId ? 'verificando' : 'no_chat_id' }
      };
    });
    setConexionesEstado(nuevosEstados);

    // 1) WhatsApp: una sola llamada para todas las instancias
    const whatsappMap = await fetchAllWhatsAppStates();
    setConexionesEstado(prev => {
      const next = { ...prev };
      asesoresData.forEach(asesor => {
        const estado = whatsappMap[asesor.NOMBRE] ?? 'desconectado';
        if (next[asesor.ID]) next[asesor.ID] = { ...next[asesor.ID], whatsapp: estado };
      });
      return next;
    });

    // 2) Telegram: todos en paralelo (sin lotes ni pausas), timeout 6s
    const telegramPromises = asesoresData
      .filter(a => Boolean(a.ID_TG && a.ID_TG.trim()))
      .map(async (asesor) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(`/api/hotmart/telegram/verify-advisor/${asesor.ID}`, {
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await resp.json().catch(() => null);
          const status = data?.success ? data?.data?.status : 'error';
          const details = data?.success ? data?.data?.details : (data?.error || 'Error verificando Telegram');
          setConexionesEstado(prev => ({
            ...prev,
            [asesor.ID]: {
              ...prev[asesor.ID],
              telegram: { hasId: true, status: status || 'error', details }
            }
          }));
        } catch (error) {
          setConexionesEstado(prev => ({
            ...prev,
            [asesor.ID]: {
              ...prev[asesor.ID],
              telegram: {
                hasId: true,
                status: 'error',
                details: error instanceof Error ? error.message : 'Error verificando Telegram'
              }
            }
          }));
        }
      });

    await Promise.allSettled(telegramPromises);
    console.log('✅ Verificaciones de conexión completadas');
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
      const rawFirst = await apiClient.request<any[]>(firstPageUrl);
      const firstPage = Array.isArray(rawFirst) ? rawFirst : [];
      
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
      
      // Combinar resultados y verificar si necesitamos más páginas (normalizar por si la API devuelve no-array)
      for (const pageData of parallelResults) {
        const arr = Array.isArray(pageData) ? pageData : [];
        if (arr.length > 0) {
          allData = [...allData, ...arr];
        }
      }
      
      // 🚀 OPTIMIZACIÓN 4: Si la última página paralela está llena, continuar secuencialmente
      const lastParallelPage = parallelResults[parallelResults.length - 1];
      const lastParallelArr = Array.isArray(lastParallelPage) ? lastParallelPage : [];
      if (lastParallelArr.length === pageSize) {
        let offset = (maxParallelRequests + 1) * pageSize;
        let hasMore = true;
        
        while (hasMore) {
          const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
          const rawPage = await apiClient.request<any[]>(url);
          const pageData = Array.isArray(rawPage) ? rawPage : [];
          
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
      // Hacer 8 requests paralelos desde el inicio (sin request de prueba para ahorrar 1 round-trip)
      const maxParallelRequests = 8;
      const parallelPromises: Promise<any[]>[] = [];
      
      for (let i = 0; i < maxParallelRequests; i++) {
        const offset = i * pageSize;
        const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
        parallelPromises.push(apiClient.request<any[]>(url));
      }
      
      const parallelResults = await Promise.all(parallelPromises);
      let allData: any[] = [];
      
      // Combinar todos los resultados (normalizar cada página por si la API devuelve no-array)
      for (const pageData of parallelResults) {
        const arr = Array.isArray(pageData) ? pageData : [];
        if (arr.length > 0) {
          allData = [...allData, ...arr];
        }
      }
      
      // Si la última página estaba llena, continuar con más requests
      const lastPage = parallelResults[parallelResults.length - 1];
      const lastPageArr = Array.isArray(lastPage) ? lastPage : [];
      if (lastPageArr.length === pageSize) {
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
            const arr = Array.isArray(pageData) ? pageData : [];
            if (arr.length > 0) {
              allData = [...allData, ...arr];
              foundData = true;
            }
          }
          const lastMore = moreResults[moreResults.length - 1];
          const lastMoreArr = Array.isArray(lastMore) ? lastMore : [];
          if (!foundData || lastMoreArr.length < pageSize) {
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


  // 🆕 Funciones para gestión de VIPs
  const procesarArchivoCSV = (archivo: File): Promise<{ vips: any[]; duplicados: any[]; totalLineas: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let texto = e.target?.result as string;
          
          // Intentar decodificar caracteres especiales comunes en CSV
          texto = texto
            .replace(/Ã¡/g, 'á')
            .replace(/Ã©/g, 'é')
            .replace(/Ã­/g, 'í')
            .replace(/Ã³/g, 'ó')
            .replace(/Ãº/g, 'ú')
            .replace(/Ã±/g, 'ñ')
            .replace(/Ã /g, 'à')
            .replace(/Ãˆ/g, 'è')
            .replace(/Ã¼/g, 'ü');
          
          const lineas = texto.split('\n').filter(linea => linea.trim());
          
          // Asumir que la primera línea contiene los headers
          const headers = lineas[0].split(',').map(h => h.trim().replace(/"/g, ''));
          console.log('📊 Headers detectados:', headers);
          
          // Función para normalizar WhatsApp (igual que el sistema)
          const normalizarWhatsApp = (wha: string): string => {
            if (!wha) return '';
            const soloNumeros = wha.replace(/\D/g, '');
            return soloNumeros.slice(-7); // Últimos 7 dígitos
          };
          
          const vips: any[] = [];
          const duplicados: any[] = [];
          const whatsappsVistos = new Map<string, { primeraAparicion: number; vip: any }>(); // Map<ultimos7digitos, {linea, vip}>
          
          for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (valores.length >= headers.length) {
              const vip: any = {};
              headers.forEach((header, index) => {
                const headerLower = header.toLowerCase().trim();
                const valor = valores[index]?.trim() || '';
                
                // Mapear headers exactos del CSV que me mostraste
                if (headerLower === 'id') {
                  vip.ID_CSV = valor;
                } else if (headerLower === 'nombre') {
                  vip.NOMBRE = valor;
                } else if (headerLower === 'correo') {
                  vip.CORREO = valor;
                } else if (headerLower === 'whatsapp') {
                  vip.WHATSAPP = valor;
                } else {
                  // Fallback para otros formatos posibles
                  if (headerLower.includes('nombre')) vip.NOMBRE = valor;
                  else if (headerLower.includes('correo') || headerLower.includes('email')) vip.CORREO = valor;
                  else if (headerLower.includes('whatsapp') || headerLower.includes('telefono') || headerLower.includes('phone')) vip.WHATSAPP = valor;
                  else vip[header] = valor;
                }
              });
              
              if (vip.WHATSAPP) {
                const whaNormalizado = normalizarWhatsApp(vip.WHATSAPP);
                
                // Verificar duplicados dentro del CSV
                if (whaNormalizado && whatsappsVistos.has(whaNormalizado)) {
                  // Es un duplicado
                  const primeraAparicion = whatsappsVistos.get(whaNormalizado)!;
                  duplicados.push({
                    whatsapp: vip.WHATSAPP,
                    whatsappNormalizado: whaNormalizado,
                    nombre: vip.NOMBRE || 'Sin nombre',
                    correo: vip.CORREO || '',
                    lineaActual: i + 1, // +1 porque empezamos desde línea 2 (después del header)
                    primeraAparicion: primeraAparicion.primeraAparicion,
                    vipPrimeraAparicion: primeraAparicion.vip
                  });
                  console.log(`⚠️ Duplicado detectado en línea ${i + 1}: ${vip.WHATSAPP} (ya aparece en línea ${primeraAparicion.primeraAparicion})`);
                } else {
                  // Es único, agregarlo
                  vip.LINEA_CSV = i + 1; // Guardar número de línea original
                  vips.push(vip);
                  if (whaNormalizado) {
                    whatsappsVistos.set(whaNormalizado, {
                      primeraAparicion: i + 1,
                      vip: vip
                    });
                  }
                }
              }
            }
          }
          
          console.log(`✅ ${vips.length} VIPs únicos extraídos del CSV`);
          if (duplicados.length > 0) {
            console.log(`⚠️ ${duplicados.length} duplicados detectados dentro del CSV`);
          }
          
          resolve({ 
            vips, 
            duplicados, 
            totalLineas: lineas.length - 1 // -1 porque no contamos el header
          });
        } catch (error) {
          console.error('❌ Error procesando CSV:', error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(archivo);
    });
  };

  const manejarProcesarCSV = async () => {
    if (!archivoCsv) {
      alert('Por favor selecciona un archivo CSV');
      return;
    }

    setProcesandoCsv(true);
    setResultadoProceso(null);

    try {
      console.log('🔄 Iniciando procesamiento de CSV...');
      
      // 1. Extraer datos del CSV (ahora incluye detección de duplicados)
      const resultadoCSV = await procesarArchivoCSV(archivoCsv);
      const vipsDelCsv = resultadoCSV.vips;
      const duplicadosEnCSV = resultadoCSV.duplicados;
      
      console.log(`📋 ${vipsDelCsv.length} VIPs únicos extraídos del CSV (de ${resultadoCSV.totalLineas} líneas totales)`);
      
      // Mostrar advertencia si hay duplicados
      if (duplicadosEnCSV.length > 0) {
        const mensajeDuplicados = `⚠️ Se detectaron ${duplicadosEnCSV.length} duplicado(s) dentro del CSV.\n\n` +
          `Los duplicados fueron excluidos del procesamiento.\n` +
          `Solo se procesarán los ${vipsDelCsv.length} VIPs únicos.\n\n` +
          `Duplicados encontrados:\n` +
          duplicadosEnCSV.slice(0, 5).map(d => 
            `  • Línea ${d.lineaActual}: ${d.nombre} (${d.whatsapp}) - ya aparece en línea ${d.primeraAparicion}`
          ).join('\n') +
          (duplicadosEnCSV.length > 5 ? `\n  ... y ${duplicadosEnCSV.length - 5} más` : '');
        
        alert(mensajeDuplicados);
        console.warn('⚠️ Duplicados en CSV:', duplicadosEnCSV);
      }
      
      // 2. Asignar posición y nivel de conciencia basado en porcentajes
      const totalVips = vipsDelCsv.length;
      vipsDelCsv.forEach((vip, index) => {
        const posicion = index + 1; // Posición 1-based
        vip.POSICION_CSV = posicion;
        
        // Calcular porcentaje de posición
        const porcentajePosicion = (posicion / totalVips) * 100;
        
        // Primeros 35% = Alta conciencia (registrados durante clase)
        if (porcentajePosicion <= 35) {
          vip.NIVEL_CONCIENCIA = 'alta';
          vip.ORIGEN_REGISTRO = 'segunda_clase';
        }
        // Siguientes 35% = Media conciencia (activos en grupo)
        else if (porcentajePosicion <= 70) {
          vip.NIVEL_CONCIENCIA = 'media';
          vip.ORIGEN_REGISTRO = 'grupo_whatsapp_activo';
        }
        // Resto 30% = Baja conciencia (pasivos en grupo)
        else {
          vip.NIVEL_CONCIENCIA = 'baja';
          vip.ORIGEN_REGISTRO = 'grupo_whatsapp';
        }
      });

      // 3. Procesar VIPs en lotes (comparar con clientes existentes)
      console.log(`🔄 Procesando ${vipsDelCsv.length} VIPs únicos en lotes de 100...`);
      
      const tamanioLote = 100;
      const resultadoFinal = {
        yaEnSistema: [] as any[],
        nuevosVIPs: [] as any[],
        errores: [] as string[],
        duplicadosEnCSV: duplicadosEnCSV, // Incluir duplicados detectados en el CSV
        totalLineasCSV: resultadoCSV.totalLineas,
        vipsUnicosProcesados: vipsDelCsv.length
      };

      for (let i = 0; i < vipsDelCsv.length; i += tamanioLote) {
        const lote = vipsDelCsv.slice(i, i + tamanioLote);
        console.log(`📦 Procesando lote ${Math.floor(i/tamanioLote) + 1}/${Math.ceil(vipsDelCsv.length/tamanioLote)} (${lote.length} VIPs)`);
        
        const response = await fetch('/api/vips/procesar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ vips: lote })
        });

        if (!response.ok) {
          throw new Error(`Error procesando lote ${Math.floor(i/tamanioLote) + 1}`);
        }

        const resultadoLote = await response.json();
        
        // Combinar resultados
        resultadoFinal.yaEnSistema.push(...resultadoLote.data.yaEnSistema);
        resultadoFinal.nuevosVIPs.push(...resultadoLote.data.nuevosVIPs);
        resultadoFinal.errores.push(...resultadoLote.data.errores);
        
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Resultado del procesamiento completo:', resultadoFinal);
      setResultadoProceso(resultadoFinal);

    } catch (error) {
      console.error('❌ Error procesando CSV:', error);
      alert('Error procesando el archivo CSV');
    } finally {
      setProcesandoCsv(false);
    }
  };

  const guardarVIPsNuevos = async () => {
    if (!resultadoProceso?.nuevosVIPs?.length) {
      alert('No hay VIPs nuevos para guardar');
      return;
    }

    try {
      console.log(`🔄 Guardando ${resultadoProceso.nuevosVIPs.length} VIPs nuevos...`);
      
      const BATCH_SIZE = 100;
      const vips = resultadoProceso.nuevosVIPs;
      const totalLotes = Math.ceil(vips.length / BATCH_SIZE);
      let totalInsertados = 0;

      for (let i = 0; i < totalLotes; i++) {
        const inicio = i * BATCH_SIZE;
        const fin = Math.min(inicio + BATCH_SIZE, vips.length);
        const lote = vips.slice(inicio, fin);
        
        console.log(`📦 Guardando lote ${i + 1}/${totalLotes} (${lote.length} VIPs)`);

        const response = await fetch('/api/vips/guardar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ vips: lote })
        });

        if (!response.ok) {
          throw new Error(`Error guardando lote ${i + 1}: ${response.status} ${response.statusText}`);
        }

        const resultado = await response.json();
        totalInsertados += resultado.data.insertados || lote.length;
        console.log(`✅ Lote ${i + 1} guardado: ${resultado.data.insertados || lote.length} VIPs`);
      }

      console.log(`✅ Todos los VIPs guardados: ${totalInsertados} total`);
      alert(`${totalInsertados} VIPs guardados exitosamente`);
      
      // Limpiar el resultado y archivo
      setResultadoProceso(null);
      setArchivoCsv(null);
      
      // Cargar VIPs pendientes si estamos en esa vista
      if (vistaVIP === 'pendientes') {
        cargarVIPsPendientes();
      }

    } catch (error) {
      console.error('❌ Error guardando VIPs:', error);
      alert('Error guardando los VIPs');
    }
  };

  const cargarVIPsPendientes = async () => {
    setCargandoVips(true);
    try {
      const response = await fetch('/api/vips/pendientes');
      if (response.ok) {
        const resultado = await response.json();
        setVipsPendientes(resultado.data);
        console.log(`✅ ${resultado.data.length} VIPs pendientes cargados`);
      } else {
        throw new Error('Error cargando VIPs pendientes');
      }
    } catch (error) {
      console.error('❌ Error cargando VIPs pendientes:', error);
      alert('Error cargando VIPs pendientes');
    } finally {
      setCargandoVips(false);
    }
  };

  const asignarVIP = async (vipId: number, asesorId: number) => {
    try {
      const response = await fetch(`/api/vips/${vipId}/asignar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ asesorId })
      });

      if (!response.ok) {
        throw new Error('Error asignando VIP');
      }

      alert('VIP asignado exitosamente');
      cargarVIPsPendientes(); // Recargar la lista
      
    } catch (error) {
      console.error('❌ Error asignando VIP:', error);
      alert('Error asignando VIP');
    }
  };

  const cambiarEstadoVIP = async (vipId: number, nuevoEstado: string, notas?: string) => {
    try {
      const response = await fetch(`/api/vips/${vipId}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado: nuevoEstado, notas })
      });

      if (!response.ok) {
        throw new Error('Error actualizando estado VIP');
      }

      alert('Estado actualizado exitosamente');
      cargarVIPsPendientes(); // Recargar la lista
      
    } catch (error) {
      console.error('❌ Error actualizando estado VIP:', error);
      alert('Error actualizando estado VIP');
    }
  };

  const asignarVIPsMasivo = async () => {
    setProcesandoAsignacion(true);
    try {
      // Calcular total de VIPs a asignar
      const totalVips = Object.values(asignacionMasiva).reduce((sum, cantidad) => sum + cantidad, 0);
      
      if (totalVips === 0) {
        alert('No hay asignaciones para procesar');
        return;
      }
      
      if (totalVips > vipsPendientes.length) {
        alert(`No hay suficientes VIPs pendientes. Disponibles: ${vipsPendientes.length}, Solicitados: ${totalVips}`);
        return;
      }
      
      console.log(`🔄 Procesando asignación masiva de ${totalVips} VIPs`);
      
      const response = await fetch('/api/vips/asignar-masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          asignaciones: asignacionMasiva,
          prioridad: 'posicion_csv' // Asignar por orden de prioridad (posición en CSV)
        })
      });

      if (!response.ok) {
        throw new Error('Error en asignación masiva');
      }

      const resultado = await response.json();
      console.log('✅ Asignación masiva completada:', resultado);
      
      alert(`${resultado.data.asignados} VIPs asignados exitosamente`);
      
      // Limpiar formulario y recargar
      setAsignacionMasiva({});
      cargarVIPsPendientes();
      
    } catch (error) {
      console.error('❌ Error en asignación masiva:', error);
      alert('Error procesando la asignación masiva');
    } finally {
      setProcesandoAsignacion(false);
    }
  };

  const cargarVIPsEnSistema = async () => {
    setCargandoVipsEnSistema(true);
    try {
      // Obtener VIPs que ya están registrados como clientes
      // Necesitamos cruzar los datos de VIPs con la tabla de clientes
      const response = await fetch('/api/vips/en-sistema');
      if (response.ok) {
        const resultado = await response.json();
        setVipsEnSistema(resultado.data);
        console.log(`✅ ${resultado.data.length} VIPs en sistema cargados`);
      } else {
        throw new Error('Error cargando VIPs en sistema');
      }
    } catch (error) {
      console.error('❌ Error cargando VIPs en sistema:', error);
      alert('Error cargando VIPs en sistema');
    } finally {
      setCargandoVipsEnSistema(false);
    }
  };

  const cargarVIPsPipelinePorAsesor = async () => {
    setCargandoPipeline(true);
    try {
      const response = await fetch('/api/vips/pipeline-por-asesor');
      if (response.ok) {
        const resultado = await response.json();
        setVipsPipelinePorAsesor(resultado.data);
        console.log(`✅ ${resultado.data.length} asesores con VIPs en pipeline cargados`);
      } else {
        throw new Error('Error cargando VIPs en pipeline por asesor');
      }
    } catch (error) {
      console.error('❌ Error cargando VIPs en pipeline por asesor:', error);
      alert('Error cargando VIPs en pipeline por asesor');
    } finally {
      setCargandoPipeline(false);
    }
  };

  const cargarVIPsTablaData = async () => {
    setCargandoTablaVips(true);
    try {
      const response = await fetch('/api/vips/table-data');
      if (response.ok) {
        const resultado = await response.json();
        setVipsTablaData(resultado.data);
        console.log(`✅ Datos de tabla VIP cargados para ${resultado.data.length} asesores`);
      } else {
        throw new Error('Error cargando datos de tabla VIP');
      }
    } catch (error) {
      console.error('❌ Error cargando datos de tabla VIP:', error);
      alert('Error cargando datos de tabla VIP');
    } finally {
      setCargandoTablaVips(false);
    }
  };

  // Función para manejar el ordenamiento de la tabla VIP
  const handleVipSort = (column: string) => {
    if (sortVipsBy === column) {
      setSortVipsOrder(sortVipsOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortVipsBy(column);
      setSortVipsOrder('asc');
    }
  };

  // Función para ordenar los datos de la tabla VIP
  const sortedVipsTablaData = useMemo(() => {
    if (!vipsTablaData.length) return [];

    return [...vipsTablaData].sort((a, b) => {
      let aValue, bValue;

      switch (sortVipsBy) {
        case 'asesor':
          aValue = a.asesor.NOMBRE.toLowerCase();
          bValue = b.asesor.NOMBRE.toLowerCase();
          break;
        case 'totalVIPs':
          aValue = a.metricas.totalVIPs;
          bValue = b.metricas.totalVIPs;
          break;
        case 'contactados':
          aValue = a.metricas.contactados;
          bValue = b.metricas.contactados;
          break;
        case 'enProceso':
          aValue = (a.metricas.enSeguimiento || 0) + (a.metricas.interesados || 0);
          bValue = (b.metricas.enSeguimiento || 0) + (b.metricas.interesados || 0);
          break;
        case 'ventas':
          aValue = (a.metricas.pagados || 0) + (a.metricas.consolidadas || 0);
          bValue = (b.metricas.pagados || 0) + (b.metricas.consolidadas || 0);
          break;
        case 'noInteresados':
          aValue = a.metricas.noInteresados || 0;
          bValue = b.metricas.noInteresados || 0;
          break;
        case 'noContactar':
          aValue = a.metricas.noContactar || 0;
          bValue = b.metricas.noContactar || 0;
          break;
        case 'porcentajeContactado':
          aValue = a.metricas.porcentajeContactado;
          bValue = b.metricas.porcentajeContactado;
          break;
        case 'porcentajeReportado':
          aValue = a.metricas.porcentajeReportado;
          bValue = b.metricas.porcentajeReportado;
          break;
        case 'porcentajeConversion':
          aValue = a.metricas.porcentajeConversion;
          bValue = b.metricas.porcentajeConversion;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return sortVipsOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortVipsOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [vipsTablaData, sortVipsBy, sortVipsOrder]);

  // Componente para header clicable con sorting
  const SortableHeader = ({ column, children, className = "" }: { 
    column: string; 
    children: React.ReactNode; 
    className?: string;
  }) => {
    const getSortIcon = () => {
      if (sortVipsBy !== column) {
        return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
      }
      return sortVipsOrder === 'asc' 
        ? <ArrowUp className="h-4 w-4 text-blue-600" />
        : <ArrowDown className="h-4 w-4 text-blue-600" />;
    };

    return (
      <th 
        className={`text-center px-3 py-3 border-b font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
        onClick={() => handleVipSort(column)}
      >
        <div className="flex items-center justify-center gap-1">
          {children}
          {getSortIcon()}
        </div>
      </th>
    );
  };

  // Cargar VIPs según la subvista activa
  useEffect(() => {
    if (vistaAdmin === 'vips') {
      if (vistaVIP === 'pendientes') {
        cargarVIPsPendientes();
      } else if (vistaVIP === 'en-sistema') {
        cargarVIPsEnSistema();
      }
    }
  }, [vistaAdmin, vistaVIP]);

  // 🆕 Funciones para Chat Global
  const cargarConversacionesChat = async (asesorId: number, silencioso: boolean = false) => {
    if (!silencioso) {
      console.log("🔄 Cargando conversaciones para asesor:", asesorId);
      setCargandoConversacionesChat(true);
    }
    
    try {
      const response = await fetch(`/api/conversaciones/${asesorId}`);
      if (response.ok) {
        const result = await response.json();
        if (!silencioso) {
          console.log("📡 Respuesta del backend:", result);
        }
        
        // El backend devuelve { success: true, data: conversaciones, timestamp: ... }
        const conversaciones = result.data || result;
        
        if (Array.isArray(conversaciones)) {
          setConversacionesChat(conversaciones);
          if (!silencioso) {
            console.log("✅ Conversaciones cargadas:", conversaciones.length);
          }
          
          // Seleccionar automáticamente la primera conversación si existe (solo en carga inicial)
          if (conversaciones.length > 0 && !conversacionActivaChat && !silencioso) {
            setConversacionActivaChat(conversaciones[0]);
          }
        } else {
          if (!silencioso) {
            console.error("❌ Formato de respuesta inválido:", conversaciones);
          }
          setConversacionesChat([]);
        }
      } else {
        if (!silencioso) {
          console.error("❌ Error en la respuesta:", response.status);
        }
        setConversacionesChat([]);
      }
    } catch (error) {
      if (!silencioso) {
        console.error("❌ Error cargando conversaciones:", error);
      }
      setConversacionesChat([]);
    } finally {
      if (!silencioso) {
        setCargandoConversacionesChat(false);
      }
    }
  };

  const cargarMensajesChat = async (asesorId: number, clienteKey: string, silencioso: boolean = false) => {
    if (!silencioso) {
      console.log("🔄 Cargando mensajes para:", clienteKey);
      setCargandoMensajesChat(true);
    }
    
    try {
      const response = await fetch(`/api/mensajes/${asesorId}/${encodeURIComponent(clienteKey)}`);
      if (response.ok) {
        const result = await response.json();
        if (!silencioso) {
          console.log("📡 Respuesta de mensajes del backend:", result);
        }
        
        // El backend devuelve { success: true, data: mensajes, timestamp: ... }
        const mensajes = result.data || result;
        
        if (Array.isArray(mensajes)) {
          setMensajesChat(mensajes);
          if (!silencioso) {
            console.log("✅ Mensajes cargados:", mensajes.length);
          }
        } else {
          if (!silencioso) {
            console.error("❌ Formato de respuesta de mensajes inválido:", mensajes);
          }
          setMensajesChat([]);
        }
      } else {
        if (!silencioso) {
          console.error("❌ Error cargando mensajes:", response.status);
        }
        setMensajesChat([]);
      }
    } catch (error) {
      if (!silencioso) {
        console.error("❌ Error cargando mensajes:", error);
      }
      setMensajesChat([]);
    } finally {
      if (!silencioso) {
        setCargandoMensajesChat(false);
      }
    }
  };

  const seleccionarAsesorChat = (asesor: Asesor) => {
    setAsesorSeleccionadoChat(asesor);
    setConversacionActivaChat(null);
    setMensajesChat([]);
    cargarConversacionesChat(asesor.ID);
  };

  // Intervalo para actualizar conversaciones cada 2 segundos
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (asesorSeleccionadoChat && vistaAdmin === 'chat-global') {
      interval = setInterval(() => {
        cargarConversacionesChat(asesorSeleccionadoChat.ID, true);
      }, 2000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [asesorSeleccionadoChat, vistaAdmin]);

  const seleccionarConversacionChat = (conversacion: any) => {
    setConversacionActivaChat(conversacion);
    if (asesorSeleccionadoChat) {
      const clienteKey = conversacion.id_cliente || conversacion.wha_cliente;
      cargarMensajesChat(asesorSeleccionadoChat.ID, clienteKey);
    }
  };

  // Intervalo para actualizar mensajes de la conversación activa cada 3 segundos
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (asesorSeleccionadoChat && conversacionActivaChat && vistaAdmin === 'chat-global') {
      interval = setInterval(() => {
        const clienteKey = conversacionActivaChat.id_cliente || conversacionActivaChat.wha_cliente;
        cargarMensajesChat(asesorSeleccionadoChat.ID, clienteKey, true);
      }, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [asesorSeleccionadoChat, conversacionActivaChat, vistaAdmin]);

  const handleAsesorNameClick = async (asesor: Asesor) => {
    setVipModalAsesor(asesor);
    setLoadingVipClientes(true);

    try {
        // Usar el nuevo endpoint que combina VIPs pendientes con clientes existentes
        const response = await fetch(`/api/vips/asesor/${asesor.ID}/todos`);
        
        if (response.ok) {
            const result = await response.json();
            const vips = result.data || [];
            
            if (vips.length > 0) {
                const priority: { [key: string]: number } = {
                    'venta-consolidada': 0,
                    'pagado': 1,
                    'interesado': 2,
                    'en-seguimiento': 3,
                    'contactado': 4,
                    'listado-vip': 5,
                    'no-interesado': 6,
                    'no-contactar': 7,
                };

                const sortedVips = [...vips].sort((a, b) => {
                    const priorityA = priority[a.estadoPipeline as keyof typeof priority] ?? 99;
                    const priorityB = priority[b.estadoPipeline as keyof typeof priority] ?? 99;
                    return priorityA - priorityB;
                });

                setVipClientes(sortedVips);
                console.log(`✅ ${sortedVips.length} clientes VIP cargados para ${asesor.NOMBRE}`);
            } else {
                console.log(`No hay clientes VIP asignados a ${asesor.NOMBRE}`);
                setVipClientes([]);
            }
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error fetching VIP clients for advisor", error);
        setVipClientes([]);
    } finally {
        setLoadingVipClientes(false);
    }
  };

  const VipClientsModal = ({ asesor, clients, isLoading, onClose }: { asesor: Asesor | null, clients: any[], isLoading: boolean, onClose: () => void }) => {
    if (!asesor) return null;

    const getStatusPill = (client: any) => {
        const status = client.estadoPipeline;
        switch (status) {
            case 'venta-consolidada':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">Consolidado</span>;
            case 'pagado':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Pagado</span>;
            case 'interesado':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Interesado</span>;
            case 'en-seguimiento':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">En Seguimiento</span>;
            case 'contactado':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Contactado</span>;
            case 'listado-vip':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Sin Contacto</span>;
            case 'no-interesado':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">No Interesado</span>;
            case 'no-contactar':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-200 text-red-900">No Contactar</span>;
            default:
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Clientes VIP de {asesor.NOMBRE}</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {!isLoading && clients.length > 0 ? `${clients.length} clientes VIP asignados` : 'Cargando clientes VIP...'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="overflow-y-auto mt-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <p className="text-gray-500">Cargando clientes VIP...</p>
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="flex justify-center items-center h-48">
                            <p className="text-gray-500">No se encontraron clientes VIP para este asesor.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Resumen de estadísticas */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-600">{clients.length}</div>
                                        <div className="text-sm text-gray-600">Total VIPs</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-purple-600">
                                            {clients.filter(c => c.estadoPipeline === 'contactado').length}
                                        </div>
                                        <div className="text-sm text-gray-600">Contactados</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-600">
                                            {clients.filter(c => c.estadoPipeline === 'pagado' || c.estadoPipeline === 'venta-consolidada').length}
                                        </div>
                                        <div className="text-sm text-gray-600">Ventas</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-600">
                                            {clients.filter(c => c.estadoPipeline === 'listado-vip').length}
                                        </div>
                                        <div className="text-sm text-gray-600">Sin Contacto</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Lista de clientes */}
                            <ul className="divide-y divide-gray-200">
                                {clients.map(client => (
                                    <li key={client.ID} className="py-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <p className="font-semibold text-gray-900">{client.NOMBRE}</p>
                                                    {getStatusPill(client)}
                                                </div>
                                                <div className="mt-2 space-y-1">
                                                    {client.WHATSAPP && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-green-500">📱</span>
                                                            {client.WHATSAPP}
                                                        </p>
                                                    )}
                                                    {client.EMAIL && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-blue-500">✉️</span>
                                                            {client.EMAIL}
                                                        </p>
                                                    )}
                                                    {client.FUENTE && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-orange-500">🌐</span>
                                                            {client.FUENTE}
                                                        </p>
                                                    )}
                                                    {/* Indicador de tipo de cliente */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                            client.tipo === 'vip-pendiente' 
                                                                ? 'bg-yellow-100 text-yellow-800' 
                                                                : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {client.tipo === 'vip-pendiente' ? '🆕 VIP Pendiente' : '✅ Cliente Existente'}
                                                        </span>
                                                        {client.fechaCreacion && (
                                                            <span className="text-xs text-gray-500">
                                                                Creado: {new Date(client.fechaCreacion).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {client.montoCompra && client.montoCompra > 0 && (
                                                            <span className="text-xs text-green-600 font-medium">
                                                                💰 ${client.montoCompra.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  // Helper: asesores en paralelo (retorna array siempre)
  const fetchAsesores = async (): Promise<any[]> => {
    try {
      const raw = await apiClient.request<any[]>('/GERSSON_ASESORES?select=*&order=NOMBRE');
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.error("❌ Error cargando asesores:", err);
      return [];
    }
  };

  const cargarDatos = async () => {
    const inicioTiempo = performance.now();
    const thisLoadId = ++loadIdRef.current;
    setCargandoDatos(true);
    
    try {
      console.log("🚀 Cargando datos desde PostgREST (optimizado: asesores + 4 en paralelo, conversaciones select mínimo)...");
      
      // 🚀 OPTIMIZACIÓN: Iniciar asesores + datos principales en paralelo, con reintentos ante fallos
      const retryOpt = { maxAttempts: 3, delayMs: 1500, exponentialBackoff: true };
      const pAsesores = withRetry(() => fetchAsesores(), retryOpt);
      const pClientes = withRetry(() => fetchAllPages('/GERSSON_CLIENTES', 'select=*'), retryOpt);
      const pReportes = withRetry(() => fetchAllPages('/GERSSON_REPORTES', 'select=*'), retryOpt);
      const pRegistros = withRetry(() => fetchAllPages('/GERSSON_REGISTROS', 'select=*'), retryOpt);
      const pConversaciones = withRetry(() => fetchAllPagesUltraFast('/conversaciones', 'select=id_asesor,id_cliente,timestamp,modo'), { ...retryOpt, maxAttempts: 2 });

      // Fase 1: No esperar conversaciones — pintar UI en cuanto tengamos asesores, clientes, reportes y registros
      const [asesoresSettled, clientesSettled, reportesSettled, registrosSettled] = await Promise.allSettled([
        pAsesores,
        pClientes,
        pReportes,
        pRegistros,
      ]);

      const asesoresData = asesoresSettled.status === 'fulfilled' ? asesoresSettled.value : [];
      const clientesData = clientesSettled.status === 'fulfilled' ? clientesSettled.value : [];
      const reportesData = reportesSettled.status === 'fulfilled' ? reportesSettled.value : [];
      const registrosData = registrosSettled.status === 'fulfilled' ? registrosSettled.value : [];

      if (asesoresSettled.status === 'rejected') console.error("❌ Error cargando asesores:", asesoresSettled.reason);
      if (clientesSettled.status === 'rejected') console.error("❌ Error cargando clientes:", clientesSettled.reason);
      if (reportesSettled.status === 'rejected') console.error("❌ Error cargando reportes/ventas:", reportesSettled.reason);
      if (registrosSettled.status === 'rejected') console.error("❌ Error cargando registros:", registrosSettled.reason);

      setAsesores(asesoresData);
      setClientes(clientesData);
      setReportes(reportesData);
      setRegistros(registrosData);
      setConversaciones([]); // Se rellenará cuando lleguen conversaciones

      // Verificaciones de conexión en background (no bloquean)
      if (asesoresData.length > 0) {
        setCargandoConexiones(true);
        verificarEstadosConexion(asesoresData)
          .catch(error => console.warn("⚠️ Error en verificaciones de conexión (no crítico):", error))
          .finally(() => setCargandoConexiones(false));
      }

      // Estadísticas iniciales sin conversaciones (UI usable de inmediato)
      const aplicarEstadisticas = (conversacionesData: any[]) => {
        const nuevasEstadisticas: Record<number, EstadisticasDetalladas> = {};
        (asesoresData || []).forEach((asesor: any) => {
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
      };
      aplicarEstadisticas([]);

      const tiempoFase1 = Math.round(performance.now() - inicioTiempo);
      setTiempoCarga(tiempoFase1);
      setLastUpdated(new Date());
      setCargandoDatos(false);
      console.log(`✅ Fase 1 listo en ${tiempoFase1}ms (asesores: ${asesoresData.length}, clientes: ${clientesData.length}, reportes: ${reportesData.length}). Conversaciones en background...`);

      // Fase 2: Cuando lleguen conversaciones, actualizar estado y recalcular estadísticas (solo si sigue siendo la carga actual)
      pConversaciones
        .then((conversacionesData) => {
          if (loadIdRef.current !== thisLoadId) return; // Nueva carga en curso, ignorar
          setConversaciones(conversacionesData);
          aplicarEstadisticas(conversacionesData);
          const tiempoTotal = Math.round(performance.now() - inicioTiempo);
          setTiempoCarga(tiempoTotal);
          setLastUpdated(new Date());
          console.log(`✅ Conversaciones cargadas (${conversacionesData.length}). Dashboard completo en ${tiempoTotal}ms.`);
        })
        .catch((err) => {
          if (loadIdRef.current !== thisLoadId) return;
          console.error("❌ Error cargando conversaciones:", err);
        });
      
    } catch (error) {
      console.error("❌ Error al cargar datos:", error);
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

    // Solo cuentan como "con reporte" los reportes completos (no los solo "Esperando respuesta")
    const reportesCompletosAsesor = reportesAsesor.filter((r: any) => esReporteCompleto(r));
    const clientesReportados = new Set(reportesCompletosAsesor.map((r: any) => r.ID_CLIENTE)).size;
    const clientesSinReporteList = clientesAsesor.filter(
      (c: any) => !reportesAsesor.some((r: any) => r.ID_CLIENTE === c.ID && esReporteCompleto(r))
    );
    const clientesSinReporte = clientesSinReporteList.length;
    
    // Separar clientes sin reporte entre VIP y no VIP
    const esClienteVIP = (cliente: any): boolean => {
      return cliente.ESTADO === 'LISTA-VIP' || cliente.ESTADO === 'VIP';
    };
    const clientesSinReporteVIP = clientesSinReporteList.filter((c: any) => esClienteVIP(c)).length;
    const clientesSinReporteNoVIP = clientesSinReporte - clientesSinReporteVIP;
    
    // Separar total de clientes entre VIP y no VIP
    const totalClientesVIP = clientesAsesor.filter((c: any) => esClienteVIP(c)).length;
    const totalClientesNoVIP = clientesAsesor.length - totalClientesVIP;
    
    // Calcular ventas por VIP y no VIP
    const clientesVIPIds = new Set(clientesAsesor.filter((c: any) => esClienteVIP(c)).map((c: any) => c.ID));
    const ventasVIP = reportesFiltrados.filter((r: any) => 
      (r.ESTADO_NUEVO === 'PAGADO') && clientesVIPIds.has(r.ID_CLIENTE)
    ).reduce((acc: Record<number, boolean>, r: any) => {
      acc[r.ID_CLIENTE] = true;
      return acc;
    }, {});
    const ventasVIPCount = Object.keys(ventasVIP).length;
    
    const ventasNoVIP = reportesFiltrados.filter((r: any) => 
      (r.ESTADO_NUEVO === 'PAGADO') && !clientesVIPIds.has(r.ID_CLIENTE)
    ).reduce((acc: Record<number, boolean>, r: any) => {
      acc[r.ID_CLIENTE] = true;
      return acc;
    }, {});
    const ventasNoVIPCount = Object.keys(ventasNoVIP).length;
    
    // Calcular porcentaje de cierre separado
    const porcentajeCierreVIP = totalClientesVIP > 0 ? (ventasVIPCount / totalClientesVIP) * 100 : 0;
    const porcentajeCierreNoVIP = totalClientesNoVIP > 0 ? (ventasNoVIPCount / totalClientesNoVIP) * 100 : 0;

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
      clientesSinReporteVIP,
      clientesSinReporteNoVIP,
      totalClientesVIP,
      totalClientesNoVIP,
      porcentajeCierreVIP,
      porcentajeCierreNoVIP,
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
        const desconectadosA = (estadoA?.whatsapp === 'desconectado' ? 1 : 0) + (estadoA?.telegram ? 0 : 1);
        const desconectadosB = (estadoB?.whatsapp === 'desconectado' ? 1 : 0) + (estadoB?.telegram ? 0 : 1);
        resultado = desconectadosB - desconectadosA;
        break;
      }
      case 'whatsapp_desconectado': {
        const estadoA = conexionesEstado[a.ID];
        const estadoB = conexionesEstado[b.ID];
        const desconectadoA = estadoA?.whatsapp === 'desconectado' ? 1 : 0;
        const desconectadoB = estadoB?.whatsapp === 'desconectado' ? 1 : 0;
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
      case 'ESPERANDO RESPUESTA':
        return 'bg-sky-100 text-sky-800 border border-sky-300';
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
      case 'VIP':
        return 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500';
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

  // Función para manejar duplicados
  const handleBuscarDuplicados = (cliente: any) => {
    setModalDuplicados({
      isOpen: true,
      clienteId: cliente.ID,
      clienteName: cliente.NOMBRE
    });
  };

  const handleDuplicadosFusionados = () => {
    // Recargar datos después de fusionar duplicados
    cargarDatos();
    setModalDuplicados({ isOpen: false, clienteId: 0, clienteName: '' });
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
  // const getColorTiempo = (minutos: number | null, limite: number = 60) => {
  //   if (minutos === null) return 'text-gray-400';
  //   if (minutos <= limite) return 'text-green-600';
  //   if (minutos <= limite * 2) return 'text-yellow-600';
  //   return 'text-red-600';
  // };

  // Si estamos en modo asesor, renderizar el DashboardAsesor con banner
  if (modoAsesor && (asesorModoActivo || asesor)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Banner para volver al modo admin */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-white" />
                <span className="text-white font-medium">Modo Asesor Activado</span>
                <span className="text-purple-200 text-sm">• Viendo como: {asesorModoActivo?.NOMBRE || asesor.NOMBRE}</span>
              </div>
              <button
                onClick={() => setModoAsesor(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all duration-200"
              >
                <Shield className="h-4 w-4" />
                <span className="font-medium">Volver a Admin</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Renderizar DashboardAsesor */}
        <DashboardAsesor 
          asesorInicial={asesorModoActivo || asesor} 
          onLogout={() => {
            setModoAsesor(false);
            setAsesorModoActivo(null);
          }} 
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex relative">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-64 h-screen bg-white shadow-xl border-r border-gray-200 flex flex-col z-10">
        {/* Logo y Título del Sidebar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Panel <span className="text-purple-600">Admin</span>
              </h1>
              <p className="text-xs text-gray-500">Control del sistema</p>
            </div>
          </div>
        </div>

        {/* Navegación del Sidebar */}
        <div className="flex-1 px-4 py-6">
          <nav className="space-y-2">
            <button
              onClick={() => setVistaAdmin('resumen')}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                ${vistaAdmin === 'resumen'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <PieChart className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Resumen</div>
                <div className="text-xs opacity-75">Dashboard principal</div>
              </div>
            </button>
            
            <button
              onClick={() => setVistaAdmin('asesores')}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative
                ${vistaAdmin === 'asesores'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <UserCheck className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-semibold">Asesores</div>
                <div className="text-xs opacity-75">Gestión del equipo</div>
              </div>
              <span className="bg-white bg-opacity-20 text-xs font-bold px-2 py-1 rounded-full">
                {asesores.length}
              </span>
            </button>
            
            <button
              onClick={() => setVistaAdmin('clientes')}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative
                ${vistaAdmin === 'clientes'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <Users className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-semibold">Clientes</div>
                <div className="text-xs opacity-75">Base de datos</div>
              </div>
              <span className="bg-white bg-opacity-20 text-xs font-bold px-2 py-1 rounded-full">
                {clientes.length}
              </span>
            </button>
            
            {/* Gestión - Solo para admins completos */}
            {adminRole === 'admin' && (
              <button
                onClick={() => setVistaAdmin('gestion')}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                  ${vistaAdmin === 'gestion'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <Settings className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Gestión</div>
                  <div className="text-xs opacity-75">Asignaciones</div>
                </div>
              </button>
            )}

            {/* Webhooks - Solo para admins completos */}
            {adminRole === 'admin' && (
              <button
                onClick={() => setVistaAdmin('webhooks')}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                  ${vistaAdmin === 'webhooks'
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <Webhook className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Webhooks</div>
                  <div className="text-xs opacity-75">Configuración</div>
                </div>
              </button>
            )}

            {/* Listado VIP - Solo para admins completos */}
            {adminRole === 'admin' && (
              <button
                onClick={() => setVistaAdmin('vips')}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative
                  ${vistaAdmin === 'vips'
                    ? 'bg-yellow-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <Crown className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <div className="font-semibold">Listado VIP</div>
                  <div className="text-xs opacity-75">Importar y gestionar</div>
                </div>
                <span className="bg-white bg-opacity-20 text-xs font-bold px-2 py-1 rounded-full">
                  {vipsPendientes.length}
                </span>
              </button>
            )}

            {/* Chat Global */}
            <button
              onClick={() => setVistaAdmin('chat-global')}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                ${vistaAdmin === 'chat-global'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <MessageSquare className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Chat Global</div>
                <div className="text-xs opacity-75">Supervisión</div>
              </div>
            </button>
          </nav>
        </div>

        {/* Footer del Sidebar con botón de salir */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Salir</span>
          </button>
        </div>
      </div>

              {/* Contenido Principal */}
        <div className="flex-1 flex flex-col ml-64 mt-20">
        {/* Header Moderno */}
        <div className="fixed top-0 left-64 right-0 bg-white shadow-lg border-b border-gray-200 z-20">
          <div className="px-6">
            {/* Header Principal */}
            <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Título de la vista actual */}
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 capitalize">
                {vistaAdmin === 'chat-global' ? 'Chat Global' : vistaAdmin}
              </h1>
              <p className="text-sm text-gray-500">
                {vistaAdmin === 'resumen' && 'Dashboard principal del sistema'}
                {vistaAdmin === 'asesores' && 'Gestión del equipo de asesores'}
                {vistaAdmin === 'clientes' && 'Base de datos de clientes'}
                {vistaAdmin === 'gestion' && 'Asignaciones y configuraciones'}
                {vistaAdmin === 'webhooks' && 'Configuración de webhooks'}
                {vistaAdmin === 'vips' && 'Importar y gestionar lista VIP'}
                {vistaAdmin === 'chat-global' && 'Supervisión de conversaciones'}
              </p>
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
                     const telegramOk = estado?.telegram?.status === 'ok';
                     return estado?.whatsapp === 'desconectado' || !telegramOk;
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
              {/* Crear Asesor - Solo para admins completos */}
              {adminRole === 'admin' && (
                <button
                  onClick={() => setMostrarModalCrearAsesor(true)}
                  className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <UserCheck className="h-4 w-4" />
                  <span className="hidden lg:inline font-medium">Crear Asesor</span>
                </button>
              )}
              {/* Exportar - Solo para admins completos */}
              {adminRole === 'admin' && (
                <button
                  onClick={exportarDatos}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden lg:inline font-medium">Exportar</span>
                </button>
              )}
              
              {/* Toggle Vista - Solo mostrar en vista asesores */}
              {vistaAdmin === 'asesores' && (
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setVistaAsesores('cards')}
                    className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                      vistaAsesores === 'cards'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Vista de tarjetas"
                  >
                    <Grid3X3 className="h-4 w-4" />
                    <span className="hidden lg:inline ml-1">Cards</span>
                  </button>
                  <button
                    onClick={() => setVistaAsesores('tabla')}
                    className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                      vistaAsesores === 'tabla'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Vista de tabla"
                  >
                    <List className="h-4 w-4" />
                    <span className="hidden lg:inline ml-1">Tabla</span>
                  </button>
                </div>
              )}
              {/* Verificar Conexiones - Solo para admins completos */}
              {adminRole === 'admin' && (
                <button
                  onClick={() => verificarEstadosConexion(asesores)}
                  className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span className="hidden lg:inline font-medium">Verificar Conexiones</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Contenido Principal */}
        <div className="h-[calc(100vh-5rem)] overflow-y-auto">
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
                  const telegramOk = estado?.telegram?.status === 'ok';
                  return estado?.whatsapp === 'desconectado' || !telegramOk;
                }).map((asesor) => {
                  const estado = conexionesEstado[asesor.ID];
                  const whatsappDesconectado = estado?.whatsapp === 'desconectado';
                  const telegramSinConfigurar = estado?.telegram?.status !== 'ok';
                  
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
                                  Telegram no verificado
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
                        <div>{stats?.clientesSinReporte || 0} clientes sin reporte</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          VIP: {stats?.clientesSinReporteVIP || 0} | Otros: {stats?.clientesSinReporteNoVIP || 0}
                        </div>
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
                        {(Object.values(conexionesEstado) as any[]).filter(c => c.whatsapp === 'conectado' && c.telegram?.status === 'ok').length}/
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
                          {(Object.values(conexionesEstado) as any[]).filter(c => c.whatsapp === 'conectado').length}
                        </span>
                        <span className="text-xs text-gray-500">/</span>
                        <span className="text-sm font-medium text-red-600">
                          {(Object.values(conexionesEstado) as any[]).filter(c => c.whatsapp === 'desconectado').length}
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
                          {(Object.values(conexionesEstado) as any[]).filter(c => c.telegram?.status === 'ok').length}
                        </span>
                        <span className="text-xs text-gray-500">/</span>
                        <span className="text-sm font-medium text-red-600">
                          {(Object.values(conexionesEstado) as any[]).filter(c => c.telegram?.status !== 'ok').length}
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
                  {vistaAsesores === 'cards' ? (
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
                                <h3 className="text-lg font-semibold hover:text-blue-600">{asesor.NOMBRE}</h3>
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
                                            : estadoConexion?.whatsapp === 'conectando'
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                        }`}></div>
                                        <span className={`text-xs font-medium ${
                                          estadoConexion?.whatsapp === 'conectado' 
                                            ? 'text-green-600' 
                                            : estadoConexion?.whatsapp === 'conectando'
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                        }`}>
                                          {estadoConexion?.whatsapp === 'conectado' ? 'Conectado' : 
                                           estadoConexion?.whatsapp === 'conectando' ? 'Conectando' : 'Desconectado'}
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
                                        estadoConexion?.telegram?.status === 'ok'
                                          ? 'bg-green-500' 
                                          : 'bg-red-500'
                                      }`}></div>
                                      <span className={`text-xs font-medium ${
                                        estadoConexion?.telegram?.status === 'ok'
                                          ? 'text-green-600' 
                                          : 'text-red-600'
                                      }`}>
                                        {estadoConexion?.telegram?.status === 'ok' ? 'Verificado' : 'No verificado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <BarChart className="h-6 w-6 text-green-500" />
                              <div>
                                <span className="text-lg font-bold">{stats?.porcentajeCierre.toFixed(1)}% Cierre</span>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  VIP: {stats?.porcentajeCierreVIP?.toFixed(1) || '0.0'}% | Otros: {stats?.porcentajeCierreNoVIP?.toFixed(1) || '0.0'}%
                                </div>
                              </div>
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
                                <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                                  <span>VIP:</span>
                                  <span>{stats?.totalClientesVIP || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                                  <span>Otros:</span>
                                  <span>{stats?.totalClientesNoVIP || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-red-500 flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    Sin reporte:
                                  </span>
                                  <span className="font-semibold text-red-500">{stats?.clientesSinReporte}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                                  <span>VIP:</span>
                                  <span>{stats?.clientesSinReporteVIP || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                                  <span>Otros:</span>
                                  <span>{stats?.clientesSinReporteNoVIP || 0}</span>
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
                                <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                                  <span>VIP:</span>
                                  <span>{stats?.porcentajeCierreVIP?.toFixed(1) || '0.0'}%</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                                  <span>Otros:</span>
                                  <span>{stats?.porcentajeCierreNoVIP?.toFixed(1) || '0.0'}%</span>
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
                                      {stats.clientesSinReporteVIP > 0 || stats.clientesSinReporteNoVIP > 0 && (
                                        <span className="text-xs text-gray-600 ml-1">
                                          (VIP: {stats.clientesSinReporteVIP || 0}, Otros: {stats.clientesSinReporteNoVIP || 0})
                                        </span>
                                      )}
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
                          {/* Botones de acción */}
                          <div className="mt-4 flex justify-end space-x-2">
                            {/* Editar Asesor - Solo para admins completos */}
                            {adminRole === 'admin' && (
                              <button
                                onClick={() => setAsesorParaEditar(asesor)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                                title="Editar asesor"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Editar
                              </button>
                            )}
                            {/* Entrar como Asesor */}
                            <button
                              onClick={() => {
                                setAsesorModoActivo(asesor);
                                setModoAsesor(true);
                              }}
                              className="inline-flex items-center px-3 py-2 border border-purple-300 text-sm font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors duration-200"
                              title="Entrar como este asesor"
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Entrar
                            </button>
                            <button
                              onClick={() => setAsesorSeleccionado(asesor)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
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
                  ) : (
                    /* Vista de Tabla */
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Asesor
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Conexiones
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Clientes
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ventas
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cierre
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actividad
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {asesoresOrdenados.map((asesor) => {
                            const stats = estadisticas[asesor.ID];
                            const ultimaActividadDate = stats?.ultimaActividad ? new Date(stats.ultimaActividad * 1000) : null;
                            const horasSinActividad = ultimaActividadDate
                              ? Math.floor((Date.now() - ultimaActividadDate.getTime()) / (1000 * 60 * 60))
                              : null;
                            const estadoConexion = conexionesEstado[asesor.ID];

                            return (
                              <tr key={asesor.ID} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <Users className="h-10 w-10 text-blue-500 mr-3" />
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</div>
                                      <div className="text-sm text-gray-500">{asesor.WHATSAPP}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <div className="flex flex-col space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-2 h-2 rounded-full ${
                                        estadoConexion?.whatsapp === 'conectado' ? 'bg-green-500' : 
                                        estadoConexion?.whatsapp === 'conectando' ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}></div>
                                      <span className="text-xs">WhatsApp</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-2 h-2 rounded-full ${
                                        estadoConexion?.telegram?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                                      }`}></div>
                                      <span className="text-xs">Telegram</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-gray-900">{stats?.totalClientes || 0}</span>
                                    <span className="text-xs text-gray-500">
                                      VIP: {stats?.totalClientesVIP || 0} | Otros: {stats?.totalClientesNoVIP || 0}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-0.5">
                                      {stats?.clientesSinReporte || 0} sin reporte
                                      {(stats?.clientesSinReporteVIP || 0) > 0 || (stats?.clientesSinReporteNoVIP || 0) > 0 ? (
                                        <span className="block text-xs text-gray-400 mt-0.5">
                                          VIP: {stats?.clientesSinReporteVIP || 0} | Otros: {stats?.clientesSinReporteNoVIP || 0}
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-green-600">{stats?.ventasPrincipal || 0} Principal</span>
                                    <span className="text-xs text-blue-600">{stats?.ventasDownsell || 0} Downsell</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      {stats?.porcentajeCierre?.toFixed(1) || '0.0'}%
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      VIP: {stats?.porcentajeCierreVIP?.toFixed(1) || '0.0'}% | Otros: {stats?.porcentajeCierreNoVIP?.toFixed(1) || '0.0'}%
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {horasSinActividad !== null ? (
                                    <span className={`text-xs ${horasSinActividad > 10 ? 'text-red-600' : 'text-green-600'}`}>
                                      {formatInactivityTime(stats?.ultimaActividad)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">Sin datos</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex justify-end space-x-2">
                                    {/* Editar Asesor - Solo para admins completos */}
                                    {adminRole === 'admin' && (
                                      <button
                                        onClick={() => setAsesorParaEditar(asesor)}
                                        className="text-indigo-600 hover:text-indigo-900 p-1 rounded"
                                        title="Editar"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                    )}
                                    {/* Entrar como Asesor */}
                                    <button
                                      onClick={() => {
                                        setAsesorModoActivo(asesor);
                                        setModoAsesor(true);
                                      }}
                                      className="text-purple-600 hover:text-purple-900 p-1 rounded"
                                      title="Entrar como este asesor"
                                    >
                                      <Users className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setAsesorSeleccionado(asesor)}
                                      className="text-blue-600 hover:text-blue-900 text-xs"
                                    >
                                      Ver Detalle
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {asesoresOrdenados.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No se encontraron asesores que coincidan con los filtros aplicados
                        </div>
                      )}
                    </div>
                  )}
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
                      adminRole={adminRole}
                      onReasignSuccess={handleClienteReasignado}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        ) : vistaAdmin === 'clientes' ? (
          <div className="p-4 space-y-8">
            {/* Botón para crear cliente - Solo para admins completos */}
            {adminRole === 'admin' && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setMostrarModalCrearCliente(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Crear Cliente
                </button>
              </div>
            )}
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
                  <option value="ESPERANDO RESPUESTA">Esperando respuesta</option>
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
                                <div className="break-words max-w-[150px]">
                                  {cliente.NOMBRE}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="break-all max-w-[120px]">
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
                                <div className="break-words max-w-[100px]">
                                  {ultimoReporte ? ultimoReporte.PRODUCTO : 'Sin definir'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {ultimoReporte ? (
                                  <div className="flex flex-col">
                                    <span className="text-gray-700 break-words">
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
                                  <span className={`break-words max-w-[120px] inline-block ${!ultimoReporte ? "text-red-700 font-bold" : "text-gray-800"}`}>
                                    {asesorAsignado.NOMBRE}
                                  </span>
                                ) : (
                                  "Sin asignar"
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-1">
                                  {asesorAsignado && adminRole === 'admin' && (
                                    <div>
                                      <ReasignarCliente
                                        clienteId={cliente.ID}
                                        asesorActual={asesorAsignado.NOMBRE}
                                        asesorActualId={asesorAsignado.ID}
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
                                  {adminRole === 'admin' && (
                                    <button
                                      onClick={() => handleBuscarDuplicados(cliente)}
                                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded"
                                      title="Buscar y fusionar duplicados"
                                    >
                                      <Copy className="h-3.5 w-3.5 mr-1" />
                                      Duplicados
                                    </button>
                                  )}
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
        ) : vistaAdmin === 'gestion' && adminRole === 'admin' ? (
          <GestionAsignaciones 
            asesores={asesores} 
            onUpdate={cargarSoloAsesores}
            estadisticas={estadisticas}
          />
        ) : vistaAdmin === 'webhooks' && adminRole === 'admin' ? (
          <div className="space-y-6">
            {/* Sub-navegación de Webhooks */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Webhook className="mr-3 h-6 w-6 text-teal-600" />
                    Administración de Webhooks
                  </h2>
                </div>
                
                {/* Pestañas */}
                <div className="flex space-x-2 border-b border-gray-200">
                  <button
                    onClick={() => setVistaWebhook('config')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                      vistaWebhook === 'config'
                        ? 'border-teal-500 text-teal-600 bg-teal-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Settings className="h-4 w-4 inline mr-2" />
                    Configuración
                  </button>
                  <button
                    onClick={() => setVistaWebhook('logs')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                      vistaWebhook === 'logs'
                        ? 'border-teal-500 text-teal-600 bg-teal-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 inline mr-2" />
                    Logs en Tiempo Real
                  </button>
                </div>
              </div>
            </div>
            
            {/* Contenido de la vista de webhook */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {vistaWebhook === 'config' ? (
                <WebhookConfig />
              ) : (
                <WebhookLogs />
              )}
            </div>
          </div>
        ) : vistaAdmin === 'vips' && adminRole === 'admin' ? (
          <div className="space-y-6">
            {/* Navegación de subvistas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={() => setVistaVIP('importar')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    vistaVIP === 'importar'
                      ? 'bg-yellow-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Upload className="h-4 w-4 inline-block mr-2" />
                  Importar VIPs
                </button>
                <button
                  onClick={() => setVistaVIP('pendientes')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    vistaVIP === 'pendientes'
                      ? 'bg-yellow-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Crown className="h-4 w-4 inline-block mr-2" />
                  VIPs Pendientes ({vipsPendientes.length})
                </button>
                <button
                  onClick={() => setVistaVIP('en-sistema')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    vistaVIP === 'en-sistema'
                      ? 'bg-yellow-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <BarChart className="h-4 w-4 inline-block mr-2" />
                  VIPs en Sistema ({vipsEnSistema.length})
                </button>
              </div>
            </div>

            {vistaVIP === 'importar' ? (
              /* Subvista: Importar CSV */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Upload className="h-5 w-5 mr-2 text-yellow-600" />
                    Importar Lista VIP desde CSV
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Sube tu archivo CSV con los datos VIP. El sistema verificará automáticamente quiénes ya están registrados como clientes.
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Upload de archivo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar archivo CSV
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setArchivoCsv(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                      />
                      <button
                        onClick={manejarProcesarCSV}
                        disabled={!archivoCsv || procesandoCsv}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {procesandoCsv ? (
                          <>
                            <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Procesar
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Resultado del procesamiento */}
                  {resultadoProceso && (
                    <div className="space-y-4">
                      {/* Resumen de estadísticas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* VIPs ya en sistema */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center">
                            <Users className="h-8 w-8 text-blue-500 mr-3" />
                            <div>
                              <p className="text-2xl font-bold text-blue-700">
                                {resultadoProceso.yaEnSistema.length}
                              </p>
                              <p className="text-sm text-blue-600">Ya en sistema</p>
                            </div>
                          </div>
                        </div>

                        {/* VIPs nuevos */}
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <div className="flex items-center">
                            <Crown className="h-8 w-8 text-green-500 mr-3" />
                            <div>
                              <p className="text-2xl font-bold text-green-700">
                                {resultadoProceso.nuevosVIPs.length}
                              </p>
                              <p className="text-sm text-green-600">VIPs nuevos</p>
                            </div>
                          </div>
                        </div>

                        {/* Duplicados en CSV */}
                        {resultadoProceso.duplicadosEnCSV && resultadoProceso.duplicadosEnCSV.length > 0 && (
                          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <div className="flex items-center">
                              <AlertTriangle className="h-8 w-8 text-yellow-500 mr-3" />
                              <div>
                                <p className="text-2xl font-bold text-yellow-700">
                                  {resultadoProceso.duplicadosEnCSV.length}
                                </p>
                                <p className="text-sm text-yellow-600">Duplicados en CSV</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Errores */}
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <div className="flex items-center">
                            <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                            <div>
                              <p className="text-2xl font-bold text-red-700">
                                {resultadoProceso.errores.length}
                              </p>
                              <p className="text-sm text-red-600">Errores</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Información sobre duplicados en CSV */}
                      {resultadoProceso.duplicadosEnCSV && resultadoProceso.duplicadosEnCSV.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                                Duplicados detectados en el CSV
                              </h4>
                              <p className="text-sm text-yellow-700 mb-3">
                                Se encontraron {resultadoProceso.duplicadosEnCSV.length} registro(s) duplicado(s) dentro del archivo CSV. 
                                Estos fueron excluidos automáticamente del procesamiento. 
                                Solo se procesaron {resultadoProceso.vipsUnicosProcesados} VIPs únicos de {resultadoProceso.totalLineasCSV} líneas totales.
                              </p>
                              <div className="max-h-48 overflow-y-auto bg-white rounded border border-yellow-200">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-yellow-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium text-yellow-800">Línea</th>
                                      <th className="px-3 py-2 text-left font-medium text-yellow-800">Nombre</th>
                                      <th className="px-3 py-2 text-left font-medium text-yellow-800">WhatsApp</th>
                                      <th className="px-3 py-2 text-left font-medium text-yellow-800">Primera aparición</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-yellow-100">
                                    {resultadoProceso.duplicadosEnCSV.slice(0, 20).map((dup: any, index: number) => (
                                      <tr key={index} className="hover:bg-yellow-50">
                                        <td className="px-3 py-2 text-yellow-700">{dup.lineaActual}</td>
                                        <td className="px-3 py-2 text-yellow-700">{dup.nombre}</td>
                                        <td className="px-3 py-2 text-yellow-700 font-mono">{dup.whatsapp}</td>
                                        <td className="px-3 py-2 text-yellow-700">Línea {dup.primeraAparicion}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {resultadoProceso.duplicadosEnCSV.length > 20 && (
                                  <div className="px-3 py-2 text-xs text-yellow-600 bg-yellow-50 border-t border-yellow-200">
                                    ... y {resultadoProceso.duplicadosEnCSV.length - 20} duplicado(s) más
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botón para guardar VIPs nuevos */}
                      {resultadoProceso.nuevosVIPs.length > 0 && (
                        <div className="flex justify-center">
                          <button
                            onClick={guardarVIPsNuevos}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center"
                          >
                            <Download className="h-5 w-5 mr-2" />
                            Guardar {resultadoProceso.nuevosVIPs.length} VIPs Nuevos
                          </button>
                        </div>
                      )}

                      {/* Tablas de resultados */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Tabla: Ya en sistema */}
                        {resultadoProceso.yaEnSistema.length > 0 && (
                          <div>
                            <h4 className="text-lg font-medium text-gray-800 mb-3">VIPs que ya están en el sistema</h4>
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                              <div className="max-h-64 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {resultadoProceso.yaEnSistema.slice(0, 50).map((vip: any, index: number) => (
                                      <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm">{vip.NOMBRE || 'Sin nombre'}</td>
                                        <td className="px-4 py-2 text-sm font-mono">{vip.WHATSAPP}</td>
                                        <td className="px-4 py-2 text-sm">
                                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                            Cliente: {vip.cliente?.ESTADO}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tabla: VIPs nuevos */}
                        {resultadoProceso.nuevosVIPs.length > 0 && (
                          <div>
                            <h4 className="text-lg font-medium text-gray-800 mb-3">VIPs nuevos para importar</h4>
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                              <div className="max-h-64 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Correo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {resultadoProceso.nuevosVIPs.slice(0, 50).map((vip: any, index: number) => (
                                      <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm">{vip.NOMBRE || 'Sin nombre'}</td>
                                        <td className="px-4 py-2 text-sm font-mono">{vip.WHATSAPP}</td>
                                        <td className="px-4 py-2 text-sm">{vip.CORREO || 'Sin correo'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : vistaVIP === 'pendientes' ? (
              /* Subvista: VIPs Pendientes */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <Crown className="h-5 w-5 mr-2 text-yellow-600" />
                        VIPs Pendientes de Contactar
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Lista de VIPs que aún no han sido convertidos en clientes del sistema
                      </p>
                    </div>
                    <button
                      onClick={cargarVIPsPendientes}
                      disabled={cargandoVips}
                      className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      <RefreshCcw className={`h-4 w-4 mr-2 ${cargandoVips ? 'animate-spin' : ''}`} />
                      {cargandoVips ? 'Cargando...' : 'Actualizar'}
                    </button>
                  </div>
                </div>

                {/* Panel de Asignación Masiva */}
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h4 className="text-md font-medium text-gray-800 mb-4 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-blue-600" />
                    Asignación Masiva de VIPs
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {asesores.map((asesor) => (
                      <div key={asesor.ID} className="bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-700">{asesor.NOMBRE}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              max={vipsPendientes.length}
                              value={asignacionMasiva[asesor.ID] || 0}
                              onChange={(e) => setAsignacionMasiva({
                                ...asignacionMasiva,
                                [asesor.ID]: Math.max(0, parseInt(e.target.value) || 0)
                              })}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                            <span className="text-xs text-gray-500">VIPs</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span>Total a asignar: </span>
                      <span className="font-semibold text-blue-600">
                        {Object.values(asignacionMasiva).reduce((sum, cantidad) => sum + cantidad, 0)} VIPs
                      </span>
                      <span className="mx-2">•</span>
                      <span>Disponibles: </span>
                      <span className="font-semibold text-green-600">{vipsPendientes.length} VIPs</span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setAsignacionMasiva({})}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={asignarVIPsMasivo}
                        disabled={procesandoAsignacion || Object.values(asignacionMasiva).reduce((sum, cantidad) => sum + cantidad, 0) === 0}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {procesandoAsignacion ? (
                          <>
                            <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 mr-2" />
                            Asignar VIPs
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {cargandoVips ? (
                    <div className="text-center py-12">
                      <RefreshCcw className="mx-auto h-8 w-8 text-gray-400 animate-spin" />
                      <p className="mt-2 text-sm text-gray-500">Cargando VIPs pendientes...</p>
                    </div>
                  ) : vipsPendientes.length === 0 ? (
                    <div className="text-center py-12">
                      <Crown className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No hay VIPs pendientes</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Todos los VIPs han sido contactados o convertidos en clientes.
                      </p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VIP / Prioridad</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asesor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Act.</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {vipsPendientes.map((vip: any) => {
                          const asesorAsignado = asesores.find(a => a.ID === vip.ASESOR_ASIGNADO);
                          return (
                            <tr key={vip.ID} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="flex items-center space-x-2 mb-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {vip.NOMBRE || 'Sin nombre'}
                                    </div>
                                    {vip.NIVEL_CONCIENCIA === 'alta' && (
                                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                                        ALTA PRIORIDAD
                                      </span>
                                    )}
                                    {vip.NIVEL_CONCIENCIA === 'media' && (
                                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                                        MEDIA
                                      </span>
                                    )}
                                    {vip.NIVEL_CONCIENCIA === 'baja' && (
                                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                                        BAJA
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-1">
                                    {vip.CORREO && <div>📧 {vip.CORREO}</div>}
                                    {vip.POSICION_CSV && <div>📍 Posición CSV: #{vip.POSICION_CSV}</div>}
                                    {vip.ORIGEN_REGISTRO && <div>🎯 {vip.ORIGEN_REGISTRO === 'segunda_clase' ? 'Registrado en 2da clase' : 'Desde grupo WhatsApp'}</div>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-mono text-gray-900">{vip.WHATSAPP}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  vip.ESTADO_CONTACTO === 'sin_asesor' 
                                    ? 'bg-gray-100 text-gray-800' 
                                    : vip.ESTADO_CONTACTO === 'asignado'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : vip.ESTADO_CONTACTO === 'contactado'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {vip.ESTADO_CONTACTO === 'sin_asesor' && 'Sin Asesor'}
                                  {vip.ESTADO_CONTACTO === 'asignado' && 'Asignado'}
                                  {vip.ESTADO_CONTACTO === 'contactado' && 'Contactado'}
                                  {vip.ESTADO_CONTACTO === 'no_responde' && 'No Responde'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {asesorAsignado ? asesorAsignado.NOMBRE : 'Sin asignar'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {vip.FECHA_ULTIMA_ACTUALIZACION 
                                  ? formatDistanceToNow(new Date(vip.FECHA_ULTIMA_ACTUALIZACION), { addSuffix: true, locale: es })
                                  : 'N/A'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                {/* Asignar a asesor */}
                                {vip.ESTADO_CONTACTO === 'sin_asesor' && (
                                  <select
                                    onChange={(e) => {
                                      const asesorId = parseInt(e.target.value);
                                      if (asesorId) asignarVIP(vip.ID, asesorId);
                                    }}
                                    className="text-xs border rounded px-2 py-1"
                                    defaultValue=""
                                  >
                                    <option value="">Asignar a...</option>
                                    {asesores.map(asesor => (
                                      <option key={asesor.ID} value={asesor.ID}>
                                        {asesor.NOMBRE}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                
                                {/* WhatsApp directo */}
                                <a
                                  href={`https://wa.me/${vip.WHATSAPP.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-900"
                                >
                                  <Smartphone className="h-4 w-4 inline" />
                                </a>
                                
                                {/* Cambiar estado */}
                                {vip.ASESOR_ASIGNADO && (
                                  <select
                                    onChange={(e) => {
                                      if (e.target.value) cambiarEstadoVIP(vip.ID, e.target.value);
                                    }}
                                    className="text-xs border rounded px-2 py-1"
                                    defaultValue=""
                                  >
                                    <option value="">Estado...</option>
                                    <option value="contactado">Contactado</option>
                                    <option value="no_responde">No Responde</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              /* Subvista: VIPs en Sistema - Tabla con Métricas */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <BarChart className="h-5 w-5 mr-2 text-yellow-600" />
                        VIPs en Sistema - Métricas por Asesor
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Vista consolidada con métricas de VIPs por asesor, porcentajes de contactado, reportado y conversión para toma de decisiones
                      </p>
                    </div>
                    <button
                      onClick={cargarVIPsTablaData}
                      disabled={cargandoTablaVips}
                      className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      <RefreshCcw className={`h-4 w-4 mr-2 ${cargandoTablaVips ? 'animate-spin' : ''}`} />
                      {cargandoTablaVips ? 'Cargando...' : 'Actualizar'}
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {cargandoTablaVips ? (
                    <div className="text-center py-12">
                      <RefreshCcw className="mx-auto h-8 w-8 text-gray-400 animate-spin" />
                      <p className="mt-2 text-sm text-gray-500">Cargando datos de VIPs...</p>
                    </div>
                  ) : vipsTablaData.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No hay VIPs asignados</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Importa VIPs primero y espera a que algunos sean asignados a asesores.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Tabla de Métricas VIP por Asesor */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full table-auto border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <SortableHeader column="asesor" className="text-left px-4 py-3 border-b font-semibold text-gray-700">
                                Asesor
                              </SortableHeader>
                              <SortableHeader column="totalVIPs" className="text-center px-3 py-3 border-b font-semibold text-gray-700">
                                Total VIPs
                              </SortableHeader>
                              <SortableHeader column="contactados" className="text-center px-3 py-3 border-b font-semibold text-gray-700">
                                Primer contacto
                              </SortableHeader>
                              <SortableHeader column="enProceso" className="text-center px-3 py-3 border-b font-semibold text-gray-700">
                                En Proceso
                              </SortableHeader>
                              <SortableHeader column="ventas" className="text-center px-3 py-3 border-b font-semibold text-gray-700">
                                Ventas
                              </SortableHeader>
                              <SortableHeader column="noInteresados" className="text-center px-3 py-3 border-b font-semibold text-red-600">
                                No Interesados
                              </SortableHeader>
                              <SortableHeader column="noContactar" className="text-center px-3 py-3 border-b font-semibold text-gray-600">
                                No Contactar
                              </SortableHeader>
                              <SortableHeader column="porcentajeContactado" className="text-center px-3 py-3 border-b font-semibold text-blue-600">
                                % Contactado
                              </SortableHeader>
                              <SortableHeader column="porcentajeReportado" className="text-center px-3 py-3 border-b font-semibold text-purple-600">
                                % Reportado
                              </SortableHeader>
                              <SortableHeader column="porcentajeConversion" className="text-center px-3 py-3 border-b font-semibold text-green-600">
                                % Conversión
                              </SortableHeader>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedVipsTablaData.map((asesorData: any) => (
                              <tr key={asesorData.asesor.ID} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleAsesorNameClick(asesorData.asesor)} >
                                <td className="px-4 py-3 border-b">
                                  <div className="flex items-center">
                                    <Users className="h-5 w-5 text-blue-600 mr-2" />
                                    <div>
                                      <div className="font-medium text-gray-900">{asesorData.asesor.NOMBRE}</div>
                                      <div className="text-xs text-gray-500">ID: {asesorData.asesor.ID}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <span className="font-bold text-lg text-gray-800">{asesorData.metricas.totalVIPs}</span>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium text-sm">
                                    {asesorData.metricas.contactados}
                                  </span>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full font-medium text-sm">
                                    {(asesorData.metricas.enSeguimiento || 0) + (asesorData.metricas.interesados || 0)}
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {asesorData.metricas.interesados || 0} int. + {asesorData.metricas.enSeguimiento || 0} seg.
                                  </div>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium text-sm">
                                    {(asesorData.metricas.pagados || 0) + (asesorData.metricas.consolidadas || 0)}
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {asesorData.metricas.pagados || 0} pag. + {asesorData.metricas.consolidadas || 0} cons.
                                  </div>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full font-medium text-sm">
                                    {asesorData.metricas.noInteresados || 0}
                                  </span>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded-full font-medium text-sm">
                                    {asesorData.metricas.noContactar || 0}
                                  </span>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <div className="flex flex-col items-center">
                                    <span className="font-bold text-lg text-blue-600">{asesorData.metricas.porcentajeContactado}%</span>
                                    <div className="w-12 bg-gray-200 rounded-full h-2 mt-1">
                                      <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{width: `${asesorData.metricas.porcentajeContactado}%`}}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1">{asesorData.metricas.contactados} contactados</span>
                                  </div>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <div className="flex flex-col items-center">
                                    <span className="font-bold text-lg text-purple-600">{asesorData.metricas.porcentajeReportado}%</span>
                                    <div className="w-12 bg-gray-200 rounded-full h-2 mt-1">
                                      <div 
                                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                        style={{width: `${asesorData.metricas.porcentajeReportado}%`}}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1">{asesorData.metricas.clientesReportados} reportados</span>
                                  </div>
                                </td>
                                <td className="text-center px-3 py-3 border-b">
                                  <div className="flex flex-col items-center">
                                    <span className="font-bold text-lg text-green-600">{asesorData.metricas.porcentajeConversion}%</span>
                                    <div className="w-12 bg-gray-200 rounded-full h-2 mt-1">
                                      <div 
                                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                        style={{width: `${asesorData.metricas.porcentajeConversion}%`}}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1">{asesorData.metricas.pagados + asesorData.metricas.consolidadas} ventas</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Resumen de totales */}
                      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {vipsTablaData.reduce((sum, asesor) => sum + asesor.metricas.totalVIPs, 0)}
                          </div>
                          <div className="text-sm text-blue-700">Total VIPs</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {vipsTablaData.reduce((sum, asesor) => sum + asesor.metricas.clientesReportados, 0)}
                          </div>
                          <div className="text-sm text-purple-700">Total Reportados</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {vipsTablaData.reduce((sum, asesor) => sum + asesor.metricas.pagados + asesor.metricas.consolidadas, 0)}
                          </div>
                          <div className="text-sm text-green-700">Total Ventas</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {vipsTablaData.length > 0 ? 
                              Math.round((vipsTablaData.reduce((sum, asesor) => sum + asesor.metricas.pagados + asesor.metricas.consolidadas, 0) / 
                                         vipsTablaData.reduce((sum, asesor) => sum + asesor.metricas.totalVIPs, 0)) * 100) : 0}%
                          </div>
                          <div className="text-sm text-yellow-700">Conversión Global</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : vistaAdmin === 'chat-global' ? (
          <div className="h-full flex flex-col bg-gray-100">
            

            <div className="h-[calc(100vh-5rem)] flex min-h-0">
              {/* Sidebar - Selección de Asesor */}
              <div 
                className="bg-white border-r border-gray-200 flex flex-col flex-shrink-0"
                style={{ width: `${anchoListaChat}px` }}
              >
                {/* Selector de Asesor */}
                <div className="p-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Asesor
                  </label>
                  <select
                    value={asesorSeleccionadoChat?.ID || ''}
                    onChange={(e) => {
                      const asesorId = parseInt(e.target.value);
                      const asesor = asesores.find(a => a.ID === asesorId);
                      if (asesor) seleccionarAsesorChat(asesor);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seleccionar asesor...</option>
                    {asesores.map(asesor => (
                      <option key={asesor.ID} value={asesor.ID}>
                        {asesor.NOMBRE}
                      </option>
                    ))}
                  </select>
                  
                  {/* Estadísticas de conversaciones */}
                  {asesorSeleccionadoChat && conversacionesChat.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-700">Resumen de Conversaciones</div>
           
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Mostrando:</span>
                          <span className="font-medium">{conversacionesFiltradas.length} de {conversacionesChat.length}</span>
                        </div>
                      </div>
                      
                      {/* Filtro de conversaciones */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-2">Filtro:</div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setFiltroChatGlobal('todos')}
                            className={`px-2 py-1 text-xs rounded ${
                              filtroChatGlobal === 'todos'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Todos
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de Conversaciones */}
                <div className="flex-1 overflow-y-auto">
                  {cargandoConversacionesChat ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCcw className="h-6 w-6 text-gray-400 animate-spin" />
                      <span className="ml-2 text-gray-500">Cargando conversaciones...</span>
                    </div>
                  ) : conversacionesFiltradas.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {conversacionesFiltradas.map((conversacion, index) => (
                        <div
                          key={index}
                          onClick={() => seleccionarConversacionChat(conversacion)}
                          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                            conversacionActivaChat === conversacion ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                                  obtenerTipoCliente(conversacion) === 'lid-sin-mapear' 
                                    ? 'bg-red-100' 
                                    : obtenerTipoCliente(conversacion) === 'cliente-mapeado'
                                    ? 'bg-green-100'
                                    : 'bg-gray-200'
                                }`}>
                                  {obtenerTipoCliente(conversacion) === 'lid-sin-mapear' ? (
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                  ) : obtenerTipoCliente(conversacion) === 'cliente-mapeado' ? (
                                    <Users className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Users className="h-5 w-5 text-gray-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <p className={`text-sm font-medium break-words ${
                                      obtenerTipoCliente(conversacion) === 'lid-sin-mapear' 
                                        ? 'text-red-700' 
                                        : 'text-gray-900'
                                    }`}>
                                      {obtenerNombreCliente(conversacion)}
                                    </p>
                                    {obtenerTipoCliente(conversacion) === 'lid-sin-mapear' && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        LID
                                      </span>
                                    )}
                                    {obtenerEstadoCliente(conversacion) && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        obtenerEstadoCliente(conversacion) === 'PAGADO' 
                                          ? 'bg-green-100 text-green-800'
                                          : obtenerEstadoCliente(conversacion) === 'SEGUIMIENTO'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {obtenerEstadoCliente(conversacion)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 break-all">
                                    {conversacion.wha_cliente?.includes('@lid') 
                                      ? `LID: ${conversacion.wha_cliente}`
                                      : conversacion.wha_cliente
                                    }
                                  </p>
                                  {conversacion.id_cliente && (
                                    <p className="text-xs text-green-600 font-medium">
                                      ID: {conversacion.id_cliente}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2">
                                <p className="text-sm text-gray-600 break-words">
                                  <span className={conversacion.ultimo_modo === 'entrante' ? 'text-blue-600' : 'text-green-600'}>
                                    {conversacion.ultimo_modo === 'entrante' ? '👤 ' : '👨‍💼 '}
                                  </span>
                                  {conversacion.ultimo_mensaje}
                                </p>
                              </div>
                            </div>
                            <div className="ml-2 flex flex-col items-end">
                              {/* Indicador de último mensaje */}
                              <div className="flex items-center space-x-2 mb-1">
                                {conversacion.ultimo_modo === 'entrante' ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                    <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                                    Cliente
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                    Asesor
                                  </span>
                                )}
                              </div>
                              
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(conversacion.ultimo_timestamp * 1000), { 
                                  addSuffix: true, 
                                  locale: es 
                                })}
                              </span>
                              
                              {conversacion.total_mensajes > 0 && (
                                <span className="mt-1 bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded-full">
                                  {conversacion.total_mensajes}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : asesorSeleccionadoChat ? (
                    <div className="flex items-center justify-center p-8">
                      <MessageSquare className="h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-center">
                        {conversacionesChat.length > 0 
                          ? `No hay conversaciones que coincidan con el filtro "${filtroChatGlobal}"`
                          : 'No hay conversaciones para este asesor'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8">
                      <Users className="h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-center">
                        Selecciona un asesor para ver sus conversaciones
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 🆕 Resizer para redimensionar la lista de chats */}
              <div
                className={`w-1 cursor-col-resize transition-colors duration-200 flex-shrink-0 relative group ${
                  redimensionando 
                    ? 'bg-indigo-500' 
                    : 'bg-gray-300 hover:bg-indigo-400'
                }`}
                onMouseDown={iniciarRedimensionamiento}
                title="Arrastra para redimensionar"
              >
                <div className={`w-1 h-full transition-colors duration-200 ${
                  redimensionando ? 'bg-indigo-600' : 'bg-transparent hover:bg-indigo-500'
                }`} />
                {/* Indicador visual de redimensionamiento */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-0.5 h-8 bg-indigo-400 rounded-full"></div>
                </div>
                {/* Indicador de redimensionamiento activo */}
                {redimensionando && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-0.5 h-12 bg-indigo-600 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>

              {/* Área Principal - Mensajes */}
              <div className="flex-1 flex flex-col min-h-0 max-h-[calc(100vh-5rem)]">
                {conversacionActivaChat ? (
                  <>
                    {/* Header de la conversación */}
                    <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                            <Users className="h-6 w-6 text-gray-500" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-3 mb-1">
                              <h3 className={`text-lg font-semibold ${
                                obtenerTipoCliente(conversacionActivaChat) === 'lid-sin-mapear' 
                                  ? 'text-red-700' 
                                  : 'text-gray-900'
                              }`}>
                                {obtenerNombreCliente(conversacionActivaChat)}
                              </h3>
                              {obtenerTipoCliente(conversacionActivaChat) === 'lid-sin-mapear' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  LID Sin Mapear
                                </span>
                              )}
                              {obtenerEstadoCliente(conversacionActivaChat) && (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  obtenerEstadoCliente(conversacionActivaChat) === 'PAGADO' 
                                    ? 'bg-green-100 text-green-800'
                                    : obtenerEstadoCliente(conversacionActivaChat) === 'SEGUIMIENTO'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {obtenerEstadoCliente(conversacionActivaChat)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {conversacionActivaChat.wha_cliente?.includes('@lid') 
                                ? `LID: ${conversacionActivaChat.wha_cliente}`
                                : conversacionActivaChat.wha_cliente
                              }
                            </p>
                            {conversacionActivaChat.id_cliente && (
                              <p className="text-xs text-green-600 font-medium">
                                Cliente ID: {conversacionActivaChat.id_cliente}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Estado del último mensaje */}
                          <div className="flex items-center space-x-2">
                            {conversacionActivaChat.ultimo_modo === 'entrante' ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 border-2 border-red-300">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                                ⚠️ Último mensaje del CLIENTE
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 border-2 border-green-300">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                ✅ Último mensaje del ASESOR
                              </span>
                            )}
                          </div>
                          
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                            {conversacionActivaChat.total_mensajes} mensajes
                          </span>
                          <button
                            onClick={() => {
                              if (asesorSeleccionadoChat && conversacionActivaChat) {
                                const clienteKey = conversacionActivaChat.id_cliente || conversacionActivaChat.wha_cliente;
                                cargarMensajesChat(asesorSeleccionadoChat.ID, clienteKey);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            <RefreshCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Área de mensajes */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4 min-h-0 max-h-[calc(100vh-15rem)]">
                      
                      {cargandoMensajesChat ? (
                        <div className="flex items-center justify-center h-full">
                          <RefreshCcw className="h-8 w-8 text-gray-400 animate-spin" />
                          <span className="ml-2 text-gray-500">Cargando mensajes...</span>
                        </div>
                      ) : mensajesChat.length > 0 ? (
                        <div className="space-y-4">
                          {mensajesChat.map((mensaje, index) => (
                            <div
                              key={index}
                              className={`flex ${
                                mensaje.modo === 'saliente' ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${
                                  mensaje.modo === 'saliente'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white text-gray-900 border border-gray-200'
                                }`}
                              >
                                <p className="text-sm">{mensaje.mensaje}</p>
                                <p className={`text-xs mt-1 ${
                                  mensaje.modo === 'saliente' ? 'text-indigo-100' : 'text-gray-500'
                                }`}>
                                  {new Date(mensaje.timestamp * 1000).toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {mensaje.estado && (
                                    <span className="ml-2">
                                      {mensaje.estado === 'leido' && '✓✓'}
                                      {mensaje.estado === 'entregado' && '✓'}
                                      {mensaje.estado === 'enviado' && '○'}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <MessageSquare className="h-12 w-12 text-gray-400 mb-2" />
                          <p className="text-gray-500 text-center">
                            No hay mensajes en esta conversación
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Área de envío de mensajes (solo lectura por ahora) */}
                    <div className="bg-white border-t border-gray-200 px-6 py-3 flex-shrink-0">
                      <div className={`px-4 py-2 rounded-lg text-center border-2 ${
                        conversacionActivaChat.ultimo_modo === 'entrante'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-green-50 border-green-200 text-green-700'
                      }`}>
                        <div className="flex items-center justify-center space-x-2 mb-1">
                          {conversacionActivaChat.ultimo_modo === 'entrante' ? (
                            <>
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                              <span className="font-medium">⚠️ ATENCIÓN REQUERIDA</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-5 w-5 text-green-500" />
                              <span className="font-medium">✅ CONVERSACIÓN AL DÍA</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs">
                          {conversacionActivaChat.ultimo_modo === 'entrante'
                            ? 'Cliente envió último mensaje - Asesor debe responder'
                            : 'Asesor envió último mensaje - Esperando respuesta del cliente'
                          }
                        </p>
                        <p className="text-xs mt-1 opacity-75">
                          Modo supervisión - Solo lectura
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <MessageSquare className="h-24 w-24 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {asesorSeleccionadoChat ? 'Selecciona una conversación' : 'Bienvenido al Chat Global'}
                      </h3>
                      <p className="text-gray-500 max-w-sm">
                        {asesorSeleccionadoChat 
                          ? 'Elige una conversación de la lista para ver los mensajes'
                          : 'Selecciona un asesor y luego una conversación para comenzar la supervisión'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-8">
            {/* Botón para crear cliente - Solo para admins completos */}
            {adminRole === 'admin' && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setMostrarModalCrearCliente(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Crear Cliente
                </button>
              </div>
            )}
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
                  <option value="ESPERANDO RESPUESTA">Esperando respuesta</option>
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
                                <div className="break-words max-w-[150px]">
                                  {cliente.NOMBRE}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="break-all max-w-[120px]">
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
                                <div className="break-words max-w-[100px]">
                                  {ultimoReporte ? ultimoReporte.PRODUCTO : 'Sin definir'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {ultimoReporte ? (
                                  <div className="flex flex-col">
                                    <span className="text-gray-700 break-words">
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
                                  <span className={`break-words max-w-[120px] inline-block ${!ultimoReporte ? "text-red-700 font-bold" : "text-gray-800"}`}>
                                    {asesorAsignado.NOMBRE}
                                  </span>
                                ) : (
                                  "Sin asignar"
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-1">
                                  {asesorAsignado && adminRole === 'admin' && (
                                    <div>
                                      <ReasignarCliente
                                        clienteId={cliente.ID}
                                        asesorActual={asesorAsignado.NOMBRE}
                                        asesorActualId={asesorAsignado.ID}
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
                                  {adminRole === 'admin' && (
                                    <button
                                      onClick={() => handleBuscarDuplicados(cliente)}
                                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded"
                                      title="Buscar y fusionar duplicados"
                                    >
                                      <Copy className="h-3.5 w-3.5 mr-1" />
                                      Duplicados
                                    </button>
                                  )}
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
          adminRole={adminRole}
          onClose={() => setClienteSeleccionado(null)}
        />
      )}

      {/* Modal Crear Cliente - Solo para admins completos */}
      {mostrarModalCrearCliente && adminRole === 'admin' && (
        <CrearClienteModal
          asesores={asesores}
          onClose={() => setMostrarModalCrearCliente(false)}
          onClienteCreado={refrescarClientes}
        />
      )}

      {/* Modales de gestión de asesores - Solo para admins completos */}
      {mostrarModalCrearAsesor && adminRole === 'admin' && (
        <CrearAsesorModal
          onClose={() => setMostrarModalCrearAsesor(false)}
          onAsesorCreado={cargarDatos}
        />
      )}
      {asesorParaEditar && adminRole === 'admin' && (
        <EditarAsesorModal
          asesor={asesorParaEditar}
          onClose={() => setAsesorParaEditar(null)}
          onAsesorActualizado={cargarDatos}
          onAsesorEliminado={cargarDatos}
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
                adminRole={adminRole}
                onReasignSuccess={handleClienteReasignado}
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
      
      {/* Modal de Duplicados */}
      <DuplicateModal
        isOpen={modalDuplicados.isOpen}
        onClose={() => setModalDuplicados({ isOpen: false, clienteId: 0, clienteName: '' })}
        clienteId={modalDuplicados.clienteId}
        clienteName={modalDuplicados.clienteName}
        onMergeSuccess={handleDuplicadosFusionados}
      />

      {vipModalAsesor && (
        <VipClientsModal 
            asesor={vipModalAsesor}
            clients={vipClientes}
            isLoading={loadingVipClientes}
            onClose={() => setVipModalAsesor(null)}
        />
      )}
      </div>
      
    </div>
    </div>
  );
}
