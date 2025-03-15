import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { Cliente, Asesor, Reporte, EstadisticasAsesor } from '../types';
import { List, Clock, TrendingUp } from 'lucide-react';
import ClientesSinReporte from './ClientesSinReporte';
import ActualizarEstadoCliente from './ActualizarEstadoCliente';
import ReportarVenta from './ReportarVenta';
import ListaGeneralClientes from './ListaGeneralClientes';
import SeguimientosClientes from './SeguimientosClientes';
import EstadisticasAvanzadas from './EstadisticasAvanzadas';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';

// Modal para el control de WhatsApp
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
        {/* Si no existe instancia ni QR, mostrar botón para conectar */}
        {!instanceInfo && !qrCode && !isLoadingWhatsApp && (
          <div className="text-center">
            <button
              onClick={onCreateInstance}
              disabled={isLoadingWhatsApp}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Conectar
            </button>
          </div>
        )}
        {/* Si existe QR y la instancia existe pero no está conectada */}
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
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Refrescar Conexión
            </button>
          </div>
        )}
        {/* Si la instancia existe y está conectada */}
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
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Desconectar
            </button>
          </div>
        )}
        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
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
  const [vistaActual, setVistaActual] = useState<'general' | 'seguimientos' | 'estadisticas'>('general');
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

  // Estados para WhatsApp y modal
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceInfo, setInstanceInfo] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Configuración de Evolution API
  const evolutionServerUrl = import.meta.env.VITE_EVOLUTIONAPI_URL;
  console.log("URLEVOLUTION: ", evolutionServerUrl)
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

  // Al abrir el modal, se refresca la conexión (obteniendo QR e info) de inmediato
  useEffect(() => {
    if (showWhatsAppModal) {
      refreshConnection();
    }
  }, [showWhatsAppModal, asesor.NOMBRE]);

  // Polling: cada 30 segundos, si la instancia existe pero no está conectada, se refresca la conexión
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

  const cargarDatos = async () => {
    try {
      console.log('Cargando datos para asesor:', asesor.ID);
      const clientesData = await apiClient.request<Cliente[]>(`/GERSSON_CLIENTES?ID_ASESOR=eq.${asesor.ID}`);
      const reportesData = await apiClient.request<Reporte[]>(`/GERSSON_REPORTES?ID_ASESOR=eq.${asesor.ID}&select=*,cliente:GERSSON_CLIENTES(*)&order=FECHA_SEGUIMIENTO.asc`);

      if (clientesData && reportesData) {
        const clientesProcesados = clientesData.map(cliente => {
          if (cliente.ESTADO === 'PAGADO') {
            const tieneReporteVenta = reportesData.some(r =>
              r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'PAGADO'
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

        // Estadísticas básicas
        const ventasRealizadas = reportesData.filter(r => r.ESTADO_NUEVO === 'PAGADO').length;
        const seguimientosPendientes = reportesData.filter(r =>
          r.FECHA_SEGUIMIENTO &&
          !r.COMPLETADO &&
          r.FECHA_SEGUIMIENTO >= Math.floor(Date.now() / 1000)
        ).length;
        const seguimientosCompletados = reportesData.filter(r => r.COMPLETADO).length;
        const totalSeguimientos = seguimientosPendientes + seguimientosCompletados;

        const ventasConFecha = reportesData.filter(r =>
          r.ESTADO_NUEVO === 'PAGADO' &&
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

  // Función para crear la instancia
  const handleCreateInstance = async () => {
    const payload = {
      instanceName: asesor.NOMBRE,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    };
    try {
      setIsLoadingWhatsApp(true);
      // Abrir el modal inmediatamente para mostrar el spinner de carga
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
      // Luego de crear la instancia, configuramos Chatwoot y refrescamos la conexión.
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

  // Función para configurar Chatwoot
  const setChatwootIntegration = async (instanceName) => {
    try {
      const url = `${evolutionServerUrl}/chatwoot/set/${encodeURIComponent(instanceName)}`;
      const payload = {
        enabled: true,
        accountId: "1",
        token: "wTVRJs9UfamwhTqcAqNpdqWE",
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

  // Función para llamar al endpoint "Instance Connect" y obtener el QR
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

  // Función combinada para refrescar la conexión: obtiene el QR y consulta la info
  const refreshConnection = async () => {
    await handleInstanceConnect();
    await handleFetchInstanceInfo();
  };

  // Función para obtener la info de la instancia usando fetchInstances
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

  // Función para desconectar la instancia
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
      // Después de desconectar, refrescamos para obtener el QR inmediatamente.
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
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              WhatsApp {whatsappStatus ? `(${whatsappStatus})` : ''}
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
        {/* Pestañas de navegación */}
        <div className="flex space-x-4 border-b border-gray-200 px-4">
          <button
            onClick={() => setVistaActual('general')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === 'general'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <List className="inline-block h-5 w-5 mr-2" />
            Vista General
          </button>
          <button
            onClick={() => setVistaActual('seguimientos')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === 'seguimientos'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Clock className="inline-block h-5 w-5 mr-2" />
            Seguimientos
          </button>
          <button
            onClick={() => setVistaActual('estadisticas')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === 'estadisticas'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <TrendingUp className="inline-block h-5 w-5 mr-2" />
            Estadísticas
          </button>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {vistaActual === 'general' && (
          <>
            <ClientesSinReporte
              clientes={clientesSinReporte}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
            />
            <div className="h-4"></div>
            <ListaGeneralClientes
              clientes={clientes}
              reportes={reportes}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
              admin={false}
            />
          </>
        )}
        {vistaActual === 'seguimientos' && (
          <SeguimientosClientes
            reportes={reportes}
            onRefrescar={cargarDatos}
          />
        )}
        {vistaActual === 'estadisticas' && (
          <EstadisticasAvanzadas
            estadisticas={estadisticas}
            reportes={reportes}
            clientes={clientes}
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
        {toast.visible && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
      </div>

      {/* Modal de control de WhatsApp */}
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
