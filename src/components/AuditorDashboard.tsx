import React, { useState, useEffect, useMemo } from 'react';
import { Asesor, Cliente, Reporte } from '../types';
import { apiClient } from '../lib/apiClient';
import { FileVideo, DollarSign, Search, LogOut, X } from 'lucide-react';
import HistorialCliente from './HistorialCliente';

// Función para calcular la distancia de Levenshtein entre dos strings
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
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
  return matrix[a.length][b.length];
}

// Función que devuelve una similitud entre 0 y 1
function similarity(s1: string, s2: string): number {
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLength;
}

// Función que determina si dos clientes son similares (fuzzy) según nombre o WhatsApp
function sonSimilares(c1: Cliente, c2: Cliente, umbral = 0.8): boolean {
  const nombreSim = similarity(c1.NOMBRE.toLowerCase(), c2.NOMBRE.toLowerCase());
  const whatsappSim = similarity((c1.WHATSAPP || '').trim(), (c2.WHATSAPP || '').trim());
  return nombreSim >= umbral || whatsappSim >= umbral;
}

// Función para analizar duplicados de forma fuzzy entre clientes, comparando solo aquellos que tienen asesor asignado.
// Además, se agrupa por similitud y se filtra el grupo si los asesores asignados (por nombre) son distintos.
const analizarDuplicados = (
  clientes: Cliente[],
  getNombreAsesor: (asesorId: number) => string
): Cliente[][] => {
  // Solo considerar clientes con asesor asignado (ID_ASESOR)
  const clientesConAsesor = clientes.filter(cliente => !!cliente.ID_ASESOR);
  const grupos: Cliente[][] = [];
  clientesConAsesor.forEach(cliente => {
    let asignado = false;
    for (let grupo of grupos) {
      if (sonSimilares(grupo[0], cliente)) {
        grupo.push(cliente);
        asignado = true;
        break;
      }
    }
    if (!asignado) {
      grupos.push([cliente]);
    }
  });
  // Filtrar grupos con más de un elemento y que tengan asesores con nombres distintos
  return grupos.filter(grupo =>
    grupo.length > 1 && new Set(grupo.map(c => getNombreAsesor(c.ID_ASESOR))).size > 1
  );
};

interface ClientesAsesorModalProps {
  asesor: Asesor;
  clientes: Cliente[];
  reportes: Reporte[];
  onClose: () => void;
  onVerHistorial: (cliente: Cliente) => void;
}

function ClientesAsesorModal({ asesor, clientes, reportes, onClose, onVerHistorial }: ClientesAsesorModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar los clientes asignados a este asesor
  const clientesAsesor = clientes.filter(c => c.ID_ASESOR === asesor.ID);
  const clientesFiltrados = clientesAsesor
    .filter(cliente =>
      cliente.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.WHATSAPP.includes(searchTerm)
    )
    // Orden: primero los no consolidados y luego los consolidados; en caso de empate, por nombre
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [asesoresData, clientesData, reportesData] = await Promise.all([
        apiClient.request<Asesor[]>('/GERSSON_ASESORES?select=*'),
        // Filtrar solo clientes con estado PAGADO o VENTA CONSOLIDADA
        apiClient.request<Cliente[]>('/GERSSON_CLIENTES?ESTADO=in.(PAGADO,VENTA CONSOLIDADA)'),
        apiClient.request<Reporte[]>('/GERSSON_REPORTES?ESTADO_NUEVO=in.(PAGADO,VENTA CONSOLIDADA)'),
      ]);
      setAsesores(asesoresData);
      setClientes(clientesData);
      setReportes(reportesData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcula estadísticas para cada asesor, deduplicando ventas por cliente
  const getEstadisticasAsesor = (asesorId: number) => {
    const ventasReportadas = Array.from(
      new Set(
        reportes
          .filter(r => r.ID_ASESOR === asesorId && r.ESTADO_NUEVO === 'PAGADO')
          .map(r => r.ID_CLIENTE)
      )
    ).length;

    const ventasConsolidadas = Array.from(
      new Set(
        reportes
          .filter(r => r.ID_ASESOR === asesorId && (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA'))
          .map(r => r.ID_CLIENTE)
      )
    ).length;

    return { ventasReportadas, ventasConsolidadas };
  };

  // Filtrar asesores según el término de búsqueda
  const asesoresFiltrados = asesores.filter(asesor =>
    asesor.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asesor.WHATSAPP.includes(searchTerm)
  );

  // Función auxiliar para obtener el nombre del asesor dado su ID
  const getNombreAsesor = (asesorId: number): string => {
    const asesor = asesores.find(a => a.ID === asesorId);
    return asesor ? asesor.NOMBRE : '';
  };

  // Analizar duplicados (fuzzy) entre clientes que tengan asesor asignado y
  // agrupar aquellos que tengan asesores con nombres distintos.
  const duplicados = useMemo(() => analizarDuplicados(clientes, getNombreAsesor), [clientes]);

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
              const { ventasReportadas, ventasConsolidadas } = getEstadisticasAsesor(asesor.ID);
              const porcentajeConsolidacion = ventasReportadas > 0 
                ? ((ventasConsolidadas / ventasReportadas) * 100).toFixed(1)
                : '0';
              return (
                <div
                  key={asesor.ID}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setAsesorSeleccionado(asesor)}
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
            })}
          </div>
        </div>

        {/* Sección de duplicados (fuzzy) */}
        {duplicados.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Posibles Ventas Duplicadas</h2>
            {duplicados.map((grupo, idx) => (
              <div key={idx} className="mb-4 border p-4 rounded">
                <p className="text-sm font-bold text-gray-800">Grupo {idx + 1}</p>
                <ul className="mt-2 space-y-1">
                  {grupo.map(cliente => (
                    <li key={cliente.ID} className="text-sm text-gray-700">
                      {cliente.NOMBRE} — WhatsApp: {cliente.WHATSAPP} — Asesor: {getNombreAsesor(cliente.ID_ASESOR)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
