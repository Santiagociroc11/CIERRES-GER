import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
  lazy
} from 'react';
import { FixedSizeList as List } from 'react-window';
import { Asesor, Cliente, Reporte, Registro } from '../types';
import { apiClient } from '../lib/apiClient';
import { FileVideo, DollarSign, Search, LogOut, X, CheckCircle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';


// Lazy load para reducir el tamaño inicial del bundle
const HistorialCliente = lazy(() => import('./HistorialCliente'));

/* ––––––– FUNCIONES DE SIMILITUD ––––––– */
// Función para calcular la distancia de Levenshtein (sin cambios)
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
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
  return matrix[a.length][b.length];
}

// Función que devuelve una similitud entre 0 y 1 (sin cambios)
function similarity(s1: string, s2: string): number {
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLength;
}

// Función para normalizar cadenas: elimina acentos, espacios extra y convierte a minúsculas.
function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Determina si dos clientes son similares (fuzzy) según nombre o WhatsApp usando un umbral (por defecto 0.76)
function sonSimilares(c1: Cliente, c2: Cliente, umbral = 0.76): boolean {
  const nombreSim = similarity(normalizeString(c1.NOMBRE), normalizeString(c2.NOMBRE));
  const whatsappSim = similarity(normalizeString(c1.WHATSAPP || ''), normalizeString(c2.WHATSAPP || ''));
  return nombreSim >= umbral || whatsappSim >= umbral;
}

/* ––––––– COMPONENTE ClientesAsesorModal ––––––– */
interface ClientesAsesorModalProps {
  asesor: Asesor;
  clientes: Cliente[];
  reportes: Reporte[];
  registros: Registro[];
  duplicados: Cliente[][];
  onClose: () => void;
  onVerHistorial: (cliente: Cliente) => void;
  onVerificarVenta: (cliente: Cliente) => void;
  onResolverDisputa: (grupo: Cliente[]) => void;
}


