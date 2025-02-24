import React, { useMemo } from 'react';
import { Cliente, Registro, Reporte } from '../types';

interface FuentesAnalysisPorAsesorProps {
  clientes: Cliente[];
  registros: Registro[] | null;
  reportes: Reporte[]; // Se usa para determinar cierres
  asesorId: number;
}

export default function FuentesAnalysisPorAsesor({
  clientes,
  registros,
  reportes,
  asesorId,
}: FuentesAnalysisPorAsesorProps) {
  // Filtrar clientes asignados al asesor
  const clientesAsesor = useMemo(() => {
    const filtrados = clientes.filter(cliente => cliente.ID_ASESOR === asesorId);
    console.log(`Clientes asignados al asesor ${asesorId}:`, filtrados);
    return filtrados;
  }, [clientes, asesorId]);

  // Aseguramos que 'registros' sea un arreglo
  const registrosSafe = registros || [];
  console.log('Registros recibidos:', registrosSafe);

  // Función para convertir FECHA_EVENTO
  const parseFechaEvento = (fechaEvento: any): number => {
    let t = new Date(fechaEvento).getTime();
    if (isNaN(t)) {
      console.log(`FechaEvento "${fechaEvento}" inválida con new Date(), se asume timestamp en segundos.`);
      t = Number(fechaEvento) * 1000;
    }
    return t;
  };

  // Para cada cliente, obtener su primer registro por FECHA_EVENTO
  const fuentePorCliente = useMemo(() => {
    const mapa: Record<number, string> = {};
    clientesAsesor.forEach(cliente => {
      const registrosCliente = registrosSafe.filter(r => r.ID_CLIENTE === cliente.ID);
      console.log(`Cliente ${cliente.ID} tiene registros:`, registrosCliente);
      if (registrosCliente.length > 0) {
        registrosCliente.sort((a, b) => parseFechaEvento(a.FECHA_EVENTO) - parseFechaEvento(b.FECHA_EVENTO));
        const primerRegistro = registrosCliente[0];
        console.log(`Primer registro para cliente ${cliente.ID}:`, primerRegistro);
        let fuente = primerRegistro.TIPO_EVENTO;
        if (typeof fuente === 'string') {
          fuente = fuente.trim();
        }
        console.log(`Fuente para cliente ${cliente.ID}: "${fuente}"`);
        mapa[cliente.ID] = fuente && fuente !== '' ? fuente : 'Desconocido';
      } else {
        console.log(`Cliente ${cliente.ID} no tiene registros.`);
        mapa[cliente.ID] = 'Desconocido';
      }
    });
    console.log('Mapa de fuente por cliente:', mapa);
    return mapa;
  }, [clientesAsesor, registrosSafe]);

  // Agrupar clientes por fuente y calcular estadísticas
  const fuentesStats = useMemo(() => {
    const stats = clientesAsesor.reduce((acc, cliente) => {
      const fuente = fuentePorCliente[cliente.ID] || 'Desconocido';
      if (!acc[fuente]) {
        acc[fuente] = { total: 0, cerrados: 0 };
      }
      acc[fuente].total += 1;
      // Se considera cerrado si existe al menos un reporte con ESTADO_NUEVO === 'PAGADO'
      const reportesCliente = reportes.filter(r => r.ID_CLIENTE === cliente.ID);
      console.log(`Reportes para cliente ${cliente.ID}:`, reportesCliente);
      if (reportesCliente.some(r => r.ESTADO_NUEVO === 'PAGADO')) {
        acc[fuente].cerrados += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; cerrados: number }>);
    console.log('Estadísticas por fuente:', stats);
    return stats;
  }, [clientesAsesor, fuentePorCliente, reportes]);

  // Totales globales para este asesor
  const totalesGlobales = useMemo(() => {
    let total = 0;
    let cerrados = 0;
    Object.values(fuentesStats).forEach(({ total: t, cerrados: c }) => {
      total += t;
      cerrados += c;
    });
    const tasa = total > 0 ? (cerrados / total) * 100 : 0;
    console.log('Totales globales:', { total, cerrados, tasa });
    return { total, cerrados, tasa };
  }, [fuentesStats]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Análisis por Fuente de Ingreso</h2>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-4 py-2 border-b text-left">Fuente</th>
            <th className="px-4 py-2 border-b text-center">Clientes Asignados</th>
            <th className="px-4 py-2 border-b text-center">Cierres</th>
            <th className="px-4 py-2 border-b text-center">Tasa de Cierre (%)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(fuentesStats).map(([fuente, { total, cerrados }]) => (
            <tr key={fuente}>
              <td className="px-4 py-2 border-b">{fuente}</td>
              <td className="px-4 py-2 border-b text-center">{total}</td>
              <td className="px-4 py-2 border-b text-center">{cerrados}</td>
              <td className="px-4 py-2 border-b text-center">
                {total > 0 ? ((cerrados / total) * 100).toFixed(1) : '0.0'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className="px-4 py-2 border-t">Global</td>
            <td className="px-4 py-2 border-t text-center">{totalesGlobales.total}</td>
            <td className="px-4 py-2 border-t text-center">{totalesGlobales.cerrados}</td>
            <td className="px-4 py-2 border-t text-center">
              {totalesGlobales.tasa.toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
