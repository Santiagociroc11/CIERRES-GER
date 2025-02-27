import React, { useEffect, useState } from 'react';
import { Cliente, Reporte, Registro } from '../types';
import { Clock, MessageSquare, DollarSign, AlertCircle, CheckCircle, X, Activity } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { supabase, eliminarReporte  } from '../lib/supabase';
import { Asesor } from '../types';

interface HistorialClienteProps {
  cliente: Cliente;
  reportes: Reporte[];
  asesor?: Asesor;
  admin?: boolean; // <-- Nuevo prop
  onClose: () => void;
}


export default function HistorialCliente({ cliente, reportes, asesor, admin = false, onClose }: HistorialClienteProps) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagenPago, setImagenPago] = useState<string | null>(null);


  useEffect(() => {
    cargarRegistros();
  }, [cliente.ID]);

  const cargarRegistros = async () => {
    try {
      const { data, error } = await supabase
        .from('GERSSON_REGISTROS')
        .select('*')
        .eq('ID_CLIENTE', cliente.ID)
        .order('FECHA_EVENTO', { ascending: false });

      if (error) throw error;
      setRegistros(data || []);
    } catch (error) {
      console.error('Error al cargar registros:', error);
    } finally {
      setLoading(false);
    }
  };

  // Combinar reportes y registros en una sola línea de tiempo
  const timelineItems = [
    ...reportes.map(reporte => ({
      tipo: 'reporte',
      fecha: reporte.FECHA_REPORTE,
      data: reporte
    })),
    ...registros.map(registro => ({
      tipo: 'registro',
      fecha: parseInt(registro.FECHA_EVENTO),
      data: registro
    }))
  ].sort((a, b) => b.fecha - a.fecha);


  const handleEliminarReporte = async (reporteId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este reporte?")) return;
  
    try {
      await eliminarReporte(reporteId);
      alert("✅ Reporte eliminado y estado del cliente restaurado.");
  
      // 🔄 Refrescar la lista desde Supabase
      await cargarRegistros();
  
    } catch (error) {
      console.error("❌ Error eliminando reporte:", error);
      alert("❌ Error eliminando reporte: " + error.message);
    }
  };
  

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return 'bg-green-100 text-green-800';
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
      default:
        return 'bg-gray-100 text-gray-800';
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
                <p className="text-sm text-gray-600">
                  Asesor: {asesor ? asesor.NOMBRE : 'Sin asesor asignado'}
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
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
                    key={`${item.tipo}-${item.data.ID}`}
                    className={`relative pb-6 ${index !== timelineItems.length - 1 ? 'border-l-2 border-gray-200 ml-3' : ''
                      }`}
                  >
                    <div className="relative flex items-start">
                      <div className="absolute -left-3.5 mt-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${item.tipo === 'registro'
                          ? 'bg-purple-100'
                          : item.data.ESTADO_NUEVO === 'PAGADO'
                            ? 'bg-green-100'
                            : 'bg-blue-100'
                          }`}>
                          {item.tipo === 'registro' ? (
                            <Activity className="h-4 w-4 text-purple-600" />
                          ) : item.data.ESTADO_NUEVO === 'PAGADO' ? (
                            <DollarSign className="h-4 w-4 text-green-600" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>

                      <div className="ml-6">
                        {item.tipo === 'registro' ? (
                          // Renderizar evento del backend
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="text-sm font-medium text-purple-600">
                                  {item.data.TIPO_EVENTO}
                                </span>
                              </div>
                              <span className="text-sm text-gray-500 mt-1 sm:mt-0">
                                {formatDate(parseInt(item.data.FECHA_EVENTO))}
                              </span>
                            </div>
                          </div>
                        ) : (
                          // Renderizar reporte del asesor
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getEstadoColor(item.data.ESTADO_NUEVO)
                                  }`}>
                                  {item.data.ESTADO_NUEVO}
                                </span>
                                {item.data.ESTADO_ANTERIOR && (
                                  <span className="text-sm text-gray-500">
                                    (Anterior: {item.data.ESTADO_ANTERIOR})
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-gray-500 mt-1 sm:mt-0">
                                {formatDate(item.data.FECHA_REPORTE)}
                              </span>
                              {/* 👇 Botón para eliminar reporte, solo si el usuario es admin */}
                              {admin == true && (
                                <button
                                  onClick={() => handleEliminarReporte(item.data.ID)}
                                  className="ml-4 px-3 py-1 text-xs text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                                >
                                  ❌ Eliminar
                                </button>
                              )}
                            </div>

                            <p className="mt-2 text-sm text-gray-900">{item.data.COMENTARIO}</p>

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

                            {item.data.IMAGEN_PAGO_URL && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setImagenPago(item.data.IMAGEN_PAGO_URL)}
                                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Ver comprobante de pago
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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

          {/* Pie del modal */}
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

      {imagenPago && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Fondo semitransparente que cierra al hacer click */}
          <div
            className="absolute inset-0 bg-black bg-opacity-40 transition-opacity"
            onClick={() => setImagenPago(null)}
          ></div>

          {/* Modal responsivo */}
          <div className="relative bg-white rounded-lg shadow-lg overflow-hidden transform transition-all 
      w-full max-w-md mx-4 sm:max-w-lg">
            <div className="p-4">
              <img
                src={imagenPago}
                alt="Comprobante de pago"
                className="w-full h-auto object-contain rounded-md"
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

    </div>
  );
}