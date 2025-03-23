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
import * as XLSX from 'xlsx';

// Lazy load para reducir el tamaño inicial del bundle
const HistorialCliente = lazy(() => import('./HistorialCliente'));

/* ––––––– FUNCIONES DE SIMILITUD ––––––– */
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

function similarity(s1: string, s2: string): number {
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLength;
}

function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

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

// Componente para renderizar cada fila de cliente y usar memo para actualizar solo esa fila
const ClienteRow = React.memo(({
  cliente,
  reporte,
  getFuente,
  onVerHistorial,
  onVerificarVenta
}: {
  cliente: Cliente;
  reporte: Reporte | undefined;
  getFuente: (id: number) => string;
  onVerHistorial: (cliente: Cliente) => void;
  onVerificarVenta: (cliente: Cliente) => void;
}) => {
  // Función para obtener el texto del estado, incluyendo detalle de verificación
  const getEstadoFinal = (): string => {
    if (!reporte) return 'PAGADO (sin reporte)';
    const consolidado = reporte.consolidado || reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA';
    let estado = consolidado ? (reporte.verificada ? 'VERIFICADA' : 'CONSOLIDADO') : 'PAGADO';
    if (reporte.verificada && reporte.estado_verificacion) {
      if (reporte.estado_verificacion === 'aprobada') {
        estado += ' - Aprobada';
      } else if (reporte.estado_verificacion === 'rechazada') {
        estado += ' - Rechazada';
        if (reporte.comentario_rechazo) {
          estado += ` (${reporte.comentario_rechazo})`;
        }
      }
    }
    return estado;
  };

  // Función para asignar la clase de estilo según el estado
  const getEstadoClass = (): string => {
    if (reporte) {
      if (reporte.verificada) {
        if (reporte.estado_verificacion === 'rechazada') {
          return 'bg-red-100 text-red-800';
        } else if (reporte.estado_verificacion === 'aprobada') {
          return 'bg-green-100 text-blue-800';
        }
      } else if (reporte.consolidado || reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA') {
        return 'bg-purple-100 text-purple-800';
      } else {
        return 'bg-green-100 text-green-800';
      }
    }
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <tr className="hover:bg-gray-50">
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
        <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${getEstadoClass()}`}>
          {getEstadoFinal()}
          {reporte && reporte.verificada && reporte.estado_verificacion === 'aprobada' && (
            <CheckCircle className="h-4 w-4 text-blue-600" />
          )}
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
        {(!reporte || !reporte.verificada) && reporte && (
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
});


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

  const { clientesAsesor, clientesFiltrados } = useMemo(() => {
    const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
    const clientesFiltrados = searchTerm.trim()
      ? clientesAsesor.filter(cliente =>
        cliente.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cliente.WHATSAPP || '').includes(searchTerm)
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

  const getReporteForCliente = (cliente: Cliente): Reporte | undefined => {
    return reportes.find(r => r.ID_CLIENTE === cliente.ID);
  };

  const getFuente = (clienteId: number): string => {
    const eventos = registros.filter(r => r.ID_CLIENTE === clienteId);
    if (eventos.length > 0) {
      eventos.sort((a, b) => new Date(a.FECHA_EVENTO).getTime() - new Date(b.FECHA_EVENTO).getTime());
      return eventos[0].TIPO_EVENTO?.trim() || 'Desconocido';
    }
    return 'Desconocido';
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
                return (
                  <ClienteRow
                    key={cliente.ID}
                    cliente={cliente}
                    reporte={reporte}
                    getFuente={getFuente}
                    onVerHistorial={onVerHistorial}
                    onVerificarVenta={onVerificarVenta}
                  />
                );
              })}
              {clientesFiltrados.length > 100 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
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

/* ––––––– MODAL: Verificar Venta con Decisión ––––––– */
interface ModalVerificarVentaProps {
  cliente: Cliente;
  onConfirm: (decision: 'aprobada' | 'rechazada', comentario: string) => void;
  onCancel: () => void;
}
function ModalVerificarVenta({ cliente, onConfirm, onCancel }: ModalVerificarVentaProps) {
  const [decision, setDecision] = useState<'aprobada' | 'rechazada'>('aprobada');
  const [comentario, setComentario] = useState('');
  const [password, setPassword] = useState('');

  const handleConfirm = () => {
    if (!password.trim()) {
      toast.error('Debe ingresar la contraseña.');
      return;
    }
    if (decision === 'rechazada' && !comentario.trim()) {
      toast.error('Debe ingresar el motivo del rechazo.');
      return;
    }
    if (password !== '0911') {
      toast.error('Contraseña incorrecta.');
      return;
    }
    onConfirm(decision, decision === 'rechazada' ? comentario : '');
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">Verificar Venta de {cliente.NOMBRE}</h2>
        <div className="mb-4">
          <label className="block font-medium">Decisión:</label>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as 'aprobada' | 'rechazada')}
            className="mt-1 block w-full border rounded-md p-2"
          >
            <option value="aprobada">Aprobar</option>
            <option value="rechazada">Rechazar</option>
          </select>
        </div>
        {decision === 'rechazada' && (
          <div className="mb-4">
            <label className="block font-medium">Motivo del rechazo:</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              placeholder="Ingrese el motivo del rechazo"
            />
          </div>
        )}
        {/* Campo de contraseña siempre visible */}
        <div className="mb-4">
          <label className="block font-medium">Contraseña:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded-md p-2"
            placeholder="Escriba la contraseña"
          />
        </div>
        <div className="flex justify-end space-x-4">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded">
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

/* ––––––– COMPONENTE ExportExcelModal ––––––– */
interface ExportExcelModalProps {
  fuentes: string[];
  onCancel: () => void;
  onExport: (
    commissionData: Record<string, string>,
    bonus10: string,
    bonus20: string,
    bonus30: string,
    bonus50: string,
    bestSellerBonus: string
  ) => void;
}

function ExportExcelModal({ fuentes, onCancel, onExport }: ExportExcelModalProps) {
  const [commissionValues, setCommissionValues] = useState<Record<string, string>>({});
  // Bonos globales
  const [bonus10, setBonus10] = useState('');
  const [bonus20, setBonus20] = useState('');
  const [bonus30, setBonus30] = useState('');
  const [bonus50, setBonus50] = useState('');
  const [bestSellerBonus, setBestSellerBonus] = useState('');

  const handleCommissionChange = (source: string, value: string) => {
    setCommissionValues(prev => ({ ...prev, [source]: value }));
  };

  const handleSubmit = () => {
    onExport(commissionValues, bonus10, bonus20, bonus30, bonus50, bestSellerBonus);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Exportar a Excel</h2>
        <p className="mb-4">Ingrese el valor de la comisión para cada fuente:</p>
        {fuentes.map(source => (
          <div key={source} className="mb-4 border p-2 rounded">
            <h3 className="font-semibold">{source}</h3>
            <input
              type="number"
              placeholder="Comisión"
              value={commissionValues[source] || ''}
              onChange={e => handleCommissionChange(source, e.target.value)}
              className="border p-2 w-full"
            />
          </div>
        ))}
        <div className="mb-4">
          <label className="block font-semibold">Bono a las 10 (Global)</label>
          <input
            type="number"
            placeholder="Bono a las 10"
            value={bonus10}
            onChange={e => setBonus10(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold">Bono a las 20 (Global)</label>
          <input
            type="number"
            placeholder="Bono a las 20"
            value={bonus20}
            onChange={e => setBonus20(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold">Bono a las 30 (Global)</label>
          <input
            type="number"
            placeholder="Bono a las 30"
            value={bonus30}
            onChange={e => setBonus30(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold">Bono por 50 Totales</label>
          <input
            type="number"
            placeholder="Bono 50 Totales"
            value={bonus50}
            onChange={e => setBonus50(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold">Bono al Mejor Vendedor</label>
          <input
            type="number"
            placeholder="Bono Mejor Vendedor"
            value={bestSellerBonus}
            onChange={e => setBestSellerBonus(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="flex justify-end space-x-4">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded">
            Exportar
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

  // Estados para duplicados, progresos y modales
  const [duplicados, setDuplicados] = useState<Cliente[][]>([]);
  const [duplicadosProgress, setDuplicadosProgress] = useState(0);
  const [duplicadosCargando, setDuplicadosCargando] = useState(false);

  const [asesoresCargados, setAsesoresCargados] = useState(false);
  const [clientesCargados, setClientesCargados] = useState(false);
  const [reportesCargados, setReportesCargados] = useState(false);

  const [ventaVerificar, setVentaVerificar] = useState<Cliente | null>(null);
  const [disputaGrupo, setDisputaGrupo] = useState<Cliente[] | null>(null);

  // Estado para el modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);

  // Función para cargar datos con paginación
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

  // Se abre el modal de exportación
  const exportarPanelAuditorAGlobalExcel = () => {
    setShowExportModal(true);
  };

  // Función de exportación que utiliza los valores ingresados
  const exportarConDatosExtra = (
    commissionData: Record<string, string>,
    bonus10: string,
    bonus20: string,
    bonus30: string,
    bonus50: string,
    bestSellerBonus: string
  ) => {
    if (!clientes.length || !asesores.length) return;

    const workbook = XLSX.utils.book_new();

    asesores.forEach(asesor => {
      const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
      const dataExport = clientesAsesor.map(cliente => {
        const reporte = reportes.find(r => r.ID_CLIENTE === cliente.ID);
        const consolidado = reporte?.consolidado || reporte?.ESTADO_NUEVO === 'VENTA CONSOLIDADA';
        const verificada = !!reporte?.verificada;
        const tieneReporte = !!reporte;
        const estado = consolidado
          ? (verificada ? 'VERIFICADA' : 'CONSOLIDADO')
          : (tieneReporte ? 'PAGADO' : 'PAGADO (sin reporte)');
        const eventos = registros.filter(r => r.ID_CLIENTE === cliente.ID);
        const fuente = eventos.length > 0
          ? eventos.sort((a, b) => new Date(a.FECHA_EVENTO).getTime() - new Date(b.FECHA_EVENTO).getTime())[0].TIPO_EVENTO?.trim()
          : 'Desconocido';

        const comision = commissionData[fuente] || '';

        return {
          Cliente: cliente.NOMBRE,
          WhatsApp: cliente.WHATSAPP,
          Fuente: fuente,
          Estado: estado,
          Comisión: comision,
          'Bono a las 10': bonus10,
          'Bono a las 20': bonus20,
          'Bono a las 30': bonus30,
        };
      });

      if (dataExport.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(dataExport);
        XLSX.utils.book_append_sheet(workbook, sheet, asesor.NOMBRE.substring(0, 31));
      }
    });

    const resumen = asesores.map(asesor => {
      const ventas = reportes.filter(r => r.ID_ASESOR === asesor.ID).length;
      return {
        Asesor: asesor.NOMBRE,
        Ventas: ventas,
      };
    });

    const elegibles = resumen.filter(item => item.Ventas > 30);
    let mejorVendedor: { Asesor: string; Ventas: number } | null = null;
    if (elegibles.length > 0) {
      mejorVendedor = elegibles.reduce((prev, curr) =>
        prev.Ventas > curr.Ventas ? prev : curr
      );
    }

    resumen.forEach(item => {
      item['Premio Mejor Vendedor'] = (mejorVendedor && item.Asesor === mejorVendedor.Asesor) ? 'Sí' : 'No';
      item['Bono Grupal'] = item.Ventas > 30 ? 'Participa' : 'No Participa';
    });

    resumen.push({ Asesor: 'BONO MEJOR VENDEDOR', Ventas: bestSellerBonus, 'Premio Mejor Vendedor': '', 'Bono Grupal': '' });
    resumen.push({ Asesor: 'BONO 50 TOT.', Ventas: bonus50, 'Premio Mejor Vendedor': '', 'Bono Grupal': '' });

    const sheetResumen = XLSX.utils.json_to_sheet(resumen);
    XLSX.utils.book_append_sheet(workbook, sheetResumen, 'Resumen');

    XLSX.writeFile(workbook, `Auditoría-Ventas-${new Date().toLocaleDateString()}.xlsx`);
  };

  const cargarDatosOptimizados = async () => {
    try {
      setLoading(true);
      setLoadingProgress(10);
      // Cargar asesores
      const asesoresData = await apiClient.request<Asesor[]>('/GERSSON_ASESORES?select=*');
      setAsesores(asesoresData);
      setAsesoresCargados(true);
      setLoadingProgress(30);
      // Cargar clientes, reportes y registros
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
  const reportesFiltrados = useMemo(() => {
    const filtered = reportes.filter(
      r => r.PRODUCTO && r.PRODUCTO.toUpperCase() === productoFiltro
    );
    console.log(`Reportes filtrados (${productoFiltro}):`, filtered.length);
    return filtered;
  }, [productoFiltro, reportes]);

  const clientesFiltradosPorProducto = useMemo(() => {
    return clientes.filter(cliente =>
      reportes.some(reporte =>
        reporte.ID_CLIENTE === cliente.ID &&
        reporte.PRODUCTO &&
        reporte.PRODUCTO.toUpperCase() === productoFiltro
      )
    );
  }, [clientes, productoFiltro, reportes]);

  const getNombreAsesor = (asesorId: number): string => {
    const asesor = asesores.find(a => a.ID === asesorId);
    return asesor ? asesor.NOMBRE : '';
  };

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

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    window.location.reload();
  };

  const handleVerificarVenta = (cliente: Cliente) => {
    setVentaVerificar(cliente);
  };

  // Función de verificación que actualiza en memoria y en BD
  const confirmVerificarVenta = async (cliente: Cliente, decision: 'aprobada' | 'rechazada', comentario: string) => {
    const reporteIndex = reportes.findIndex(r => r.ID_CLIENTE === cliente.ID);
    if (reporteIndex === -1) return;
    const reporte = reportes[reporteIndex];
    try {
      const response = await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        {
          verificada: true,
          estado_verificacion: decision,
          comentario_rechazo: decision === 'rechazada' ? comentario : ''
        }
      );
      console.log('Respuesta del PATCH:', response);
      // Actualización en memoria
      const updatedReporte = {
        ...reporte,
        verificada: decision === 'aprobada',
        estado_verificacion: decision,
        comentario_rechazo: decision === 'rechazada' ? comentario : ''
      };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);
      toast.success(`✅ Venta de ${cliente.NOMBRE} ${decision === 'aprobada' ? 'aprobada' : 'rechazada'}`, {
        style: { borderRadius: '8px', background: '#4f46e5', color: '#fff' },
        icon: '🎉'
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
      await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        { verificada: true, estado_verificacion: 'aprobada', comentario_rechazo: '' }
      );
      const updatedReporte = { ...reporte, verificada: true, estado_verificacion: 'aprobada', comentario_rechazo: '' };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);
      setDuplicados(prev =>
        prev.filter(grupo => !grupo.some(c => c.ID === clienteGanador.ID))
      );
      toast.success(`✅ Disputa asignada a ${clienteGanador.NOMBRE}`, {
        style: { borderRadius: '8px', background: '#16a34a', color: '#fff' },
        icon: '📌'
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="w-64 bg-white rounded-full h-4 mb-4">
          <div className="bg-purple-600 h-4 rounded-full" style={{ width: `${loadingProgress}%` }}></div>
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
              onClick={exportarPanelAuditorAGlobalExcel}
              className="ml-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              📊 Exportar Auditoría
            </button>
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
          onConfirm={(decision, comentario) => confirmVerificarVenta(ventaVerificar, decision, comentario)}
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

      {/* Modal de Exportación */}
      {showExportModal && (
        <ExportExcelModal
          fuentes={Array.from(new Set(registros.map(r => (r.TIPO_EVENTO?.trim() || 'Desconocido'))))
            .filter(f => f.toUpperCase() !== 'COMPRA')}
          onCancel={() => setShowExportModal(false)}
          onExport={(commissionData, bonus10, bonus20, bonus30, bonus50, bestSellerBonus) => {
            exportarConDatosExtra(commissionData, bonus10, bonus20, bonus30, bonus50, bestSellerBonus);
            setShowExportModal(false);
          }}
        />
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default AuditorDashboard;
