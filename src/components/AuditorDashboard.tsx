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
import { FileVideo, DollarSign, Search, LogOut, X, CheckCircle, MessageSquare } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Lazy load para reducir el tamaño inicial del bundle
const HistorialCliente = lazy(() => import('./HistorialCliente'));
const ChatModal = lazy(() => import('./ChatModal'));

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

function sonSimilares(c1: Cliente, c2: Cliente, umbral = 0.8): boolean {
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
  onDesverificarVenta: (cliente: Cliente) => void;
  onResolverDisputa: (grupo: Cliente[]) => void;
  onVerChat: (cliente: Cliente) => void;
  onResolverConflicto: (cliente: Cliente) => void;
  onVerHistorialResolucion: (cliente: Cliente) => void;
  onEliminarDecision: (cliente: Cliente) => void;
}

// Componente para renderizar cada fila de cliente y usar memo para actualizar solo esa fila
const ClienteRow = React.memo(({
  cliente,
  reporte,
  getFuente,
  onVerHistorial,
  onVerificarVenta,
  onDesverificarVenta,
  onVerChat,
  onResolverConflicto,
  onVerHistorialResolucion,
  onEliminarDecision,
  enDisputa
}: {
  cliente: Cliente;
  reporte: Reporte | undefined;
  getFuente: (id: number) => string;
  onVerHistorial: (cliente: Cliente) => void;
  onVerificarVenta: (cliente: Cliente) => void;
  onDesverificarVenta: (cliente: Cliente) => void;
  onVerChat: (cliente: Cliente) => void;
  onResolverConflicto: (cliente: Cliente) => void;
  onVerHistorialResolucion: (cliente: Cliente) => void;
  onEliminarDecision: (cliente: Cliente) => void;
  enDisputa: boolean;
}) => {
  // Función para obtener el texto del estado, incluyendo detalle de verificación doble
  const getEstadoFinal = (): string => {
    if (!reporte) return 'PAGADO (sin reporte)';
    const consolidado = reporte.consolidado || reporte.ESTADO_NUEVO === 'VENTA CONSOLIDADA';
    
    if (!consolidado) return 'PAGADO';
    
    // Estados del nuevo sistema de doble verificación
    if (reporte.estado_doble_verificacion) {
      switch (reporte.estado_doble_verificacion) {
        case 'pendiente_auditor1':
          return 'CONSOLIDADO - Sin verificar';
        case 'pendiente_auditor2':
          return 'CONSOLIDADO - Esperando 2do auditor';
        case 'aprobada':
          return 'VERIFICADA - Aprobada';
        case 'rechazada':
          return 'VERIFICADA - Rechazada';
        case 'conflicto':
          return 'EN CONFLICTO - Requiere resolución';
        default:
          return 'CONSOLIDADO';
      }
    }
    
    // Compatibilidad con sistema anterior
    if (reporte.verificada && reporte.estado_verificacion) {
      if (reporte.estado_verificacion === 'aprobada') {
        return 'VERIFICADA - Aprobada';
      } else if (reporte.estado_verificacion === 'rechazada') {
        return 'VERIFICADA - Rechazada';
      }
    }
    
    return reporte.verificada ? 'VERIFICADA' : 'CONSOLIDADO';
  };

  // Función para asignar la clase de estilo según el estado
  const getEstadoClass = (): string => {
    if (reporte) {
      // Estados del nuevo sistema de doble verificación
      if (reporte.estado_doble_verificacion) {
        switch (reporte.estado_doble_verificacion) {
          case 'pendiente_auditor1':
            return 'bg-gray-100 text-gray-800';
          case 'pendiente_auditor2':
            return 'bg-blue-100 text-blue-800';
          case 'aprobada':
            return 'bg-green-100 text-green-800';
          case 'rechazada':
            return 'bg-red-100 text-red-800';
          case 'conflicto':
            return 'bg-yellow-100 text-yellow-800';
          default:
            return 'bg-purple-100 text-purple-800';
        }
      }
      
      // Compatibilidad con sistema anterior
      if (reporte.verificada) {
        if (reporte.estado_verificacion === 'rechazada') {
          return 'bg-red-100 text-red-800';
        } else if (reporte.estado_verificacion === 'aprobada') {
          return 'bg-green-100 text-green-800';
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
      <td className="px-6 py-4 whitespace-normal break-words">
        <button
          onClick={() => onVerHistorial(cliente)}
          className="text-sm font-medium text-gray-900 hover:text-purple-600"
        >
          {cliente.NOMBRE}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-normal break-words text-sm text-gray-500">
        {getFuente(cliente.ID)}
      </td>
      <td className="px-6 py-4 whitespace-normal break-words">
        <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${getEstadoClass()}`}>
          {getEstadoFinal()}
          {reporte && reporte.verificada && reporte.estado_verificacion === 'aprobada' && (
            <CheckCircle className="h-4 w-4 text-blue-600" />
          )}
          {reporte && reporte.supervisor_resolution_timestamp && (
            <span className="text-amber-600" title="Resuelto por Supervisor">👑</span>
          )}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-normal break-words text-sm text-gray-500">
        {cliente.WHATSAPP}
      </td>
      <td className="px-6 py-4 whitespace-normal break-words text-right text-sm font-medium">
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => onVerHistorial(cliente)}
            className="px-3 py-1 text-purple-600 hover:text-purple-900 border border-purple-200 rounded hover:bg-purple-50"
          >
            Ver Historial
          </button>
          <button
            onClick={() => onVerChat(cliente)}
            className="inline-flex items-center px-3 py-1 text-white bg-indigo-600 hover:bg-indigo-700 rounded"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chat
          </button>
          {reporte && (
            (() => {
              const estadoDoble = reporte.estado_doble_verificacion;
              
              // Sistema de doble verificación
              if (estadoDoble) {
                switch (estadoDoble) {
                  case 'pendiente_auditor1':
                  case 'pendiente_auditor2':
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onVerificarVenta(cliente)}
                          className="px-3 py-1 rounded border bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
                        >
                          {estadoDoble === 'pendiente_auditor1' ? 'Verificar (1er auditor)' : 'Verificar (2do auditor)'}
                        </button>
                        {/* Mostrar botón eliminar si hay al menos una decisión */}
                        {(reporte.auditor1_decision || reporte.auditor2_decision) && (
                          <button
                            onClick={() => onEliminarDecision(cliente)}
                            className="px-3 py-1 rounded border bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200"
                            title="Eliminar mi propia decisión"
                          >
                           Cambiar decisión
                          </button>
                        )}
                      </div>
                    );
                  case 'aprobada':
                  case 'rechazada':
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onDesverificarVenta(cliente)}
                          className="px-3 py-1 rounded border bg-red-100 text-red-800 hover:bg-red-200"
                        >
                          Quitar verificación
                        </button>
                        {/* Mostrar botón de historial si la venta fue resuelta por supervisor */}
                        {(reporte.supervisor_resolution_timestamp || (reporte.auditor1_decision && reporte.auditor2_decision)) && (
                          <button
                            onClick={() => onVerHistorialResolucion(cliente)}
                            className="px-3 py-1 rounded border bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200 relative"
                            title={reporte.supervisor_resolution_timestamp ? "Resuelto por Supervisor" : "Ver historial de verificación"}
                          >
                            Ver Historial
                            {reporte.supervisor_resolution_timestamp && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border border-white shadow-sm">
                                <span className="text-white text-xs font-bold">S</span>
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  case 'conflicto':
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onResolverConflicto(cliente)}
                          className="px-3 py-1 rounded border bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200"
                        >
                          Resolver Conflicto
                        </button>
                        {/* En conflicto, permitir que cada auditor elimine su decisión */}
                        <button
                          onClick={() => onEliminarDecision(cliente)}
                          className="px-3 py-1 rounded border bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200"
                          title="Eliminar mi propia decisión"
                        >
                          Cambiar decisión
                        </button>
                      </div>
                    );
                  default:
                    return null;
                }
              }
              
              // Sistema anterior (compatibilidad)
              if (reporte.verificada) {
                return (
                  <button
                    onClick={() => onDesverificarVenta(cliente)}
                    className="px-3 py-1 rounded border bg-red-100 text-red-800 hover:bg-red-200"
                  >
                    Quitar verificación
                  </button>
                );
              } else if (enDisputa) {
                return (
                  <span className="px-3 py-1 rounded border bg-yellow-100 text-yellow-800 border-yellow-300">
                    EN DISPUTA
                  </span>
                );
              } else {
                return (
                  <button
                    onClick={() => onVerificarVenta(cliente)}
                    className="px-3 py-1 rounded border bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
                  >
                    Verificar
                  </button>
                );
              }
            })()
          )}
        </div>
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
  onDesverificarVenta,
  onResolverDisputa,
  onVerChat,
  onResolverConflicto,
  onVerHistorialResolucion,
  onEliminarDecision,
}: ClientesAsesorModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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

  const clientesEnDisputa = useMemo(() => {
    const ids = new Set();
    duplicados.forEach(grupo => {
      grupo.forEach(cliente => {
        ids.add(cliente.ID);
      });
    });
    return Array.from(ids);
  }, [duplicados]);

  const parseFechaReporte = (fecha: any): number => {
    let t = new Date(fecha).getTime();
    if (isNaN(t)) t = Number(fecha) * 1000;
    return t;
  };

  const getReporteForCliente = (cliente: Cliente): Reporte | undefined => {
    const clientReports = reportes.filter(r => r.ID_CLIENTE === cliente.ID);
    if (clientReports.length === 0) return undefined;
    clientReports.sort((a, b) => parseFechaReporte(b.FECHA_REPORTE) - parseFechaReporte(a.FECHA_REPORTE));
    return clientReports[0];
  };


  const parseFechaEvento = (fechaEvento: any): number => {
    let t = new Date(fechaEvento).getTime();
    if (isNaN(t)) t = Number(fechaEvento) * 1000;
    return t;
  };

  const getFuente = (clienteId: number) => {
    const registrosCliente = registros.filter(r => r.ID_CLIENTE === clienteId);
    if (registrosCliente.length > 0) {
      registrosCliente.sort((a, b) => parseFechaEvento(a.FECHA_EVENTO) - parseFechaEvento(b.FECHA_EVENTO));
      return registrosCliente[0].TIPO_EVENTO?.trim() || 'Desconocido';
    }
    return 'Desconocido';
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-8xl shadow-lg rounded-md bg-white">
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
                const enDisputa = clientesEnDisputa.includes(cliente.ID);
                return (
                  <ClienteRow
                    key={cliente.ID}
                    cliente={cliente}
                    reporte={reporte}
                    getFuente={getFuente}
                    onVerHistorial={onVerHistorial}
                    onVerificarVenta={onVerificarVenta}
                    onDesverificarVenta={onDesverificarVenta}
                    onVerChat={onVerChat}
                    onResolverConflicto={onResolverConflicto}
                    onVerHistorialResolucion={onVerHistorialResolucion}
                    onEliminarDecision={onEliminarDecision}
                    enDisputa={enDisputa}
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
  onConfirm: (decision: 'aprobada' | 'rechazada', comentario: string, auditorId: string) => void;
  onCancel: () => void;
}
function ModalVerificarVenta({ cliente, onConfirm, onCancel }: ModalVerificarVentaProps) {
  const [decision, setDecision] = useState<'aprobada' | 'rechazada'>('aprobada');
  const [comentario, setComentario] = useState('');
  const [password, setPassword] = useState('');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleConfirm = () => {
    if (!password.trim()) {
      toast.error('Debe ingresar su contraseña de auditor.');
      return;
    }
    if (decision === 'rechazada' && !comentario.trim()) {
      toast.error('Debe ingresar el motivo del rechazo.');
      return;
    }
    const validPasswords = ['0911', '092501'];
    if (!validPasswords.includes(password)) {
      toast.error('Contraseña incorrecta.');
      return;
    }
    onConfirm(decision, decision === 'rechazada' ? comentario : '', password);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">Verificar Venta de {cliente.NOMBRE}</h2>
        <p className="text-sm text-gray-600 mb-4">Ingrese su decisión como auditor. Se requiere la decisión de 2 auditores independientes.</p>
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
        {/* Campo de contraseña del auditor actual */}
        <div className="mb-4">
          <label className="block font-medium">Su Contraseña de Auditor:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded-md p-2"
            placeholder="Escriba su contraseña"
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

interface ModalDesverificarVentaProps {
  cliente: Cliente;
  onConfirm: (comentario: string) => void;
  onCancel: () => void;
}
function ModalDesverificarVenta({ cliente, onConfirm, onCancel }: ModalDesverificarVentaProps) {
  const [password, setPassword] = useState('');
  const [comentario, setComentario] = useState('');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleConfirm = () => {
    if (!password.trim()) {
      toast.error('Debe ingresar su contraseña de auditor.');
      return;
    }
    const validPasswords = ['0911', '092501'];
    if (!validPasswords.includes(password)) {
      toast.error('Contraseña incorrecta.');
      return;
    }
    onConfirm(comentario); // Puedes enviar el comentario o simplemente ""
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">Quitar verificación de {cliente.NOMBRE}</h2>
        <p className="text-sm text-gray-600 mb-4">Esta acción reiniciará el proceso de doble verificación.</p>
        {/* Campo de contraseña del auditor */}
        <div className="mb-4">
          <label className="block font-medium">Su Contraseña de Auditor:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded-md p-2"
            placeholder="Escriba su contraseña"
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


/* ––––––– MODAL: Eliminar Propia Decisión ––––––– */
interface ModalEliminarDecisionProps {
  cliente: Cliente;
  reporte: Reporte;
  onConfirm: (auditorId: string) => void;
  onCancel: () => void;
}

function ModalEliminarDecision({ cliente, reporte, onConfirm, onCancel }: ModalEliminarDecisionProps) {
  const [password, setPassword] = useState('');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const getAuditorName = (auditorId: string | null) => {
    if (!auditorId) return 'Auditor desconocido';
    const auditorNames: { [key: string]: string } = {
      '0911': 'Auditor Principal',
      '092501': 'Auditor Secundario'
    };
    return auditorNames[auditorId] || `Auditor ${auditorId}`;
  };

  const handleConfirm = () => {
    if (!password.trim()) {
      toast.error('Debe ingresar su contraseña de auditor.');
      return;
    }
    
    const validPasswords = ['0911', '092501'];
    if (!validPasswords.includes(password)) {
      toast.error('Contraseña incorrecta.');
      return;
    }

    // Verificar si este auditor tiene una decisión registrada
    const tieneDecision = reporte.auditor1_id === password || reporte.auditor2_id === password;
    if (!tieneDecision) {
      toast.error('No tienes ninguna decisión registrada para esta venta.');
      return;
    }

    onConfirm(password);
  };

  // Determinar qué decisión puede eliminar este auditor
  const getDecisionDelAuditor = (auditorId: string) => {
    if (reporte.auditor1_id === auditorId) {
      return {
        decision: reporte.auditor1_decision,
        comentario: reporte.auditor1_comentario,
        timestamp: reporte.auditor1_timestamp,
        posicion: 'primera'
      };
    } else if (reporte.auditor2_id === auditorId) {
      return {
        decision: reporte.auditor2_decision,
        comentario: reporte.auditor2_comentario,
        timestamp: reporte.auditor2_timestamp,
        posicion: 'segunda'
      };
    }
    return null;
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Fecha no disponible';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-red-600">
          Cambiar decisión
        </h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Ingrese su contraseña para eliminar <strong>únicamente su propia decisión</strong> de la venta de <strong>{cliente.NOMBRE}</strong>.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ <strong>Importante:</strong> Solo puede eliminar la decisión que usted mismo registró. 
              El sistema lo identificará por su contraseña.
            </p>
          </div>
        </div>

        {/* Campo de contraseña del auditor */}
        <div className="mb-4">
          <label className="block font-medium">Su Contraseña de Auditor:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded-md p-2"
            placeholder="Ingrese su contraseña"
          />
        </div>

        {/* Mostrar preview de qué decisión se eliminará */}
        {password && ['0911', '092501'].includes(password) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            {(() => {
              const decision = getDecisionDelAuditor(password);
              if (decision) {
                return (
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Su decisión a eliminar:</p>
                    <p className="text-sm text-blue-700">
                      <strong>Decisión:</strong> {decision.decision?.toUpperCase()}<br/>
                      <strong>Comentario:</strong> {decision.comentario || 'Sin comentario'}<br/>
                      <strong>Fecha:</strong> {formatTimestamp(decision.timestamp)}<br/>
                      <strong>Posición:</strong> {decision.posicion} decisión registrada
                    </p>
                  </div>
                );
              } else {
                return (
                  <p className="text-sm text-red-600">
                    No tienes ninguna decisión registrada para esta venta.
                  </p>
                );
              }
            })()}
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cambiar decisión
          </button>
        </div>
      </div>
    </div>
  );
}

/* ––––––– MODAL: Ver Historial de Resolución ––––––– */
interface ModalVerHistorialResolucionProps {
  cliente: Cliente;
  reporte: Reporte;
  onClose: () => void;
}

function ModalVerHistorialResolucion({ cliente, reporte, onClose }: ModalVerHistorialResolucionProps) {
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    // Guardar el valor actual del overflow
    const originalOverflow = document.body.style.overflow;
    // Bloquear scroll
    document.body.style.overflow = 'hidden';
    
    // Cleanup: restaurar el scroll cuando el modal se cierre
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Fecha no disponible';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getAuditorName = (auditorId: string | null) => {
    if (!auditorId) return 'Auditor desconocido';
    // Mapeo de IDs a nombres de auditores
    const auditorNames: { [key: string]: string } = {
      '0911': 'Auditor Principal',
      '092501': 'Auditor Secundario',
      '09250001': 'Supervisor'
    };
    return auditorNames[auditorId] || `Auditor ${auditorId}`;
  };

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-green-600">
            ✅ Historial de Resolución - {cliente.NOMBRE}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-bold text-green-800 mb-2">📋 Estado Final</h3>
            <p className="text-green-700">
              <strong>Decisión:</strong> <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                reporte.estado_verificacion === 'aprobada' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {reporte.estado_verificacion?.toUpperCase()}
              </span>
            </p>
            {reporte.supervisor_resolution_timestamp && (
              <p className="text-green-700 mt-1">
                <strong>Resuelto por supervisor el:</strong> {formatTimestamp(reporte.supervisor_resolution_timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* Cronología de decisiones */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-800 border-b pb-2">
            📈 Cronología de Decisiones
          </h3>

          {/* Decisión del Auditor 1 */}
          {reporte.auditor1_decision && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-blue-800 flex items-center">
                  <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-2 text-sm">1</span>
                  {getAuditorName(reporte.auditor1_id)} - Primera Revisión
                </h4>
                <span className="text-sm text-blue-600">
                  {formatTimestamp(reporte.auditor1_timestamp)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Decisión:</strong></p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    reporte.auditor1_decision === 'aprobada' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {reporte.auditor1_decision?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Comentario:</strong></p>
                  <p className="text-sm text-gray-800 bg-white p-2 rounded border">
                    {reporte.auditor1_comentario || 'Sin comentario'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Decisión del Auditor 2 */}
          {reporte.auditor2_decision && (
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-purple-800 flex items-center">
                  <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-2 text-sm">2</span>
                  {getAuditorName(reporte.auditor2_id)} - Segunda Revisión
                </h4>
                <span className="text-sm text-purple-600">
                  {formatTimestamp(reporte.auditor2_timestamp)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Decisión:</strong></p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    reporte.auditor2_decision === 'aprobada' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {reporte.auditor2_decision?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Comentario:</strong></p>
                  <p className="text-sm text-gray-800 bg-white p-2 rounded border">
                    {reporte.auditor2_comentario || 'Sin comentario'}
                  </p>
                </div>
              </div>
              
              {/* Mostrar si hubo conflicto */}
              {reporte.auditor1_decision !== reporte.auditor2_decision && (
                <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded">
                  <p className="text-yellow-800 text-sm font-semibold">
                    ⚠️ CONFLICTO DETECTADO: Los auditores no coincidieron en sus decisiones
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resolución del Supervisor (solo si hubo conflicto) */}
          {reporte.supervisor_resolution_timestamp && (
            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-amber-800 flex items-center">
                  <span className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-2 text-sm">👑</span>
                  Resolución Final del Supervisor
                </h4>
                <span className="text-sm text-amber-600">
                  {formatTimestamp(reporte.supervisor_resolution_timestamp)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Decisión Final:</strong></p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    reporte.estado_verificacion === 'aprobada' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {reporte.estado_verificacion?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Comentario de Resolución:</strong></p>
                  <p className="text-sm text-gray-800 bg-white p-2 rounded border">
                    {reporte.supervisor_resolution_comment || 'Sin comentario de resolución'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resumen del proceso */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-bold text-gray-800 mb-2">📊 Resumen del Proceso</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• <strong>Total de revisiones:</strong> {[reporte.auditor1_decision, reporte.auditor2_decision].filter(Boolean).length} auditores</p>
            <p>• <strong>Hubo conflicto:</strong> {reporte.auditor1_decision !== reporte.auditor2_decision ? 'Sí' : 'No'}</p>
            <p>• <strong>Requirió resolución de supervisor:</strong> {reporte.supervisor_resolution_timestamp ? 'Sí' : 'No'}</p>
            <p>• <strong>Estado final:</strong> {reporte.estado_verificacion?.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ––––––– MODAL: Resolver Conflicto de Auditores ––––––– */
interface ModalResolverConflictoProps {
  cliente: Cliente;
  reporte: Reporte;
  onResolve: (decision: 'aprobada' | 'rechazada', comentario: string) => void;
  onCancel: () => void;
}

function ModalResolverConflicto({ cliente, reporte, onResolve, onCancel }: ModalResolverConflictoProps) {
  const [decision, setDecision] = useState<'aprobada' | 'rechazada'>('aprobada');
  const [comentario, setComentario] = useState('');
  const [password, setPassword] = useState('');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleConfirm = () => {
    if (!password.trim()) {
      toast.error('Debe ingresar la contraseña de supervisor.');
      return;
    }
    if (!comentario.trim()) {
      toast.error('Debe ingresar un comentario explicando la resolución del conflicto.');
      return;
    }
    // Contraseña especial para supervisores que pueden resolver conflictos
    if (password !== '09250001') {
      toast.error('Solo los supervisores pueden resolver conflictos.');
      return;
    }
    onResolve(decision, comentario);
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Fecha no disponible';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          ⚠️ Resolver Conflicto de Verificación
        </h2>
        <p className="text-gray-700 mb-6">
          Los auditores no coincidieron en la verificación de la venta de <strong>{cliente.NOMBRE}</strong>. 
          Como supervisor, debe tomar la decisión final.
        </p>

        {/* Mostrar las decisiones en conflicto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h3 className="font-bold text-blue-800 mb-2">🔵 Auditor 1</h3>
            <p><strong>Decisión:</strong> <span className={`px-2 py-1 rounded text-sm ${reporte.auditor1_decision === 'aprobada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {reporte.auditor1_decision?.toUpperCase()}
            </span></p>
            <p><strong>Comentario:</strong> {reporte.auditor1_comentario || 'Sin comentario'}</p>
            <p><strong>Fecha:</strong> {formatTimestamp(reporte.auditor1_timestamp)}</p>
          </div>

          <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
            <h3 className="font-bold text-purple-800 mb-2">🟣 Auditor 2</h3>
            <p><strong>Decisión:</strong> <span className={`px-2 py-1 rounded text-sm ${reporte.auditor2_decision === 'aprobada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {reporte.auditor2_decision?.toUpperCase()}
            </span></p>
            <p><strong>Comentario:</strong> {reporte.auditor2_comentario || 'Sin comentario'}</p>
            <p><strong>Fecha:</strong> {formatTimestamp(reporte.auditor2_timestamp)}</p>
          </div>
        </div>

        {/* Decisión del supervisor */}
        <div className="border-t pt-6">
          <h3 className="font-bold text-gray-800 mb-4">👑 Decisión Final del Supervisor</h3>
          
          <div className="mb-4">
            <label className="block font-medium">Decisión Final:</label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as 'aprobada' | 'rechazada')}
              className="mt-1 block w-full border rounded-md p-2"
            >
              <option value="aprobada">Aprobar</option>
              <option value="rechazada">Rechazar</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block font-medium">Comentario de Resolución:</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              placeholder="Explique por qué toma esta decisión final..."
              rows={3}
            />
          </div>

          <div className="mb-6">
            <label className="block font-medium">Contraseña de Supervisor:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              placeholder="Contraseña de supervisor"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Resolver Conflicto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ––––––– MODAL: Resolver Disputa ––––––– */
interface ModalResolverDisputaProps {
  grupo: Cliente[];
  asesores: Asesor[];
  onResolve: (cliente: Cliente, comentario: string) => void;
  onCancel: () => void;
}

function ModalResolverDisputa({ grupo, asesores, onResolve, onCancel }: ModalResolverDisputaProps) {
  const [comentario, setComentario] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const getNombreAsesor = (id: number | null) => {
    if (id === null) return "Desconocido";
    const asesor = asesores.find(a => a.ID === id);
    return asesor ? asesor.NOMBRE : "Desconocido";
  };

  const handleResolve = (cliente: Cliente) => {
    if (!comentario.trim()) {
      toast.error("Por favor, ingrese el motivo de rechazo para las ventas duplicadas.");
      return;
    }
    if (!password1.trim() || !password2.trim()) {
      toast.error("Por favor, ingrese ambas claves de auditor para resolver la disputa.");
      return;
    }
    if (password1 !== '0911' || password2 !== '0911') {
      toast.error("Una o ambas claves son incorrectas.");
      return;
    }
    if (password1 === password2) {
      toast.error("Las claves deben ser de diferentes auditores.");
      return;
    }
    onResolve(cliente, comentario);
  };

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Resolver Disputa de Ventas Duplicadas
        </h2>
        <p className="text-gray-700 mb-4">
          Se han detectado ventas duplicadas. Ingrese el motivo de rechazo que se aplicará a todas las ventas duplicadas (excepto la seleccionada como válida), y confirme con las claves de 2 auditores.
        </p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Motivo de Rechazo
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Escriba el motivo del rechazo..."
            rows={3}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Clave Auditor 1
          </label>
          <input
            type="password"
            value={password1}
            onChange={(e) => setPassword1(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Ingrese la primera clave"
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Clave Auditor 2
          </label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Ingrese la segunda clave"
          />
        </div>
        <p className="text-gray-700 mb-2">
          Seleccione el asesor al que se asignará la venta válida:
        </p>
        <ul className="space-y-3 mb-6">
          {grupo.map(cliente => (
            <li key={cliente.ID} className="border border-gray-200 rounded p-3 hover:bg-gray-50">
              <button
                onClick={() => handleResolve(cliente)}
                className="w-full text-left text-lg text-blue-700 font-medium hover:underline"
              >
                {getNombreAsesor(cliente.ID_ASESOR)}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
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

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
  const [ventaDesverificar, setVentaDesverificar] = useState<Cliente | null>(null);
  const [clienteParaChat, setClienteParaChat] = useState<Cliente | null>(null);
  const [conflictoParaResolver, setConflictoParaResolver] = useState<{cliente: Cliente, reporte: Reporte} | null>(null);
  const [historialResolucionParaVer, setHistorialResolucionParaVer] = useState<{cliente: Cliente, reporte: Reporte} | null>(null);
  const [decisionParaEliminar, setDecisionParaEliminar] = useState<{cliente: Cliente, reporte: Reporte} | null>(null);

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

    /*** 1. Hoja "Parametros" ***/
    // Agrupar fuentes: si la fuente no es "LINKS" ni "MASIVOS", se agrupa como "HOTMART"
    // Para la hoja "Parametros"
    const uniqueSources = Array.from(
      new Set(
        registros
          .map(r => {
            let fuente = (r.TIPO_EVENTO?.trim() || 'Desconocido');
            // Si la fuente NO es LINK, MASIVOS o ASIGNACION_VIP, se agrupa como HOTMART
            if (!['LINK', 'MASIVOS', 'ASIGNACION_VIP'].includes(fuente.toUpperCase())) {
              fuente = 'HOTMART';
            }
            // Renombrar ASIGNACION_VIP a VIP para mejor visualización
            if (fuente.toUpperCase() === 'ASIGNACION_VIP') {
              fuente = 'VIP';
            }
            return fuente;
          })
          .filter(f => f.toUpperCase() !== 'COMPRA')
      )
    );
    const numSources = uniqueSources.length;
    // Construir la tabla de comisión por fuente
    const parametrosData = [];
    parametrosData.push(["Fuente", "Comisión"]);
    uniqueSources.forEach(source => {
      parametrosData.push([source, Number(commissionData[source]) || 0]);
    });
    // Separador y sección de bonos (ubicados en columnas D a H)
    parametrosData.push([]); // fila vacía
    parametrosData.push(["", "", "", "Bono10", "Bono20", "Bono30", "Bono50", "BestSellerBonus"]);
    parametrosData.push(["", "", "", Number(bonus10) || 0, Number(bonus20) || 0, Number(bonus30) || 0, Number(bonus50) || 0, Number(bestSellerBonus) || 0]);

    const wsParametros = XLSX.utils.aoa_to_sheet(parametrosData);
    XLSX.utils.book_append_sheet(workbook, wsParametros, "Parametros");

    /*** 2. Hoja "Detalle" ***/
    const detalleData = [];
    detalleData.push(["Asesor", "Cliente", "WhatsApp", "Fuente", "Estado", "Comisión"]);

    // Función auxiliar ya definida en tu código (para obtener la fuente según el primer registro)
    const obtenerFuente = (clienteId: number): string => {
      const registrosCliente = registros.filter(r => r.ID_CLIENTE === clienteId);
      if (registrosCliente.length > 0) {
        registrosCliente.sort((a, b) => {
          let tA = new Date(a.FECHA_EVENTO).getTime();
          let tB = new Date(b.FECHA_EVENTO).getTime();
          if (isNaN(tA)) tA = Number(a.FECHA_EVENTO) * 1000;
          if (isNaN(tB)) tB = Number(b.FECHA_EVENTO) * 1000;
          return tA - tB;
        });
        return registrosCliente[0].TIPO_EVENTO?.trim() || 'Desconocido';
      }
      return 'Desconocido';
    };

    asesores.forEach(asesor => {
      const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
      clientesAsesor.forEach(cliente => {
        const reporte = reportes.find(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA');
        const validaParaComision = reporte && reporte.verificada && (reporte.estado_verificacion === 'aprobada');
        const estado = reporte ? (validaParaComision ? "VERIFICADA" : "NO APLICABLE") : "SIN REPORTE";
        // Obtener fuente y agruparla
        let fuente = obtenerFuente(cliente.ID);
        if (!['LINK', 'MASIVOS', 'ASIGNACION_VIP'].includes(fuente.toUpperCase())) {
          fuente = 'HOTMART';
        }
        // Renombrar ASIGNACION_VIP a VIP para mejor visualización
        if (fuente.toUpperCase() === 'ASIGNACION_VIP') {
          fuente = 'VIP';
        }
        const currentRow = detalleData.length + 1; // Fila actual (la 1 es encabezado)
        const commissionFormula = `=IF(E${currentRow}="VERIFICADA",IFERROR(VLOOKUP(D${currentRow},Parametros!$A$2:$B$${numSources + 1},2,FALSE),0),0)`;

        detalleData.push([
          asesor.NOMBRE,
          cliente.NOMBRE,
          cliente.WHATSAPP,
          fuente,
          estado,
          { f: commissionFormula }
        ]);
      });
    });
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
    XLSX.utils.book_append_sheet(workbook, wsDetalle, "Detalle");

    /*** 3. Hoja "Resumen" ***/
    // Nuevo encabezado con columnas para ventas reportadas y válidas
    const resumenData = [];
    resumenData.push([
      "Asesor",
      "Ventas Reportadas",
      "Ventas Válidas",
      "Total Comisión",
      "Bonus 50",
      "Best Seller Bonus",
      "Bonus Fuente",
      "Total Ingreso"
    ]);

    const bonusRow = numSources + 4;
    const numAsesores = asesores.length;

    asesores.forEach((asesor, idx) => {
      const row = idx + 2; // fila en "Resumen" (la 1 es el encabezado)
      const totalReportadasFormula = `=COUNTIFS(Detalle!$A:$A, A${row}, Detalle!$E:$E, "<>SIN REPORTE")`;
      const totalValidasFormula = `=COUNTIFS(Detalle!$A:$A, A${row}, Detalle!$E:$E, "VERIFICADA")`;
      const totalComisionFormula = `=SUMIFS(Detalle!$F:$F,Detalle!$A:$A, A${row},Detalle!$E:$E, "VERIFICADA")`;
      const bonus50Formula = `=IF(C${row}>=50,Parametros!$G$${bonusRow},0)`;
      const bestSellerFormula = `=IF(AND(C${row}>30,RANK(C${row},$C$2:$C$${numAsesores + 1},0)=1),Parametros!$H$${bonusRow},0)`;


      // Fórmula para calcular el bonus por fuente para cada fuente agrupada
      let bonusFuenteParts = uniqueSources.map(source => {
        return `(IF(COUNTIFS(Detalle!$A:$A,A${row},Detalle!$D:$D,"${source}",Detalle!$E:$E,"VERIFICADA")>=10,Parametros!$D$${bonusRow},0)
  +IF(COUNTIFS(Detalle!$A:$A,A${row},Detalle!$D:$D,"${source}",Detalle!$E:$E,"VERIFICADA")>=20,Parametros!$E$${bonusRow},0)
  +IF(COUNTIFS(Detalle!$A:$A,A${row},Detalle!$D:$D,"${source}",Detalle!$E:$E,"VERIFICADA")>=30,Parametros!$F$${bonusRow},0))`;
      });
      const bonusFuenteFormula = bonusFuenteParts.join("+");
      const totalIngresoFormula = `=D${row}+E${row}+F${row}+(${bonusFuenteFormula})`;

      resumenData.push([
        asesor.NOMBRE,
        { f: totalReportadasFormula },
        { f: totalValidasFormula },
        { f: totalComisionFormula },
        { f: bonus50Formula },
        { f: bestSellerFormula },
        { f: bonusFuenteFormula },
        { f: totalIngresoFormula }
      ]);
    });
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, wsResumen, "Resumen");

    // Escritura final del archivo (el nombre incluye la fecha actual)
    XLSX.writeFile(
      workbook,
      `Auditoria-Ventas-${new Date().toLocaleDateString()}.xlsx`
    );
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
        fetchAllPages('/GERSSON_CLIENTES', 'or=(ESTADO.ilike.*PAGADO*,ESTADO.ilike.*CONSOLIDADA*)', 100),
        fetchAllPages(
          '/GERSSON_REPORTES',
          'or=(ESTADO_NUEVO.ilike.*PAGADO*,ESTADO_NUEVO.ilike.*CONSOLIDADA*)',
          100
        ),
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

  const getNombreAsesor = (asesorId: number | null): string => {
    if (asesorId === null) return '';
    const asesor = asesores.find(a => a.ID === asesorId);
    return asesor ? asesor.NOMBRE : '';
  };

  const getEstadisticasAsesor = (asesorId: number) => {
    const reportesAsesor = reportesFiltrados.filter(r => r.ID_ASESOR === asesorId);
    
    const ventasReportadas = Array.from(
        new Set(reportesAsesor.filter(r => r.ESTADO_NUEVO === 'PAGADO').map(r => r.ID_CLIENTE))
    ).length;

    // Usar reportesFiltrados para el conteo inicial de consolidadas por producto
    const reportesAsesorConsolidados = reportesAsesor.filter(
        r => r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'
    );
    const clientesConsolidadosIds = Array.from(new Set(reportesAsesorConsolidados.map(r => r.ID_CLIENTE)));
    
    let ventasAprobadas = 0;
    let ventasRechazadas = 0;
    let ventasPorVerificar = 0;

    for (const clienteId of clientesConsolidadosIds) {
        if (!clienteId) continue;
        
        // Usar TODOS los reportes (sin filtro de producto) para encontrar el estado de verificación más reciente del cliente
        const todosLosReportesCliente = reportes.filter(r => r.ID_CLIENTE === clienteId && (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'));
        
        if (todosLosReportesCliente.length === 0) continue;

        todosLosReportesCliente.sort((a, b) => {
            const fechaA = typeof a.FECHA_REPORTE === 'string' ? parseInt(a.FECHA_REPORTE, 10) : (a.FECHA_REPORTE || 0);
            const fechaB = typeof b.FECHA_REPORTE === 'string' ? parseInt(b.FECHA_REPORTE, 10) : (b.FECHA_REPORTE || 0);
            return fechaB - fechaA;
        });
        
        const ultimoReporte = todosLosReportesCliente[0];
        
        if (ultimoReporte) {
            if (ultimoReporte.verificada) {
                if (ultimoReporte.estado_verificacion === 'aprobada') {
                    ventasAprobadas++;
                } else if (ultimoReporte.estado_verificacion === 'rechazada') {
                    ventasRechazadas++;
                }
            } else {
                ventasPorVerificar++;
            }
        }
    }

    return {
        ventasReportadas,
        ventasConsolidadas: clientesConsolidadosIds.length,
        ventasAprobadas,
        ventasRechazadas,
        ventasPorVerificar
    };
  };

  const normalizeString = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const asesoresFiltrados = useMemo(() => {
    return asesores.filter(asesor =>
      normalizeString(asesor.NOMBRE).includes(normalizeString(searchTerm)) ||
      normalizeString(asesor.WHATSAPP || '').includes(normalizeString(searchTerm))
    );
  }, [asesores, searchTerm]);

  const sortedAsesores = [...asesoresFiltrados].sort((a, b) => a.NOMBRE.localeCompare(b.NOMBRE));

  // Calcular estadísticas globales
  const estadisticasGlobales = useMemo(() => {
    let totalConsolidado = 0;
    let totalAprobadas = 0;
    let totalRechazadas = 0;
    let totalPorVerificar = 0;
    let totalReportadas = 0;

    asesores.forEach(asesor => {
      const stats = getEstadisticasAsesor(asesor.ID);
      totalReportadas += stats.ventasReportadas;
      totalConsolidado += stats.ventasConsolidadas;
      totalAprobadas += stats.ventasAprobadas;
      totalRechazadas += stats.ventasRechazadas;
      totalPorVerificar += stats.ventasPorVerificar;
    });

    const porcentajeVerificacion = totalConsolidado > 0 
      ? ((totalAprobadas + totalRechazadas) / totalConsolidado * 100).toFixed(1)
      : '0';

    const porcentajeAprobacion = (totalAprobadas + totalRechazadas) > 0
      ? (totalAprobadas / (totalAprobadas + totalRechazadas) * 100).toFixed(1)
      : '0';

    // Analizar verificaciones por auditor específico
    const verificacionesPorAuditor: { [key: string]: number } = {};
    let verificacionesSupervisor = 0;

    const reportesConsolidados = reportesFiltrados.filter(r => 
      r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'
    );

    reportesConsolidados.forEach(reporte => {
      if (reporte.verificada && (reporte.estado_verificacion === 'aprobada' || reporte.estado_verificacion === 'rechazada')) {
        // Si fue resuelto por supervisor
        if (reporte.supervisor_resolution_timestamp) {
          verificacionesSupervisor++;
        }
        // Si tiene decisiones de auditores (sistema de doble verificación)
        else {
          // Contar participación de auditor1
          if (reporte.auditor1_decision && reporte.auditor1_id) {
            const auditorId = reporte.auditor1_id;
            verificacionesPorAuditor[auditorId] = (verificacionesPorAuditor[auditorId] || 0) + 1;
          }
          
          // Contar participación de auditor2
          if (reporte.auditor2_decision && reporte.auditor2_id) {
            const auditorId = reporte.auditor2_id;
            verificacionesPorAuditor[auditorId] = (verificacionesPorAuditor[auditorId] || 0) + 1;
          }
        }
      }
    });

    const totalVerificadas = totalAprobadas + totalRechazadas;

    // Función para obtener nombre del auditor
    const getAuditorName = (auditorId: string) => {
      const auditorNames: { [key: string]: string } = {
        '0911': 'Auditor Principal',
        '092501': 'Auditor Secundario'
      };
      return auditorNames[auditorId] || `Auditor ${auditorId}`;
    };

    // Calcular porcentajes por auditor y preparar datos
    const auditoresData = Object.entries(verificacionesPorAuditor).map(([auditorId, count]) => ({
      id: auditorId,
      nombre: getAuditorName(auditorId),
      verificaciones: count,
      porcentaje: totalVerificadas > 0 ? ((count / totalVerificadas) * 100).toFixed(1) : '0'
    }));

    const porcentajeSupervisor = totalVerificadas > 0 
      ? ((verificacionesSupervisor / totalVerificadas) * 100).toFixed(1)
      : '0';

    return {
      totalReportadas,
      totalConsolidado,
      totalAprobadas,
      totalRechazadas,
      totalPorVerificar,
      totalVerificadas,
      porcentajeVerificacion,
      porcentajeAprobacion,
      // Nuevas métricas por auditor
      auditoresData,
      verificacionesSupervisor,
      porcentajeSupervisor
    };
  }, [asesores, reportesFiltrados]);

  // Usa tu función getReporteForCliente para obtener el último reporte
  function isVentaVerificada(cliente: Cliente, reportes: Reporte[]): boolean {
    // Filtramos solo los reportes de "VENTA CONSOLIDADA" para el cliente
    const clientReports = reportes.filter(
      r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'
    );
    if (clientReports.length === 0) return false;
    // Ordenamos para obtener el reporte más reciente
    clientReports.sort((a, b) => {
      const fechaA = typeof a.FECHA_REPORTE === 'string' ? parseInt(a.FECHA_REPORTE, 10) : a.FECHA_REPORTE;
      const fechaB = typeof b.FECHA_REPORTE === 'string' ? parseInt(b.FECHA_REPORTE, 10) : b.FECHA_REPORTE;
      return fechaB - fechaA;
    });
    const ultimo = clientReports[0];
    return !!ultimo.verificada;
  }

  /* ––––––– ANÁLISIS DE DUPLICADOS CON WEB WORKER ––––––– */
  useEffect(() => {
    if (clientes.length > 0 && asesores.length > 0) {
      const worker = createDuplicateAnalysisWorker();
      worker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          setDuplicadosProgress(e.data.progress);
        } else if (e.data.type === 'complete') {
          const grupos: Cliente[][] = e.data.duplicados;
          // Se pueden filtrar nuevamente si se requiere:
          const gruposSinVerificadas = grupos
            .map(grupo => grupo.filter(cliente => !isVentaVerificada(cliente, reportes)))
            .filter(grupo => grupo.length > 1);
          setDuplicados(gruposSinVerificadas);
          setDuplicadosCargando(false);
        }
      };

      setDuplicadosCargando(true);
      // Aquí se filtran los clientes antes de enviarlos al worker
      const clientesParaWorker = clientesFiltradosPorProducto.filter(
        cliente => !isVentaVerificada(cliente, reportes)
      );
      worker.postMessage({ clientes: clientesParaWorker, asesores });
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
      function sonSimilares(c1, c2, umbral = 0.8) {
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
    ventasAprobadas,
    ventasRechazadas,
    ventasPorVerificar,
    onClick,
    style,
  }: {
    asesor: Asesor;
    ventasReportadas: number;
    ventasConsolidadas: number;
    ventasAprobadas: number;
    ventasRechazadas: number;
    ventasPorVerificar: number;
    onClick: () => void;
    style: React.CSSProperties;
  }) => {
    const porcentajeConsolidacion =
      ventasReportadas > 0
        ? ((ventasConsolidadas / ventasReportadas) * 100).toFixed(1)
        : '0';

    // Calcular tasas de verificación
    const totalVerificadas = ventasAprobadas + ventasRechazadas;
    const porcentajeVerificacion = ventasConsolidadas > 0
      ? ((totalVerificadas / ventasConsolidadas) * 100).toFixed(1)
      : '0';

    const porcentajeAprobacion = totalVerificadas > 0
      ? ((ventasAprobadas / totalVerificadas) * 100).toFixed(1)
      : '0';

    return (
      <div
        className="px-6 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
        onClick={onClick}
        style={style}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-[200px]">
            <h3 className="text-sm font-medium text-gray-900">{asesor.NOMBRE}</h3>
            <p className="text-sm text-gray-500">WhatsApp: {asesor.WHATSAPP}</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Ventas Reportadas */}
            <div className="text-center p-2 rounded-lg min-w-[70px]">
              <span className="block text-lg font-semibold text-green-600">{ventasReportadas}</span>
              <span className="text-xs text-gray-500">Reportadas</span>
            </div>
            
            {/* Ventas Consolidadas */}
            <div className="text-center p-2 rounded-lg min-w-[70px]">
              <span className="block text-lg font-semibold text-purple-600">{ventasConsolidadas}</span>
              <span className="text-xs text-gray-500">Consolidadas</span>
            </div>
            
            {/* Tasa Consolidación */}
            <div className="text-center p-2 rounded-lg min-w-[70px]">
              <span className="block text-lg font-semibold text-blue-600">{porcentajeConsolidacion}%</span>
              <span className="text-xs text-gray-500">% Consol.</span>
            </div>
            
            {/* Por Verificar */}
            <div className="text-center p-2 rounded-lg bg-yellow-100 min-w-[70px]">
              <span className="block text-lg font-semibold text-yellow-800">{ventasPorVerificar}</span>
              <span className="text-xs text-yellow-600">Pendientes</span>
            </div>
            
            {/* Aprobadas */}
            <div className="text-center p-2 rounded-lg bg-green-100 min-w-[70px]">
              <span className="block text-lg font-semibold text-green-800">{ventasAprobadas}</span>
              <span className="text-xs text-green-600">Aprobadas</span>
            </div>
            
            {/* Rechazadas */}
            <div className="text-center p-2 rounded-lg bg-red-100 min-w-[70px]">
              <span className="block text-lg font-semibold text-red-800">{ventasRechazadas}</span>
              <span className="text-xs text-red-600">Rechazadas</span>
            </div>

            {/* Tasa de Verificación */}
            <div className="text-center p-2 rounded-lg bg-indigo-100 min-w-[70px]">
              <span className="block text-lg font-semibold text-indigo-800">{porcentajeVerificacion}%</span>
              <span className="text-xs text-indigo-600">% Verif.</span>
            </div>

            {/* Tasa de Aprobación */}
            <div className="text-center p-2 rounded-lg bg-emerald-100 min-w-[70px]">
              <span className="block text-lg font-semibold text-emerald-800">{porcentajeAprobacion}%</span>
              <span className="text-xs text-emerald-600">% Aprob.</span>
            </div>
          </div>
        </div>
      </div>
    );
  });

  const renderAsesorRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const asesor = asesoresFiltrados[index];
      const { ventasReportadas, ventasConsolidadas, ventasAprobadas, ventasRechazadas, ventasPorVerificar } = getEstadisticasAsesor(asesor.ID);
      return (
        <AsesorItem
          key={asesor.ID}
          asesor={asesor}
          ventasReportadas={ventasReportadas}
          ventasConsolidadas={ventasConsolidadas}
          ventasAprobadas={ventasAprobadas}
          ventasRechazadas={ventasRechazadas}
          ventasPorVerificar={ventasPorVerificar}
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

  const handleResolverConflicto = (cliente: Cliente) => {
    const reporte = reportes.find(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA');
    if (reporte) {
      setConflictoParaResolver({ cliente, reporte });
    }
  };

  const handleVerHistorialResolucion = (cliente: Cliente) => {
    const reporte = reportes.find(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA');
    if (reporte) {
      setHistorialResolucionParaVer({ cliente, reporte });
    }
  };

  const handleEliminarDecision = (cliente: Cliente) => {
    const reporte = reportes.find(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA');
    if (reporte) {
      setDecisionParaEliminar({ cliente, reporte });
    }
  };

  const confirmEliminarDecision = async (auditorId: string) => {
    if (!decisionParaEliminar) return;
    
    const { cliente, reporte } = decisionParaEliminar;
    const reporteIndex = reportes.findIndex(r => r.ID === reporte.ID);
    if (reporteIndex === -1) return;

    try {
      let updateData: any = {};
      let mensajeExito = '';
      
      // Determinar qué decisión eliminar basado en el auditor ID
      if (reporte.auditor1_id === auditorId) {
        // Eliminar decisión del auditor 1
        if (reporte.auditor2_decision) {
          // Si hay segunda decisión, la primera se convierte en la única
          updateData = {
            auditor1_decision: reporte.auditor2_decision,
            auditor1_comentario: reporte.auditor2_comentario,
            auditor1_timestamp: reporte.auditor2_timestamp,
            auditor1_id: reporte.auditor2_id,
            auditor2_decision: null,
            auditor2_comentario: null,
            auditor2_timestamp: null,
            auditor2_id: null,
            estado_doble_verificacion: 'pendiente_auditor2',
            verificada: false,
            estado_verificacion: null
          };
          mensajeExito = 'Su decisión ha sido eliminada. La otra decisión queda pendiente de segunda revisión.';
        } else {
          // Solo había una decisión (la del auditor 1)
          updateData = {
            auditor1_decision: null,
            auditor1_comentario: null,
            auditor1_timestamp: null,
            auditor1_id: null,
            estado_doble_verificacion: 'pendiente_auditor1',
            verificada: false,
            estado_verificacion: null
          };
          mensajeExito = 'Su decisión ha sido eliminada. La venta vuelve a estar pendiente de primera revisión.';
        }
      } else if (reporte.auditor2_id === auditorId) {
        // Eliminar decisión del auditor 2
        updateData = {
          auditor2_decision: null,
          auditor2_comentario: null,
          auditor2_timestamp: null,
          auditor2_id: null,
          estado_doble_verificacion: 'pendiente_auditor2',
          verificada: false,
          estado_verificacion: null
        };
        mensajeExito = 'Su decisión ha sido eliminada. La venta queda pendiente de segunda revisión.';
      }

      const response = await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        updateData
      );
      
      console.log('Respuesta del PATCH (eliminar decisión):', response);
      
      // Actualizar en memoria local
      const updatedReporte = { ...reporte, ...updateData };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);
      
      toast.success(`✅ ${mensajeExito}`, {
        style: { borderRadius: '8px', background: '#16a34a', color: '#fff' },
        icon: '🗑️'
      });
      
    } catch (err) {
      console.error('❌ Error al eliminar decisión:', err);
      toast.error('Hubo un error al intentar eliminar su decisión.');
    }
    setDecisionParaEliminar(null);
  };

  const confirmResolverConflicto = async (decision: 'aprobada' | 'rechazada', comentario: string) => {
    if (!conflictoParaResolver) return;
    
    const { cliente, reporte } = conflictoParaResolver;
    const reporteIndex = reportes.findIndex(r => r.ID === reporte.ID);
    if (reporteIndex === -1) return;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const updateData = {
        estado_doble_verificacion: decision,
        verificada: true,
        estado_verificacion: decision,
        comentario_rechazo: decision === 'rechazada' ? comentario : '',
        // Agregar timestamp de resolución del supervisor
        supervisor_resolution_timestamp: timestamp,
        supervisor_resolution_comment: comentario
      };

      const response = await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        updateData
      );
      
      console.log('Respuesta del PATCH (resolver conflicto):', response);
      
      // Actualizar en memoria local
      const updatedReporte = { ...reporte, ...updateData };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);
      
      toast.success(`✅ Conflicto resuelto: Venta de ${cliente.NOMBRE} ${decision === 'aprobada' ? 'APROBADA' : 'RECHAZADA'} por supervisor.`, {
        style: { borderRadius: '8px', background: '#16a34a', color: '#fff' },
        icon: '👑'
      });
      
    } catch (err) {
      console.error('❌ Error al resolver conflicto:', err);
      toast.error('Hubo un error al intentar resolver el conflicto.');
    }
    setConflictoParaResolver(null);
  };

  const confirmDesverificarVenta = async (cliente: Cliente, comentario: string) => {
    const reporteIndex = reportes.findIndex(
      r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'
    );
    if (reporteIndex === -1) return;
    const reporte = reportes[reporteIndex];
    try {
      const response = await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        {
          verificada: false,
          estado_verificacion: '',
          comentario_rechazo: comentario,
          // Reiniciar el proceso de doble verificación
          auditor1_decision: null,
          auditor1_comentario: null,
          auditor1_timestamp: null,
          auditor1_id: null,
          auditor2_decision: null,
          auditor2_comentario: null,
          auditor2_timestamp: null,
          auditor2_id: null,
          estado_doble_verificacion: 'pendiente_auditor1'
        }
      );
      console.log('Respuesta del PATCH (desverificar):', response);
      const updatedReporte = { 
        ...reporte, 
        verificada: false, 
        estado_verificacion: '', 
        comentario_rechazo: comentario,
        auditor1_decision: null,
        auditor1_comentario: null,
        auditor1_timestamp: null,
        auditor1_id: null,
        auditor2_decision: null,
        auditor2_comentario: null,
        auditor2_timestamp: null,
        auditor2_id: null,
        estado_doble_verificacion: 'pendiente_auditor1'
      };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);
      toast.success(`✅ Verificación de ${cliente.NOMBRE} reiniciada. Requiere nuevas decisiones de 2 auditores.`, {
        style: { borderRadius: '8px', background: '#4f46e5', color: '#fff' },
        icon: '🔄'
      });
    } catch (err) {
      console.error('❌ Error al desverificar la venta:', err);
      alert('Hubo un error al intentar desverificar la venta.');
    }
  };

  // Función de verificación con doble auditoría independiente
  const confirmVerificarVenta = async (cliente: Cliente, decision: 'aprobada' | 'rechazada', comentario: string, auditorId: string) => {
    const reporteIndex = reportes.findIndex(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA');
    if (reporteIndex === -1) return;
    const reporte = reportes[reporteIndex];
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Determinar si es el primer o segundo auditor
      const esSegundoAuditor = reporte.auditor1_decision && !reporte.auditor2_decision;
      
      let updateData: any = {};
      let mensaje = '';
      
      if (!reporte.auditor1_decision) {
        // Primer auditor
        updateData = {
          auditor1_decision: decision,
          auditor1_comentario: comentario,
          auditor1_timestamp: timestamp,
          auditor1_id: auditorId,
          estado_doble_verificacion: 'pendiente_auditor2'
        };
        mensaje = `📝 Su decisión ha sido registrada. Esperando decisión del segundo auditor.`;
        
      } else if (!reporte.auditor2_decision && reporte.auditor1_id !== auditorId) {
        // Segundo auditor (y es diferente al primero)
        const primeraDecision = reporte.auditor1_decision;
        const coinciden = primeraDecision === decision;
        
        if (coinciden) {
          // Las decisiones coinciden - aplicar la decisión final
          updateData = {
            auditor2_decision: decision,
            auditor2_comentario: comentario,
            auditor2_timestamp: timestamp,
            auditor2_id: auditorId,
            estado_doble_verificacion: decision,
            verificada: true,
            estado_verificacion: decision,
            comentario_rechazo: decision === 'rechazada' ? comentario : ''
          };
          mensaje = `✅ Ambos auditores coinciden. Venta ${decision === 'aprobada' ? 'APROBADA' : 'RECHAZADA'}.`;
          
        } else {
          // Las decisiones no coinciden - conflicto
          updateData = {
            auditor2_decision: decision,
            auditor2_comentario: comentario,
            auditor2_timestamp: timestamp,
            auditor2_id: auditorId,
            estado_doble_verificacion: 'conflicto'
          };
          mensaje = `⚠️ CONFLICTO: Los auditores no coinciden. Requiere resolución manual.`;
        }
        
      } else if (reporte.auditor1_id === auditorId) {
        toast.error('Ya ha emitido su decisión para esta venta.');
        setVentaVerificar(null);
        return;
      } else {
        toast.error('Esta venta ya tiene las decisiones de 2 auditores.');
        setVentaVerificar(null);
        return;
      }

      const response = await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        updateData
      );
      
      console.log('Respuesta del PATCH:', response);
      
      // Actualizar en memoria local
      const updatedReporte = { ...reporte, ...updateData };
      const nuevosReportes = [...reportes];
      nuevosReportes[reporteIndex] = updatedReporte;
      setReportes(nuevosReportes);
      
      toast.success(mensaje, {
        style: { borderRadius: '8px', background: '#4f46e5', color: '#fff' },
        icon: updateData.estado_doble_verificacion === 'conflicto' ? '⚠️' : '🎉'
      });
      
    } catch (err) {
      console.error('❌ Error al verificar la venta:', err);
      toast.error('Hubo un error al intentar verificar la venta.');
    }
    setVentaVerificar(null);
  };

  const confirmResolverDisputa = async (clienteGanador: Cliente, comentario: string) => {
    // Se busca el grupo de duplicados que contiene al ganador
    const grupo = duplicados.find(grupo => grupo.some(c => c.ID === clienteGanador.ID));
    if (!grupo) return;

    // Se recorre cada cliente en el grupo para actualizar su reporte
    for (const cliente of grupo) {
      const reporteIndex = reportes.findIndex(r => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'VENTA CONSOLIDADA');
      if (reporteIndex === -1) continue;
      const reporte = reportes[reporteIndex];
      let newEstado, newComentario;
      if (cliente.ID === clienteGanador.ID) {
        // Para el ganador se marca "aprobada" sin comentario
        newEstado = 'aprobada';
        newComentario = '';
      } else {
        // Para los otros se marca "rechazada" y se asigna el comentario ingresado
        newEstado = 'rechazada';
        newComentario = comentario;
      }
      try {
        await apiClient.request(
          `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
          'PATCH',
          {
            verificada: true,
            estado_verificacion: newEstado,
            comentario_rechazo: newComentario
          }
        );
        // Actualiza en memoria el reporte modificado
        const updatedReporte = {
          ...reporte,
          verificada: true,
          estado_verificacion: newEstado,
          comentario_rechazo: newComentario
        };
        const nuevosReportes = [...reportes];
        nuevosReportes[reporteIndex] = updatedReporte;
        setReportes(nuevosReportes);
      } catch (err) {
        console.error(`Error al actualizar la venta para ${cliente.NOMBRE}:`, err);
        alert(`Hubo un error al actualizar la venta de ${cliente.NOMBRE}.`);
      }
    }

    // Se elimina el grupo de duplicados resuelto
    setDuplicados(prev => prev.filter(grupo => !grupo.some(c => c.ID === clienteGanador.ID)));
    toast.success(`✅ Disputa resuelta: ${clienteGanador.NOMBRE} aprobado, otros rechazados.`, {
      style: { borderRadius: '8px', background: '#16a34a', color: '#fff' },
      icon: '📌'
    });
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
        {/* Cards de Resumen Global */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Reportadas */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-lg font-bold">📊</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Ventas Reportadas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {estadisticasGlobales.totalReportadas}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Consolidadas */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-lg font-bold">🔄</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Consolidadas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {estadisticasGlobales.totalConsolidado}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Verificadas */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-lg font-bold">✅</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Verificadas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {estadisticasGlobales.totalVerificadas}
                      <span className="text-sm text-gray-500 ml-2">
                        ({estadisticasGlobales.porcentajeVerificacion}%)
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Tasa de Aprobación */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-lg font-bold">📈</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Tasa Aprobación
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {estadisticasGlobales.porcentajeAprobacion}%
                      <span className="text-sm text-gray-500 block">
                        {estadisticasGlobales.totalAprobadas} aprobadas
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            <h2 className="text-lg font-medium text-gray-900">Asesores y sus Ventas - Métricas de Verificación</h2>
          </div>
          
          {/* Header de la tabla */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-[200px]">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Asesor</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">Reportadas</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">Consolidadas</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">% Consol.</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">Pendientes</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">Aprobadas</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">Rechazadas</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">% Verif.</span>
                </div>
                <div className="text-center min-w-[70px]">
                  <span className="text-xs font-medium text-gray-500 uppercase">% Aprob.</span>
                </div>
              </div>
            </div>
          </div>

          {asesoresFiltrados.length > 0 ? (
            <div>
              {sortedAsesores.map((asesor) => {
                const { ventasReportadas, ventasConsolidadas, ventasAprobadas, ventasRechazadas, ventasPorVerificar } = getEstadisticasAsesor(asesor.ID);
                return (
                  <AsesorItem
                    key={asesor.ID}
                    asesor={asesor}
                    ventasReportadas={ventasReportadas}
                    ventasConsolidadas={ventasConsolidadas}
                    ventasAprobadas={ventasAprobadas}
                    ventasRechazadas={ventasRechazadas}
                    ventasPorVerificar={ventasPorVerificar}
                    onClick={() => setAsesorSeleccionado(asesor)}
                    style={{ minHeight: '80px' }}
                  />
                );
              })}
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
          clientes={clientesFiltradosPorProducto}  // Aquí aplicamos el filtro de producto
          reportes={reportes}
          duplicados={duplicados}
          onClose={() => setAsesorSeleccionado(null)}
          onVerHistorial={(cliente) => setClienteHistorial(cliente)}
          onVerificarVenta={handleVerificarVenta}
          onDesverificarVenta={(cliente) => setVentaDesverificar(cliente)}
          onResolverDisputa={handleResolverDisputa}
          onVerChat={(cliente) => setClienteParaChat(cliente)}
          onResolverConflicto={handleResolverConflicto}
          onVerHistorialResolucion={handleVerHistorialResolucion}
          onEliminarDecision={handleEliminarDecision}
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
            admin={false}
            adminRole={'supervisor'}
            onClose={() => setClienteHistorial(null)}
          />
        </Suspense>
      )}

      {/* Modal para confirmar verificación de venta */}
      {ventaVerificar && (
        <ModalVerificarVenta
          cliente={ventaVerificar}
          onConfirm={(decision, comentario, auditorId) => confirmVerificarVenta(ventaVerificar, decision, comentario, auditorId)}
          onCancel={cancelVerificarVenta}
        />
      )}

      {/* Modal para resolver disputa */}
      {disputaGrupo && (
        <ModalResolverDisputa
          grupo={disputaGrupo}
          asesores={asesores}  // Asegúrate de pasar el arreglo de asesores aquí
          onResolve={confirmResolverDisputa}
          onCancel={cancelResolverDisputa}
        />
      )}

      {ventaDesverificar && (
        <ModalDesverificarVenta
          cliente={ventaDesverificar}
          onConfirm={(comentario) => {
            // Llama a tu función existente para desverificar:
            confirmDesverificarVenta(ventaDesverificar, comentario);
            setVentaDesverificar(null);
          }}
          onCancel={() => setVentaDesverificar(null)}
        />
      )}



      {/* Modal de Exportación */}
      {showExportModal && (
        <ExportExcelModal
          fuentes={Array.from(
            new Set(
              registros.map(r => {
                let fuente = r.TIPO_EVENTO?.trim() || 'Desconocido';
                if (!['LINK', 'MASIVOS', 'ASIGNACION_VIP'].includes(fuente.toUpperCase())) {
                  fuente = 'HOTMART';
                }
                // Renombrar ASIGNACION_VIP a VIP para mejor visualización
                if (fuente.toUpperCase() === 'ASIGNACION_VIP') {
                  fuente = 'VIP';
                }
                return fuente;
              })
            )
          ).filter(f => f.toUpperCase() !== 'COMPRA')}
          onCancel={() => setShowExportModal(false)}
          onExport={(commissionData, bonus10, bonus20, bonus30, bonus50, bestSellerBonus) => {
            exportarConDatosExtra(commissionData, bonus10, bonus20, bonus30, bonus50, bestSellerBonus);
            setShowExportModal(false);
          }}
        />

      )}

      {/* Modal de Chat */}
      {clienteParaChat && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          }
        >
          <ChatModal
            isOpen={!!clienteParaChat}
            onClose={() => setClienteParaChat(null)}
            cliente={clienteParaChat}
            asesor={asesorSeleccionado ? { ID: asesorSeleccionado.ID, NOMBRE: asesorSeleccionado.NOMBRE } : { ID: 0, NOMBRE: 'Auditor' }}
          />
        </Suspense>
      )}

      {/* Modal para resolver conflicto de auditores */}
      {conflictoParaResolver && (
        <ModalResolverConflicto
          cliente={conflictoParaResolver.cliente}
          reporte={conflictoParaResolver.reporte}
          onResolve={confirmResolverConflicto}
          onCancel={() => setConflictoParaResolver(null)}
        />
      )}

      {/* Modal para ver historial de resolución */}
      {historialResolucionParaVer && (
        <ModalVerHistorialResolucion
          cliente={historialResolucionParaVer.cliente}
          reporte={historialResolucionParaVer.reporte}
          onClose={() => setHistorialResolucionParaVer(null)}
        />
      )}

      {/* Modal para eliminar propia decisión */}
      {decisionParaEliminar && (
        <ModalEliminarDecision
          cliente={decisionParaEliminar.cliente}
          reporte={decisionParaEliminar.reporte}
          onConfirm={confirmEliminarDecision}
          onCancel={() => setDecisionParaEliminar(null)}
        />
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default AuditorDashboard;

