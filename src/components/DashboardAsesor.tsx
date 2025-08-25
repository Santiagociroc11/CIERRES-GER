import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { Cliente, Asesor, Reporte, EstadisticasAsesor, EstadoCliente } from '../types';
import { List, Clock, TrendingUp, AlertTriangle, MessageSquare, AlertCircle, Menu as MenuIcon, X, Send, User, Smartphone, LogOut, Plus, Search, MessageCircle, Phone, Edit, CheckCircle, ShoppingCart } from 'lucide-react';
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
  onDeleteInstance: () => Promise<void>;
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
  onDeleteInstance,
}: WhatsAppModalProps) {
  const [qrLoading, setQrLoading] = useState(false);
  const [connectionStep, setConnectionStep] = useState<'initial' | 'generating' | 'scanning' | 'connected'>('initial');

  // Update connection step based on state
  useEffect(() => {
    if (!instanceInfo && !qrCode && !isLoadingWhatsApp) {
      setConnectionStep('initial');
    } else if (isLoadingWhatsApp || qrLoading) {
      setConnectionStep('generating');
    } else if (instanceInfo && instanceInfo.connectionStatus !== "open" && qrCode) {
      setConnectionStep('scanning');
    } else if (instanceInfo && instanceInfo.connectionStatus === "open") {
      setConnectionStep('connected');
    }
  }, [instanceInfo, qrCode, isLoadingWhatsApp, qrLoading]);

  const handleRefreshWithAnimation = async () => {
    setQrLoading(true);
    try {
      await onRefreshInstance();
    } finally {
      setTimeout(() => setQrLoading(false), 1000); // Slight delay for smooth UX
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">WhatsApp Business</h2>
                <p className="text-green-100 text-sm">
                  {connectionStep === 'connected' ? 'Conectado y listo' :
                   connectionStep === 'scanning' ? 'Escanea el código QR' :
                   connectionStep === 'generating' ? 'Generando código...' :
                   'Conecta tu cuenta'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors flex items-center justify-center"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Initial Connection */}
          {connectionStep === 'initial' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Smartphone className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Conectar WhatsApp</h3>
              <p className="text-gray-600 mb-6">
                Conecta tu WhatsApp Business para gestionar clientes.
              </p>
              <button
                onClick={onCreateInstance}
                disabled={isLoadingWhatsApp}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Iniciar Conexión
              </button>
            </div>
          )}

          {/* Step 2: Generating QR */}
          {connectionStep === 'generating' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Generando código QR</h3>
              <p className="text-gray-600">
                Preparando tu código de conexión...
              </p>
            </div>
          )}

          {/* Step 3: Scanning QR */}
          {connectionStep === 'scanning' && (
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Escanea con WhatsApp</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-left">
                <p className="text-sm text-blue-800 font-medium mb-2">Pasos rápidos:</p>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li><strong>1.</strong> Abre WhatsApp → <strong>Configuración</strong></li>
                  <li><strong>2.</strong> <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong></li>
                  <li><strong>3.</strong> Escanea el código de abajo</li>
                </ol>
              </div>

              {qrCode ? (
                <div className="relative mb-6">
                  {qrLoading && (
                    <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-xl">
                      <div className="text-center">
                        <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600 font-medium">Actualizando...</p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
                    <img 
                      src={qrCode} 
                      alt="Código QR de WhatsApp" 
                      className={`w-64 h-64 mx-auto transition-all duration-300 ${qrLoading ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
                      style={{
                        imageRendering: 'pixelated',
                        filter: 'contrast(1.1)',
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Se actualiza automáticamente cada 25 segundos
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 mb-6">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Código QR no disponible</p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                    <p className="text-sm text-yellow-800 font-medium">💡 ¿Tienes problemas?</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      <strong>Solución:</strong> Elimina la instancia y vuelve a iniciar la conexión.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleRefreshWithAnimation}
                  disabled={qrLoading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {qrLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Actualizando...</span>
                    </div>
                  ) : (
                    'Generar Nuevo QR'
                  )}
                </button>
                
                <button
                  onClick={onDeleteInstance}
                  disabled={isLoadingWhatsApp || qrLoading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  Eliminar Instancia
                </button>
                
                {/* Información de diagnóstico para móvil */}
                {/Mobi|Android/i.test(navigator.userAgent) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-left">
                    <p className="text-xs text-orange-800 font-medium mb-1">📱 Dispositivo móvil detectado:</p>
                    <p className="text-xs text-orange-700">
                      Si ves "Iniciar Conexión" pero en PC aparece conectado, presiona "Eliminar Instancia" y vuelve a conectar.
                    </p>
                  </div>
                )}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-700">
                    <strong>Tip:</strong> Si el QR no funciona o hay errores, elimina la instancia y vuelve a iniciar la conexión.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Connected */}
          {connectionStep === 'connected' && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-green-800 mb-3">¡WhatsApp Conectado!</h3>
              <p className="text-gray-600 mb-6">Tu cuenta está lista</p>
              
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3 text-left mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Estado:</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {whatsappStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Perfil:</span>
                  <span className="text-sm text-gray-600">{instanceInfo.profileName || "Cargando..."}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Número:</span>
                  <span className="text-sm text-gray-600 font-mono">{instanceInfo.ownerJid?.split('@')[0] || "Configurando..."}</span>
                </div>
                
                {/* Información adicional para móvil */}
                {/Mobi|Android/i.test(navigator.userAgent) && (
                  <div className="bg-green-100 border border-green-300 rounded-lg p-2 mt-3">
                    <p className="text-xs text-green-800 font-medium">📱 Conexión verificada en móvil ✅</p>
                    <p className="text-xs text-green-700">Estado sincronizado correctamente</p>
                  </div>
                )}
              </div>
              
              <button
                onClick={onDisconnect}
                disabled={isLoadingWhatsApp}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                Desconectar WhatsApp
              </button>
            </div>
          )}
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
  const [showWhatsAppWarning, setShowWhatsAppWarning] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramId, setTelegramId] = useState('');
  const [currentTelegramId, setCurrentTelegramId] = useState<string | null>(null);
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);
  const [verificandoWhatsApp, setVerificandoWhatsApp] = useState(false);

  const evolutionServerUrl = import.meta.env.VITE_EVOLUTIONAPI_URL;
  const evolutionApiKey = import.meta.env.VITE_EVOLUTIONAPI_TOKEN;

  const { toast, showToast, hideToast } = useToast();

  const handleLogout = async () => {
    localStorage.removeItem('userSession');
    onLogout();
  };

  useEffect(() => {
    loadCurrentTelegramId();
    cargarDatos();
  }, [asesor.ID]);

  useEffect(() => {
    // ⚡ MEJORA UX: Permitir que la plataforma cargue primero antes de verificar WhatsApp
    // Esto evita que el modal de "WhatsApp no conectado" aparezca inmediatamente,
    // proporcionando una mejor experiencia de usuario donde el dashboard se carga
    // normalmente y la verificación ocurre en segundo plano
    const verificarConexionInicial = async () => {
      console.log('🔍 [WhatsApp] Iniciando verificación de conexión para:', asesor.NOMBRE);
      console.log('🔍 [WhatsApp] Tipo de dispositivo:', /Mobi|Android/i.test(navigator.userAgent) ? 'MÓVIL' : 'DESKTOP');
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos de retraso
      setVerificandoWhatsApp(true);
      
      try {
        console.log('🔍 [WhatsApp] Ejecutando primera verificación...');
        await refreshConnection();
        
        // 🚀 MEJORA MÓVIL: Si no obtuvimos información válida, reintentar
        if (!instanceInfo || instanceInfo.connectionStatus !== "open") {
          console.log('⚠️ [WhatsApp] Primera verificación sin éxito, reintentando en 3 segundos...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          console.log('🔍 [WhatsApp] Ejecutando segundo intento...');
          await refreshConnection();
          
          // Tercer intento si es necesario
          if (!instanceInfo || instanceInfo.connectionStatus !== "open") {
            console.log('⚠️ [WhatsApp] Segundo intento sin éxito, último intento en 5 segundos...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log('🔍 [WhatsApp] Ejecutando tercer y último intento...');
            await refreshConnection();
          }
        }
        
        console.log('✅ [WhatsApp] Verificación completada. Estado final:', instanceInfo?.connectionStatus || 'SIN_INFO');
      } catch (error) {
        console.error('❌ [WhatsApp] Error en verificación inicial:', error);
      } finally {
        setVerificandoWhatsApp(false);
      }
    };
    
    verificarConexionInicial();
  }, []);

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
    } else if (instanceInfo && instanceInfo.connectionStatus !== "open") {
      setShowWhatsAppWarning(true);
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
        accountId: "12",
        token: "A55c8HWKWZ9kJS9Tv5GVcXWu",
        url: "https://chatwoot.automscc.com",
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
      console.log("🔗 Fetching QR from:", url);
      console.log("🔑 API Key:", evolutionApiKey ? "✅ Present" : "❌ Missing");
      console.log("🏠 Server URL:", evolutionServerUrl);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });
      
      console.log("📡 Response status:", response.status);
      console.log("📡 Response ok:", response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response error text:", errorText);
        throw new Error(`Error al obtener el QR de conexión: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("📦 Full response data:", data);
      console.log("📦 Data keys:", Object.keys(data));
      
      // Verificar todas las posibles ubicaciones del QR
      if (data.instance) {
        console.log("🔍 data.instance exists:", data.instance);
        console.log("🔍 data.instance keys:", Object.keys(data.instance));
        if (data.instance.base64) {
          console.log("✅ QR found in data.instance.base64");
          console.log("📸 QR preview:", data.instance.base64.substring(0, 50) + "...");
          setQrCode(data.instance.base64);
        } else {
          console.log("❌ No base64 in data.instance");
        }
      } else {
        console.log("❌ data.instance does not exist");
      }
      
      if (data.base64) {
        console.log("✅ QR found in data.base64");
        console.log("📸 QR preview:", data.base64.substring(0, 50) + "...");
        setQrCode(data.base64);
      } else {
        console.log("❌ No data.base64 found");
      }
      
      // Verificar otras posibles ubicaciones
      if (data.qr) {
        console.log("✅ QR found in data.qr:", data.qr);
        setQrCode(data.qr);
      }
      
      if (data.qrcode) {
        console.log("✅ QR found in data.qrcode:", data.qrcode);
        setQrCode(data.qrcode);
      }
      
      // Si no se encontró en ningún lugar
      if (!data.instance?.base64 && !data.base64 && !data.qr && !data.qrcode) {
        console.log("❌ No QR found anywhere in response");
        setQrCode(null);
      }
      
    } catch (error) {
      console.error("💥 Error in handleInstanceConnect:", error);
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  const refreshConnection = async () => {
    console.log('🔄 [WhatsApp] Refrescando conexión...');
    try {
      await handleInstanceConnect();
      await handleFetchInstanceInfo();
      console.log('✅ [WhatsApp] Conexión refrescada exitosamente');
    } catch (error) {
      console.error('❌ [WhatsApp] Error refrescando conexión:', error);
    }
  };

  const handleFetchInstanceInfo = async () => {
    try {
      setIsLoadingWhatsApp(true);
      const instanceName = encodeURIComponent(asesor.NOMBRE);
      const url = `${evolutionServerUrl}/instance/fetchInstances?instanceName=${instanceName}`;
      
      console.log('📡 [WhatsApp] Obteniendo info de instancia:', url);
      console.log('📡 [WhatsApp] Usuario:', asesor.NOMBRE);
    
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });
      
      console.log('📡 [WhatsApp] Response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ [WhatsApp] Error en response:', response.status);
        throw new Error("Error al obtener la información de la instancia");
      }
      
      const data = await response.json();
      console.log('📦 [WhatsApp] Response data:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        const instance = data[0];
        console.log('✅ [WhatsApp] Instancia encontrada:', {
          connectionStatus: instance.connectionStatus,
          profileName: instance.profileName,
          ownerJid: instance.ownerJid
        });
        
        setInstanceInfo(instance);
        if (instance.connectionStatus === "open") {
          setWhatsappStatus("Conectado");
          console.log('🎉 [WhatsApp] Estado: CONECTADO');
        } else if (instance.connectionStatus === "connecting") {
          setWhatsappStatus("Desconectado");
          console.log('⏳ [WhatsApp] Estado: CONECTANDO');
        } else {
          setWhatsappStatus("Desconectado");
          console.log('❌ [WhatsApp] Estado: DESCONECTADO');
        }
      } else {
        console.log('❌ [WhatsApp] No se encontró instancia');
        setInstanceInfo(null);
        setWhatsappStatus("Desconectado");
      }
    } catch (error) {
      console.error("❌ [WhatsApp] Error in handleFetchInstanceInfo:", error);
      setInstanceInfo(null);
      setWhatsappStatus("Desconectado");
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

  const handleDeleteInstance = async () => {
    try {
      setIsLoadingWhatsApp(true);
      const url = `${evolutionServerUrl}/instance/delete/${encodeURIComponent(asesor.NOMBRE)}`;
      console.log("Delete URL:", url);
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al eliminar la instancia: ${response.status} - ${errorText}`);
      }
      setWhatsappStatus("Desconectado");
      setInstanceInfo(null);
      setQrCode(null);
      showToast("Instancia eliminada correctamente", "success");
      await refreshConnection();
    } catch (error) {
      console.error("Error eliminando instancia:", error);
      showToast("Error al eliminar la instancia", "error");
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  const handleSaveTelegramId = async () => {
    if (!telegramId.trim()) {
      showToast("Por favor ingresa tu ID de Telegram", "error");
      return;
    }

    try {
      setIsLoadingTelegram(true);
      
      const response = await apiClient.request(`/GERSSON_ASESORES?ID=eq.${asesor.ID}`, 'PATCH', {
        ID_TG: telegramId.trim()
      });

      showToast("ID de Telegram guardado correctamente", "success");
      setShowTelegramModal(false);
      setTelegramId('');
      await loadCurrentTelegramId();
    } catch (error) {
      console.error("Error guardando ID de Telegram:", error);
      showToast("Error al guardar el ID de Telegram", "error");
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  const loadCurrentTelegramId = async () => {
    try {
      const response = await apiClient.request<any[]>(`/GERSSON_ASESORES?ID=eq.${asesor.ID}&select=ID_TG`);
      if (response && response.length > 0) {
        const idTg = response[0].ID_TG;
        setCurrentTelegramId(idTg || null);
        setTelegramId(idTg || '');
      }
    } catch (error) {
      console.error('Error cargando ID de Telegram:', error);
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
                  verificandoWhatsApp ? 'bg-yellow-500 animate-pulse' :
                  whatsappStatus === 'Conectado' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-xs font-medium text-gray-600">
                  {verificandoWhatsApp ? 'Verificando...' : (whatsappStatus || 'Desconectado')}
                </span>
              </div>

              {/* Botón de actualización manual - Solo visible en móvil si hay problemas */}
              {(/Mobi|Android/i.test(navigator.userAgent) && whatsappStatus !== 'Conectado') && (
                <button
                  onClick={async () => {
                    setVerificandoWhatsApp(true);
                    console.log('🔄 [WhatsApp] Actualización manual solicitada');
                    try {
                      await refreshConnection();
                    } finally {
                      setVerificandoWhatsApp(false);
                    }
                  }}
                  disabled={verificandoWhatsApp}
                  className="flex items-center space-x-1 px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-all duration-200 text-xs"
                  title="Actualizar estado de WhatsApp"
                >
                  <div className={`w-3 h-3 ${verificandoWhatsApp ? 'animate-spin' : ''}`}>
                    {verificandoWhatsApp ? '⏳' : '🔄'}
                  </div>
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              )}

              {/* Botón WhatsApp */}
              <button
                onClick={() => setShowWhatsAppModal(true)}
                className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md relative"
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">WhatsApp</span>
                {/* Indicador visual del estado en móvil */}
                <div className="sm:hidden">
                  <div className={`w-2 h-2 rounded-full ${
                    verificandoWhatsApp ? 'bg-yellow-300 animate-pulse' :
                    whatsappStatus === 'Conectado' ? 'bg-green-300' : 'bg-red-300'
                  }`}></div>
                </div>
                {/* Indicador tipo Telegram - visible en desktop y móvil */}
                {!verificandoWhatsApp && (
                  <div className={`absolute -top-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${
                    whatsappStatus === 'Conectado' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                )}
                {/* Indicador de carga */}
                {verificandoWhatsApp && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border-2 border-white rounded-full animate-pulse"></div>
                )}
              </button>

              {/* Botón Telegram */}
              <button
                onClick={() => setShowTelegramModal(true)}
                className={`flex items-center space-x-2 px-3 lg:px-4 py-2 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md relative ${
                  currentTelegramId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600'
                }`}
              >
                <Send className="h-4 w-4" />
                <span className="hidden lg:inline font-medium">Telegram</span>
                {/* Indicador verde/rojo - siempre visible */}
                <div className={`absolute -top-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${
                  currentTelegramId ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
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
        onDeleteInstance={handleDeleteInstance}
      />

      <WhatsAppWarningModal
        isOpen={showWhatsAppWarning && (!instanceInfo || instanceInfo.connectionStatus !== "open")}
        onClose={() => setShowWhatsAppWarning(false)}
        onConnect={() => {
          setShowWhatsAppModal(true);
          setShowWhatsAppWarning(false);
        }}
      />

      {/* Modal de Telegram */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Configurar ID de Telegram</h2>
              
              {/* Estado actual */}
              <div className="mb-4">
                {currentTelegramId ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800">
                          Ya tienes configurado tu ID de Telegram
                        </p>
                        <p className="text-sm text-green-700">
                          ID actual: <span className="font-mono font-bold">{currentTelegramId}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-yellow-800">
                          No tienes configurado tu ID de Telegram
                        </p>
                        <p className="text-sm text-yellow-700">
                          Sigue las instrucciones para configurarlo
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Instrucciones:</h3>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. Ve a Telegram y busca: <a 
                      href="https://t.me/Repartidor_td_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors duration-200"
                    >@Repartidor_td_bot</a></li>
                    <li>2. Presiona el botón <strong>"Iniciar"</strong> o escribe el comando <strong>/start</strong></li>
                    <li>3. Presiona el MENÚ y selecciona<strong>"/autoid"</strong></li>
                    <li>4. El bot te enviará un número, cópialo y pégalo aquí:</li>
                  </ol>
                </div>

                <input
                  type="text"
                  placeholder={currentTelegramId ? `ID actual: ${currentTelegramId}` : "Ingresa tu ID de Telegram"}
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoadingTelegram}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTelegramModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-200"
                  disabled={isLoadingTelegram}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTelegramId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                  disabled={isLoadingTelegram || !telegramId.trim()}
                >
                  {isLoadingTelegram ? 'Guardando...' : (currentTelegramId ? 'Actualizar ID' : 'Guardar ID')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
