import React, { useMemo } from 'react';
import { Cliente, Registro, Reporte } from '../types';

interface FuentesAnalysisPorAsesorProps {
  clientes: Cliente[];
  registros: Registro[] | null;
  reportes: Reporte[];
  asesorId: number;
}

export default function FuentesAnalysisPorAsesor({
  clientes,
  registros,
  reportes,
  asesorId,
}: FuentesAnalysisPorAsesorProps) {
  const clientesAsesor = useMemo(
    () => clientes.filter(cliente => cliente.ID_ASESOR === asesorId),
    [clientes, asesorId]
  );

  const registrosSafe = registros || [];

  const parseFechaEvento = (fechaEvento: any): number => {
    let t = new Date(fechaEvento).getTime();
    if (isNaN(t)) t = Number(fechaEvento) * 1000; // Si es un timestamp en segundos
    return t;
  };

  const fuentePorCliente = useMemo(() => {
    return clientesAsesor.reduce((mapa, cliente) => {
      const registrosCliente = registrosSafe.filter(r => r.ID_CLIENTE === cliente.ID);
      if (registrosCliente.length > 0) {
        registrosCliente.sort((a, b) => parseFechaEvento(a.FECHA_EVENTO) - parseFechaEvento(b.FECHA_EVENTO));
        mapa[cliente.ID] = registrosCliente[0].TIPO_EVENTO?.trim() || 'Desconocido';
      } else {
        mapa[cliente.ID] = 'Desconocido';
      }
      return mapa;
    }, {} as Record<number, string>);
  }, [clientesAsesor, registrosSafe]);

  const fuentesStats = useMemo(() => {
    return clientesAsesor.reduce((acc, cliente) => {
      const fuente = fuentePorCliente[cliente.ID] || 'Desconocido';
      if (!acc[fuente]) acc[fuente] = { total: 0, cerrados: 0 };
      acc[fuente].total += 1;
      if (reportes.some(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'PAGADO')) {
        acc[fuente].cerrados += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; cerrados: number }>);
  }, [clientesAsesor, fuentePorCliente, reportes]);

  const totalesGlobales = useMemo(() => {
    const total = Object.values(fuentesStats).reduce((sum, fuente) => sum + fuente.total, 0);
    const cerrados = Object.values(fuentesStats).reduce((sum, fuente) => sum + fuente.cerrados, 0);
    return { total, cerrados, tasa: total > 0 ? (cerrados / total) * 100 : 0 };
  }, [fuentesStats]);

  const getTasaCierreColor = (tasa: number) => {
    if (tasa >= 50) return 'text-green-600 font-semibold';
    if (tasa >= 20) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center">📊 Análisis de Fuentes</h2>
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
          {Object.entries(fuentesStats).map(([fuente, { total, cerrados }]) => (
            <tr key={fuente} className="border-b">
              <td className="px-6 py-4">{fuente}</td>
              <td className="px-6 py-4 text-center">{total}</td>
              <td className="px-6 py-4 text-center">{cerrados}</td>
              <td className={`px-6 py-4 text-center ${getTasaCierreColor((cerrados / total) * 100)}`}>
                {total > 0 ? ((cerrados / total) * 100).toFixed(1) : '0.0'}
              </td>
            </tr>
          ))}
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
  );
}
