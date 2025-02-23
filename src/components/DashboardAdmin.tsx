import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Asesor, EstadisticasDetalladas } from '../types';
import {
  BarChart,
  LogOut,
  Users,
  Calendar,
  Target,
  Clock,
  Download,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Bell,
  Search,
  Filter,
} from 'lucide-react';
import {
  formatDateOnly,
  formatInactivityTime,
  formatDate,
} from '../utils/dateUtils';
import DetalleAsesor from './DetalleAsesor';

interface DashboardAdminProps {
  onLogout: () => void;
}

export default function DashboardAdmin({ onLogout }: DashboardAdminProps) {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [estadisticas, setEstadisticas] = useState<
    Record<number, EstadisticasDetalladas>
  >({});
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenarPor, setOrdenarPor] = useState<
    'ventas' | 'tasa' | 'tiempo' | 'actividad'
  >('ventas');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(
    null
  );
  const [clientes, setClientes] = useState<any[]>([]);
  const [reportes, setReportes] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [periodoSeleccionado, fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    try {
      // Cargar asesores
      const { data: asesoresData } = await supabase
        .from('GERSSON_ASESORES')
        .select('*')
        .order('NOMBRE');

      if (asesoresData) {
        setAsesores(asesoresData);

        // Cargar todos los clientes y reportes
        const { data: clientesData } = await supabase
          .from('GERSSON_CLIENTES')
          .select('*');

        const { data: reportesData } = await supabase
          .from('GERSSON_REPORTES')
          .select('*');

        if (clientesData && reportesData) {
          setClientes(clientesData);
          setReportes(reportesData);

          // Calcular estadísticas para cada asesor
          const statsTemp: Record<number, EstadisticasDetalladas> = {};

          for (const asesor of asesoresData) {
            const clientesAsesor = clientesData.filter(
              (c) => c.ID_ASESOR === asesor.ID
            );
            const reportesAsesor = reportesData.filter(
              (r) => r.ID_ASESOR === asesor.ID
            );

            // Calcular todas las métricas detalladas
            statsTemp[asesor.ID] = calcularEstadisticasDetalladas(
              clientesAsesor,
              reportesAsesor,
              periodoSeleccionado,
              fechaInicio,
              fechaFin
            );
          }

          setEstadisticas(statsTemp);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  const calcularEstadisticasDetalladas = (
    clientesAsesor: any[],
    reportesAsesor: any[],
    periodo: string,
    inicio?: string,
    fin?: string
  ): EstadisticasDetalladas => {
    // Calcular fechas para el filtro
    const hoy = new Date();
    let fechaInicioFiltro = new Date();
    if (periodo === 'mes') {
      fechaInicioFiltro.setMonth(hoy.getMonth() - 1);
    } else if (periodo === 'semana') {
      fechaInicioFiltro.setDate(hoy.getDate() - 7);
    } else if (periodo === 'personalizado' && inicio) {
      fechaInicioFiltro = new Date(inicio);
    }

    const fechaFinFiltro =
      periodo === 'personalizado' && fin ? new Date(fin) : hoy;

    // Filtrar reportes por período
    const reportesFiltrados = reportesAsesor.filter((r) => {
      const fechaReporte = new Date(r.FECHA_REPORTE * 1000);
      return (
        fechaReporte >= fechaInicioFiltro && fechaReporte <= fechaFinFiltro
      );
    });

    // Calcular métricas básicas
    const clientesReportados = new Set(reportesAsesor.map((r) => r.ID_CLIENTE))
      .size;
    const clientesSinReporte = clientesAsesor.filter(
      (c) => !reportesAsesor.find((r) => r.ID_CLIENTE === c.ID)
    ).length;

    const ventasRealizadas = reportesFiltrados.filter(
      (r) => r.ESTADO_NUEVO === 'PAGADO'
    ).length;

    // Calcular métricas de tiempo
    const tiemposRespuesta = reportesAsesor
      .filter((r) => r.FECHA_SEGUIMIENTO && r.COMPLETADO)
      .map((r) => r.FECHA_SEGUIMIENTO - r.FECHA_REPORTE);

    const tiempoPromedioRespuesta = tiemposRespuesta.length
      ? tiemposRespuesta.reduce((a, b) => a + b, 0) /
        tiemposRespuesta.length /
        3600
      : 0;

    // Calcular métricas de calidad
    const reportesPorCliente = clientesAsesor.length
      ? reportesAsesor.length / clientesAsesor.length
      : 0;

    const reportesConSeguimiento = reportesAsesor.filter(
      (r) => r.FECHA_SEGUIMIENTO
    ).length;

    // Calcular monto promedio de ventas
    const ventasConMonto = clientesAsesor.filter(
      (c) => c.ESTADO === 'PAGADO' && c.MONTO_COMPRA > 0
    );

    const montoPromedioVenta = ventasConMonto.length
      ? ventasConMonto.reduce((acc, c) => acc + c.MONTO_COMPRA, 0) /
        ventasConMonto.length
      : 0;

    // Obtener fechas de últimas actividades
    const ultimoReporte =
      reportesAsesor.length > 0
        ? Math.max(...reportesAsesor.map((r) => r.FECHA_REPORTE))
        : null;

    const ultimoSeguimiento =
      reportesAsesor.filter((r) => r.FECHA_SEGUIMIENTO && r.COMPLETADO).length >
      0
        ? Math.max(
            ...reportesAsesor
              .filter((r) => r.FECHA_SEGUIMIENTO && r.COMPLETADO)
              .map((r) => r.FECHA_SEGUIMIENTO)
          )
        : null;

    const ultimaVenta =
      reportesAsesor.filter((r) => r.ESTADO_NUEVO === 'PAGADO').length > 0
        ? Math.max(
            ...reportesAsesor
              .filter((r) => r.ESTADO_NUEVO === 'PAGADO')
              .map((r) => r.FECHA_REPORTE)
          )
        : null;

    // Calcular tiempo promedio hasta reporte
    const tiempoHastaReporte = clientesAsesor
      .map((cliente) => {
        const primerReporte = reportesAsesor
          .filter((r) => r.ID_CLIENTE === cliente.ID)
          .sort((a, b) => a.FECHA_REPORTE - b.FECHA_REPORTE)[0];

        if (!primerReporte) return null;

        return (primerReporte.FECHA_REPORTE - cliente.FECHA_CREACION) / 3600; // Convertir a horas
      })
      .filter((t) => t !== null) as number[];

    const tiempoPromedioHastaReporte = tiempoHastaReporte.length
      ? tiempoHastaReporte.reduce((a, b) => a + b, 0) /
        tiempoHastaReporte.length
      : 0;

    // Calcular tiempo promedio hasta venta
    const tiempoHastaVenta = clientesAsesor
      .filter((c) => c.ESTADO === 'PAGADO')
      .map((cliente) => {
        const reporteVenta = reportesAsesor
          .filter(
            (r) => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'PAGADO'
          )
          .sort((a, b) => a.FECHA_REPORTE - b.FECHA_REPORTE)[0];

        if (!reporteVenta) return null;

        return (reporteVenta.FECHA_REPORTE - cliente.FECHA_CREACION) / 3600; // Convertir a horas
      })
      .filter((t) => t !== null) as number[];

    const tiempoPromedioHastaVenta = tiempoHastaVenta.length
      ? tiempoHastaVenta.reduce((a, b) => a + b, 0) / tiempoHastaVenta.length
      : 0;

    return {
      totalClientes: clientesAsesor.length,
      clientesReportados,
      clientesSinReporte,
      clientesConReporte: clientesReportados,
      clientesEnSeguimiento: reportesAsesor.filter(
        (r) => r.ESTADO_NUEVO === 'SEGUIMIENTO'
      ).length,
      clientesRechazados: reportesAsesor.filter(
        (r) => r.ESTADO_NUEVO === 'NO INTERESADO'
      ).length,
      clientesCriticos: clientesAsesor.filter((c) =>
        ['CARRITOS', 'RECHAZADOS', 'TICKETS'].includes(c.ESTADO)
      ).length,
      clientesNoContactados: clientesAsesor.filter(
        (c) => !reportesAsesor.find((r) => r.ID_CLIENTE === c.ID)
      ).length,
      ventasRealizadas,
      seguimientosPendientes: reportesAsesor.filter(
        (r) => r.FECHA_SEGUIMIENTO && !r.COMPLETADO
      ).length,
      seguimientosCompletados: reportesAsesor.filter((r) => r.COMPLETADO)
        .length,
      porcentajeCierre: clientesAsesor.length
        ? (ventasRealizadas / clientesAsesor.length) * 100
        : 0,
      ventasPorMes: ventasRealizadas,
      tiempoPromedioConversion: tiempoPromedioHastaVenta / 24, // Convertir a días
      tasaRespuesta: reportesConSeguimiento
        ? (reportesAsesor.filter((r) => r.COMPLETADO).length /
            reportesConSeguimiento) *
          100
        : 0,
      tiempoPromedioRespuesta,
      tiempoPromedioHastaReporte,
      tiempoPromedioHastaVenta,
      reportesPorCliente,
      reportesConSeguimiento,
      montoPromedioVenta,
      ultimaActividad: ultimoReporte,
      ultimoReporte,
      ultimoSeguimiento,
      ultimaVenta,
    };
  };

  const asesoresFiltrados = asesores.filter((asesor) => {
    const coincideBusqueda =
      asesor.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
      asesor.WHATSAPP.includes(busqueda);

    if (mostrarInactivos) {
      const stats = estadisticas[asesor.ID];
      const ultimaActividadDate = stats?.ultimaActividad
        ? new Date(stats.ultimaActividad * 1000)
        : null;
      const horasSinActividad = ultimaActividadDate
        ? Math.floor(
            (Date.now() - ultimaActividadDate.getTime()) / (1000 * 60 * 60)
          )
        : Infinity;
      return coincideBusqueda && horasSinActividad >= 10;
    }

    return coincideBusqueda;
  });

  const asesoresOrdenados = [...asesoresFiltrados].sort((a, b) => {
    const statsA = estadisticas[a.ID];
    const statsB = estadisticas[b.ID];

    switch (ordenarPor) {
      case 'ventas':
        return (
          (statsB?.ventasRealizadas || 0) - (statsA?.ventasRealizadas || 0)
        );
      case 'tasa':
        return (
          (statsB?.porcentajeCierre || 0) - (statsA?.porcentajeCierre || 0)
        );
      case 'tiempo':
        return (
          (statsA?.tiempoPromedioConversion || 0) -
          (statsB?.tiempoPromedioConversion || 0)
        );
      case 'actividad':
        const fechaA = statsA?.ultimaActividad
          ? new Date(statsA.ultimaActividad * 1000)
          : new Date(0);
        const fechaB = statsB?.ultimaActividad
          ? new Date(statsB.ultimaActividad * 1000)
          : new Date(0);
        return fechaB.getTime() - fechaA.getTime();
      default:
        return 0;
    }
  });

  const exportarDatos = () => {
    const data = asesores.map((asesor) => ({
      Nombre: asesor.NOMBRE,
      WhatsApp: asesor.WHATSAPP,
      'Total Clientes': estadisticas[asesor.ID]?.totalClientes || 0,
      'Clientes Sin Reporte': estadisticas[asesor.ID]?.clientesSinReporte || 0,
      'Clientes Con Reporte': estadisticas[asesor.ID]?.clientesConReporte || 0,
      'Clientes En Seguimiento':
        estadisticas[asesor.ID]?.clientesEnSeguimiento || 0,
      'Clientes Rechazados': estadisticas[asesor.ID]?.clientesRechazados || 0,
      'Clientes Críticos': estadisticas[asesor.ID]?.clientesCriticos || 0,
      'Clientes Sin Contactar':
        estadisticas[asesor.ID]?.clientesNoContactados || 0,
      'Ventas Realizadas': estadisticas[asesor.ID]?.ventasRealizadas || 0,
      'Tasa de Cierre': `${estadisticas[asesor.ID]?.porcentajeCierre.toFixed(
        1
      )}%`,
      'Tiempo Promedio': `${estadisticas[
        asesor.ID
      ]?.tiempoPromedioConversion.toFixed(1)} días`,
      'Tiempo de Completado': `${estadisticas[
        asesor.ID
      ]?.tiempoPromedioRespuesta.toFixed(1)} horas`,
      'Última Actividad': estadisticas[asesor.ID]?.ultimaActividad
        ? formatDateOnly(estadisticas[asesor.ID]?.ultimaActividad)
        : 'Sin actividad',
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute(
      'download',
      `reporte_asesores_${formatDateOnly(Date.now() / 1000)}.csv`
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Panel de Administración
            </h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportarDatos}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <Download className="h-5 w-5 mr-2" />
                Exportar Datos
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Cerrar Sesión
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="mt-4">
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="md:hidden w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Filter className="inline-block h-4 w-4 mr-2" />
              {mostrarFiltros ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>

            <div
              className={`mt-4 space-y-4 ${
                mostrarFiltros ? 'block' : 'hidden md:block'
              }`}
            >
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar asesor..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <select
                  value={periodoSeleccionado}
                  onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                  className="w-full md:w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="mes">Último mes</option>
                  <option value="semana">Última semana</option>
                  <option value="personalizado">Personalizado</option>
                </select>

                <select
                  value={ordenarPor}
                  onChange={(e) => setOrdenarPor(e.target.value as any)}
                  className="w-full md:w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="ventas">Ordenar por ventas</option>
                  <option value="tasa">Ordenar por tasa de cierre</option>
                  <option value="tiempo">
                    Ordenar por tiempo de conversión
                  </option>
                  <option value="actividad">
                    Ordenar por última actividad
                  </option>
                </select>

                <button
                  onClick={() => setMostrarInactivos(!mostrarInactivos)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    mostrarInactivos
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {mostrarInactivos
                    ? 'Mostrar todos'
                    : 'Mostrar solo inactivos'}
                </button>
              </div>

              {periodoSeleccionado === 'personalizado' && (
                <div className="flex flex-col md:flex-row gap-4">
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full md:w-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="hidden md:inline">hasta</span>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full md:w-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Resumen General */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Asesores
                </p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">
                  {asesores.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Ventas Totales
                </p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">
                  {Object.values(estadisticas).reduce(
                    (acc, stats) => acc + stats.ventasRealizadas,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Sin Reporte</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">
                  {Object.values(estadisticas).reduce(
                    (acc, stats) => acc + stats.clientesSinReporte,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Clientes Totales
                </p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">
                  {Object.values(estadisticas).reduce(
                    (acc, stats) => acc + stats.totalClientes,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Asesores */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg font-medium leading-6 text-gray-900">
              Rendimiento de Asesores
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-4">
              {asesoresOrdenados.map((asesor) => {
                const stats = estadisticas[asesor.ID];
                const ultimaActividadDate = stats?.ultimaActividad
                  ? new Date(stats.ultimaActividad * 1000)
                  : null;
                const horasSinActividad = ultimaActividadDate
                  ? Math.floor(
                      (Date.now() - ultimaActividadDate.getTime()) /
                        (1000 * 60 * 60)
                    )
                  : null;

                return (
                  <div key={asesor.ID} className="bg-gray-50 rounded-lg p-4">
                    {/* Encabezado del asesor */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center">
                        <Users className="h-8 w-8 text-blue-500" />
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold">
                            {asesor.NOMBRE}
                          </h3>
                          {horasSinActividad !== null && (
                            <p
                              className={`text-sm ${
                                horasSinActividad > 10
                                  ? 'text-red-500'
                                  : 'text-gray-500'
                              }`}
                            >
                              {formatInactivityTime(stats?.ultimaActividad)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <BarChart className="h-6 w-6 text-green-500" />
                        <span className="text-lg font-bold">
                          {stats?.porcentajeCierre.toFixed(1)}% Cierre
                        </span>
                      </div>
                    </div>

                    {/* Estadísticas del asesor */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Estado de Clientes */}
                      <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">
                          Estado de Clientes
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Total:</span>
                            <span className="font-semibold">
                              {stats?.totalClientes}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-red-500 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Sin reporte:
                            </span>
                            <span className="font-semibold text-red-500">
                              {stats?.clientesSinReporte}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-blue-500 flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              En seguimiento:
                            </span>
                            <span className="font-semibold text-blue-500">
                              {stats?.clientesEnSeguimiento}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-amber-500 flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Críticos:
                            </span>
                            <span className="font-semibold text-amber-500">
                              {stats?.clientesCriticos}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Seguimientos */}
                      <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">
                          Seguimientos
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Pendientes:</span>
                            <span className="font-semibold text-yellow-500">
                              {stats?.seguimientosPendientes}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Completados:</span>
                            <span className="font-semibold text-green-500">
                              {stats?.seguimientosCompletados}
                            </span>
                          </div>
                          <div className="flex justify- between items-center">
                            <span className="text-sm">Tasa de respuesta:</span>
                            <span className="font-semibold">
                              {stats?.tasaRespuesta.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">T. Completado:</span>
                            <span className="font-semibold">
                              {stats?.tiempoPromedioRespuesta.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ventas */}
                      <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">
                          Ventas
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Del período:</span>
                            <span className="font-semibold text-green-500">
                              {stats?.ventasRealizadas}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">
                              Tiempo promedio:
                              <span className="font-semibold">
                                {stats?.tiempoPromedioConversion.toFixed(1)}{' '}
                                días
                              </span>
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm">Tasa de cierre:</span>
                            <span className="font-semibold">
                              {stats?.porcentajeCierre.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Monto promedio:</span>
                            <span className="font-semibold">
                              ${stats?.montoPromedioVenta.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Últimas Actividades */}
                    <div className="mt-4 bg-white p-4 rounded-lg shadow">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">
                        Últimas Actividades
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Último reporte:</span>
                          <span className="font-semibold">
                            {stats?.ultimoReporte
                              ? formatDate(stats.ultimoReporte)
                              : 'Sin reportes'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Último seguimiento:</span>
                          <span className="font-semibold">
                            {stats?.ultimoSeguimiento
                              ? formatDate(stats.ultimoSeguimiento)
                              : 'Sin seguimientos'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Última venta:</span>
                          <span className="font-semibold">
                            {stats?.ultimaVenta
                              ? formatDate(stats.ultimaVenta)
                              : 'Sin ventas'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Alertas */}
                    {(stats?.clientesSinReporte > 0 ||
                      horasSinActividad > 10 ||
                      stats?.clientesCriticos > 0 ||
                      stats?.clientesNoContactados > 0 ||
                      stats?.tiempoPromedioRespuesta > 24) && (
                      <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                        <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                          <Bell className="h-4 w-4 mr-2" />
                          Alertas
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {stats?.clientesSinReporte > 0 && (
                            <li className="text-sm text-red-700">
                              Tiene {stats.clientesSinReporte} clientes sin
                              reporte
                            </li>
                          )}
                          {horasSinActividad > 10 && (
                            <li className="text-sm text-red-700">
                              No ha registrado actividad en las últimas{' '}
                              {horasSinActividad} horas
                            </li>
                          )}
                          {stats?.clientesCriticos > 0 && (
                            <li className="text-sm text-red-700">
                              Tiene {stats.clientesCriticos} clientes críticos
                              sin atender
                            </li>
                          )}
                          {stats?.clientesNoContactados > 0 && (
                            <li className="text-sm text-red-700">
                              {stats.clientesNoContactados} clientes sin
                              contactar en las últimas 48 horas
                            </li>
                          )}
                          {stats?.tiempoPromedioRespuesta > 24 && (
                            <li className="text-sm text-red-700">
                              Tiempo de completado superior a 24 horas
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Botón para ver detalle */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setAsesorSeleccionado(asesor)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </div>
                );
              })}

              {asesoresOrdenados.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron asesores que coincidan con los filtros
                  aplicados
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalle de Asesor */}
      {asesorSeleccionado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-7xl bg-white shadow-xl rounded-lg">
            <DetalleAsesor
              asesor={asesorSeleccionado}
              estadisticas={estadisticas[asesorSeleccionado.ID]}
              clientes={clientes.filter(
                (c) => c.ID_ASESOR === asesorSeleccionado.ID
              )}
              reportes={reportes.filter(
                (r) => r.ID_ASESOR === asesorSeleccionado.ID
              )}
              promedioEquipo={{
                tasaCierre:
                  Object.values(estadisticas).reduce(
                    (acc, stats) => acc + stats.porcentajeCierre,
                    0
                  ) / Object.keys(estadisticas).length,
                tiempoRespuesta:
                  Object.values(estadisticas).reduce(
                    (acc, stats) => acc + stats.tiempoPromedioRespuesta,
                    0
                  ) / Object.keys(estadisticas).length,
                ventasPorMes:
                  Object.values(estadisticas).reduce(
                    (acc, stats) => acc + stats.ventasPorMes,
                    0
                  ) / Object.keys(estadisticas).length,
              }}
              onBack={() => setAsesorSeleccionado(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
