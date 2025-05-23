import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { Cliente, Asesor, Reporte, EstadisticasAsesor, EstadoCliente } from '../types';
import { List, Clock, TrendingUp, AlertTriangle, MessageSquare, AlertCircle, Menu as MenuIcon, X, Send, User, Smartphone, LogOut } from 'lucide-react';
import ClientesSinReporte from './ClientesSinReporte';
import ClientesPendientes from './ClientesPendientes';
import ActualizarEstadoCliente from './ActualizarEstadoCliente';
import ReportarVenta from './ReportarVenta';
import ListaGeneralClientes from './ListaGeneralClientes';
import SeguimientosClientes from './SeguimientosClientes';
import EstadisticasAvanzadas from './EstadisticasAvanzadas';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import ChatModal from './ChatModal';

type Vista = 'general' | 'seguimientos' | 'estadisticas' | 'pendientes' | 'sin-reporte';

interface NavItem {
  id: Vista;
  label: string;
  icon: typeof List;
  badge?: number;
  color?: 'red' | 'yellow' | 'blue';
  description?: string;
}

const getActiveClasses = (color?: 'red' | 'yellow' | 'blue') => {
  switch (color) {
    case 'red':
      return 'border-red-500 text-red-600 bg-red-50';
    case 'yellow':
      return 'border-yellow-500 text-yellow-600 bg-yellow-50';
    case 'blue':
    default:
      return 'border-blue-500 text-blue-600 bg-blue-50';
  }
};

const getHoverClasses = (color?: 'red' | 'yellow' | 'blue') => {
  switch (color) {
    case 'red':
      return 'hover:border-red-300 hover:text-red-500 hover:bg-red-25';
    case 'yellow':
      return 'hover:border-yellow-300 hover:text-yellow-500 hover:bg-yellow-25';
    case 'blue':
    default:
      return 'hover:border-blue-300 hover:text-blue-500 hover:bg-blue-25';
  }
};

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappStatus: string | null;
  instanceInfo: any;
  qrCode: string | null;
  isLoadingWhatsApp: boolean;
  onCreateInstance: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRefreshInstance: () => Promise<void>;
}

function WhatsAppModal({
  isOpen,
  onClose,
  whatsappStatus,
  instanceInfo,
  qrCode,
  isLoadingWhatsApp,
  onCreateInstance,
  onDisconnect,
  onRefreshInstance,
}: WhatsAppModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-md w-full relative">
        {isLoadingWhatsApp && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="text-lg font-semibold">Cargando...</div>
          </div>
        )}
        <h2 className="text-xl font-bold mb-4">Sesión de WhatsApp</h2>
        {!instanceInfo && !qrCode && !isLoadingWhatsApp && (
          <div className="text-center">
            <button
              onClick={onCreateInstance}
              disabled={isLoadingWhatsApp}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-300"
            >
              Conectar
            </button>
          </div>
        )}
        {instanceInfo && instanceInfo.connectionStatus !== "open" && !isLoadingWhatsApp && (
          <div className="text-center">
            <p className="mb-2 font-medium">Escanea el QR para conectar:</p>
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="mx-auto mb-4" />
            ) : (
              <p className="mb-4 text-sm text-gray-600">QR no disponible. Intenta refrescar.</p>
            )}
            <button
              onClick={onRefreshInstance}
              disabled={isLoadingWhatsApp}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition duration-300"
            >
              Refrescar Conexión
            </button>
          </div>
        )}
        {instanceInfo && instanceInfo.connectionStatus === "open" && !isLoadingWhatsApp && (
          <div>
            <p className="mb-2">
              <span className="font-medium">Estado:</span> {whatsappStatus}
            </p>
            <p className="mb-2">
              <span className="font-medium">Instancia:</span> {instanceInfo.name}
            </p>
            <p className="mb-2">
              <span className="font-medium">Perfil:</span> {instanceInfo.profileName || "N/A"}
            </p>
            <p className="mb-2">
              <span className="font-medium">Número:</span> {instanceInfo.ownerJid || "N/A"}
            </p>
            {instanceInfo.profileStatus && (
              <p className="mb-2">
                <span className="font-medium">Status:</span> {instanceInfo.profileStatus}
              </p>
            )}
            <button
              onClick={onDisconnect}
              disabled={isLoadingWhatsApp}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition duration-300"
            >
              Desconectar
            </button>
          </div>
        )}
        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition duration-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface WhatsAppWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
}

