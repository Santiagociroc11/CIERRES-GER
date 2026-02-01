import React, { useState } from 'react';
import { Reporte } from '../types';
import { Calendar, Phone, CheckCircle, History, Clock, Menu, Loader2, MessageSquare } from 'lucide-react';
import { formatTime } from '../utils/dateUtils';
import { apiClient } from '../lib/apiClient';

/**
 * Si en DashboardAsesor le pasas un callback para refrescar datos,
 * agrégalo como prop onRefrescar?: () => void
 */
interface SeguimientosClientesProps {
  reportes: Reporte[];
  onRefrescar?: () => void; // Para recargar datos en el padre
  onChat?: (cliente: any) => void;
}

/**
 * Modal interno donde se fusionan:
 * - Actualizar el estado del cliente
 * - Crear un nuevo reporte
 * - Marcar COMPLETADO el reporte actual
 */
function ModalCompletarActualizar({
  reporte,
  onClose,
  onRefrescar
}: {
  reporte: Reporte;
  onClose: () => void;
  onRefrescar?: () => void;
}) {
  const [nuevoEstado, setNuevoEstado] = useState('SEGUIMIENTO');
  const [comentario, setComentario] = useState('');
  const [requiereSeguimiento, setRequiereSeguimiento] = useState(false);
  const [fechaSeguimiento, setFechaSeguimiento] = useState('');
  const [loading, setLoading] = useState(false);

  // Función que hace las 3 operaciones
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fechaEpoch = requiereSeguimiento && fechaSeguimiento
        ? Math.floor(new Date(fechaSeguimiento).getTime() / 1000)
        : null;

      // 1) Insertar un nuevo reporte
      // 1) Insertar el nuevo reporte
      await apiClient.request('/GERSSON_REPORTES', 'POST', {
        ID_CLIENTE: reporte.ID_CLIENTE,
        ID_ASESOR: reporte.ID_ASESOR,
        ESTADO_ANTERIOR: reporte.ESTADO_NUEVO, // o lo que consideres
        ESTADO_NUEVO: nuevoEstado,
        COMENTARIO: comentario,
        NOMBRE_ASESOR: reporte.NOMBRE_ASESOR, // o el nombre del asesor actual
        FECHA_REPORTE: Math.floor(Date.now() / 1000),
        FECHA_SEGUIMIENTO: fechaEpoch,
      });

      // 2) Actualizar el estado del cliente
      await apiClient.request(
        `/GERSSON_CLIENTES?ID=eq.${reporte.ID_CLIENTE}`,
        'PATCH',
        { ESTADO: nuevoEstado }
      );

      // 3) Marcar como COMPLETADO el reporte que estamos manejando
      await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        { COMPLETADO: true }
      );

      // Si el padre nos pasó un callback, refrescamos
      if (onRefrescar) {
        onRefrescar();
      }

      onClose();
    } catch (error) {
      console.error('Error al completar y actualizar:', error);
      alert('Error al completar y actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 overflow-auto flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-500"
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Completar y Actualizar
        </h2>

        <form onSubmit={handleGuardar} className="space-y-4">
          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              required
            >
              <option value="SEGUIMIENTO">En Seguimiento</option>
              <option value="ESPERANDO RESPUESTA">Esperando respuesta</option>
              <option value="NO CONTACTAR">No Contactar</option>
              <option value="NO CONTESTÓ">No Contestó</option>
            </select>
          </div>

          {/* Comentario */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comentario
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              rows={3}
              required
            />
          </div>

          {/* Check de Seguimiento */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requiereSeguimiento}
              onChange={(e) => setRequiereSeguimiento(e.target.checked)}
            />
            <label>¿Requiere nueva fecha de seguimiento?</label>
          </div>

          {requiereSeguimiento && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha de Seguimiento
              </label>
              <input
                type="datetime-local"
                value={fechaSeguimiento}
                onChange={(e) => setFechaSeguimiento(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center justify-center"
            >
              {loading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SeguimientosClientes({
  reportes,
  onRefrescar,
  onChat
}: SeguimientosClientesProps) {
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  // Estado para abrir/cerrar modal de Completar+Actualizar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null);

  // Estado para mostrar menú mobile
  const [reporteAcciones, setReporteAcciones] = useState<number | null>(null);

  // Abrir modal
  const handleAbrirModal = (reporte: Reporte) => {
    setReporteSeleccionado(reporte);
    setModalAbierto(true);
  };

  // Cerrar modal
  const handleCerrarModal = () => {
    setReporteSeleccionado(null);
    setModalAbierto(false);
  };

  // Función para abrir WhatsApp
  const abrirWhatsApp = (numero: string) => {
    if (!numero) return;
    const numeroLimpio = numero.replace(/\D/g, '');
    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
  };

  // Excluir clientes con venta reportada (PAGADO)
  const clientesConVenta = new Set(
    reportes
      .filter(r => r.ESTADO_NUEVO === 'PAGADO')
      .map(r => r.ID_CLIENTE)
  );

  // Filtrar reportes
  const reportesFiltrados = reportes.filter(reporte => {
    // No mostrar clientes pagados
    if (clientesConVenta.has(reporte.ID_CLIENTE)) return false;
    // Mostrar solo los que tienen fecha de seguimiento
    if (!reporte.FECHA_SEGUIMIENTO) return false;
    return mostrarCompletados ? reporte.COMPLETADO : !reporte.COMPLETADO;
  });

  // Agrupar por fecha
  const reportesPorFecha = reportesFiltrados.reduce((acc, reporte) => {
    if (!reporte.FECHA_SEGUIMIENTO) return acc;
    const fechaStr = new Date(reporte.FECHA_SEGUIMIENTO * 1000).toDateString();
    if (!acc[fechaStr]) {
      acc[fechaStr] = [];
    }
    acc[fechaStr].push(reporte);
    return acc;
  }, {} as Record<string, Reporte[]>);

  // Ordenar fechas
  const fechasOrdenadas = Object.keys(reportesPorFecha).sort((a, b) =>
    mostrarCompletados
      ? new Date(b).getTime() - new Date(a).getTime() // descendente para completados
      : new Date(a).getTime() - new Date(b).getTime() // ascendente para pendientes
  );

  // Contar seguimientos
  const contarSeguimientos = (completados: boolean) => {
    return reportes.filter((r) => {
      // Excluir sin FECHA_SEGUIMIENTO o con cliente pagado
      if (!r.FECHA_SEGUIMIENTO) return false;
      if (clientesConVenta.has(r.ID_CLIENTE)) return false;

      if (completados) {
        // Contar solo si COMPLETADO == true
        return r.COMPLETADO === true;
      } else {
        // Contar COMPLETADO == false o null como "pendiente"
        return r.COMPLETADO === false || r.COMPLETADO == null;
      }
    }).length;
  };

  return (
    <div className="space-y-4">
      {/* Modal de Completar + Actualizar */}
      {modalAbierto && reporteSeleccionado && (
        <ModalCompletarActualizar
          reporte={reporteSeleccionado}
          onClose={handleCerrarModal}
          onRefrescar={onRefrescar}
        />
      )}

      {/* Encabezado y Filtro */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {mostrarCompletados ? 'Historial de Seguimientos' : 'Seguimientos Pendientes'}
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${mostrarCompletados
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
                }`}
            >
              {mostrarCompletados
                ? `${contarSeguimientos(true)} Completados`
                : `${contarSeguimientos(false)} Pendientes`}
            </span>
          </div>

          <button
            onClick={() => setMostrarCompletados(!mostrarCompletados)}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${mostrarCompletados
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
          <div
            key={fecha}
            className="bg-white rounded-lg shadow overflow-hidden"
          >
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
                  className={`p-4 ${reporte.COMPLETADO ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Encabezado y botones */}
                    <div className="flex justify-between items-start">
                      {/* Info del cliente */}
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {reporte.cliente?.NOMBRE}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              reporte.COMPLETADO
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {reporte.COMPLETADO
                              ? 'Completado'
                              : formatTime(reporte.FECHA_SEGUIMIENTO)}
                          </span>
                          <span className="text-sm text-gray-500">
                            Estado: {reporte.ESTADO_NUEVO}
                          </span>
                        </div>
                      </div>

                      {/* Botones desktop */}
                      <div className="hidden sm:flex sm:items-center sm:space-x-2">
                        <button
                          onClick={() => abrirWhatsApp(reporte.cliente?.WHATSAPP || '')}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Contactar
                        </button>
                        {onChat && reporte.cliente && (
                          <button
                            onClick={() => onChat(reporte.cliente)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Chat
                          </button>
                        )}
                        {!reporte.COMPLETADO && (
                          <button
                            onClick={() => handleAbrirModal(reporte)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Completar
                          </button>
                        )}
                      </div>

                      {/* Botón menú mobile */}
                      <button
                        onClick={() => setReporteAcciones(reporteAcciones === reporte.ID ? null : reporte.ID)}
                        className="sm:hidden p-1 hover:bg-gray-100 rounded-full"
                      >
                        <Menu className="h-5 w-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Comentario */}
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-600">
                        {reporte.COMENTARIO}
                      </p>
                    </div>

                    {/* Menú mobile */}
                    {reporteAcciones === reporte.ID && (
                      <div className="sm:hidden flex flex-col gap-2">
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
                        {onChat && reporte.cliente && (
                          <button
                            onClick={() => {
                              onChat(reporte.cliente);
                              setReporteAcciones(null);
                            }}
                            className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </button>
                        )}
                        {!reporte.COMPLETADO && (
                          <button
                            onClick={() => {
                              handleAbrirModal(reporte);
                              setReporteAcciones(null);
                            }}
                            className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Completar y Actualizar
                          </button>
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
