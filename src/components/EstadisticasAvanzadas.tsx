import React from 'react';
import { Cliente, Reporte, EstadisticasAsesor } from '../types';
import { 
  BarChart as BarChartIcon, 
  TrendingUp, 
  Clock, 
  Target,
  Calendar,
  Users,
  DollarSign
} from 'lucide-react';
import { formatDateOnly } from '../utils/dateUtils';

interface EstadisticasAvanzadasProps {
  estadisticas: EstadisticasAsesor;
  reportes: Reporte[];
  clientes: Cliente[];
}

export default function EstadisticasAvanzadas({
  estadisticas,
  reportes,
  clientes
}: EstadisticasAvanzadasProps) {
  // Calcular ventas por día de la semana
  const ventasPorDia = reportes
    .filter(r => r.ESTADO_NUEVO === 'PAGADO')
    .reduce((acc, reporte) => {
      const fecha = new Date(reporte.FECHA_REPORTE * 1000);
      const dia = fecha.toLocaleDateString('es-ES', { weekday: 'long' });
      acc[dia] = (acc[dia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Calcular efectividad por hora
  const efectividadPorHora = reportes
    .filter(r => r.COMPLETADO)
    .reduce((acc, reporte) => {
      const fecha = new Date(reporte.FECHA_REPORTE * 1000);
      const hora = fecha.getHours();
      acc[hora] = (acc[hora] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Obtener últimas ventas
  const ultimasVentas = reportes
    .filter(r => r.ESTADO_NUEVO === 'PAGADO')
    .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* KPIs Principales - Grid responsivo 2x2 en móvil, 4x1 en desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Conversión</p>
              <p className="text-xl md:text-2xl font-semibold text-gray-900">
                {estadisticas.porcentajeCierre.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-green-500" />
          </div>
          <p className="mt-1 text-xs md:text-sm text-gray-600">
            De {estadisticas.totalClientes} clientes
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">T. Promedio</p>
              <p className="text-xl md:text-2xl font-semibold text-gray-900">
                {estadisticas.tiempoPromedioConversion.toFixed(1)}d
              </p>
            </div>
            <Clock className="h-6 w-6 md:h-8 md:w-8 text-blue-500" />
          </div>
          <p className="mt-1 text-xs md:text-sm text-gray-600">
            Hasta venta
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Respuesta</p>
              <p className="text-xl md:text-2xl font-semibold text-gray-900">
                {estadisticas.tasaRespuesta.toFixed(1)}%
              </p>
            </div>
            <Target className="h-6 w-6 md:h-8 md:w-8 text-purple-500" />
          </div>
          <p className="mt-1 text-xs md:text-sm text-gray-600">
            Seguimientos
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Ventas Mes</p>
              <p className="text-xl md:text-2xl font-semibold text-gray-900">
                {estadisticas.ventasPorMes}
              </p>
            </div>
            <Calendar className="h-6 w-6 md:h-8 md:w-8 text-yellow-500" />
          </div>
          <p className="mt-1 text-xs md:text-sm text-gray-600">
            Este mes
          </p>
        </div>
      </div>

      {/* Gráficos y Análisis - Apilados en móvil, lado a lado en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ventas por Día */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <BarChartIcon className="h-5 w-5 text-blue-500 mr-2" />
              Ventas por Día
            </h3>
          </div>
          <div className="p-4 space-y-3 overflow-x-auto">
            {Object.entries(ventasPorDia).map(([dia, cantidad]) => (
              <div key={dia} className="flex items-center min-w-[250px]">
                <div className="w-20 text-sm text-gray-600 capitalize">
                  {dia.slice(0, 3)}
                </div>
                <div className="flex-1 mx-2">
                  <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="absolute h-full bg-blue-500 rounded transition-all duration-300"
                      style={{ 
                        width: `${(cantidad / Math.max(...Object.values(ventasPorDia))) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                <div className="w-8 text-right text-sm text-gray-600">
                  {cantidad}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Efectividad por Hora */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Clock className="h-5 w-5 text-green-500 mr-2" />
              Efectividad por Hora
            </h3>
          </div>
          <div className="p-4 space-y-3 overflow-x-auto">
            {Object.entries(efectividadPorHora)
              .sort(([horaA], [horaB]) => parseInt(horaA) - parseInt(horaB))
              .map(([hora, cantidad]) => (
                <div key={hora} className="flex items-center min-w-[250px]">
                  <div className="w-16 text-sm text-gray-600">
                    {`${hora}:00`}
                  </div>
                  <div className="flex-1 mx-2">
                    <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
                      <div 
                        className="absolute h-full bg-green-500 rounded transition-all duration-300"
                        style={{ 
                          width: `${(cantidad / Math.max(...Object.values(efectividadPorHora))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-8 text-right text-sm text-gray-600">
                    {cantidad}
                  </div>
                </div>
            ))}
          </div>
        </div>
      </div>

      {/* Últimas Ventas - Diseño adaptativo */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 text-green-500 mr-2" />
            Últimas Ventas
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {ultimasVentas.map((venta) => (
            <div key={venta.ID} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{venta.cliente?.NOMBRE}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{venta.COMENTARIO}</p>
                </div>
                <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  {formatDateOnly(venta.FECHA_REPORTE)}
                </div>
              </div>
            </div>
          ))}
          {ultimasVentas.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No hay ventas registradas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}