function WhatsAppWarningModal({ isOpen, onClose, onConnect }: WhatsAppWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">WhatsApp No Conectado</h2>
          <p className="text-gray-600 mb-6">
            Para poder recibir clientes y trabajar en la plataforma, necesitas escanear y conectar tu sesión de WhatsApp.
          </p>
          <div className="flex gap-4">
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition duration-300"
            >
              Escanear Sesión
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition duration-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardAsesorProps {
  asesorInicial: Asesor;
  onLogout: () => void;
}

export default function DashboardAsesor({ asesorInicial, onLogout }: DashboardAsesorProps) {
  const [asesor] = useState<Asesor>(asesorInicial);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesSinReporte, setClientesSinReporte] = useState<Cliente[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [clienteParaEstado, setClienteParaEstado] = useState<Cliente | null>(null);
  const [clienteParaVenta, setClienteParaVenta] = useState<Cliente | null>(null);
  const [clienteParaChat, setClienteParaChat] = useState<Cliente | null>(null);
  const [vistaActual, setVistaActual] = useState<Vista>('general');
  const [menuMobileAbierto, setMenuMobileAbierto] = useState(false);
  const [estadisticas, setEstadisticas] = useState<EstadisticasAsesor>({
    totalClientes: 0,
    clientesReportados: 0,
    ventasRealizadas: 0,
    ventasPrincipal: 0,
    ventasDownsell: 0,
    seguimientosPendientes: 0,
    seguimientosCompletados: 0,
    porcentajeCierre: 0,
    ventasPorMes: 0,
    tiempoPromedioConversion: 0,
    tasaRespuesta: 0
  });

  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceInfo, setInstanceInfo] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showWhatsAppWarning, setShowWhatsAppWarning] = useState(true);

  const evolutionServerUrl = import.meta.env.VITE_EVOLUTIONAPI_URL;
  const evolutionApiKey = import.meta.env.VITE_EVOLUTIONAPI_TOKEN;

  const { toast, showToast, hideToast } = useToast();

  const handleLogout = async () => {
    localStorage.removeItem('userSession');
    onLogout();
  };

  useEffect(() => {
    refreshConnection();
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [asesor.ID]);

  useEffect(() => {
    if (showWhatsAppModal) {
      refreshConnection();
    }
  }, [showWhatsAppModal, asesor.NOMBRE]);

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined;
    if (showWhatsAppModal && instanceInfo && instanceInfo.connectionStatus !== "open") {
      pollingInterval = setInterval(() => {
        refreshConnection();
      }, 30000);
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [showWhatsAppModal, instanceInfo]);

  useEffect(() => {
    if (instanceInfo?.connectionStatus === "open") {
      setShowWhatsAppWarning(false);
    }
  }, [instanceInfo]);

  const getClientesEstadoPendiente = () => {
    return clientes.filter(cliente => {
      const ultimoReporte = reportes
        .filter(r => r.ID_CLIENTE === cliente.ID)
        .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];
      
      if (!ultimoReporte || ultimoReporte.ESTADO_NUEVO === 'PAGADO' || ultimoReporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA') {
        return false;
      }
      
      return cliente.ESTADO !== ultimoReporte.ESTADO_NUEVO && 
             cliente.ESTADO !== 'PAGADO' && 
             cliente.ESTADO !== 'VENTA CONSOLIDADA';
    });
  };

  const navItems: NavItem[] = [
    { 
      id: 'general', 
      label: 'Vista General', 
      icon: List,
      description: 'Resumen completo de todos los clientes'
    },
    { 
      id: 'pendientes', 
      label: 'Cambios de Estados', 
      icon: AlertCircle,
      badge: getClientesEstadoPendiente().length,
      color: 'red',
      description: 'Clientes con actualizaciones pendientes'
    },
    { 
      id: 'sin-reporte', 
      label: 'Sin Reporte', 
      icon: MessageSquare,
      badge: clientesSinReporte.length,
      color: 'yellow',
      description: 'Clientes que necesitan primer contacto'
    },
    { 
      id: 'seguimientos', 
      label: 'Seguimientos', 
      icon: Clock,
      description: 'Gestión de citas y seguimientos'
    },
    { 
      id: 'estadisticas', 
      label: 'Estadísticas', 
      icon: TrendingUp,
      description: 'Análisis de rendimiento y métricas'
    }
  ];

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = vistaActual === item.id;
    const Icon = item.icon;
    
    return (
      <button
        onClick={() => {
          setVistaActual(item.id);
          setMenuMobileAbierto(false);
        }}
        className={`
          flex items-center py-3 px-4 text-sm font-medium w-full rounded-lg transition-all duration-200 relative group
          ${isActive 
            ? getActiveClasses(item.color) + ' shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }
        `}
      >
        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
        <div className="flex-1 text-left">
          <div className="font-medium">{item.label}</div>
          {item.description && (
            <div className="text-xs opacity-75 mt-0.5 hidden sm:block">{item.description}</div>
          )}
        </div>
        {item.badge !== undefined && item.badge > 0 && (
          <span className={`
            flex items-center justify-center min-w-[20px] h-5 text-xs font-bold rounded-full
            ${item.color === 'red'
              ? 'bg-red-500 text-white'
              : item.color === 'yellow'
              ? 'bg-yellow-500 text-white'
              : 'bg-blue-500 text-white'
            }
          `}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const cargarDatos = async () => {
    try {
      console.log('Cargando datos para asesor:', asesor.ID);
      const clientesData = await apiClient.request<Cliente[]>(`/GERSSON_CLIENTES?ID_ASESOR=eq.${asesor.ID}`);
      const reportesData = await apiClient.request<Reporte[]>(`/GERSSON_REPORTES?ID_ASESOR=eq.${asesor.ID}&select=*,cliente:GERSSON_CLIENTES(*)&order=FECHA_SEGUIMIENTO.asc`);

      if (clientesData && reportesData) {
        const clientesProcesados = clientesData.map(cliente => {
          if (cliente.ESTADO === 'PAGADO' || cliente.ESTADO === 'VENTA CONSOLIDADA') {
            const tieneReporteVenta = reportesData.some(r =>
              r.ID_CLIENTE === cliente.ID && (r.ESTADO_NUEVO === 'PAGADO')
            );
            if (!tieneReporteVenta) {
              const ultimoReporte = reportesData
                .filter(r => r.ID_CLIENTE === cliente.ID)
                .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];
              if (ultimoReporte) return { ...cliente, ESTADO: ultimoReporte.ESTADO_NUEVO as EstadoCliente };
            }
          }
          return cliente;
        });

        setClientes(clientesProcesados);
        setReportes(reportesData);

        const clientesConReporte = new Set(reportesData.map(r => r.ID_CLIENTE));
        setClientesSinReporte(clientesProcesados.filter(c => !clientesConReporte.has(c.ID)));

        const uniqueVentasPrincipal = reportesData
          .filter(r => (r.ESTADO_NUEVO === 'PAGADO') && r.PRODUCTO === 'PRINCIPAL')
          .reduce((acc: Record<number, boolean>, r) => {
            acc[r.ID_CLIENTE] = true;
            return acc;
          }, {});
        const ventasPrincipal = Object.keys(uniqueVentasPrincipal).length;

        const uniqueVentasDownsell = reportesData
          .filter(r => (r.ESTADO_NUEVO === 'PAGADO' || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA') && r.PRODUCTO === 'DOWNSELL')
          .reduce((acc: Record<number, boolean>, r) => {
            acc[r.ID_CLIENTE] = true;
            return acc;
          }, {});
        const ventasDownsell = Object.keys(uniqueVentasDownsell).length;

        const ventasRealizadas = ventasPrincipal + ventasDownsell;
        const seguimientosPendientes = reportesData.filter(r =>
          r.FECHA_SEGUIMIENTO &&
          !r.COMPLETADO &&
          r.FECHA_SEGUIMIENTO >= Math.floor(Date.now() / 1000)
        ).length;
        const seguimientosCompletados = reportesData.filter(r => r.COMPLETADO).length;
        const totalSeguimientos = seguimientosPendientes + seguimientosCompletados;

        const ventasConFecha = reportesData.filter(r =>
          (r.ESTADO_NUEVO === 'PAGADO' || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA') &&
          r.cliente?.FECHA_CREACION &&
          r.FECHA_REPORTE
        );
        const tiempoPromedioConversion = ventasConFecha.length > 0
          ? ventasConFecha.reduce((acc, venta) => {
              const tiempoConversion = venta.FECHA_REPORTE -
                (typeof venta.cliente?.FECHA_CREACION === 'string'
                  ? parseInt(venta.cliente.FECHA_CREACION)
                  : venta.cliente?.FECHA_CREACION || 0);
              return acc + tiempoConversion;
            }, 0) / ventasConFecha.length / (24 * 60 * 60)
          : 0;
        const tasaRespuesta = totalSeguimientos > 0 ? (seguimientosCompletados / totalSeguimientos) * 100 : 0;

        setEstadisticas({
          totalClientes: clientesProcesados.length,
          clientesReportados: clientesConReporte.size,
          ventasRealizadas,
          ventasPrincipal,
          ventasDownsell,
          seguimientosPendientes,
          seguimientosCompletados,
          porcentajeCierre: clientesProcesados.length ? (ventasRealizadas / clientesProcesados.length) * 100 : 0,
          ventasPorMes: ventasRealizadas,
          tiempoPromedioConversion,
          tasaRespuesta
        });
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      showToast('Error al cargar los datos', 'error');
    }
  };

  const handleCreateInstance = async () => {
    const payload = {
      instanceName: asesor.NOMBRE,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      rejectCall: false,
      msgCall: "",
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    };
    try {
      setIsLoadingWhatsApp(true);
      setShowWhatsAppModal(true);
      const response = await fetch(`${evolutionServerUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("No se pudo crear la instancia");
      await response.json();
      await setChatwootIntegration(asesor.NOMBRE);
      await refreshConnection();
      setWhatsappStatus("Desconectado");
      showToast("Instancia creada, escanea el QR para conectar", "success");
    } catch (error) {
      console.error("Error creando instancia:", error);
      showToast("Error al crear la instancia de WhatsApp", "error");
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  const setChatwootIntegration = async (instanceName) => {
    try {
      const url = `${evolutionServerUrl}/chatwoot/set/${encodeURIComponent(instanceName)}`;
      const payload = {
        enabled: true,
        accountId: "2",
        token: "A55c8HWKWZ9kJS9Tv5GVcXWu",
        url: "https://n8n-chatwoot.wc2hpx.easypanel.host",
        signMsg: false,
        sign_delimiter: ":",
        reopenConversation: true,
        conversationPending: false,
        nameInbox: instanceName,
        importContacts: false,
        importMessages: false,
        daysLimitImportMessages: 1,
        autoCreate: true
      };
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al configurar Chatwoot: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log("Chatwoot integration set:", data);
      return data;
    } catch (error) {
      console.error("Error in setChatwootIntegration:", error);
      showToast("Error al configurar Chatwoot", "error");
    }
  };

  const handleInstanceConnect = async () => {
    try {
      setIsLoadingWhatsApp(true);
      const url = `${evolutionServerUrl}/instance/connect/${encodeURIComponent(asesor.NOMBRE)}`;
      console.log("Fetching QR from:", url);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al obtener el QR de conexión: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log("Instance Connect response:", data);
      if (data.instance && data.instance.base64) {
        setQrCode(data.instance.base64);
      } else if (data.base64) {
        setQrCode(data.base64);
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.error("Error in handleInstanceConnect:", error);
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  const refreshConnection = async () => {
    await handleInstanceConnect();
    await handleFetchInstanceInfo();
  };

  const handleFetchInstanceInfo = async () => {
    try {
      setIsLoadingWhatsApp(true);
      const instanceName = encodeURIComponent(asesor.NOMBRE);
      const url = `${evolutionServerUrl}/instance/fetchInstances?instanceName=${instanceName}`;
    
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });
      if (!response.ok) throw new Error("Error al obtener la información de la instancia");
      const data = await response.json();
      console.log("Response data:", data);
      if (Array.isArray(data) && data.length > 0) {
        const instance = data[0];
        setInstanceInfo(instance);
        if (instance.connectionStatus === "open") {
          setWhatsappStatus("Conectado");
        } else if (instance.connectionStatus === "connecting") {
          setWhatsappStatus("Desconectado");
        } else {
          setWhatsappStatus("Desconectado");
        }
      } else {
        setInstanceInfo(null);
        setWhatsappStatus("Desconectado");
      }
    } catch (error) {
      console.error("Error in handleFetchInstanceInfo:", error);
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  const handleDisconnectInstance = async () => {
    try {
      setIsLoadingWhatsApp(true);
      const url = `${evolutionServerUrl}/instance/logout/${encodeURIComponent(asesor.NOMBRE)}`;
      console.log("Disconnect URL:", url);
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al desconectar la instancia: ${response.status} - ${errorText}`);
      }
      setWhatsappStatus("Desconectado");
      setInstanceInfo(null);
      showToast("WhatsApp desconectado", "success");
      await refreshConnection();
    } catch (error) {
      console.error("Error desconectando instancia:", error);
      showToast("Error al desconectar WhatsApp", "error");
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Moderno */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Principal */}
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo y Título */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="h-6 w-6 lg:h-7 lg:w-7 text-white" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                  Dashboard de <span className="text-blue-600">{asesor.NOMBRE}</span>
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Panel de control y gestión de clientes</p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
                <p className="text-xs text-gray-500">{asesor.NOMBRE}</p>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center space-x-2 lg:space-x-4">
              {/* Estado WhatsApp */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  whatsappStatus === 'Conectado' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-xs font-medium text-gray-600">
                  {whatsappStatus || 'Desconectado'}
                </span>
              </div>

              {/* Botón WhatsApp */}
              <button
                onClick={() => setShowWhatsAppModal(true)}
                className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">WhatsApp</span>
              </button>

              {/* Botón Cerrar Sesión */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">Salir</span>
              </button>
            </div>
          </div>

          {/* Navegación Móvil */}
          <div className="lg:hidden pb-4">
            <button
              onClick={() => setMenuMobileAbierto(!menuMobileAbierto)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-xl transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <MenuIcon className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">Menú de Navegación</span>
              </div>
              <div className="flex items-center space-x-2">
                {navItems.reduce((total, item) => total + (item.badge || 0), 0) > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {navItems.reduce((total, item) => total + (item.badge || 0), 0)}
                  </span>
                )}
                <X className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                  menuMobileAbierto ? 'rotate-180' : 'rotate-0'
                }`} />
              </div>
            </button>
            
            {menuMobileAbierto && (
              <div className="mt-4 space-y-2 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                {navItems.map(item => (
                  <NavButton key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Navegación Desktop */}
          <div className="hidden lg:block">
            <div className="flex space-x-1 py-4">
              {navItems.map(item => {
                const isActive = vistaActual === item.id;
                const Icon = item.icon;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setVistaActual(item.id)}
                    className={`
                      flex items-center space-x-3 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 relative group
                      ${isActive 
                        ? getActiveClasses(item.color) + ' shadow-md border-2'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-sm border-2 border-transparent'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold">{item.label}</div>
                      {item.description && (
                        <div className="text-xs opacity-75 mt-0.5">{item.description}</div>
                      )}
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`
                        flex items-center justify-center min-w-[24px] h-6 text-xs font-bold rounded-full shadow-sm
                        ${item.color === 'red'
                          ? 'bg-red-500 text-white'
                          : item.color === 'yellow'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-blue-500 text-white'
                        }
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {vistaActual === 'general' && (
            <ListaGeneralClientes
              clientes={clientes}
              reportes={reportes}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
              onChat={setClienteParaChat}
              admin={false}
            />
          )}
          {vistaActual === 'seguimientos' && (
            <SeguimientosClientes 
              reportes={reportes} 
              onRefrescar={cargarDatos}
              onChat={setClienteParaChat}
            />
          )}
          {vistaActual === 'estadisticas' && (
            <EstadisticasAvanzadas
              estadisticas={estadisticas}
              reportes={reportes}
              clientes={clientes}
            />
          )}
          {vistaActual === 'pendientes' && (
            <ClientesPendientes
              clientes={clientes}
              reportes={reportes}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
              onChat={setClienteParaChat}
            />
          )}
          {vistaActual === 'sin-reporte' && (
            <ClientesSinReporte
              clientes={clientesSinReporte}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
              onChat={setClienteParaChat}
            />
          )}
        </div>

        {/* Modales */}
        {clienteParaEstado && (
          <ActualizarEstadoCliente
            cliente={clienteParaEstado}
            asesor={asesor}
            onComplete={() => {
              setClienteParaEstado(null);
              cargarDatos();
              showToast('Estado actualizado correctamente', 'success');
            }}
            onClose={() => setClienteParaEstado(null)}
          />
        )}
        {clienteParaVenta && (
          <ReportarVenta
            cliente={clienteParaVenta}
            asesor={asesor}
            onComplete={() => {
              setClienteParaVenta(null);
              cargarDatos();
              showToast('Venta reportada correctamente', 'success');
            }}
            onClose={() => setClienteParaVenta(null)}
          />
        )}
        {clienteParaChat && (
          <ChatModal
            isOpen={!!clienteParaChat}
            onClose={() => setClienteParaChat(null)}
            cliente={clienteParaChat}
            asesor={asesor}
          />
        )}
        {toast.visible && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
      </div>

      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        whatsappStatus={whatsappStatus}
        instanceInfo={instanceInfo}
        qrCode={qrCode}
        isLoadingWhatsApp={isLoadingWhatsApp}
        onCreateInstance={handleCreateInstance}
        onRefreshInstance={refreshConnection}
        onDisconnect={handleDisconnectInstance}
      />

      <WhatsAppWarningModal
        isOpen={showWhatsAppWarning && (!instanceInfo || instanceInfo.connectionStatus !== "open")}
        onClose={() => setShowWhatsAppWarning(false)}
        onConnect={() => {
          setShowWhatsAppModal(true);
          setShowWhatsAppWarning(false);
        }}
      />
    </div>
  );
}
