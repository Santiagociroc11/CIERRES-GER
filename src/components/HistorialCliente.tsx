import React, { useEffect, useState } from 'react';
import { Cliente, Reporte, Registro, AdminRole } from '../types';
import { Clock, MessageSquare, DollarSign, AlertCircle, CheckCircle, X, Activity, FileVideo, Image as ImageIcon, Send } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { apiClient, eliminarReporte, eliminarRegistro } from '../lib/apiClient';

interface HistorialClienteProps {
  cliente: Cliente;
  reportes: Reporte[];
  asesor?: any;
  admin?: boolean;
  adminRole?: AdminRole;
  onClose: () => void;
}

export default function HistorialCliente({
  cliente,
  reportes,
  asesor,
  admin = false,
  adminRole = 'supervisor',
  onClose
}: HistorialClienteProps) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagenPago, setImagenPago] = useState<string | null>(null);
  const [imagenConsolidacion, setImagenConsolidacion] = useState<string | null>(null);
  const [videoConsolidacion, setVideoConsolidacion] = useState<string | null>(null);

  // Estado local para los reportes, inicializado con la prop "reportes"
  const [localReportes, setLocalReportes] = useState<Reporte[]>(reportes);

  // Estados para modales de eliminación de registros
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [mostrarModalContrasena, setMostrarModalContrasena] = useState(false);
  const [mostrarModalMensaje, setMostrarModalMensaje] = useState(false);
  const [registroAEliminar, setRegistroAEliminar] = useState<number | null>(null);
  const [contrasenaInput, setContrasenaInput] = useState('');
  const [mensajeModal, setMensajeModal] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'success' | 'error'>('success');
  const [reenviandoPago, setReenviandoPago] = useState<number | null>(null);

  // Actualizar el estado local si la prop "reportes" cambia
  useEffect(() => {
    setLocalReportes(reportes);
  }, [reportes]);

  useEffect(() => {
    cargarRegistros();
  }, [cliente.ID]);

  const cargarRegistros = async () => {
    try {
      const data = await apiClient.request<Registro[]>(
        `/GERSSON_REGISTROS?ID_CLIENTE=eq.${cliente.ID}&order=FECHA_EVENTO.desc`
      );
      setRegistros(data || []);
    } catch (error: any) {
      console.error('Error al cargar registros:', error);
    } finally {
      setLoading(false);
    }
  };

  // Combinar localReportes y registros en una sola línea de tiempo
  const timelineItems = [
    ...localReportes.map(reporte => ({
      tipo: 'reporte' as const,
      fecha: parseInt(reporte.FECHA_REPORTE || '0'),
      data: reporte
    })),
    ...registros.map(registro => ({
      tipo: 'registro' as const,
      fecha: parseInt(registro.FECHA_EVENTO),
      data: registro
    }))
  ].sort((a, b) => b.fecha - a.fecha);

  // Type guards
  const isReporte = (item: any): item is { tipo: 'reporte'; fecha: number; data: Reporte } => {
    return item.tipo === 'reporte';
  };

  const isRegistro = (item: any): item is { tipo: 'registro'; fecha: number; data: Registro } => {
    return item.tipo === 'registro';
  };

  const handleEliminarReporte = async (reporteId: number) => {
    if (!window.confirm("¿Estás seguro de eliminar este reporte?")) return;

    try {
      await eliminarReporte(reporteId.toString());
      alert("✅ Reporte eliminado y estado del cliente restaurado.");
      setLocalReportes(prev => prev.filter(r => r.ID !== reporteId));
    } catch (error: any) {
      console.error("❌ Error eliminando reporte:", error);
      alert("❌ Error eliminando reporte: " + error.message);
    }
  };

  const handleEliminarRegistro = async (registroId: number) => {
    setRegistroAEliminar(registroId);
    setMostrarModalConfirmacion(true);
  };

  const confirmarEliminacion = () => {
    setMostrarModalConfirmacion(false);
    setMostrarModalContrasena(true);
  };

  const ejecutarEliminacion = async () => {
    if (contrasenaInput !== "santi123") {
      setMensajeModal("❌ Contraseña incorrecta. Operación cancelada.");
      setTipoMensaje('error');
      setMostrarModalContrasena(false);
      setMostrarModalMensaje(true);
      setContrasenaInput('');
      return;
    }

    setMostrarModalContrasena(false);
    setContrasenaInput('');

    if (!registroAEliminar) return;

    try {
      const resultado = await eliminarRegistro(registroAEliminar.toString());
      if (resultado.success) {
        setMensajeModal(`✅ ${resultado.message || 'Registro eliminado correctamente.'}`);
        setTipoMensaje('success');
        // Actualizar la lista de registros localmente
        setRegistros(prev => prev.filter(r => r.ID !== registroAEliminar));
        // Recargar los registros para asegurar consistencia
        await cargarRegistros();
      } else {
        setMensajeModal(`❌ ${resultado.message || 'Error al eliminar el registro.'}`);
        setTipoMensaje('error');
      }
    } catch (error: any) {
      console.error("❌ Error eliminando registro:", error);
      setMensajeModal("❌ Error eliminando registro: " + error.message);
      setTipoMensaje('error');
    }

    setMostrarModalMensaje(true);
    setRegistroAEliminar(null);
  };

  const cancelarEliminacion = () => {
    setMostrarModalConfirmacion(false);
    setMostrarModalContrasena(false);
    setRegistroAEliminar(null);
    setContrasenaInput('');
  };

  const handleReenviarPagoExterno = async (reporteId: number) => {
    if (!window.confirm('¿Reenviar este pago externo al grupo de Telegram?')) {
      return;
    }

    setReenviandoPago(reporteId);
    try {
      const response = await fetch('/api/pagos-externos/reenviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reporteId })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Pago externo reenviado exitosamente al grupo de Telegram');
      } else {
        alert(`❌ Error reenviando pago: ${data.error || data.details || 'Error desconocido'}`);
      }
    } catch (error: any) {
      console.error('Error reenviando pago externo:', error);
      alert(`❌ Error de conexión: ${error.message || 'Error desconocido'}`);
    } finally {
      setReenviandoPago(null);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return 'bg-green-100 text-green-800';
      case 'VENTA CONSOLIDADA':
        return 'bg-emerald-100 text-emerald-800';
      case 'SEGUIMIENTO':
        return 'bg-blue-100 text-blue-800';
      case 'NO INTERESADO':
        return 'bg-red-100 text-red-800';
      case 'LINK':
        return 'bg-purple-100 text-purple-800';
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

  const getIconForReporte = (reporte: Reporte) => {
    if (reporte.ESTADO_NUEVO === 'PAGADO' || reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA') {
      if (reporte.PRODUCTO === 'PRINCIPAL') {
        return <DollarSign className="h-4 w-4 text-green-600" />;
      } else if (reporte.PRODUCTO === 'DOWNSELL') {
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      } else {
        return <DollarSign className="h-4 w-4 text-green-600" />;
      }
    } else if (reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA') {
      return <FileVideo className="h-4 w-4 text-emerald-600" />;
    } else {
      return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative min-h-screen md:min-h-0 md:top-20 mx-auto p-4 md:p-6 w-full max-w-4xl">
        <div className="bg-white rounded-lg shadow-xl">
          {/* Encabezado */}
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-900">
                  Historial de {cliente.NOMBRE}
                </h2>
                <p className="text-sm text-gray-600">WhatsApp: {cliente.WHATSAPP}</p>
                <p className="text-sm text-gray-600">
                  Fecha de asignación: {formatDate(cliente.FECHA_CREACION)}
                </p>
                {asesor && (
                  <p className="text-sm text-gray-600">
                    Asesor: {asesor ? asesor.NOMBRE : 'Sin asesor asignado'}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Línea de tiempo de interacciones
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-500">Cargando historial...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {timelineItems.map((item, index) => (
                  <div
                    key={`${item.tipo}-${isReporte(item) ? item.data.ID : item.data.ID}`}
                    className={`relative pb-6 ${index !== timelineItems.length - 1 ? 'border-l-2 border-gray-200 ml-3' : ''}`}
                  >
                    <div className="relative flex items-start">
                      <div className="absolute -left-3.5 mt-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          isRegistro(item) ? 'bg-purple-100' :
                          isReporte(item) && item.data.ESTADO_NUEVO === 'VENTA CONSOLIDADA'
                            ? 'bg-emerald-100'
                            : isReporte(item) && item.data.ESTADO_NUEVO === 'PAGADO'
                              ? 'bg-green-100'
                              : 'bg-blue-100'
                          }`}>
                          {isRegistro(item) ? (
                            <Activity className="h-4 w-4 text-purple-600" />
                          ) : isReporte(item) ? (
                            getIconForReporte(item.data)
                          ) : null}
                        </div>
                      </div>
                      <div className="ml-6">
                        {isRegistro(item) ? (
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="text-sm font-medium text-purple-600">
                                  {item.data.TIPO_EVENTO}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 sm:mt-0">
                                <span className="text-sm text-gray-500">
                                  {formatDate(parseInt(item.data.FECHA_EVENTO))}
                                </span>
                                {admin && adminRole === 'admin' && (
                                  <button
                                    onClick={() => handleEliminarRegistro(item.data.ID)}
                                    className="px-3 py-1 text-xs text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200 transition-colors border border-orange-300"
                                    title="🔒 Eliminar este registro (requiere contraseña de administrador)"
                                  >
                                    🗑️ Eliminar Registro
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : isReporte(item) ? (
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getEstadoColor(item.data.ESTADO_NUEVO)}`}>
                                  {item.data.ESTADO_NUEVO}
                                </span>
                                {(item.data.ESTADO_NUEVO === 'PAGADO') && (
                                  <span className="ml-2 px-2 py-0.5 text-[12px] font-medium text-black-700 bg-yellow-100 rounded">
                                    {item.data.PRODUCTO === 'DOWNSELL' ? 'DOWNSELL' : 'PRINCIPAL'}
                                  </span>
                                )}
                                {item.data.ESTADO_ANTERIOR && (
                                  <span className="text-sm text-gray-500">
                                    (Anterior: {item.data.ESTADO_ANTERIOR})
                                  </span>
                                )}
                              </div>

                              <span className="text-sm text-gray-500 mt-1 sm:mt-0">
                                {formatDate(item.data.FECHA_REPORTE)}
                              </span>
                              {admin && adminRole === 'admin' && (
                                <button
                                  onClick={() => handleEliminarReporte(item.data.ID)}
                                  className="ml-4 px-3 py-1 text-xs text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                                >
                                  ❌ Eliminar
                                </button>
                              )}
                            </div>
                            {isReporte(item) && (
                              <>
                                <p className="mt-2 text-sm text-gray-900">{item.data.COMENTARIO}</p>
                                
                                {/* Información del tipo de venta - Solo para ventas */}
                                {(item.data.ESTADO_NUEVO === 'PAGADO' || item.data.ESTADO_NUEVO === 'VENTA CONSOLIDADA') && item.data.TIPO_VENTA && (
                                  <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <DollarSign className="h-4 w-4 text-blue-600" />
                                      <span className="font-medium text-blue-800">Información de la Venta</span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                      {item.data.TIPO_VENTA === 'INTERNA' ? (
                                        <p className="text-blue-700">
                                          💳 <strong>Venta interna</strong> - Procesada por Hotmart
                                        </p>
                                      ) : (
                                        <>
                                          <p className="text-purple-700">
                                            🌐 <strong>Venta externa</strong> - Procesada fuera de Hotmart
                                          </p>
                                          {item.data.MEDIO_PAGO && (
                                            <p className="text-purple-700">
                                              💰 <strong>Medio de pago:</strong> {item.data.MEDIO_PAGO}
                                            </p>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {item.data.PAIS_CLIENTE && (
                                  <p className="text-sm text-gray-700 mt-2">
                                    🌍 País: <strong>{item.data.PAIS_CLIENTE}</strong>
                                  </p>
                                )}
                                {item.data.CORREO_INSCRIPCION && (
                                  <p className="text-sm text-gray-700">
                                    📧 Correo de inscripción: <strong>{item.data.CORREO_INSCRIPCION}</strong>
                                  </p>
                                )}
                                {item.data.TELEFONO_CLIENTE && (
                                  <p className="text-sm text-gray-700">
                                    📞 Teléfono: <strong>{item.data.TELEFONO_CLIENTE}</strong>
                                  </p>
                                )}
                                {item.data.CORREO_PAGO && (
                                  <p className="text-sm text-gray-700">
                                    💳 Correo de pago (Stripe): <strong>{item.data.CORREO_PAGO}</strong>
                                  </p>
                                )}
                                {item.data.FECHA_SEGUIMIENTO && (
                                  <div className="mt-2 flex items-center space-x-2 text-sm bg-blue-50 p-2 rounded-md">
                                    <Clock className="h-4 w-4 text-blue-500" />
                                    <span className="text-blue-700">
                                      Seguimiento: {formatDate(item.data.FECHA_SEGUIMIENTO)}
                                    </span>
                                    {item.data.COMPLETADO && (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    )}
                                  </div>
                                )}
                                {(item.data.imagen_inicio_conversacion ||
                                  item.data.imagen_fin_conversacion ||
                                  item.data.video_conversacion) && (
                                    <div className="mt-4 space-y-2">
                                      <h4 className="text-sm font-medium text-gray-700">Pruebas de consolidación:</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {item.data.imagen_inicio_conversacion && (
                                          <button
                                            onClick={() => setImagenConsolidacion(item.data.imagen_inicio_conversacion)}
                                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100"
                                          >
                                            <ImageIcon className="h-4 w-4 mr-1" />
                                            Ver inicio de conversación
                                          </button>
                                        )}
                                        {item.data.imagen_fin_conversacion && (
                                          <button
                                            onClick={() => setImagenConsolidacion(item.data.imagen_fin_conversacion)}
                                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100"
                                          >
                                            <ImageIcon className="h-4 w-4 mr-1" />
                                            Ver fin de conversación
                                          </button>
                                        )}
                                        {item.data.video_conversacion && (
                                          <button
                                            onClick={() => setVideoConsolidacion(item.data.video_conversacion)}
                                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100"
                                          >
                                            <FileVideo className="h-4 w-4 mr-1" />
                                            Ver video
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                {item.data.IMAGEN_PAGO_URL && (
                                  <div className="mt-3">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">📄 Comprobante de pago:</h4>
                                    <div 
                                      className="relative group cursor-pointer inline-block"
                                      onClick={() => {
                                        console.log('Click en imagen de pago:', item.data.IMAGEN_PAGO_URL);
                                        setImagenPago(item.data.IMAGEN_PAGO_URL);
                                      }}
                                    >
                                      <img
                                        src={item.data.IMAGEN_PAGO_URL}
                                        alt="Comprobante de pago"
                                        className="max-w-48 max-h-38 object-contain rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                          <div className="bg-white rounded-full p-1 shadow-lg">
                                            <DollarSign className="h-4 w-4 text-blue-600" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Clic para ver en grande</p>
                                    
                                    {/* Botón para reenviar pago externo al grupo de Telegram */}
                                    {item.data.TIPO_VENTA === 'EXTERNA' && (
                                      <div className="mt-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReenviarPagoExterno(item.data.ID);
                                          }}
                                          disabled={reenviandoPago === item.data.ID}
                                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                          title="Reenviar este pago externo al grupo de Telegram"
                                        >
                                          {reenviandoPago === item.data.ID ? (
                                            <>
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                              Reenviando...
                                            </>
                                          ) : (
                                            <>
                                              <Send className="h-3 w-3 mr-1.5" />
                                              Reenviar al Grupo
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {timelineItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay registros de interacciones con este cliente
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-4 py-4 sm:px-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de imagen de pago */}
      {imagenPago && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={() => setImagenPago(null)}
          ></div>
          <div className="relative bg-white rounded-lg shadow-lg overflow-auto transform transition-all max-w-3xl w-full max-h-[90vh] mx-4">
            <div className="p-4">
              <img
                src={imagenPago}
                alt="Comprobante de pago"
                className="w-full h-auto object-contain max-h-[80vh] rounded-md"
              />
            </div>
            <div className="px-4 py-3 bg-gray-100 text-right">
              <button
                onClick={() => setImagenPago(null)}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de imagen de consolidación */}
      {imagenConsolidacion && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={() => setImagenConsolidacion(null)}
          ></div>
          <div className="relative bg-white rounded-lg shadow-lg overflow-auto transform transition-all max-w-3xl w-full max-h-[90vh] mx-4">
            <div className="p-4">
              <img
                src={imagenConsolidacion}
                alt="Imagen de consolidación"
                className="w-full h-auto object-contain max-h-[80vh] rounded-md"
              />
            </div>
            <div className="px-4 py-3 bg-gray-100 text-right">
              <button
                onClick={() => setImagenConsolidacion(null)}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:outline-none transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de video de consolidación */}
      {videoConsolidacion && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={() => setVideoConsolidacion(null)}
          ></div>
          <div className="relative bg-white rounded-lg shadow-lg overflow-auto transform transition-all max-w-4xl w-full max-h-[90vh] mx-4">
            <div className="p-4">
              <video
                src={videoConsolidacion}
                controls
                className="w-full h-auto rounded-md max-h-[80vh]"
              >
                Tu navegador no soporta la reproducción de video.
              </video>
            </div>
            <div className="px-4 py-3 bg-gray-100 text-right">
              <button
                onClick={() => setVideoConsolidacion(null)}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:outline-none transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar registro */}
      {mostrarModalConfirmacion && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={cancelarEliminacion}
          ></div>
          <div className="relative bg-white rounded-lg shadow-xl transform transition-all max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertCircle className="h-8 w-8 text-orange-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  Confirmar Eliminación de Registro
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                ¿Estás seguro de que quieres eliminar este registro? Esta acción restaurará 
                el estado anterior del cliente y no se puede deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelarEliminacion}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEliminacion}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de contraseña para eliminar registro */}
      {mostrarModalContrasena && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={cancelarEliminacion}
          ></div>
          <div className="relative bg-white rounded-lg shadow-xl transform transition-all max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">🔒</span>
                  </div>
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">
                  Acción Crítica - Contraseña Requerida
                </h3>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Ingresa la contraseña de administrador para proceder con la eliminación del registro:
                </p>
                <input
                  type="password"
                  value={contrasenaInput}
                  onChange={(e) => setContrasenaInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="Contraseña de administrador"
                  onKeyPress={(e) => e.key === 'Enter' && ejecutarEliminacion()}
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelarEliminacion}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarEliminacion}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Eliminar Registro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de mensaje (éxito/error) */}
      {mostrarModalMensaje && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={() => setMostrarModalMensaje(false)}
          ></div>
          <div className="relative bg-white rounded-lg shadow-xl transform transition-all max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tipoMensaje === 'success' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {tipoMensaje === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">
                  {tipoMensaje === 'success' ? 'Operación Exitosa' : 'Error en la Operación'}
                </h3>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {mensajeModal}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setMostrarModalMensaje(false)}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                    tipoMensaje === 'success' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}