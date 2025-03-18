import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Asesor, Cliente, Reporte } from '../types';
import { apiClient } from '../lib/apiClient';
import { Search, LogOut, X } from 'lucide-react';

// Lazy load components to reduce initial bundle size
const HistorialCliente = lazy(() => import('./HistorialCliente'));

// Virtualized list for asesores to efficiently render large lists
import { FixedSizeList as List } from 'react-window';

// Offload expensive calculations to a Web Worker
const createDuplicateAnalysisWorker = () => {
  const workerCode = `
    // Improved Levenshtein function for web worker
    const memoizedLevenshtein = (() => {
      const cache = new Map();
      
      return (a, b) => {
        const key = \`\${a}|\${b}\`;
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
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + cost
            );
          }
        }
        
        const result = matrix[a.length][b.length];
        cache.set(key, result);
        return result;
      };
    })();

    // Function to check if clients are similar
    function sonSimilares(c1, c2, umbral = 0.8) {
      const s1 = c1.NOMBRE.toLowerCase();
      const s2 = c2.NOMBRE.toLowerCase();
      
      if (s1 === s2) return true;
      
      const maxLen = Math.max(s1.length, s2.length);
      const minLen = Math.min(s1.length, s2.length);
      if (minLen / maxLen < umbral) return false;
      
      const w1 = (c1.WHATSAPP || '').trim();
      const w2 = (c2.WHATSAPP || '').trim();
      if (w1 !== '' && w2 !== '' && w1 === w2) return true;
      
      if (maxLen === 0) return true;
      
      const dist = memoizedLevenshtein(s1, s2);
      const nombreSim = 1 - (dist / maxLen);
      
      return nombreSim >= umbral;
    }

    // Optimized duplicate analysis
    self.onmessage = function(e) {
      const { clientes, asesores } = e.data;
      
      // Create a map for quick asesor lookup by ID
      const asesorMap = new Map();
      asesores.forEach(asesor => asesorMap.set(asesor.ID, asesor));
      
      // Only consider clients with assigned asesor
      const clientesConAsesor = clientes.filter(cliente => !!cliente.ID_ASESOR);
      
      const grupos = [];
      const clienteProcesado = new Set();
      
      // Index clients by first letters of name to reduce comparisons
      const clientesPorInicial = new Map();
      
      clientesConAsesor.forEach(cliente => {
        if (cliente.NOMBRE.length > 0) {
          const inicial = cliente.NOMBRE.substring(0, 2).toLowerCase();
          if (!clientesPorInicial.has(inicial)) {
            clientesPorInicial.set(inicial, []);
          }
          clientesPorInicial.get(inicial).push(cliente);
        }
      });
      
      // Process in batches to report progress
      const batchSize = 100;
      let processedCount = 0;
      
      for (let i = 0; i < clientesConAsesor.length; i++) {
        const cliente = clientesConAsesor[i];
        
        if (clienteProcesado.has(cliente.ID)) continue;
        
        const grupoNuevo = [cliente];
        clienteProcesado.add(cliente.ID);
        
        const iniciales = [cliente.NOMBRE.substring(0, 2).toLowerCase()];
        
        if (cliente.NOMBRE.length > 0) {
          const primerLetra = cliente.NOMBRE[0].toLowerCase();
          for (let i = 0; i < 26; i++) {
            const letraPosible = String.fromCharCode(97 + i);
            iniciales.push(primerLetra + letraPosible);
          }
        }
        
        const candidatos = [];
        iniciales.forEach(inicial => {
          if (clientesPorInicial.has(inicial)) {
            candidatos.push(...clientesPorInicial.get(inicial));
          }
        });
        
        candidatos.forEach(candidato => {
          if (candidato.ID !== cliente.ID && !clienteProcesado.has(candidato.ID)) {
            if (sonSimilares(cliente, candidato)) {
              grupoNuevo.push(candidato);
              clienteProcesado.add(candidato.ID);
            }
          }
        });
        
        if (grupoNuevo.length > 1) {
          const asesoresUnicos = new Set(
            grupoNuevo.map(c => asesorMap.get(c.ID_ASESOR)?.NOMBRE || '')
          );
          if (asesoresUnicos.size > 1) {
            grupos.push(grupoNuevo);
          }
        }
        
        // Report progress periodically
        processedCount++;
        if (processedCount % batchSize === 0 || i === clientesConAsesor.length - 1) {
          self.postMessage({
            type: 'progress',
            progress: Math.round((processedCount / clientesConAsesor.length) * 100)
          });
        }
      }
      
      self.postMessage({
        type: 'complete',
        duplicados: grupos
      });
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  
  return worker;
};

// Memoized component for asesor item to prevent unnecessary re-renders
const AsesorItem = React.memo(({ 
  asesor, 
  ventasReportadas, 
  ventasConsolidadas, 
  onClick,
  style // Added for virtualized list
}) => {
  const porcentajeConsolidacion = ventasReportadas > 0 
    ? ((ventasConsolidadas / ventasReportadas) * 100).toFixed(1)
    : '0';
    
  return (
    <div
      className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
      style={style} // For virtualized list
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

// More efficient modal with proper client filtering
function ClientesAsesorModal({ asesor, clientes, reportes, onClose, onVerHistorial }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Memoize client filtration to avoid recalculation on every render
  const { clientesAsesor, clientesFiltrados } = useMemo(() => {
    const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
    
    const clientesFiltrados = searchTerm.trim() 
      ? clientesAsesor.filter(cliente =>
          cliente.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cliente.WHATSAPP.includes(searchTerm)
        )
      : clientesAsesor;
      
    clientesFiltrados.sort((a, b) => {
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
    
    return { clientesAsesor, clientesFiltrados };
  }, [asesor.ID, clientes, reportes, searchTerm]);

  // Virtualized list for clients to handle large datasets efficiently
  const ClientRow = useCallback(({ index, style }) => {
    const cliente = clientesFiltrados[index];
    const consolidado = reportes.some(r =>
      r.ID_CLIENTE === cliente.ID &&
      (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA')
    );
    
    return (
      <tr key={cliente.ID} className="hover:bg-gray-50" style={style}>
        <td className="px-6 py-4 whitespace-nowrap">
          <button
            onClick={() => onVerHistorial(cliente)}
            className="text-sm font-medium text-gray-900 hover:text-purple-600"
          >
            {cliente.NOMBRE}
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            consolidado
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
  }, [clientesFiltrados, reportes, onVerHistorial]);

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
              {clientesFiltrados.slice(0, 100).map(cliente => {
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
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        consolidado
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
              {clientesFiltrados.length > 100 && (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                    Mostrando 100 de {clientesFiltrados.length} clientes. Use el buscador para filtrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Optimized statististics calculation
const useAsesorEstadisticas = (reportes) => {
  return useMemo(() => {
    // Create index for fast lookup
    const clientesPorAsesor = new Map();
    const clientesConsolidadosPorAsesor = new Map();
    
    // Process in batches to avoid blocking the main thread
    const batchSize = 1000;
    const batches = [];
    
    for (let i = 0; i < reportes.length; i += batchSize) {
      batches.push(reportes.slice(i, i + batchSize));
    }
    
    batches.forEach(batch => {
      batch.forEach(reporte => {
        const asesorId = reporte.ID_ASESOR;
        const clienteId = reporte.ID_CLIENTE;
        
        // For reported sales (PAGADO)
        if (reporte.ESTADO_NUEVO === 'PAGADO') {
          if (!clientesPorAsesor.has(asesorId)) {
            clientesPorAsesor.set(asesorId, new Set());
          }
          clientesPorAsesor.get(asesorId).add(clienteId);
        }
        
        // For consolidated sales
        if (reporte.consolidado || reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA') {
          if (!clientesConsolidadosPorAsesor.has(asesorId)) {
            clientesConsolidadosPorAsesor.set(asesorId, new Set());
          }
          clientesConsolidadosPorAsesor.get(asesorId).add(clienteId);
        }
      });
    });
    
    // Convert to object for easy access
    const estadisticas = {};
    
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

function AuditorDashboard() {
  const [asesores, setAsesores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteHistorial, setClienteHistorial] = useState(null);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState(null);
  const [duplicados, setDuplicados] = useState([]);
  const [duplicadosProgress, setDuplicadosProgress] = useState(0);
  const [duplicadosCargando, setDuplicadosCargando] = useState(false);

  // Track data loading state
  const [asesoresCargados, setAsesoresCargados] = useState(false);
  const [clientesCargados, setClientesCargados] = useState(false);
  const [reportesCargados, setReportesCargados] = useState(false);

  // Get pre-calculated statistics
  const estadisticasAsesores = useAsesorEstadisticas(reportes);
  
  // Load data only when the component mounts
  useEffect(() => {
    cargarDatosOptimizados();
    return () => {
      // Clean up worker on unmount
      if (window.duplicadosWorker) {
        window.duplicadosWorker.terminate();
        window.duplicadosWorker = null;
      }
    };
  }, []);

  // Create and initialize the web worker
  useEffect(() => {
    if (clientes.length > 0 && asesores.length > 0 && !window.duplicadosWorker) {
      window.duplicadosWorker = createDuplicateAnalysisWorker();
      
      window.duplicadosWorker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          setDuplicadosProgress(e.data.progress);
        } else if (e.data.type === 'complete') {
          setDuplicados(e.data.duplicados);
          setDuplicadosCargando(false);
        }
      };
      
      // Start analyzing duplicates
      analizarDuplicados();
    }
  }, [clientes, asesores]);

  // Analyze duplicates using the web worker
  const analizarDuplicados = useCallback(() => {
    if (window.duplicadosWorker && clientes.length > 0 && asesores.length > 0) {
      setDuplicadosCargando(true);
      setDuplicadosProgress(0);
      
      // Send data to worker for processing
      window.duplicadosWorker.postMessage({
        clientes,
        asesores
      });
    }
  }, [clientes, asesores]);

  // Optimized data loading with pagination and progress tracking
  const cargarDatosOptimizados = async () => {
    try {
      setLoading(true);
      setLoadingProgress(10);
      
      // First fetch asesores (smaller dataset)
      const asesoresData = await apiClient.request('/GERSSON_ASESORES?select=*');
      setAsesores(asesoresData);
      setAsesoresCargados(true);
      setLoadingProgress(30);
      
      // Then fetch clientes and reportes in parallel
      Promise.all([
        // Use pagination for larger datasets
        fetchAllPages('/GERSSON_CLIENTES', 'ESTADO=in.(PAGADO,VENTA CONSOLIDADA)', 100),
        fetchAllPages('/GERSSON_REPORTES', 'ESTADO_NUEVO=in.(PAGADO,VENTA CONSOLIDADA)', 100)
      ]).then(([clientesData, reportesData]) => {
        setClientes(clientesData);
        setClientesCargados(true);
        setReportes(reportesData);
        setReportesCargados(true);
        setLoadingProgress(100);
        setLoading(false);
      }).catch(error => {
        console.error('Error cargando datos paginados:', error);
        setLoading(false);
      });
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setLoading(false);
    }
  };

  // Helper function to fetch paginated data
  const fetchAllPages = async (endpoint, filter, pageSize = 100) => {
    let allData = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
      const data = await apiClient.request(url);
      
      if (data.length > 0) {
        allData = [...allData, ...data];
        offset += pageSize;
        
        // Update loading progress
        if (endpoint.includes('CLIENTES')) {
          setLoadingProgress(prev => Math.min(30 + Math.floor((offset / (offset + 100)) * 30), 60));
        } else if (endpoint.includes('REPORTES')) {
          setLoadingProgress(prev => Math.min(60 + Math.floor((offset / (offset + 100)) * 30), 90));
        }
      } else {
        hasMore = false;
      }
    }
    
    return allData;
  };

  // Filtered asesores in memory with debounce
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timerId);
  }, [searchTerm]);
  
  const asesoresFiltrados = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return asesores;
    
    const termLower = debouncedSearchTerm.toLowerCase();
    return asesores.filter(asesor =>
      asesor.NOMBRE.toLowerCase().includes(termLower) ||
      asesor.WHATSAPP.includes(debouncedSearchTerm)
    );
  }, [asesores, debouncedSearchTerm]);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    window.location.reload();
  };

  // Virtualized list setup for asesores
  const renderAsesorRow = useCallback(({ index, style }) => {
    const asesor = asesoresFiltrados[index];
    const stats = estadisticasAsesores[asesor.ID] || { ventasReportadas: 0, ventasConsolidadas: 0 };
    
    return (
      <AsesorItem
        key={asesor.ID}
        asesor={asesor}
        ventasReportadas={stats.ventasReportadas}
        ventasConsolidadas={stats.ventasConsolidadas}
        onClick={() => setAsesorSeleccionado(asesor)}
        style={style}
      />
    );
  }, [asesoresFiltrados, estadisticasAsesores, setAsesorSeleccionado]);

  // Improved loading UI with progress
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="w-64 bg-white rounded-full h-4 mb-4">
          <div 
            className="bg-purple-600 h-4 rounded-full" 
            style={{ width: `${loadingProgress}%` }}
          ></div>
        </div>
        <p className="text-gray-700">Cargando datos ({loadingProgress}%)</p>
        <div className="mt-4 text-sm text-gray-500">
          {asesoresCargados ? "✓" : "⏳"} Asesores
          {clientesCargados ? "✓" : "⏳"} Clientes
          {reportesCargados ? "✓" : "⏳"} Reportes
        </div>
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
          
          {/* Use virtualized list for better performance with large datasets */}
          {asesoresFiltrados.length > 0 ? (
            <div className="divide-y divide-gray-200" style={{ height: '60vh' }}>
              <List
                height={500} // Fixed height for virtualized list
                itemCount={asesoresFiltrados.length}
                itemSize={100} // Approximate height of each row
                width="100%"
              >
                {renderAsesorRow}
              </List>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No se encontraron asesores con ese criterio de búsqueda
            </div>
          )}
        </div>

        {/* Sección de duplicados (fuzzy) */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-between">
            <span>
              {duplicadosCargando 
                ? `Analizando posibles duplicados (${duplicadosProgress}%)` 
                : `Posibles Ventas Duplicadas (${duplicados.length})`}
            </span>
            {duplicadosCargando && (
              <div className="w-32 bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-purple-600 h-2.5 rounded-full" 
                  style={{ width: `${duplicadosProgress}%` }}
                ></div>
              </div>
            )}
          </h2>
          
          {duplicadosCargando ? (
            <p className="text-sm text-gray-500">
              Este proceso puede tomar algunos minutos dependiendo del volumen de datos...
            </p>
          ) : duplicados.length > 0 ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No se encontraron duplicados en la base de datos actual.
            </p>
          )}
        </div>
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
        <Suspense fallback={
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        }>
          <HistorialCliente
            cliente={clienteHistorial}
            reportes={reportes.filter(r => r.ID_CLIENTE === clienteHistorial.ID)}
            onClose={() => setClienteHistorial(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default AuditorDashboard;