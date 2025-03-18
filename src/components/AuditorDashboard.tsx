import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asesor, Cliente, Reporte } from '../types';
import { apiClient } from '../lib/apiClient';
import { Search, LogOut, X } from 'lucide-react';
import HistorialCliente from './HistorialCliente';

// Componente memoizado para mostrar un asesor individual
const AsesorItem = React.memo(({
  asesor,
  ventasReportadas,
  ventasConsolidadas,
  onClick
}: {
  asesor: Asesor,
  ventasReportadas: number,
  ventasConsolidadas: number,
  onClick: () => void
}) => {
  const porcentajeConsolidacion = ventasReportadas > 0
    ? ((ventasConsolidadas / ventasReportadas) * 100).toFixed(1)
    : '0';

  return (
    <div
      className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
          <p className="text-sm text-gray-500">WhatsApp: {asesor.WHATSAPP}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <span className="block text-2xl font-semibold text-green-600">{ventasReportadas}</span>
            <span className="text-xs text-gray-500">Reportadas</span>
          </div>
          <div className="text-center">
            <span className="block text-2xl font-semibold text-purple-600">{ventasConsolidadas}</span>
            <span className="text-xs text-gray-500">Consolidadas</span>
          </div>
          <div className="text-center">
            <span className="block text-2xl font-semibold text-blue-600">{porcentajeConsolidacion}%</span>
            <span className="text-xs text-gray-500">Consolidación</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Versión mejorada de Levenshtein distance usando memoización interna
const memoizedLevenshtein = (() => {
  const cache = new Map();

  return (a: string, b: string): number => {
    const key = `${a}|${b}`;
    if (cache.has(key)) return cache.get(key);

    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // eliminación
          matrix[i][j - 1] + 1,      // inserción 
          matrix[i - 1][j - 1] + cost // sustitución
        );
      }
    }

    const result = matrix[a.length][b.length];
    cache.set(key, result);
    return result;
  };
})();

// Función que determina si dos clientes son similares (fuzzy) según nombre o WhatsApp
function sonSimilares(c1: Cliente, c2: Cliente, umbral = 0.8): boolean {
  const s1 = c1.NOMBRE.toLowerCase();
  const s2 = c2.NOMBRE.toLowerCase();

  // Optimización: comprobar si los nombres son idénticos
  if (s1 === s2) return true;

  // Optimización: verificar longitud para rechazar rápidamente
  const maxLen = Math.max(s1.length, s2.length);
  const minLen = Math.min(s1.length, s2.length);
  if (minLen / maxLen < umbral) return false;

  // Optimización: comprobar si WhatsApp son idénticos (si existen)
  const w1 = (c1.WHATSAPP || '').trim();
  const w2 = (c2.WHATSAPP || '').trim();
  if (w1 !== '' && w2 !== '' && w1 === w2) return true;

  // Solo si las comprobaciones rápidas fallan, calculamos la distancia
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return true;

  const dist = memoizedLevenshtein(s1, s2);
  const nombreSim = 1 - (dist / maxLength);

  return nombreSim >= umbral;
}

