import React, { useState, useMemo } from 'react';
import { Cliente, Reporte, Asesor, EstadisticasDetalladas, Registro, AdminRole } from '../types';
import {
  Users,
  TrendingUp,
  Clock,
  Search,
  Filter,
  ArrowLeft,
  BarChart,
  Calendar,
  AlertCircle,
  PieChart as PieChartIcon
} from 'lucide-react';
import { formatDateOnly, formatDate } from '../utils/dateUtils';
import ListaGeneralClientes from './ListaGeneralClientes';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  XAxis,
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend
} from 'recharts';
import FuentesAnalysisPorAsesor from './FuentesAnalysisPorAsesor';

interface DetalleAsesorProps {
  asesor: Asesor;
  estadisticas: EstadisticasDetalladas;
  clientes: Cliente[];
  reportes: Reporte[];
  registros: Registro[];
  promedioEquipo: {
    tasaCierre: number;
    tiempoRespuesta: number;
    ventasPorMes: number;
  };
  onBack: () => void;
  teamStatsByFuente: Record<string, number>;
  bestRateByFuente: Record<string, number>;
  onChat?: (cliente: Cliente) => void;
  adminRole?: AdminRole;
}

type VistaDetalle = 'general' | 'clientes' | 'metricas' | 'fuentes';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7'];

