import React from 'react';
import { Cliente, Reporte } from '../types';
import { Clock, MessageSquare, DollarSign, AlertCircle, CheckCircle, X } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

interface HistorialClienteProps {
  cliente: Cliente;
  reportes: Reporte[];
  onClose: () => void;
}

export default function HistorialCliente({ cliente, reportes, onClose }: HistorialClienteProps) {
  const reportesOrdenados = [...reportes].sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE);

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

            <div className="space-y-6">
              {reportesOrdenados.map((reporte, index) => (
                <div 
                  key={reporte.ID} 
                  className={`relative pb-6 ${
                    index !== reportesOrdenados.length - 1 ? 'border-l-2 border-gray-200 ml-3' : ''
                  }`}
                >
                  <div className="relative flex items-start">
                    <div className="absolute -left-3.5 mt-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        reporte.ESTADO_NUEVO === 'PAGADO' 
                          ? 'bg-green-100' 
                          : 'bg-blue-100'
                      }`}>
                        {reporte.ESTADO_NUEVO === 'PAGADO' ? (
                          <DollarSign className="h-4 w-4 text-green-600" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </div>

                    <div className="ml-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            getEstadoColor(reporte.ESTADO_NUEVO)
                          }`}>
                            {reporte.ESTADO_NUEVO}
                          </span>
                          {reporte.ESTADO_ANTERIOR && (
                            <span className="text-sm text-gray-500">
                              (Anterior: {reporte.ESTADO_ANTERIOR})
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 mt-1 sm:mt-0">
                          {formatDate(reporte.FECHA_REPORTE)}
                        </span>
                      </div>
                      
                      <p className="mt-2 text-sm text-gray-900">{reporte.COMENTARIO}</p>
                      
                      {reporte.FECHA_SEGUIMIENTO && (
                        <div className="mt-2 flex items-center space-x-2 text-sm bg-blue-50 p-2 rounded-md">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-blue-700">
                            Seguimiento: {formatDate(reporte.FECHA_SEGUIMIENTO)}
                          </span>
                          {reporte.COMPLETADO && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      )}

                      {reporte.IMAGEN_PAGO_URL && (
                        <div className="mt-2">
                          <a
                            href={reporte.IMAGEN_PAGO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Ver comprobante de pago
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {reportesOrdenados.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay registros de interacciones con este cliente
                </div>
              )}
            </div>
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
    </div>
  );
}