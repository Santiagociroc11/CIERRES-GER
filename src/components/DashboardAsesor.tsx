import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { Cliente, Asesor, Reporte, EstadisticasAsesor } from '../types';
import { List, Clock, TrendingUp, AlertTriangle, MessageSquare, AlertCircle, Menu as MenuIcon, X, Send } from 'lucide-react';
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
}

const getActiveClasses = (color?: 'red' | 'yellow' | 'blue') => {
  switch (color) {
    case 'red':
      return 'border-red-500 text-red-600';
    case 'yellow':
      return 'border-yellow-500 text-yellow-600';
    case 'blue':
    default:
      return 'border-blue-500 text-blue-600';
  }
};

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
}) {
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
    let pollingInterval;
    if (showWhatsAppModal && instanceInfo && instanceInfo.connectionStatus !== "open") {
      pollingInterval = setInterval(() => {
        refreshConnection();
      }, 30000);
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [showWhatsAppModal, instanceInfo]);

  const getClientesEstadoPendiente = () => {
    return clientes.filter(cliente => {
      const ultimoReporte = reportes
        .filter(r => r.ID_CLIENTE === cliente.ID)
        .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];
      return ultimoReporte && cliente.ESTADO !== ultimoReporte.ESTADO_NUEVO;
    });
  };

  const navItems: NavItem[] = [
    { id: 'general', label: 'Vista General', icon: List },
    { 
      id: 'pendientes', 
      label: 'Cambios de Estados', 
      icon: AlertCircle,
      badge: getClientesEstadoPendiente().length,
      color: 'red'
    },
    { 
      id: 'sin-reporte', 
      label: 'Sin Reporte', 
      icon: MessageSquare,
      badge: clientesSinReporte.length,
      color: 'yellow'
    },
    { id: 'seguimientos', label: 'Seguimientos', icon: Clock },
    { id: 'estadisticas', label: 'Estadísticas', icon: TrendingUp }
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
          flex items-center py-2 px-4 text-sm font-medium w-full
          ${isActive ? getActiveClasses(item.color) : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
        `}
      >
        <Icon className="h-5 w-5 mr-2" />
        <span>{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className={
            item.color === 'red'
              ? 'ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full'
              : item.color === 'yellow'
              ? 'ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full'
              : 'ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full'
          }>
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
              if (ultimoReporte) return { ...cliente, ESTADO: ultimoReporte.ESTADO_NUEVO };
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
      console.error('Error al cargar datos:', error);
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
      const url = `${evolutionServerUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(asesor.NOMBRE)}`;
      console.log("Fetching instance info from:", url);
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
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de {asesor.NOMBRE}</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowWhatsAppModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition duration-300"
            >
              WhatsApp {whatsappStatus ? `(${whatsappStatus})` : ''}
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition duration-300"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Navegación móvil */}
        <div className="md:hidden px-4 py-2 border-b border-gray-200">
          <button
            onClick={() => setMenuMobileAbierto(!menuMobileAbierto)}
            className="flex items-center justify-between w-full py-2 px-4 bg-gray-100 rounded-lg shadow hover:bg-gray-200 transition duration-300"
          >
            <span className="font-medium">Menú</span>
            {menuMobileAbierto ? (
              <X className="h-6 w-6 transition-transform duration-300 transform rotate-90" />
            ) : (
              <MenuIcon className="h-6 w-6 transition-transform duration-300" />
            )}
          </button>
          
          {menuMobileAbierto && (
            <div className="mt-2 space-y-1">
              {navItems.map(item => (
                <NavButton key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Navegación desktop */}
        <div className="hidden md:flex space-x-4 border-b border-gray-200 px-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setVistaActual(item.id)}
              className={`
                py-2 px-4 border-b-2 font-medium text-sm
                ${vistaActual === item.id ? getActiveClasses(item.color) : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <item.icon className="inline-block h-5 w-5 mr-2" />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={
                  item.color === 'red'
                    ? 'ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full'
                    : item.color === 'yellow'
                    ? 'ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full'
                    : 'ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full'
                }>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-6">
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
          <SeguimientosClientes reportes={reportes} onRefrescar={cargarDatos} />
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
          />
        )}
        {vistaActual === 'sin-reporte' && (
          <ClientesSinReporte
            clientes={clientesSinReporte}
            onActualizarEstado={setClienteParaEstado}
            onReportarVenta={setClienteParaVenta}
          />
        )}

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
    </div>
  );
}