export default function DetalleAsesor({
  asesor,
  estadisticas,
  clientes,
  reportes,
  registros,
  promedioEquipo,
  onBack,
  teamStatsByFuente,
  bestRateByFuente,
  onChat,
  adminRole = 'supervisor'
}: DetalleAsesorProps) {
  const [vistaActual, setVistaActual] = useState<VistaDetalle>('general');

  // Cálculo de distribución de estados para el gráfico de pastel
  const distribucionEstados = useMemo(() => {
    const totales: Record<string, number> = {};
    clientes.forEach(cliente => {
      totales[cliente.ESTADO] = (totales[cliente.ESTADO] || 0) + 1;
    });
    return Object.keys(totales)
      .map(estado => ({
        name: estado,
        value: totales[estado]
      }))
      .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor
  }, [clientes]);

  // Gráfico de tendencia: reportes diarios en los últimos 7 días
  const tendenciaReportes = useMemo(() => {
    const dias: Record<string, number> = {};
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);
    reportes.forEach(r => {
      const fechaReporte = new Date(r.FECHA_REPORTE * 1000);
      if (fechaReporte >= hace7dias) {
        const dia = formatDateOnly(r.FECHA_REPORTE);
        dias[dia] = (dias[dia] || 0) + 1;
      }
    });
    const data = Object.keys(dias).map(dia => ({
      date: dia,
      reportes: dias[dia]
    }));
    return data.sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reportes]);

  // KPI: Índice de Conversión (Ventas / Total de Clientes)
  const indiceConversion = clientes.length > 0
    ? ((estadisticas.ventasRealizadas || 0) / clientes.length) * 100
    : 0;

  // Datos para Radar Chart (Comparativa Integral)
  const radarData = useMemo(() => [
    {
      metric: 'Tasa de Cierre',
      asesor: estadisticas.porcentajeCierre,
      equipo: promedioEquipo.tasaCierre
    },
    {
      metric: 'Tiempo Respuesta (h)',
      asesor: estadisticas.tiempoPromedioHastaReporte,
      equipo: promedioEquipo.tiempoRespuesta
    },
    {
      metric: 'Ventas/Mes',
      asesor: estadisticas.ventasPorMes,
      equipo: promedioEquipo.ventasPorMes
    }
  ], [estadisticas, promedioEquipo]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="h-6 w-6 text-gray-500" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{asesor.NOMBRE}</h2>
            <p className="text-sm text-gray-500">WhatsApp: {asesor.WHATSAPP}</p>
          </div>
        </div>
      </div>

      {/* Navegación interna */}
      <div className="flex space-x-4 border-b border-gray-200">
        {(['general', 'clientes', 'metricas', 'fuentes'] as VistaDetalle[]).map(vista => (
          <button
            key={vista}
            onClick={() => setVistaActual(vista)}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === vista
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            {vista === 'general'
              ? 'Vista General'
              : vista === 'clientes'
                ? 'Clientes'
                : vista === 'metricas'
                  ? 'Métricas Avanzadas'
                  : 'Fuentes'}
          </button>
        ))}
      </div>

      {/* Contenido según pestaña */}
      {vistaActual === 'general' && (
        <div className="space-y-6">
          {/* KPIs Principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tasa de Cierre</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {estadisticas.porcentajeCierre.toFixed(1)}%
                  </p>
                </div>
                <div className={`text-sm font-medium ${estadisticas.porcentajeCierre > promedioEquipo.tasaCierre ? 'text-green-600' : 'text-red-600'}`}>
                  vs {promedioEquipo.tasaCierre.toFixed(1)}% equipo
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tiempo Reporte</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {estadisticas.tiempoPromedioHastaReporte.toFixed(1)}h
                  </p>
                </div>
                <div className={`text-sm font-medium ${estadisticas.tiempoPromedioHastaReporte < promedioEquipo.tiempoRespuesta ? 'text-green-600' : 'text-red-600'}`}>
                  vs {promedioEquipo.tiempoRespuesta.toFixed(1)}h equipo
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-500">Ventas</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{estadisticas.ventasPorMes}</p>
                <div className="mt-2 text-sm">
                  <span className="font-medium text-green-600">Principal: {estadisticas.ventasPrincipal}</span>
                  <br />
                  <span className="font-medium text-blue-600">Downsell: {estadisticas.ventasDownsell}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tendencia de Reportes Diarios */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Actividad Diaria (últimos 7 días)</h3>
            </div>
            <div className="p-6">
              {tendenciaReportes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={tendenciaReportes}>
                    <XAxis dataKey="date" />
                    <Tooltip />
                    <Line type="monotone" dataKey="reportes" stroke="#4ade80" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">No hay datos recientes.</p>
              )}
            </div>
          </div>

          {/* Distribución de Clientes */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center">
              <PieChartIcon className="h-5 w-5 mr-2 text-blue-500" />
              <h3 className="text-lg font-medium text-gray-900">Distribución de Clientes</h3>
            </div>
            <div className="p-6">
              {distribucionEstados.length > 0 ? (
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-full md:w-2/3">
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={distribucionEstados}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={150}
                          innerRadius={60}
                        >
                          {distribucionEstados.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any, name: any) => [`${value} clientes`, name]}
                          contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/3 space-y-2">
                    <h4 className="font-medium text-gray-700 mb-3">Leyenda</h4>
                    {distribucionEstados.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded mr-2" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{entry.name}</span>
                        </div>
                        <span className="text-sm font-medium">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No hay clientes registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {vistaActual === 'clientes' && (
        <ListaGeneralClientes
          clientes={clientes}
          reportes={reportes}
          onActualizarEstado={() => { }}
          onReportarVenta={() => { }}
          onChat={onChat || (() => {})}
          readOnly
          admin={true}
          adminRole={adminRole}
        />
      )}

      {vistaActual === 'metricas' && (
        <div className="space-y-6">
          {/* Métricas de Tiempo */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Métricas de Tiempo</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Tiempo Hasta Primer Mensaje</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {estadisticas.tiempoHastaPrimerMensaje.toFixed(1)}m
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tiempo Hasta Primer Reporte</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {estadisticas.tiempoPromedioHastaReporte.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tiempo Hasta Venta</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {estadisticas.tiempoPromedioHastaVenta.toFixed(1)}h
                </p>
              </div>
            </div>
          </div>

          {/* Métricas de Calidad */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Métricas de Calidad</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Reportes/Cliente</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {estadisticas.reportesPorCliente.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Reportes con Seguimiento</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {estadisticas.reportesConSeguimiento}
                </p>
              </div>
            </div>
          </div>

          {/* KPI: Índice de Conversión */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Índice de Conversión</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {indiceConversion.toFixed(1)}%
                </p>
              </div>
              <div className="text-sm font-medium text-gray-500">
                {clientes.length} clientes
              </div>
            </div>
          </div>

          {/* Comparativa Integral (Radar Chart) */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Comparativa Integral</h3>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis />
                  <Radar name="Asesor" dataKey="asesor" stroke="#4ade80" fill="#4ade80" fillOpacity={0.6} />
                  <Radar name="Equipo" dataKey="equipo" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.6} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {vistaActual === 'fuentes' && (
        <div className="mt-6">
          <FuentesAnalysisPorAsesor 
            clientes={clientes} 
            registros={registros} 
            reportes={reportes} 
            asesorId={asesor.ID} 
            teamStatsByFuente={teamStatsByFuente}
            bestRateByFuente={bestRateByFuente}
          />
        </div>
      )}
    </div>
  );
}