// Versión optimizada de la función de análisis de duplicados
const analizarDuplicadosOptimizado = (
  clientes: Cliente[],
  asesores: Asesor[]
): Cliente[][] => {
  // Crear un mapa para búsqueda rápida de asesores por ID
  const asesorMap = new Map<number, Asesor>();
  asesores.forEach(asesor => asesorMap.set(asesor.ID, asesor));

  // Solo considerar clientes con asesor asignado
  const clientesConAsesor = clientes.filter(cliente => !!cliente.ID_ASESOR);

  // Optimización: usar Map para agrupación más rápida
  const grupos: Cliente[][] = [];
  const clienteProcesado = new Set<number>();

  // Indexar clientes por las primeras letras del nombre para reducir comparaciones
  const clientesPorInicial = new Map<string, Cliente[]>();

  clientesConAsesor.forEach(cliente => {
    if (cliente.NOMBRE.length > 0) {
      // Usar las primeras 2 letras como índice
      const inicial = cliente.NOMBRE.substring(0, 2).toLowerCase();
      if (!clientesPorInicial.has(inicial)) {
        clientesPorInicial.set(inicial, []);
      }
      clientesPorInicial.get(inicial)!.push(cliente);
    }
  });

  // Proceso de agrupación optimizado
  clientesConAsesor.forEach(cliente => {
    if (clienteProcesado.has(cliente.ID)) return;

    const grupoNuevo = [cliente];
    clienteProcesado.add(cliente.ID);

    // Solo comparar con clientes que tengan iniciales similares
    const iniciales = [
      cliente.NOMBRE.substring(0, 2).toLowerCase()
    ];

    // Agregar algunas variaciones de la inicial para mejorar detección
    if (cliente.NOMBRE.length > 0) {
      const primerLetra = cliente.NOMBRE[0].toLowerCase();
      for (let i = 0; i < 26; i++) {
        const letraPosible = String.fromCharCode(97 + i); // a-z
        iniciales.push(primerLetra + letraPosible);
      }
    }

    // Obtener candidatos solo de las iniciales relevantes
    const candidatos: Cliente[] = [];
    iniciales.forEach(inicial => {
      if (clientesPorInicial.has(inicial)) {
        candidatos.push(...clientesPorInicial.get(inicial)!);
      }
    });

    // Comparar solo con los candidatos filtrados
    candidatos.forEach(candidato => {
      if (candidato.ID !== cliente.ID && !clienteProcesado.has(candidato.ID)) {
        if (sonSimilares(cliente, candidato)) {
          grupoNuevo.push(candidato);
          clienteProcesado.add(candidato.ID);
        }
      }
    });

    // Solo agregar grupos con más de un cliente y asesores diferentes
    if (grupoNuevo.length > 1) {
      const asesoresUnicos = new Set(
        grupoNuevo.map(c => asesorMap.get(c.ID_ASESOR)?.NOMBRE || '')
      );
      if (asesoresUnicos.size > 1) {
        grupos.push(grupoNuevo);
      }
    }
  });

  return grupos;
};

// Versión optimizada y memoizada para estadísticas de asesores
const useAsesorEstadisticas = (reportes: Reporte[]) => {
  return useMemo(() => {
    // Crear índice para búsqueda rápida
    const clientesPorAsesor = new Map<number, Set<number>>();
    const clientesConsolidadosPorAsesor = new Map<number, Set<number>>();

    reportes.forEach(reporte => {
      const asesorId = reporte.ID_ASESOR;
      const clienteId = reporte.ID_CLIENTE;

      // Para ventas reportadas (PAGADO)
      if (reporte.ESTADO_NUEVO === 'PAGADO') {
        if (!clientesPorAsesor.has(asesorId)) {
          clientesPorAsesor.set(asesorId, new Set());
        }
        clientesPorAsesor.get(asesorId)!.add(clienteId);
      }

      // Para ventas consolidadas
      if (reporte.consolidado || reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA') {
        if (!clientesConsolidadosPorAsesor.has(asesorId)) {
          clientesConsolidadosPorAsesor.set(asesorId, new Set());
        }
        clientesConsolidadosPorAsesor.get(asesorId)!.add(clienteId);
      }
    });

    // Convertir a objeto para fácil acceso
    const estadisticas: Record<number, { ventasReportadas: number, ventasConsolidadas: number }> = {};

    clientesPorAsesor.forEach((clientes, asesorId) => {
      const consolidados = clientesConsolidadosPorAsesor.get(asesorId) || new Set();
      estadisticas[asesorId] = {
        ventasReportadas: clientes.size,
        ventasConsolidadas: consolidados.size
      };
    });

    return estadisticas;
  }, [reportes]);
};

