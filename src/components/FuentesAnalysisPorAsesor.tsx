import React, { useMemo } from 'react';
import { Cliente, Registro, Reporte } from '../types';

interface FuentesAnalysisPorAsesorProps {
  clientes: Cliente[];
  registros: Registro[] | null;
  reportes: Reporte[];
  asesorId: number;
  teamStatsByFuente: Record<string, number>;
  bestRateByFuente: Record<string, { rate: number; advisorName: string }>;
}

export default function FuentesAnalysisPorAsesor({
  clientes,
  registros,
  reportes,
  asesorId,
  teamStatsByFuente,
  bestRateByFuente,
}: FuentesAnalysisPorAsesorProps) {
  // Filtrar solo los clientes del asesor actual
  const clientesAsesor = useMemo(
    () => clientes.filter(cliente => cliente.ID_ASESOR === asesorId),
    [clientes, asesorId]
  );
  
  const registrosSafe = registros || [];

  const parseFechaEvento = (fechaEvento: any): number => {
    let t = new Date(fechaEvento).getTime();
    if (isNaN(t)) t = Number(fechaEvento) * 1000;
    return t;
  };

  const getFuente = (clienteId: number) => {
    const registrosCliente = registrosSafe.filter(r => r.ID_CLIENTE === clienteId);
    if (registrosCliente.length > 0) {
      registrosCliente.sort((a, b) => parseFechaEvento(a.FECHA_EVENTO) - parseFechaEvento(b.FECHA_EVENTO));
      return registrosCliente[0].TIPO_EVENTO?.trim() || 'Desconocido';
    }
    return 'Desconocido';
  };

  // Acumular estadísticas por fuente, manteniendo lo actual y agregando la separación de cierres
  const fuentesStats = useMemo(() => {
    return clientesAsesor.reduce((acc, cliente) => {
      const fuente = getFuente(cliente.ID);
      if (!acc[fuente]) {
        acc[fuente] = { total: 0, cerrados: 0, cerradosPrincipal: 0, cerradosDownsell: 0 };
      }
      acc[fuente].total += 1;
      // Se cuenta cierre si hay reporte con ESTADO_NUEVO === 'PAGADO'
      if (
        reportes.some(
          r =>
            r.ID_CLIENTE === cliente.ID &&
            r.ESTADO_NUEVO === 'PAGADO'
        )
      ) {
        // Para compatibilidad, sumamos en 'cerrados'
        acc[fuente].cerrados += 1;
      }
      // Ahora, diferenciamos según PRODUCTO
      if (
        reportes.some(
          r =>
            r.ID_CLIENTE === cliente.ID &&
            r.ESTADO_NUEVO === 'PAGADO' &&
            r.PRODUCTO === 'PRINCIPAL'
        )
      ) {
        acc[fuente].cerradosPrincipal += 1;
      }
      if (
        reportes.some(
          r =>
            r.ID_CLIENTE === cliente.ID &&
            r.ESTADO_NUEVO === 'PAGADO' &&
            r.PRODUCTO === 'DOWNSELL'
        )
      ) {
        acc[fuente].cerradosDownsell += 1;
      }
      return acc;
    }, {} as Record<
      string,
      { total: number; cerrados: number; cerradosPrincipal: number; cerradosDownsell: number }
    >);
  }, [clientesAsesor, reportes, registrosSafe]);

  const getTasaCierreColor = (tasa: number) => {
    if (tasa >= 50) return 'text-green-600 font-semibold';
    if (tasa >= 20) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  // Totales globales
  const totalesGlobales = useMemo(() => {
    let total = 0, cerrados = 0, cerradosPrincipal = 0, cerradosDownsell = 0;
    for (const stats of Object.values(fuentesStats)) {
      total += stats.total;
      cerrados += stats.cerrados;
      cerradosPrincipal += stats.cerradosPrincipal;
      cerradosDownsell += stats.cerradosDownsell;
    }
    return {
      total,
      cerrados,
      cerradosPrincipal,
      cerradosDownsell,
      tasa: total > 0 ? (cerrados / total) * 100 : 0,
      tasaPrincipal: total > 0 ? (cerradosPrincipal / total) * 100 : 0,
      tasaDownsell: total > 0 ? (cerradosDownsell / total) * 100 : 0,
    };
  }, [fuentesStats]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center">📊 Análisis de Fuentes</h2>

      <div className="my-4 p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-lg">
          Tasa de conversión Total: <span className="font-bold">{totalesGlobales.tasa.toFixed(1)}%</span>
          <br />
          Tasa de Cierre Principal: <span className="font-bold">{totalesGlobales.tasaPrincipal.toFixed(1)}%</span>
          <br />
          Tasa de Cierre Downsell: <span className="font-bold">{totalesGlobales.tasaDownsell.toFixed(1)}%</span>
        </p>
      </div>

      {/* Vista de escritorio */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-800">
              <tr>
                <th className="px-6 py-3 text-left">Fuente</th>
                <th className="px-6 py-3 text-center">Clientes</th>
                <th className="px-6 py-3 text-center">Cierres (Total)</th>
                <th className="px-6 py-3 text-center">Cierres Principal</th>
                <th className="px-6 py-3 text-center">Cierres Downsell</th>
                <th className="px-6 py-3 text-center">Tasa de Cierre (%)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fuentesStats).map(([fuente, stats]) => {
                const { total, cerrados, cerradosPrincipal, cerradosDownsell } = stats;
                const tasaAsesor = total > 0 ? (cerrados / total) * 100 : 0;
                const tasaEquipo = teamStatsByFuente[fuente] || 0;
                const bestData = bestRateByFuente[fuente];
                const tasaMejor = bestData ? bestData.rate : 0;
                const mejorNombre = bestData ? bestData.advisorName : '-';
                return (
                  <tr key={fuente} className="border-b">
                    <td className="px-6 py-4">{fuente}</td>
                    <td className="px-6 py-4 text-center">{total}</td>
                    <td className="px-6 py-4 text-center">{cerrados}</td>
                    <td className="px-6 py-4 text-center">{cerradosPrincipal}</td>
                    <td className="px-6 py-4 text-center">{cerradosDownsell}</td>
                    <td className={`px-6 py-4 text-center ${getTasaCierreColor(tasaAsesor)}`}>
                      {tasaAsesor.toFixed(1)}%
                      <br />
                      <span className="text-xs text-gray-500">
                        vs Equipo: {tasaEquipo.toFixed(1)}% | Mejor: {tasaMejor.toFixed(1)}% - {mejorNombre}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-200">
              <tr className="font-bold">
                <td className="px-6 py-4">TOTAL</td>
                <td className="px-6 py-4 text-center">{totalesGlobales.total}</td>
                <td className="px-6 py-4 text-center">{totalesGlobales.cerrados}</td>
                <td className="px-6 py-4 text-center">{totalesGlobales.cerradosPrincipal}</td>
                <td className="px-6 py-4 text-center">{totalesGlobales.cerradosDownsell}</td>
                <td className={`px-6 py-4 text-center ${getTasaCierreColor(totalesGlobales.tasa)}`}>
                  {totalesGlobales.tasa.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Vista móvil */}
      <div className="md:hidden space-y-4">
        {Object.entries(fuentesStats).map(([fuente, stats]) => {
          const { total, cerrados, cerradosPrincipal, cerradosDownsell } = stats;
          const tasaAsesor = total > 0 ? (cerrados / total) * 100 : 0;
          const tasaEquipo = teamStatsByFuente[fuente] || 0;
          const bestData = bestRateByFuente[fuente];
          const tasaMejor = bestData ? bestData.rate : 0;
          const mejorNombre = bestData ? bestData.advisorName : '-';
          return (
            <div key={fuente} className="bg-white shadow-md rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800">{fuente}</h3>
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm text-gray-600">
                  Clientes: <span className="font-medium">{total}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm text-gray-600">
                  Cierres Principal: <span className="font-medium">{cerradosPrincipal}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Cierres Downsell: <span className="font-medium">{cerradosDownsell}</span>
                </div>
              </div>
              <div className={`mt-2 text-lg ${getTasaCierreColor(tasaAsesor)}`}>
                Total Cierres: {cerrados} ({tasaAsesor.toFixed(1)}%)
                <br />
                <span className="text-xs text-gray-500">
                  vs Equipo: {tasaEquipo.toFixed(1)}% | Mejor: {tasaMejor.toFixed(1)}% - {mejorNombre}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
