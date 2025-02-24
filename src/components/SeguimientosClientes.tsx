import React, { useState } from 'react';
import { Cliente, Reporte } from '../types';
import { Calendar, MessageSquare, Phone, CheckCircle, History, Clock, Filter, Menu } from 'lucide-react';
import { formatDate, formatTime } from '../utils/dateUtils';

interface SeguimientosClientesProps {
  reportes: Reporte[];
  onActualizarEstado: (cliente: Cliente) => void;
  onMarcarCompletado: (reporte: Reporte) => void;
}

export default function SeguimientosClientes({
  reportes,
  onActualizarEstado,
  onMarcarCompletado
}: SeguimientosClientesProps) {
  const [mostrarCompletados, setMostrarCompletados] = useState(false);
  const [reporteAcciones, setReporteAcciones] = useState<number | null>(null);

  const abrirWhatsApp = (numero: string) => {
    if (!numero) return;
    const numeroLimpio = numero.replace(/\D/g, '');
    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
  };

  // Obtener clientes con venta reportada
  const clientesConVenta = new Set(
    reportes
      .filter(r => r.ESTADO_NUEVO === 'PAGADO')
      .map(r => r.ID_CLIENTE)
  );

  // Filtrar reportes
  const reportesFiltrados = reportes.filter(reporte => {
    // No mostrar seguimientos de clientes con venta reportada
    if (clientesConVenta.has(reporte.ID_CLIENTE)) return false;
    
    // Solo mostrar reportes con fecha de seguimiento
    if (!reporte.FECHA_SEGUIMIENTO) return false;

    // Filtrar por estado de completado
    return mostrarCompletados ? reporte.COMPLETADO : !reporte.COMPLETADO;
  });

  // Agrupar reportes por fecha
  const reportesPorFecha = reportesFiltrados.reduce((acc, reporte) => {
    if (!reporte.FECHA_SEGUIMIENTO) return acc;
    
    const fecha = new Date(reporte.FECHA_SEGUIMIENTO * 1000).toDateString();
    if (!acc[fecha]) {
      acc[fecha] = [];
    }
    acc[fecha].push(reporte);
    return acc;
  }, {} as Record<string, Reporte[]>);

  // Ordenar las fechas
  const fechasOrdenadas = Object.keys(reportesPorFecha).sort((a, b) => 
    mostrarCompletados
      ? new Date(b).getTime() - new Date(a).getTime() // Orden descendente para completados
      : new Date(a).getTime() - new Date(b).getTime() // Orden ascendente para pendientes
  );

  const contarSeguimientos = (completados: boolean) => {
    return reportes.filter(r => 
      r.FECHA_SEGUIMIENTO && 
      r.COMPLETADO === completados &&
      !clientesConVenta.has(r.ID_CLIENTE)
    ).length;
  };

  return (
    <div className="space-y-4">
      {/* Encabezado y Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {mostrarCompletados ? 'Historial de Seguimientos' : 'Seguimientos Pendientes'}
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              mostrarCompletados 
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {mostrarCompletados
                ? `${contarSeguimientos(true)} completados`
                : `${contarSeguimientos(false)} pendientes`}
            </span>
          </div>
          
          <button
            onClick={() => setMostrarCompletados(!mostrarCompletados)}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mostrarCompletados
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {mostrarCompletados ? (
              <>
                <Clock className="inline-block h-4 w-4 mr-2" />
                Ver Pendientes
              </>
            ) : (
              <>
                <History className="inline-block h-4 w-4 mr-2" />
                Ver Completados
              </>
            )}
          </button>
        </div>
      </div>

      {/* Lista de Seguimientos */}
      {fechasOrdenadas.length > 0 ? (
        fechasOrdenadas.map(fecha => (
          <div key={fecha} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center bg-gray-50">
              <Calendar className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-sm font-medium text-gray-800">
                {new Date(fecha).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {reportesPorFecha[fecha].map((reporte) => (
                <div 
                  key={reporte.ID}
                  className={`p-4 ${
                    reporte.COMPLETADO 
                      ? 'bg-gray-50'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Encabezado del reporte */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {reporte.cliente?.NOMBRE}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            reporte.COMPLETADO
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {reporte.COMPLETADO ? 'Completado' : formatTime(reporte.FECHA_SEGUIMIENTO)}
                          </span>
                          <span className="text-sm text-gray-500">
                            Estado: {reporte.ESTADO_NUEVO}
                          </span>
                        </div>
                      </div>
                      
                      {/* Botón de menú en móvil */}
                      <button
                        onClick={() => setReporteAcciones(reporteAcciones === reporte.ID ? null : reporte.ID)}
                        className="p-1 hover:bg-gray-100 rounded-full sm:hidden"
                      >
                        <Menu className="h-5 w-5 text-gray-500" />
                      </button>

                      {/* Botones de acción en desktop */}
                      <div className="hidden sm:flex sm:space-x-2">
                        <button
                          onClick={() => abrirWhatsApp(reporte.cliente?.WHATSAPP || '')}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Contactar
                        </button>
                        
                        {!mostrarCompletados && !clientesConVenta.has(reporte.ID_CLIENTE) && (
                          <>
                            <button
                              onClick={() => onActualizarEstado(reporte.cliente!)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Actualizar
                            </button>
                            
                            <button
                              onClick={() => onMarcarCompletado(reporte)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Completar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Comentario */}
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-600">{reporte.COMENTARIO}</p>
                    </div>

                    {/* Menú de acciones móvil */}
                    {reporteAcciones === reporte.ID && (
                      <div className="flex flex-col gap-2 sm:hidden mt-2">
                        <button
                          onClick={() => {
                            abrirWhatsApp(reporte.cliente?.WHATSAPP || '');
                            setReporteAcciones(null);
                          }}
                          className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Contactar
                        </button>
                        
                        {!mostrarCompletados && !clientesConVenta.has(reporte.ID_CLIENTE) && (
                          <>
                            <button
                              onClick={() => {
                                onActualizarEstado(reporte.cliente!);
                                setReporteAcciones(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Actualizar Estado
                            </button>
                            
                            <button
                              onClick={() => {
                                onMarcarCompletado(reporte);
                                setReporteAcciones(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marcar Completado
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500">
            {mostrarCompletados
              ? 'No hay seguimientos completados para mostrar'
              : 'No hay seguimientos pendientes'}
          </div>
        </div>
      )}
    </div>
  );
}