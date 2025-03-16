import React from 'react';
import { Cliente, Reporte, EstadisticasAsesor } from '../types';
import {
  TrendingUp,
  Clock,
  Target,
  Calendar,
  Users,
  DollarSign
} from 'lucide-react';
import { formatDateOnly } from '../utils/dateUtils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

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
  // Calcular ventas por día para producto PRINCIPAL
  const ventasPorDiaPrincipal = reportes
    .filter(r => r.ESTADO_NUEVO === 'PAGADO' && r.PRODUCTO === 'PRINCIPAL')
    .reduce((acc, reporte) => {
      const fecha = new Date(reporte.FECHA_REPORTE * 1000);
      const dia = fecha.toLocaleDateString('es-ES', { weekday: 'long' });
      acc[dia] = (acc[dia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Calcular ventas por día para producto DOWNSELL
  const ventasPorDiaDownsell = reportes
    .filter(r => r.ESTADO_NUEVO === 'PAGADO' && r.PRODUCTO === 'DOWNSELL')
    .reduce((acc, reporte) => {
      const fecha = new Date(reporte.FECHA_REPORTE * 1000);
      const dia = fecha.toLocaleDateString('es-ES', { weekday: 'long' });
      acc[dia] = (acc[dia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Generar datos para el gráfico apilado
  const diasUnicos = Array.from(new Set([
    ...Object.keys(ventasPorDiaPrincipal),
    ...Object.keys(ventasPorDiaDownsell)
  ]));
  const datosVentas = diasUnicos.map(dia => ({
    day: dia.slice(0, 3), // abreviatura del día
    principal: ventasPorDiaPrincipal[dia] || 0,
    downsell: ventasPorDiaDownsell[dia] || 0,
  }));

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

    acc[hora].total++;

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

    if (reporte.ESTADO_ANTERIOR === 'SEGUIMIENTO' || reporte.ESTADO_NUEVO === 'PAGADO') {
      acc[hora].total++;

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

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col">
            <p className="text-sm font-medium text-gray-500">Ventas del Mes</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{estadisticas.ventasPorMes}</p>
            <div className="mt-2 text-sm">
              <span className="font-medium text-green-600">Principal: {estadisticas.ventasPrincipal}</span>
              <br />
              <span className="font-medium text-blue-600">Downsell: {estadisticas.ventasDownsell}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Ventas por Día (Stacked) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <BarChart className="h-5 w-5 text-blue-500 mr-2" />
            Ventas por Día (Apilado)
          </h3>
        </div>
        <div className="p-4">
          {datosVentas.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosVentas}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="principal" stackId="a" fill="#4ade80" name="Principal" />
                <Bar dataKey="downsell" stackId="a" fill="#60a5fa" name="Downsell" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No hay datos de ventas.</p>
          )}
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
                .filter(([_, porcentaje]) => porcentaje > 0)
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
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {venta.COMENTARIO} {venta.PRODUCTO ? `(${venta.PRODUCTO})` : ''}
                  </p>
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