function ClientesAsesorModal({
  asesor,
  clientes,
  reportes,
  registros,
  duplicados,
  onClose,
  onVerHistorial,
  onVerificarVenta,
  onResolverDisputa,
}: ClientesAsesorModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra los clientes del asesor y aplica el término de búsqueda
  const { clientesAsesor, clientesFiltrados } = useMemo(() => {
    const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
    const clientesFiltrados = searchTerm.trim()
      ? clientesAsesor.filter(cliente =>
        cliente.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cliente.WHATSAPP || '').includes(searchTerm)
      )
      : clientesAsesor;
    // Ordena según si tienen reporte consolidado o no
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

  // Función auxiliar para obtener el reporte de un cliente
  const getReporteForCliente = (cliente: Cliente): Reporte | undefined => {
    return reportes.find(r => r.ID_CLIENTE === cliente.ID);
  };

  // Determina si la venta ya fue verificada (campo "verificada" en el reporte)
  const isVentaVerificada = (cliente: Cliente): boolean => {
    const reporte = getReporteForCliente(cliente);
    return reporte ? !!reporte.verificada : false;
  };

  function getFuente(clienteId: number): string {
    const eventos = registros.filter(r => r.ID_CLIENTE === clienteId);
    if (eventos.length > 0) {
      eventos.sort((a, b) => {
        const aTime = new Date(a.FECHA_EVENTO).getTime();
        const bTime = new Date(b.FECHA_EVENTO).getTime();
        return aTime - bTime;
      });
      return eventos[0].TIPO_EVENTO?.trim() || 'Desconocido';
    }
    return 'Desconocido';
  }


  // Determina si el cliente forma parte de un grupo duplicado
  const getGrupoDuplicado = (cliente: Cliente): Cliente[] | null => {
    for (let grupo of duplicados) {
      if (grupo.some(c => c.ID === cliente.ID)) {
        return grupo;
      }
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Clientes de {asesor.NOMBRE}
            </h3>
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
                  Fuente
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
                const reporte = getReporteForCliente(cliente);
                const consolidado = reporte?.consolidado || reporte?.ESTADO_NUEVO === 'VENTA CONSOLIDADA';
                const verificada = !!reporte?.verificada;
                const tieneReporte = !!reporte;

                // Nuevo texto del estado
                const estadoTexto = consolidado
                  ? verificada
                    ? 'VERIFICADA'
                    : 'CONSOLIDADO'
                  : tieneReporte
                    ? 'PAGADO'
                    : 'PAGADO (no tiene reporte de venta)';

                // Nueva clase de color
                const estadoClase = consolidado
                  ? verificada
                    ? 'bg-green-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                  : tieneReporte
                    ? 'bg-green-100 text-green-800'
                    : 'bg-orange-100 text-orange-800';

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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getFuente(cliente.ID)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${estadoClase}`}>
                        {estadoTexto}
                        {estadoTexto === 'VERIFICADA' && <CheckCircle className="h-4 w-4 text-blue-600" />}
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
                      {/* Botón para verificar la venta si no está verificada */}
                      {!isVentaVerificada(cliente) && getReporteForCliente(cliente) && (
                        <button
                          onClick={() => onVerificarVenta(cliente)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          Verificar
                        </button>
                      )}

                    </td>
                  </tr>
                );
              })}
              {clientesFiltrados.length > 100 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
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

/* ––––––– MODAL: Verificar Venta ––––––– */
interface ModalVerificarVentaProps {
  cliente: Cliente;
  onConfirm: () => void;
  onCancel: () => void;
}
function ModalVerificarVenta({ cliente, onConfirm, onCancel }: ModalVerificarVentaProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">Verificar Venta</h2>
        <p className="mb-4">
          ¿Está seguro de verificar la venta de <strong>{cliente.NOMBRE}</strong>?
        </p>
        <div className="flex justify-end space-x-4">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ––––––– MODAL: Resolver Disputa ––––––– */
interface ModalResolverDisputaProps {
  grupo: Cliente[];
  onResolve: (cliente: Cliente) => void;
  onCancel: () => void;
}
function ModalResolverDisputa({ grupo, onResolve, onCancel }: ModalResolverDisputaProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Resolver Disputa</h2>
        <p className="mb-4">Seleccione la venta correcta:</p>
        <ul className="space-y-2">
          {grupo.map(cliente => (
            <li key={cliente.ID}>
              <button
                onClick={() => onResolve(cliente)}
                className="text-blue-600 hover:text-blue-800"
              >
                {cliente.NOMBRE} — WhatsApp: {cliente.WHATSAPP} — Asesor: {cliente.ID_ASESOR}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button onClick={onCancel} className="text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ––––––– COMPONENTE AuditorDashboard ––––––– */
function AuditorDashboard() {
  // Estados para datos y carga
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [productoFiltro, setProductoFiltro] = useState<'PRINCIPAL' | 'DOWNSELL'>('PRINCIPAL');
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);

  // Estados para el análisis de duplicados con Worker
  const [duplicados, setDuplicados] = useState<Cliente[][]>([]);
  const [duplicadosProgress, setDuplicadosProgress] = useState(0);
  const [duplicadosCargando, setDuplicadosCargando] = useState(false);

  // Estados para el progreso de carga
  const [asesoresCargados, setAsesoresCargados] = useState(false);
  const [clientesCargados, setClientesCargados] = useState(false);
  const [reportesCargados, setReportesCargados] = useState(false);

  // Estados para modales de verificación y resolución de disputas
  const [ventaVerificar, setVentaVerificar] = useState<Cliente | null>(null);
  const [disputaGrupo, setDisputaGrupo] = useState<Cliente[] | null>(null);

  /* ––––––– CARGA DE DATOS MEJORADA ––––––– */
  // Función auxiliar para cargar datos con paginación y actualizar el progreso
  const fetchAllPages = async (
    endpoint: string,
    filter: string,
    pageSize = 100
  ): Promise<any[]> => {
    let allData: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const url = `${endpoint}?${filter}&limit=${pageSize}&offset=${offset}`;
      const data = await apiClient.request<any[]>(url);
      if (data.length > 0) {
        allData = [...allData, ...data];
        offset += pageSize;
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

  const cargarDatosOptimizados = async () => {
    try {
      setLoading(true);
      setLoadingProgress(10);
      // Cargar primero asesores (dataset más pequeño)
      const asesoresData = await apiClient.request<Asesor[]>('/GERSSON_ASESORES?select=*');
      setAsesores(asesoresData);
      setAsesoresCargados(true);
      setLoadingProgress(30);
      // Luego, carga clientes y reportes en paralelo con paginación
      const [clientesData, reportesData, registrosData] = await Promise.all([
        fetchAllPages('/GERSSON_CLIENTES', 'ESTADO=in.(PAGADO,VENTA CONSOLIDADA)', 100),
        fetchAllPages('/GERSSON_REPORTES', 'ESTADO_NUEVO=in.(PAGADO,VENTA CONSOLIDADA)', 100),
        fetchAllPages('/GERSSON_REGISTROS', 'ID_CLIENTE=not.is.null', 100)
      ]);
      setClientes(clientesData);
      setClientesCargados(true);
      setReportes(reportesData);
      setReportesCargados(true);
      setRegistros(registrosData);
      setLoadingProgress(100);
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosOptimizados();
  }, []);

  /* ––––––– FILTRADOS ––––––– */
  // Filtrar reportes según el producto seleccionado
  const reportesFiltrados = useMemo(() => {
    const filtered = reportes.filter(
      r => r.PRODUCTO && r.PRODUCTO.toUpperCase() === productoFiltro
    );
    console.log(`Reportes filtrados (${productoFiltro}):`, filtered.length);
    return filtered;
  }, [productoFiltro, reportes]);

  // Filtrar clientes en base al producto (lógica original)
  const clientesFiltradosPorProducto = useMemo(() => {
    return clientes.filter(cliente =>
      reportes.some(reporte =>
        reporte.ID_CLIENTE === cliente.ID &&
        reporte.PRODUCTO &&
        reporte.PRODUCTO.toUpperCase() === productoFiltro
      )
    );
  }, [clientes, productoFiltro, reportes]);

  // Función auxiliar para obtener el nombre de un asesor
  const getNombreAsesor = (asesorId: number): string => {
    const asesor = asesores.find(a => a.ID === asesorId);
    return asesor ? asesor.NOMBRE : '';
  };

  // Estadísticas para cada asesor usando reportesFiltrados
  const getEstadisticasAsesor = (asesorId: number) => {
    const ventasReportadas = Array.from(
      new Set(
        reportesFiltrados
          .filter(r => r.ID_ASESOR === asesorId && r.ESTADO_NUEVO === 'PAGADO')
          .map(r => r.ID_CLIENTE)
      )
    ).length;
    const ventasConsolidadas = Array.from(
      new Set(
        reportesFiltrados
          .filter(r => r.ID_ASESOR === asesorId && (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'))
          .map(r => r.ID_CLIENTE)
      )
    ).length;
    return { ventasReportadas, ventasConsolidadas };
  };

  // Filtrar asesores según el término de búsqueda
  const asesoresFiltrados = useMemo(() => {
    return asesores.filter(asesor =>
      asesor.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asesor.WHATSAPP || '').includes(searchTerm)
    );
  }, [asesores, searchTerm]);

  /* ––––––– ANÁLISIS DE DUPLICADOS CON WEB WORKER ––––––– */
  useEffect(() => {
    if (clientes.length > 0 && asesores.length > 0) {
      const worker = createDuplicateAnalysisWorker();
      worker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          setDuplicadosProgress(e.data.progress);
        } else if (e.data.type === 'complete') {
          const grupos: Cliente[][] = e.data.duplicados;

          // 🔍 Filtrar grupos donde no haya ninguna venta ya verificada
          const gruposSinVerificadas = grupos.filter(grupo => {
            return !grupo.some(cliente => {
              const reporte = reportes.find(r => r.ID_CLIENTE === cliente.ID);
              return reporte?.verificada;
            });
          });

          setDuplicados(gruposSinVerificadas);
          setDuplicadosCargando(false);
        }
      };

      setDuplicadosCargando(true);
      worker.postMessage({ clientes: clientesFiltradosPorProducto, asesores });
      return () => {
        worker.terminate();
      };
    }
  }, [clientes, asesores, clientesFiltradosPorProducto, reportes]);


  // Función que crea el Web Worker para análisis de duplicados
  const createDuplicateAnalysisWorker = () => {
    const workerCode = `
      function levenshteinDistance(a, b) {
        const matrix = Array.from({ length: a.length + 1 }, () =>
          new Array(b.length + 1).fill(0)
        );
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
        return matrix[a.length][b.length];
      }
      function similarity(s1, s2) {
        const maxLength = Math.max(s1.length, s2.length);
        if (maxLength === 0) return 1;
        const dist = levenshteinDistance(s1, s2);
        return 1 - dist / maxLength;
      }
      function normalizeString(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      }
      function sonSimilares(c1, c2, umbral = 0.76) {
        const nombreSim = similarity(normalizeString(c1.NOMBRE), normalizeString(c2.NOMBRE));
        const whatsappSim = similarity(normalizeString(c1.WHATSAPP || ''), normalizeString(c2.WHATSAPP || ''));
        return nombreSim >= umbral || whatsappSim >= umbral;
      }
      self.onmessage = function(e) {
        const { clientes, asesores } = e.data;
        const asesorMap = {};
        asesores.forEach(asesor => { asesorMap[asesor.ID] = asesor.NOMBRE; });
        const clientesConAsesor = clientes.filter(cliente => cliente.ID_ASESOR);
        const grupos = [];
        let processedCount = 0;
        const batchSize = 100;
        for (let i = 0; i < clientesConAsesor.length; i++) {
          const cliente = clientesConAsesor[i];
          let asignado = false;
          for (let j = 0; j < grupos.length; j++) {
            if (sonSimilares(grupos[j][0], cliente)) {
              grupos[j].push(cliente);
              asignado = true;
              break;
            }
          }
          if (!asignado) {
            grupos.push([cliente]);
          }
          processedCount++;
          if (processedCount % batchSize === 0 || i === clientesConAsesor.length - 1) {
            self.postMessage({ type: 'progress', progress: Math.round((processedCount / clientesConAsesor.length) * 100) });
          }
        }
        const filteredGroups = grupos.filter(grupo => {
          if (grupo.length <= 1) return false;
          const asesoresUnicos = new Set(grupo.map(c => asesorMap[c.ID_ASESOR] || ''));
          return asesoresUnicos.size > 1;
        });
        self.postMessage({ type: 'complete', duplicados: filteredGroups });
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    return new Worker(workerUrl);
  };

  /* ––––––– RENDER DE LA LISTA DE ASESORES CON VIRTUALIZACIÓN ––––––– */
  const AsesorItem = React.memo(({
    asesor,
    ventasReportadas,
    ventasConsolidadas,
    onClick,
    style,
  }: {
    asesor: Asesor;
    ventasReportadas: number;
    ventasConsolidadas: number;
    onClick: () => void;
    style: React.CSSProperties;
  }) => {
    const porcentajeConsolidacion =
      ventasReportadas > 0
        ? ((ventasConsolidadas / ventasReportadas) * 100).toFixed(1)
        : '0';
    return (
      <div
        className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
        onClick={onClick}
        style={style}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
            <p className="text-sm text-gray-500">WhatsApp: {asesor.WHATSAPP}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <span className="block text-2xl font-semibold text-green-600">
                {ventasReportadas}
              </span>
              <span className="text-xs text-gray-500">Reportadas</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-semibold text-purple-600">
                {ventasConsolidadas}
              </span>
              <span className="text-xs text-gray-500">Consolidadas</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-semibold text-blue-600">
                {porcentajeConsolidacion}%
              </span>
              <span className="text-xs text-gray-500">Consolidación</span>
            </div>
          </div>
        </div>
      </div>
    );
  });

  const renderAsesorRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const asesor = asesoresFiltrados[index];
      const { ventasReportadas, ventasConsolidadas } = getEstadisticasAsesor(asesor.ID);
      return (
        <AsesorItem
          key={asesor.ID}
          asesor={asesor}
          ventasReportadas={ventasReportadas}
          ventasConsolidadas={ventasConsolidadas}
          onClick={() => setAsesorSeleccionado(asesor)}
          style={style}
        />
      );
    },
    [asesoresFiltrados, reportesFiltrados]
  );

  /* ––––––– MANEJO DE LOGOUT ––––––– */
  const handleLogout = () => {
    localStorage.removeItem('userSession');
    window.location.reload();
  };

  /* ––––––– FUNCIONES PARA VERIFICAR VENTAS Y RESOLVER DISPUTAS ––––––– */
  const handleVerificarVenta = (cliente: Cliente) => {
    // Abre modal de confirmación para verificar venta
    setVentaVerificar(cliente);
  };

  const confirmVerificarVenta = async (cliente: Cliente) => {
    const reporteIndex = reportes.findIndex(r => r.ID_CLIENTE === cliente.ID);
    if (reporteIndex === -1) return;

    const reporte = reportes[reporteIndex];

    try {
      try {
        await apiClient.request(
          `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
          'PATCH',
          { verificada: true }
        );
      } catch (error: any) {
        const responseText = await error.response?.text?.();
        console.error('Error al verificar venta:', responseText);
      }

      // Actualiza en memoria local
      const updatedReporte = { ...reporte, verificada: true };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);

      toast.success(`✅ Venta de ${cliente.NOMBRE} verificada con éxito`, {
        style: {
          borderRadius: '8px',
          background: '#4f46e5',
          color: '#fff',
        },
        icon: '🎉',
      });

    } catch (err) {
      console.error('❌ Error al verificar la venta:', err);
      alert('Hubo un error al intentar verificar la venta.');
    }

    setVentaVerificar(null);
  };

  const confirmResolverDisputa = async (clienteGanador: Cliente) => {
    const reporteIndex = reportes.findIndex(r => r.ID_CLIENTE === clienteGanador.ID);
    if (reporteIndex === -1) return;

    const reporte = reportes[reporteIndex];

    try {
      // Actualiza en la BD
      try {
        await apiClient.request(
          `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
          'PATCH',
          { verificada: true }
        );
      } catch (error: any) {
        const responseText = await error.response?.text?.();
        console.error('Error al verificar venta:', responseText);
      }


      // Actualiza en memoria
      const updatedReporte = { ...reporte, verificada: true };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);

      // Elimina grupo duplicado al que pertenece el cliente
      setDuplicados(prev =>
        prev.filter(grupo => !grupo.some(c => c.ID === clienteGanador.ID))
      );

      toast.success(`✅ Disputa asignada a ${clienteGanador.NOMBRE}`, {
        style: {
          borderRadius: '8px',
          background: '#16a34a',
          color: '#fff',
        },
        icon: '📌',
      });

    } catch (err) {
      console.error('❌ Error al resolver disputa:', err);
      alert('Hubo un error al resolver la disputa.');
    }

    setDisputaGrupo(null);
  };



  const cancelVerificarVenta = () => {
    setVentaVerificar(null);
  };

  const handleResolverDisputa = (grupo: Cliente[]) => {
    setDisputaGrupo(grupo);
  };

  const cancelResolverDisputa = () => {
    setDisputaGrupo(null);
  };

  /* ––––––– RENDER PRINCIPAL ––––––– */
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
          {asesoresCargados ? '✓' : '⏳'} Asesores{' '}
          {clientesCargados ? '✓' : '⏳'} Clientes{' '}
          {reportesCargados ? '✓' : '⏳'} Reportes
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

        {/* Filtro por Producto */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700">
            Filtrar por Producto:
          </label>
          <select
            value={productoFiltro}
            onChange={(e) =>
              setProductoFiltro(e.target.value as 'PRINCIPAL' | 'DOWNSELL')
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="PRINCIPAL">Principal</option>
            <option value="DOWNSELL">Downsell</option>
          </select>
        </div>

        {/* Lista de Asesores con virtualización */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Asesores y sus Ventas</h2>
          </div>
          {asesoresFiltrados.length > 0 ? (
            <div className="divide-y divide-gray-200" style={{ height: '100vh' }}>
              <List height={1000} itemCount={asesoresFiltrados.length} itemSize={100} width="100%">
                {renderAsesorRow}
              </List>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No se encontraron asesores con ese criterio de búsqueda
            </div>
          )}
        </div>

        {/* Sección de duplicados (análisis fuzzy) */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            {duplicadosCargando
              ? `Analizando posibles duplicados (${duplicadosProgress}%)`
              : `Posibles Ventas Duplicadas (${duplicados.length})`}
          </h2>
          {duplicadosCargando ? (
            <p className="text-sm text-gray-500">
              Este proceso puede tomar algunos minutos dependiendo del volumen de datos...
            </p>
          ) : duplicados.length > 0 ? (
            duplicados.map((grupo, idx) => (
              <div key={idx} className="mb-4 border p-4 rounded">
                <p className="text-sm font-bold text-gray-800">Grupo {idx + 1}</p>
                <ul className="mt-2 space-y-1">
                  {grupo.map((cliente, i) => (
                    <li key={`${cliente.ID}-${i}`} className="text-sm text-gray-700">
                      {cliente.NOMBRE} — WhatsApp: {cliente.WHATSAPP} — Asesor: {getNombreAsesor(cliente.ID_ASESOR)}
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  <button
                    onClick={() => handleResolverDisputa(grupo)}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                  >
                    Resolver Disputa
                  </button>
                </div>

              </div>
            ))
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
          duplicados={duplicados}
          onClose={() => setAsesorSeleccionado(null)}
          onVerHistorial={(cliente) => setClienteHistorial(cliente)}
          onVerificarVenta={handleVerificarVenta}
          onResolverDisputa={handleResolverDisputa}
          registros={registros}
        />

      )}

      {/* Modal de Historial de Cliente */}
      {clienteHistorial && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          }
        >
          <HistorialCliente
            cliente={clienteHistorial}
            reportes={reportes.filter(r => r.ID_CLIENTE === clienteHistorial.ID)}
            onClose={() => setClienteHistorial(null)}
          />
        </Suspense>
      )}

      {/* Modal para confirmar verificación de venta */}
      {ventaVerificar && (
        <ModalVerificarVenta
          cliente={ventaVerificar}
          onConfirm={() => confirmVerificarVenta(ventaVerificar)}
          onCancel={cancelVerificarVenta}
        />
      )}

      {/* Modal para resolver disputa */}
      {disputaGrupo && (
        <ModalResolverDisputa
          grupo={disputaGrupo}
          onResolve={confirmResolverDisputa}
          onCancel={cancelResolverDisputa}
        />
      )}

      <Toaster position="top-right" />

    </div>
  );
}

export default AuditorDashboard;