function ClientesAsesorModal({ asesor, clientes, reportes, onClose, onVerHistorial }: ClientesAsesorModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar los clientes asignados a este asesor
  const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
  const clientesFiltrados = clientesAsesor
    .filter(cliente =>
      cliente.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.WHATSAPP.includes(searchTerm)
    )
    .sort((a, b) => {
      const aConsolidado = reportes.some(r =>
        r.ID_CLIENTE === a.ID &&
        (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA')
      );
      const bConsolidado = reportes.some(r =>
        r.ID_CLIENTE === b.ID &&
        (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA')
      );
      if (aConsolidado === bConsolidado) {
        return a.NOMBRE.localeCompare(b.NOMBRE);
      }
      return aConsolidado ? 1 : -1;
    });

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Clientes de {asesor.NOMBRE}</h3>
            <p className="text-sm text-gray-500">WhatsApp: {asesor.WHATSAPP}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-purple-500 focus:border-purple-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WhatsApp
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientesFiltrados.map(cliente => {
                const consolidado = reportes.some(r =>
                  r.ID_CLIENTE === cliente.ID &&
                  (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA')
                );
                return (
                  <tr key={cliente.ID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onVerHistorial(cliente)}
                        className="text-sm font-medium text-gray-900 hover:text-purple-600"
                      >
                        {cliente.NOMBRE}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${consolidado
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                        }`}>
                        {consolidado ? 'CONSOLIDADO' : 'PAGADO'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.WHATSAPP}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => onVerHistorial(cliente)}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Ver Historial
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function AuditorDashboard() {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [clientesVisibles, setClientesVisibles] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);

  // Obtener estadísticas pre-calculadas
  const estadisticasAsesores = useAsesorEstadisticas(reportes);

  // Cargar datos solo cuando se monta el componente
  useEffect(() => {
    cargarDatos();
  }, []);

  // Usar un filtrado diferido para la búsqueda
  useEffect(() => {
    const filtrarAsesores = () => {
      if (!searchTerm.trim()) {
        setClientesVisibles(clientes);
        return;
      }

      const termLower = searchTerm.toLowerCase();
      setClientesVisibles(
        clientes.filter(cliente =>
          cliente.NOMBRE.toLowerCase().includes(termLower) ||
          cliente.WHATSAPP.includes(searchTerm)
        )
      );
    };

    // Debounce para el filtrado de clientes si el asesor está seleccionado
    const handler = setTimeout(filtrarAsesores, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, clientes]);

  // Asesores filtrados en memoria
  const asesoresFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return asesores;

    const termLower = searchTerm.toLowerCase();
    return asesores.filter(asesor =>
      asesor.NOMBRE.toLowerCase().includes(termLower) ||
      asesor.WHATSAPP.includes(searchTerm)
    );
  }, [asesores, searchTerm]);

  // Versión optimizada de "Cargar Datos" con worker
  const cargarDatos = async () => {
    try {
      setLoading(true);

      // Dividir las solicitudes para permitir la visualización temprana
      const asesoresData = await apiClient.request<Asesor[]>('/GERSSON_ASESORES?select=*');
      setAsesores(asesoresData);

      // Cargar los siguientes datos en segundo plano
      setTimeout(async () => {
        try {
          const [clientesData, reportesData] = await Promise.all([
            apiClient.request<Cliente[]>('/GERSSON_CLIENTES?ESTADO=in.(PAGADO,VENTA CONSOLIDADA)'),
            apiClient.request<Reporte[]>('/GERSSON_REPORTES?ESTADO_NUEVO=in.(PAGADO,VENTA CONSOLIDADA)'),
          ]);

          // Procesar los datos de forma incremental para evitar bloquear la UI
          procesarDatosIncrementalmente(clientesData, reportesData);
        } catch (error) {
          console.error('Error al cargar datos secundarios:', error);
        }
      }, 100);

    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Procesar datos en trozos para evitar bloquear la UI
  const procesarDatosIncrementalmente = (clientesData: Cliente[], reportesData: Reporte[]) => {
    // Definir un procesador de datos incremental
    const chunkSize = 500; // Ajustar según rendimiento
    let clienteIndex = 0;
    let reporteIndex = 0;

    // Reiniciar los estados para evitar duplicación
    setClientes([]);
    setReportes([]);

    // Función para procesar un fragmento de datos
    const procesarFragmento = () => {
      // Procesar un fragmento de clientes
      if (clienteIndex < clientesData.length) {
        const clientesChunk = clientesData.slice(clienteIndex, clienteIndex + chunkSize);
        setClientes(prevClientes => [...prevClientes, ...clientesChunk]);
        clienteIndex += chunkSize;
      }

      // Procesar un fragmento de reportes
      if (reporteIndex < reportesData.length) {
        const reportesChunk = reportesData.slice(reporteIndex, reporteIndex + chunkSize);
        setReportes(prevReportes => [...prevReportes, ...reportesChunk]);
        reporteIndex += chunkSize;
      }

      // Si hay más datos por procesar, programar el siguiente fragmento
      if (clienteIndex < clientesData.length || reporteIndex < reportesData.length) {
        setTimeout(procesarFragmento, 10); // Pequeña pausa para permitir actualización de UI
      }
    };

    // Iniciar el procesamiento incremental
    procesarFragmento();
  };

  // Calcular duplicados de forma optimizada y con memoización
  const duplicados = useMemo(() => {
    if (clientes.length === 0 || asesores.length === 0) return [];

    // Solo recalcular si los datos han cambiado
    return analizarDuplicadosOptimizado(clientes, asesores);
  }, [clientes, asesores]);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Panel de Auditoría</h1>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Buscador de asesores */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar asesor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-purple-500 focus:border-purple-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>

        {/* Lista de Asesores */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Asesores y sus Ventas</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {asesoresFiltrados.map(asesor => {
              const stats = estadisticasAsesores[asesor.ID] || { ventasReportadas: 0, ventasConsolidadas: 0 };
              return (
                <AsesorItem
                  key={asesor.ID}
                  asesor={asesor}
                  ventasReportadas={stats.ventasReportadas}
                  ventasConsolidadas={stats.ventasConsolidadas}
                  onClick={() => setAsesorSeleccionado(asesor)}
                />
              );
            })}
          </div>
        </div>

        {/* Sección de duplicados (fuzzy) */}
        {duplicados.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-red-600 mb-4">
              Posibles Ventas Duplicadas ({duplicados.length})
            </h2>
            {duplicados.slice(0, 10).map((grupo, idx) => (
              <div key={idx} className="mb-4 border p-4 rounded">
                <p className="text-sm font-bold text-gray-800">Grupo {idx + 1}</p>
                <ul className="mt-2 space-y-1">
                  {grupo.map(cliente => {
                    const asesor = asesores.find(a => a.ID === cliente.ID_ASESOR);
                    return (
                      <li key={cliente.ID} className="text-sm text-gray-700">
                        {cliente.NOMBRE} — WhatsApp: {cliente.WHATSAPP} — Asesor: {asesor?.NOMBRE || ''}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {duplicados.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">
                Mostrando 10 de {duplicados.length} grupos de duplicados.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal de Clientes del Asesor */}
      {asesorSeleccionado && (
        <ClientesAsesorModal
          asesor={asesorSeleccionado}
          clientes={clientes}
          reportes={reportes}
          onClose={() => setAsesorSeleccionado(null)}
          onVerHistorial={(cliente) => {
            setClienteHistorial(cliente);
          }}
        />
      )}

      {/* Modal de Historial de Cliente */}
      {clienteHistorial && (
        <HistorialCliente
          cliente={clienteHistorial}
          reportes={reportes.filter(r => r.ID_CLIENTE === clienteHistorial.ID)}
          onClose={() => setClienteHistorial(null)}
        />
      )}
    </div>
  );
}

export default AuditorDashboard;