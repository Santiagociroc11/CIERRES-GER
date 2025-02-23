import React, { useState } from 'react';
import { Cliente, Reporte, Asesor, EstadisticasDetalladas } from '../types';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Search, 
  Filter,
  ArrowLeft,
  BarChart,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { formatDateOnly } from '../utils/dateUtils';
import ListaGeneralClientes from './ListaGeneralClientes';

interface DetalleAsesorProps {
  asesor: Asesor;
  estadisticas: EstadisticasDetalladas;
  clientes: Cliente[];
  reportes: Reporte[];
  promedioEquipo: {
    tasaCierre: number;
    tiempoRespuesta: number;
    ventasPorMes: number;
  };
  onBack: () => void;
}

export default function DetalleAsesor({
  asesor,
  estadisticas,
  clientes,
  reportes,
  promedioEquipo,
  onBack
}: DetalleAsesorProps) {
  const [vistaActual, setVistaActual] = useState<'general' | 'clientes' | 'metricas'>('general');

  // Calcular distribución de estados
  const distribucionEstados = clientes.reduce((acc, cliente) => {
    acc[cliente.ESTADO] = (acc[cliente.ESTADO] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calcular tendencias
  const tendencias = {
    ventasUltimaSemana: reportes.filter(r => {
      const fecha = new Date(r.FECHA_REPORTE * 1000);
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
      return r.ESTADO_NUEVO === 'PAGADO' && fecha >= haceUnaSemana;
    }).length,
    seguimientosCompletados: reportes.filter(r => r.COMPLETADO).length,
    clientesNuevos: clientes.filter(c => {
      const fecha = new Date(c.FECHA_CREACION * 1000);
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
      return fecha >= haceUnaSemana;
    }).length
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="h-6 w-6 text-gray-500" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{asesor.NOMBRE}</h2>
            <p className="text-sm text-gray-500">WhatsApp: {asesor.WHATSAPP}</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setVistaActual('general')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            vistaActual === 'general'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Vista General
        </button>
        <button
          onClick={() => setVistaActual('clientes')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            vistaActual === 'clientes'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Clientes
        </button>
        <button
          onClick={() => setVistaActual('metricas')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            vistaActual === 'metricas'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Métricas Avanzadas
        </button>
      </div>

      {vistaActual === 'general' && (
        <div className="space-y-6">
          {/* KPIs Principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tasa de Cierre</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {estadisticas.porcentajeCierre.toFixed(1)}%
                  </p>
                </div>
                <div className={`text-sm ${
                  estadisticas.porcentajeCierre > promedioEquipo.tasaCierre
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  vs {promedioEquipo.tasaCierre.toFixed(1)}% equipo
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tiempo Respuesta</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {estadisticas.tiempoPromedioHastaReporte.toFixed(1)}h
                  </p>
                </div>
                <div className={`text-sm ${
                  estadisticas.tiempoPromedioHastaReporte < promedioEquipo.tiempoRespuesta
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  vs {promedioEquipo.tiempoRespuesta.toFixed(1)}h equipo
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ventas del Mes</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {estadisticas.ventasPorMes}
                  </p>
                </div>
                <div className={`text-sm ${
                  estadisticas.ventasPorMes > promedioEquipo.ventasPorMes
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  vs {promedioEquipo.ventasPorMes.toFixed(1)} equipo
                </div>
              </div>
            </div>
          </div>

          {/* Tendencias */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Tendencias Últimos 7 Días
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Ventas</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {tendencias.ventasUltimaSemana}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Seguimientos Completados</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {tendencias.seguimientosCompletados}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Clientes Nuevos</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {tendencias.clientesNuevos}
                </p>
              </div>
            </div>
          </div>

          {/* Distribución de Estados */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Distribución de Estados
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {Object.entries(distribucionEstados).map(([estado, cantidad]) => (
                  <div key={estado}>
                    <div className="flex justify-between text-sm font-medium">
                      <span>{estado}</span>
                      <span>{cantidad}</span>
                    </div>
                    <div className="mt-1 relative pt-1">
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                        <div
                          style={{ width: `${(cantidad / clientes.length) * 100}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {vistaActual === 'clientes' && (
        <ListaGeneralClientes
          clientes={clientes}
          reportes={reportes}
          onActualizarEstado={() => {}}
          onReportarVenta={() => {}}
          readOnly
        />
      )}

      {vistaActual === 'metricas' && (
        <div className="space-y-6">
          {/* Métricas de Tiempo */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Métricas de Tiempo
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Tiempo Promedio Hasta Primer Reporte
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {estadisticas.tiempoPromedioHastaReporte.toFixed(1)} horas
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Tiempo Promedio Hasta Venta
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {estadisticas.tiempoPromedioHastaVenta.toFixed(1)} horas
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas de Calidad */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Métricas de Calidad
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Reportes por Cliente
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {estadisticas.reportesPorCliente.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Reportes con Seguimiento
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {estadisticas.reportesConSeguimiento}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Monto Promedio de Venta
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    ${estadisticas.montoPromedioVenta.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}