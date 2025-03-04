import React, { useMemo } from 'react';
import { Cliente, Registro, Reporte } from '../types';

interface FuentesAnalysisPorAsesorProps {
  clientes: Cliente[];
  registros: Registro[] | null;
  reportes: Reporte[];
  asesorId: number;
  teamStatsByFuente: Record<string, number>;
  bestRateByFuente: Record<string, number>;
}

export default function FuentesAnalysisPorAsesor({
  clientes,
  registros,
  reportes,
  asesorId,
  teamStatsByFuente,
  bestRateByFuente,
}: FuentesAnalysisPorAsesorProps) {
  // Filtramos solo los clientes del asesor actual
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

  // Estadísticas del asesor por fuente
  const fuentesStats = useMemo(() => {
    return clientesAsesor.reduce((acc, cliente) => {
      const fuente = getFuente(cliente.ID);
      if (!acc[fuente]) acc[fuente] = { total: 0, cerrados: 0 };
      acc[fuente].total += 1;
      if (reportes.some(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'PAGADO')) {
        acc[fuente].cerrados += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; cerrados: number }>);
  }, [clientesAsesor, reportes, registrosSafe]);

  const getTasaCierreColor = (tasa: number) => {
    if (tasa >= 50) return 'text-green-600 font-semibold';
    if (tasa >= 20) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const totalesGlobales = useMemo(() => {
    const total = Object.values(fuentesStats).reduce((sum, stats) => sum + stats.total, 0);
    const cerrados = Object.values(fuentesStats).reduce((sum, stats) => sum + stats.cerrados, 0);
    return { total, cerrados, tasa: total > 0 ? (cerrados / total) * 100 : 0 };
  }, [fuentesStats]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center">📊 Análisis de Fuentes</h2>

      <div className="my-4 p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-lg">
          Tu tasa de conversión: <span className="font-bold">{totalesGlobales.tasa.toFixed(1)}%</span>
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
                <th className="px-6 py-3 text-center">Cierres</th>
                <th className="px-6 py-3 text-center">Tasa de Cierre (%)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fuentesStats).map(([fuente, { total, cerrados }]) => {
                const tasaAsesor = total > 0 ? (cerrados / total) * 100 : 0;
                const tasaEquipo = teamStatsByFuente[fuente] || 0;
                const tasaMejor = bestRateByFuente[fuente] || 0;
                return (
                  <tr key={fuente} className="border-b">
                    <td className="px-6 py-4">{fuente}</td>
                    <td className="px-6 py-4 text-center">{total}</td>
                    <td className="px-6 py-4 text-center">{cerrados}</td>
                    <td className={`px-6 py-4 text-center ${getTasaCierreColor(tasaAsesor)}`}>
                      {tasaAsesor.toFixed(1)}%
                      <br />
                      <span className="text-xs text-gray-500">
                        vs Equipo: {tasaEquipo.toFixed(1)}% | Mejor: {tasaMejor.toFixed(1)}%
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
        {Object.entries(fuentesStats).map(([fuente, { total, cerrados }]) => {
          const tasaAsesor = total > 0 ? (cerrados / total) * 100 : 0;
          const tasaEquipo = teamStatsByFuente[fuente] || 0;
          const tasaMejor = bestRateByFuente[fuente] || 0;
          return (
            <div key={fuente} className="bg-white shadow-md rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800">{fuente}</h3>
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm text-gray-600">
                  Clientes: <span className="font-medium">{total}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Cierres: <span className="font-medium">{cerrados}</span>
                </div>
              </div>
              <div className={`mt-2 text-lg ${getTasaCierreColor(tasaAsesor)}`}>
                {tasaAsesor.toFixed(1)}%
                <br />
                <span className="text-xs text-gray-500">
                  vs Equipo: {tasaEquipo.toFixed(1)}% | Mejor: {tasaMejor.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
