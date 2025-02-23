import React from 'react';
import { Cliente, Reporte, EstadisticasAsesor } from '../types';
import { 
  BarChart, 
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

  // Calcular efectividad de reportes por hora
  const efectividadReportes = reportes.reduce((acc, reporte) => {
    const fecha = new Date(reporte.FECHA_REPORTE * 1000);
    const hora = fecha.getHours();
    
    if (!acc[hora]) {
      acc[hora] = {
        total: 0,
        exitosos: 0
      };
    }
    
    // Incrementar total de reportes para esta hora
    acc[hora].total++;
    
    // Un reporte es exitoso si generó seguimiento
    if (reporte.FECHA_SEGUIMIENTO) {
      acc[hora].exitosos++;
    }
    
    return acc;
  }, {} as Record<number, { total: number; exitosos: number }>);

  // Calcular efectividad de ventas por hora
  const efectividadVentas = reportes.reduce((acc, reporte) => {
    const fecha = new Date(reporte.FECHA_REPORTE * 1000);
    const hora = fecha.getHours();
    
    if (!acc[hora]) {
      acc[hora] = {
        total: 0,
        exitosos: 0
      };
    }
    
    // Contar todos los reportes de seguimiento o ventas
    if (reporte.ESTADO_ANTERIOR === 'SEGUIMIENTO' || reporte.ESTADO_NUEVO === 'PAGADO') {
      acc[hora].total++;
      
      // Contar como exitoso si es una venta
      if (reporte.ESTADO_NUEVO === 'PAGADO') {
        acc[hora].exitosos++;
      }
    }
    
    return acc;
  }, {} as Record<number, { total: number; exitosos: number }>);

  // Convertir efectividad a porcentajes
  const efectividadReportesPorcentaje = Object.entries(efectividadReportes)
    .reduce((acc, [hora, datos]) => {
      acc[parseInt(hora)] = datos.total > 0 ? Math.round((datos.exitosos / datos.total) * 100) : 0;
      return acc;
    }, {} as Record<number, number>);

  const efectividadVentasPorcentaje = Object.entries(efectividadVentas)
    .reduce((acc, [hora, datos]) => {
      acc[parseInt(hora)] = datos.total > 0 ? Math.round((datos.exitosos / datos.total) * 100) : 0;
      return acc;
    }, {} as Record<number, number>);

  // Obtener últimas ventas
  const ultimasVentas = reportes
    .filter(r => r.ESTADO_NUEVO === 'PAGADO')
    .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* KPIs Principales */}
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

      {/* Gráficos y Análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ventas por Día */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <BarChart className="h-5 w-5 text-blue-500 mr-2" />
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
          <div className="p-4">
            {/* Efectividad de Reportes */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Efectividad de Reportes (% que generan seguimiento)
              </h4>
              <div className="space-y-3 overflow-x-auto">
                {Object.entries(efectividadReportesPorcentaje)
                  .sort(([horaA], [horaB]) => parseInt(horaA) - parseInt(horaB))
                  .map(([hora, porcentaje]) => (
                    <div key={`reporte-${hora}`} className="flex items-center min-w-[250px]">
                      <div className="w-16 text-sm text-gray-600">
                        {`${hora}:00`}
                      </div>
                      <div className="flex-1 mx-2">
                        <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
                          <div 
                            className="absolute h-full bg-blue-500 rounded transition-all duration-300"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm text-gray-600">
                        {`${porcentaje}%`}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Efectividad de Ventas */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Efectividad de Ventas (% de interacciones que resultan en venta)
              </h4>
              <div className="space-y-3 overflow-x-auto">
                {Object.entries(efectividadVentasPorcentaje)
                  .sort(([horaA], [horaB]) => parseInt(horaA) - parseInt(horaB))
                  .filter(([_, porcentaje]) => porcentaje > 0) // Solo mostrar horas con actividad
                  .map(([hora, porcentaje]) => (
                    <div key={`venta-${hora}`} className="flex items-center min-w-[250px]">
                      <div className="w-16 text-sm text-gray-600">
                        {`${hora}:00`}
                      </div>
                      <div className="flex-1 mx-2">
                        <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
                          <div 
                            className="absolute h-full bg-green-500 rounded transition-all duration-300"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm text-gray-600">
                        {`${porcentaje}%`}
                      </div>
                    </div>
                  ))}
                {Object.values(efectividadVentasPorcentaje).every(p => p === 0) && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay datos suficientes para mostrar la efectividad de ventas
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Últimas Ventas */}
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