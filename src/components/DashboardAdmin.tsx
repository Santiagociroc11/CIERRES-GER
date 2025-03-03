import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../lib/apiClient';
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
import HistorialCliente from './HistorialCliente';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ReasignarCliente from "./ReasignarCliente";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCcw } from 'lucide-react';
import { parse } from 'date-fns';


interface DashboardAdminProps {
  onLogout: () => void;
}

export default function DashboardAdmin({ onLogout }: DashboardAdminProps) {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [estadisticas, setEstadisticas] = useState<Record<number, EstadisticasDetalladas>>({});
  const [clientes, setClientes] = useState<any[]>([]);
  const [reportes, setReportes] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const itemsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'mes' | 'semana' | 'personalizado'>('mes');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenarPor, setOrdenarPor] = useState<'ventas' | 'tasa' | 'tiempo' | 'actividad'>('ventas');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Función para refrescar manualmente
  const handleRefresh = async () => {
    setTick(t => t + 1);
    setLastUpdated(new Date());
    await cargarDatos(); // función que actualiza los registros
  };

  // Nuevo estado para alternar entre vista de Asesores y Clientes
  const [vistaAdmin, setVistaAdmin] = useState<'asesores' | 'clientes'>('asesores');
  // Estado para el modal de historial de cliente
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);

  const handleLogout = async () => {
    localStorage.removeItem('userSession');
    onLogout();
  };

  // Cargar datos al cambiar filtros
  useEffect(() => {
    cargarDatos();
  }, [periodoSeleccionado, fechaInicio, fechaFin]);


  const cargarDatos = async () => {
    try {
        console.log("🚀 Cargando datos desde PostgREST...");

        // Paso 1️⃣: Obtener asesores ordenados por nombre desde PostgREST
        const asesoresData = await apiClient.request<any[]>(
            '/GERSSON_ASESORES?select=*&order=NOMBRE'
        );

        if (!asesoresData || asesoresData.length === 0) return;
        setAsesores(asesoresData);

        console.log("✅ Asesores obtenidos:", asesoresData.length);

        // Paso 2️⃣: Obtener clientes, reportes y registros en paralelo SIN paginación
        const [clientesData, reportesData, registrosData] = await Promise.all([
            apiClient.request<any[]>('/GERSSON_CLIENTES?select=*'),
            apiClient.request<any[]>('/GERSSON_REPORTES?select=*'),
            apiClient.request<any[]>('/GERSSON_REGISTROS?select=*'),
        ]);

        console.log("✅ Clientes obtenidos:", clientesData.length);
        console.log("✅ Reportes obtenidos:", reportesData.length);
        console.log("✅ Registros obtenidos:", registrosData.length);

        // Paso 3️⃣: Verificar datos y actualizar el estado
        if (clientesData && reportesData && registrosData) {
            setClientes(clientesData);
            setReportes(reportesData);
            setRegistros(registrosData);

            // Paso 4️⃣: Calcular estadísticas por asesor
            const nuevasEstadisticas: Record<number, EstadisticasDetalladas> = {};
            asesoresData.forEach((asesor: any) => {
                const clientesAsesor = clientesData.filter((c: any) => c.ID_ASESOR === asesor.ID);
                const reportesAsesor = reportesData.filter((r: any) => r.ID_ASESOR === asesor.ID);

                nuevasEstadisticas[asesor.ID] = calcularEstadisticasDetalladas(
                    clientesAsesor,
                    reportesAsesor,
                    periodoSeleccionado,
                    fechaInicio,
                    fechaFin
                );
            });

            setEstadisticas(nuevasEstadisticas);
        }
    } catch (error) {
        console.error("❌ Error al cargar datos:", error);
    }
};

  const calcularEstadisticasDetalladas = (
    clientesAsesor: any[],
    reportesAsesor: any[],
    periodo: 'mes' | 'semana' | 'personalizado',
    inicio?: string,
    fin?: string
  ): EstadisticasDetalladas => {
    const hoy = new Date();
    let fechaInicioFiltro = new Date();
    if (periodo === 'mes') {
      fechaInicioFiltro.setMonth(hoy.getMonth() - 1);
    } else if (periodo === 'semana') {
      fechaInicioFiltro.setDate(hoy.getDate() - 7);
    } else if (periodo === 'personalizado' && inicio) {
      fechaInicioFiltro = new Date(inicio);
    }
    const fechaFinFiltro = (periodo === 'personalizado' && fin) ? new Date(fin) : hoy;

    const reportesFiltrados = reportesAsesor.filter((r: any) => {
      const fechaReporte = new Date(r.FECHA_REPORTE * 1000);
      return fechaReporte >= fechaInicioFiltro && fechaReporte <= fechaFinFiltro;
    });

    const clientesReportados = new Set(reportesAsesor.map((r: any) => r.ID_CLIENTE)).size;
    const clientesSinReporte = clientesAsesor.filter(
      (c: any) => !reportesAsesor.find((r: any) => r.ID_CLIENTE === c.ID)
    ).length;
    const ventasRealizadas = reportesFiltrados.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO').length;

    const tiemposRespuesta = reportesAsesor
      .filter((r: any) => r.FECHA_SEGUIMIENTO && r.COMPLETADO)
      .map((r: any) => r.FECHA_SEGUIMIENTO - r.FECHA_REPORTE);

    const tiempoPromedioRespuesta = tiemposRespuesta.length
      ? tiemposRespuesta.reduce((a: number, b: number) => a + b, 0) / tiemposRespuesta.length / 3600
      : 0;

    const reportesPorCliente = clientesAsesor.length ? reportesAsesor.length / clientesAsesor.length : 0;
    const reportesConSeguimiento = reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO).length;


    const ultimoReporte = reportesAsesor.length > 0
      ? Math.max(...reportesAsesor.map((r: any) => r.FECHA_REPORTE))
      : null;
    const ultimoSeguimiento = reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO && r.COMPLETADO).length > 0
      ? Math.max(...reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO && r.COMPLETADO).map((r: any) => r.FECHA_SEGUIMIENTO))
      : null;
    const ultimaVenta = reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO').length > 0
      ? Math.max(...reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO').map((r: any) => r.FECHA_REPORTE))
      : null;

    const tiemposHastaReporte = clientesAsesor
      .map((cliente: any) => {
        const primerReporte = reportesAsesor
          .filter((r: any) => r.ID_CLIENTE === cliente.ID)
          .sort((a: any, b: any) => a.FECHA_REPORTE - b.FECHA_REPORTE)[0];
        return primerReporte ? (primerReporte.FECHA_REPORTE - cliente.FECHA_CREACION) / 3600 : null;
      })
      .filter((t: number | null) => t !== null) as number[];
    const tiempoPromedioHastaReporte = tiemposHastaReporte.length
      ? tiemposHastaReporte.reduce((a, b) => a + b, 0) / tiemposHastaReporte.length
      : 0;

    const tiemposHastaVenta = clientesAsesor
      .filter((c: any) => c.ESTADO === 'PAGADO')
      .map((cliente: any) => {
        const reporteVenta = reportesAsesor
          .filter((r: any) => r.ID_CLIENTE === cliente.ID && r.ESTADO_NUEVO === 'PAGADO')
          .sort((a: any, b: any) => a.FECHA_REPORTE - b.FECHA_REPORTE)[0];
        return reporteVenta ? (reporteVenta.FECHA_REPORTE - cliente.FECHA_CREACION) / 3600 : null;
      })
      .filter((t: number | null) => t !== null) as number[];
    const tiempoPromedioHastaVenta = tiemposHastaVenta.length
      ? tiemposHastaVenta.reduce((a, b) => a + b, 0) / tiemposHastaVenta.length
      : 0;

    const ventasBackend = clientesAsesor.filter((c: any) => c.ESTADO === 'PAGADO').length;
    const ventasReportadas = reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO').length;
    const ventasSinReportar = ventasBackend - ventasReportadas;

    return {
      ventasReportadas,
      ventasSinReportar,
      // Usamos ventasBackend para representar las ventas realizadas
      ventasRealizadas: ventasBackend,
      totalClientes: clientesAsesor.length,
      clientesReportados,
      clientesSinReporte,
      clientesConReporte: clientesReportados,
      clientesEnSeguimiento: reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'SEGUIMIENTO').length,
      clientesRechazados: reportesAsesor.filter((r: any) => r.ESTADO_NUEVO === 'NO INTERESADO').length,
      clientesCriticos: clientesAsesor.filter((c: any) =>
        ['CARRITOS', 'RECHAZADOS', 'TICKETS'].includes(c.ESTADO)
      ).length,
      clientesNoContactados: clientesAsesor.filter(
        (c: any) => !reportesAsesor.find((r: any) => r.ID_CLIENTE === c.ID)
      ).length,
      seguimientosPendientes: reportesAsesor.filter((r: any) => r.FECHA_SEGUIMIENTO && !r.COMPLETADO).length,
      seguimientosCompletados: reportesAsesor.filter((r: any) => r.COMPLETADO).length,
      porcentajeCierre: clientesAsesor.length ? (ventasRealizadas / clientesAsesor.length) * 100 : 0,
      ventasPorMes: ventasRealizadas,
      tiempoPromedioConversion: tiempoPromedioHastaVenta / 24,
      tasaRespuesta: reportesConSeguimiento
        ? (reportesAsesor.filter((r: any) => r.COMPLETADO).length / reportesConSeguimiento) * 100
        : 0,
      tiempoPromedioRespuesta,
      tiempoPromedioHastaReporte,
      tiempoPromedioHastaVenta,
      reportesPorCliente,
      reportesConSeguimiento,
      ultimaActividad: ultimoReporte,
      ultimoReporte,
      ultimoSeguimiento,
      ultimaVenta,
    };
  };

  // Datos para el gráfico de ventas diarios
  const getSalesData = useMemo(() => {
    const ventas = reportes.filter((r: any) => r.ESTADO_NUEVO === 'PAGADO');
    const ventasPorFecha: Record<string, number> = {};
    ventas.forEach((r: any) => {
      const fecha = formatDateOnly(r.FECHA_REPORTE);
      ventasPorFecha[fecha] = (ventasPorFecha[fecha] || 0) + 1;
    });
    const data = Object.keys(ventasPorFecha).map((fecha) => ({
      date: fecha,
      sales: ventasPorFecha[fecha],
    }));
    // Ordenar parseando el string en el formato "dd/MM/yyyy"
    return data.sort((a, b) => {
      const dateA = parse(a.date, 'dd/MM/yyyy', new Date());
      const dateB = parse(b.date, 'dd/MM/yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });
  }, [reportes]);

  const asesoresFiltrados = asesores.filter((asesor) => {
    const coincideBusqueda =
      asesor.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
      asesor.WHATSAPP.includes(busqueda);
    if (mostrarInactivos) {
      const stats = estadisticas[asesor.ID];
      const ultimaActividadDate = stats?.ultimaActividad ? new Date(stats.ultimaActividad * 1000) : null;
      const horasSinActividad = ultimaActividadDate
        ? Math.floor((Date.now() - ultimaActividadDate.getTime()) / (1000 * 60 * 60))
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
        return (statsB?.ventasRealizadas || 0) - (statsA?.ventasRealizadas || 0);
      case 'tasa':
        return (statsB?.porcentajeCierre || 0) - (statsA?.porcentajeCierre || 0);
      case 'tiempo':
        return (statsA?.tiempoPromedioConversion || 0) - (statsB?.tiempoPromedioConversion || 0);
      case 'actividad': {
        const fechaA = statsA?.ultimaActividad ? new Date(statsA.ultimaActividad * 1000) : new Date(0);
        const fechaB = statsB?.ultimaActividad ? new Date(statsB.ultimaActividad * 1000) : new Date(0);
        return fechaB.getTime() - fechaA.getTime();
      }
      default:
        return 0;
    }
  });

  // Exportar datos a CSV
  const exportarDatos = () => {
    const data = asesores.map((asesor) => ({
      Nombre: asesor.NOMBRE,
      WhatsApp: asesor.WHATSAPP,
      'Total Clientes': estadisticas[asesor.ID]?.totalClientes || 0,
      'Clientes Sin Reporte': estadisticas[asesor.ID]?.clientesSinReporte || 0,
      'Clientes Con Reporte': estadisticas[asesor.ID]?.clientesConReporte || 0,
      'Clientes En Seguimiento': estadisticas[asesor.ID]?.clientesEnSeguimiento || 0,
      'Clientes Rechazados': estadisticas[asesor.ID]?.clientesRechazados || 0,
      'Clientes Críticos': estadisticas[asesor.ID]?.clientesCriticos || 0,
      'Clientes Sin Contactar': estadisticas[asesor.ID]?.clientesNoContactados || 0,
      'Ventas Realizadas': estadisticas[asesor.ID]?.ventasRealizadas || 0,
      'Tasa de Cierre': `${estadisticas[asesor.ID]?.porcentajeCierre.toFixed(1)}%`,
      'Tiempo Promedio': `${estadisticas[asesor.ID]?.tiempoPromedioConversion.toFixed(1)} días`,
      'Tiempo de Completado': `${estadisticas[asesor.ID]?.tiempoPromedioRespuesta.toFixed(1)} horas`,
      'Última Actividad': estadisticas[asesor.ID]?.ultimaActividad
        ? formatDateOnly(estadisticas[asesor.ID]?.ultimaActividad)
        : 'Sin actividad',
    }));

    const csvContent = [
      Object.keys(data[0]).join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `reporte_asesores_${formatDateOnly(Date.now() / 1000)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Encabezado y navegación principal */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Panel de Administración</h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportarDatos}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <Download className="h-5 w-5 mr-2" />
                Exportar Datos
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Cerrar Sesión
              </button>
            </div>

            {/* Navegación entre pestañas: Asesores / Clientes */}
            <div className="mt-4 flex space-x-4 border-b border-gray-200">
              <button
                onClick={() => setVistaAdmin('asesores')}
                className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaAdmin === 'asesores'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Asesores
              </button>
              <button
                onClick={() => setVistaAdmin('clientes')}
                className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaAdmin === 'clientes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Clientes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-8xl mx-auto px-4 py-6">
        {vistaAdmin === 'asesores' ? (
          <>

            {/* Resumen y lista de asesores */}
            <div className="max-w-7xl mx-auto px-4 py-6">
              {/* Resumen General */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow p-4 flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Asesores</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900">{asesores.length}</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 flex items-center">
                  <Target className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Ventas Totales</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900">
                      {Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasRealizadas, 0)}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 flex items-center">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Sin Reporte</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900">
                      {Object.values(estadisticas).reduce((acc, stats) => acc + stats.clientesSinReporte, 0)}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 flex items-center">
                  <Calendar className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Clientes Totales</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900">
                      {Object.values(estadisticas).reduce((acc, stats) => acc + stats.totalClientes, 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Gráfico de ventas */}
              {getSalesData.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Tendencia de Ventas</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getSalesData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="sales" stroke="#4ade80" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Filtros */}
              <div className="mb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Buscar asesor..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <select
                      value={periodoSeleccionado}
                      onChange={(e) => setPeriodoSeleccionado(e.target.value as 'mes' | 'semana' | 'personalizado')}
                      className="w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="mes">Último mes</option>
                      <option value="semana">Última semana</option>
                      <option value="personalizado">Personalizado</option>
                    </select>

                    {periodoSeleccionado === 'personalizado' && (
                      <div className="flex gap-4">
                        <input
                          type="date"
                          value={fechaInicio}
                          onChange={(e) => setFechaInicio(e.target.value)}
                          className="border border-gray-300 rounded-md p-2"
                        />
                        <input
                          type="date"
                          value={fechaFin}
                          onChange={(e) => setFechaFin(e.target.value)}
                          className="border border-gray-300 rounded-md p-2"
                        />
                      </div>
                    )}
                  </div>
                  <select
                    value={ordenarPor}
                    onChange={(e) => setOrdenarPor(e.target.value as any)}
                    className="w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ventas">Ordenar por ventas</option>
                    <option value="tasa">Ordenar por tasa de cierre</option>
                    <option value="tiempo">Ordenar por tiempo de conversión</option>
                    <option value="actividad">Ordenar por última actividad</option>
                  </select>
                  <button
                    onClick={() => setMostrarInactivos(!mostrarInactivos)}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    {mostrarInactivos ? 'Mostrar todos' : 'Mostrar solo inactivos'}
                  </button>
                </div>
              </div>

              {/* Lista de Asesores */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Rendimiento de Asesores</h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4">
                    {asesoresOrdenados.map((asesor) => {
                      const stats = estadisticas[asesor.ID];
                      const ultimaActividadDate = stats?.ultimaActividad ? new Date(stats.ultimaActividad * 1000) : null;
                      const horasSinActividad = ultimaActividadDate
                        ? Math.floor((Date.now() - ultimaActividadDate.getTime()) / (1000 * 60 * 60))
                        : null;

                      return (
                        <div key={asesor.ID} className="bg-gray-50 rounded-lg p-4">
                          {/* Encabezado del asesor */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center">
                              <Users className="h-8 w-8 text-blue-500" />
                              <div className="ml-3">
                                <h3 className="text-lg font-semibold">{asesor.NOMBRE}</h3>
                                {horasSinActividad !== null && (
                                  <p className={`text-sm ${horasSinActividad > 10 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {formatInactivityTime(stats?.ultimaActividad)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <BarChart className="h-6 w-6 text-green-500" />
                              <span className="text-lg font-bold">{stats?.porcentajeCierre.toFixed(1)}% Cierre</span>
                            </div>
                          </div>

                          {/* Estadísticas del asesor */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Estado de Clientes */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Estado de Clientes</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Total:</span>
                                  <span className="font-semibold">{stats?.totalClientes}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-red-500 flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    Sin reporte:
                                  </span>
                                  <span className="font-semibold text-red-500">{stats?.clientesSinReporte}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-500 flex items-center">
                                    <Clock className="h-4 w-4 mr-1" />
                                    En seguimiento:
                                  </span>
                                  <span className="font-semibold text-blue-500">{stats?.clientesEnSeguimiento}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-amber-500 flex items-center">
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    Críticos:
                                  </span>
                                  <span className="font-semibold text-amber-500">{stats?.clientesCriticos}</span>
                                </div>
                              </div>
                            </div>

                            {/* Seguimientos */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Seguimientos</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Pendientes:</span>
                                  <span className="font-semibold text-yellow-500">{stats?.seguimientosPendientes}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Completados:</span>
                                  <span className="font-semibold text-green-500">{stats?.seguimientosCompletados}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tasa de respuesta:</span>
                                  <span className="font-semibold">{stats?.tasaRespuesta.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Ventas */}
                            <div className="bg-white p-4 rounded-lg shadow">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Ventas</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Del período:</span>
                                  <span className="font-semibold text-green-500">
                                    {stats?.ventasRealizadas}
                                    {stats?.ventasSinReportar > 0 && (
                                      <span className="text-xs text-red-500 ml-1">
                                        ({stats.ventasSinReportar} sin reportar)
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">
                                    Tiempo promedio:
                                    <span className="font-semibold">
                                      {stats?.tiempoPromedioConversion.toFixed(1)} días
                                    </span>
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Tasa de cierre:</span>
                                  <span className="font-semibold">{stats?.porcentajeCierre.toFixed(1)}%</span>
                                </div>
                      
                              </div>
                            </div>
                          </div>

                          {/* Últimas Actividades */}
                          <div className="mt-4 bg-white p-4 rounded-lg shadow">
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Últimas Actividades</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Último reporte:</span>
                                <span className="font-semibold">
                                  {stats?.ultimoReporte ? formatDate(stats.ultimoReporte) : 'Sin reportes'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Último seguimiento:</span>
                                <span className="font-semibold">
                                  {stats?.ultimoSeguimiento ? formatDate(stats.ultimoSeguimiento) : 'Sin seguimientos'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Última venta:</span>
                                <span className="font-semibold">
                                  {stats?.ultimaVenta ? formatDate(stats.ultimaVenta) : 'Sin ventas'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Alertas individuales */}
                          {(stats?.clientesSinReporte > 0 ||
                            (horasSinActividad !== null && horasSinActividad > 10) ||
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
                                      Tiene {stats.clientesSinReporte} cliente(s) sin reporte
                                    </li>
                                  )}
                                  {horasSinActividad !== null && horasSinActividad > 10 && (
                                    <li className="text-sm text-red-700">
                                      No ha registrado actividad en las últimas {horasSinActividad} hora(s)
                                    </li>
                                  )}
                                  {stats?.clientesCriticos > 0 && (
                                    <li className="text-sm text-red-700">
                                      Tiene {stats.clientesCriticos} cliente(s) críticos sin atender
                                    </li>
                                  )}
                                  {stats?.ventasSinReportar > 0 && (
                                    <li className="text-sm text-red-700">
                                      Tiene {stats.ventasSinReportar} venta(s) sin reportar
                                    </li>
                                  )}
                                  {stats?.clientesNoContactados > 0 && (
                                    <li className="text-sm text-red-700">
                                      {stats.clientesNoContactados} cliente(s) sin contactar en las últimas 48 horas
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
                        No se encontraron asesores que coincidan con los filtros aplicados
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
                    clientes={clientes.filter((c) => c.ID_ASESOR === asesorSeleccionado.ID)}
                    reportes={reportes.filter((r) => r.ID_ASESOR === asesorSeleccionado.ID)}
                    registros={registros}
                    promedioEquipo={{
                      tasaCierre:
                        Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) /
                        Object.keys(estadisticas).length,
                      tiempoRespuesta:
                        Object.values(estadisticas).reduce((acc, stats) => acc + stats.tiempoPromedioRespuesta, 0) /
                        Object.keys(estadisticas).length,
                      ventasPorMes:
                        Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasPorMes, 0) /
                        Object.keys(estadisticas).length,
                    }}
                    onBack={() => setAsesorSeleccionado(null)}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 space-y-8">
            {/* Filtros */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Buscador */}
              <div className="relative w-full md:w-1/3">
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {/* Filtro por estado */}
              <div className="w-full md:w-1/4">
                <select
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-3 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="SEGUIMIENTO">Seguimiento</option>
                  <option value="NO CONTESTÓ">No Contestó</option>
                  <option value="NO CONTACTAR">No Contactar</option>
                </select>
              </div>
              {/* Botón de refrescar y último update */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <RefreshCcw className="h-5 w-5 mr-2" />
                  Refrescar
                </button>
                <span className="text-xs text-gray-500">
                  Actualizado: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Tabla de Clientes */}
            <div className="overflow-x-auto">
              {(() => {
                const filteredClients = clientes
                  .filter(
                    (c) =>
                      (c.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
                        c.WHATSAPP.includes(busqueda)) &&
                      (filtroEstado ? c.ESTADO === filtroEstado : true)
                  )
                  .filter((cliente) =>
                    asesores.some((a) => a.ID === cliente.ID_ASESOR)
                  )
                  .sort((a, b) => b.FECHA_CREACION - a.FECHA_CREACION);

                const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
                const paginatedClients = filteredClients.slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                );

                return (
                  <>
                    <table className="min-w-full bg-white shadow rounded-lg">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            WhatsApp
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Fecha de Creación
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Último Reporte
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Asesor Asignado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedClients.map((cliente) => {
                          const asesorAsignado = asesores.find(
                            (a) => a.ID === cliente.ID_ASESOR
                          );
                          const ultimoReporte = reportes
                            .filter((r) => r.ID_CLIENTE === cliente.ID)
                            .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];

                          const borderClass = ultimoReporte
                            ? "border-l-4 border-green-500"
                            : "border-l-4 border-red-500";

                          const tiempoReporte = ultimoReporte
                            ? (() => {
                              const diff =
                                ultimoReporte.FECHA_REPORTE - cliente.FECHA_CREACION;
                              const hours = Math.floor(diff / 3600);
                              if (hours < 24) return `(${hours}h)`;
                              const days = Math.floor(hours / 24);
                              const remainingHours = hours % 24;
                              return `(${days}d ${remainingHours}h)`;
                            })()
                            : null;

                          const tiempoSinReporte = !ultimoReporte
                            ? formatDistanceToNow(new Date(cliente.FECHA_CREACION * 1000), {
                              addSuffix: true,
                              locale: es,
                            })
                            : null;

                          return (
                            <tr key={cliente.ID} className="hover:bg-gray-50">
                              <td
                                className={`px-6 py-4 whitespace-nowrap text-sm text-gray-800 truncate ${borderClass}`}
                              >
                                {cliente.NOMBRE}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate">
                                {cliente.WHATSAPP}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate">
                                {formatDate(cliente.FECHA_CREACION)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate">
                                {cliente.ESTADO || "Sin definir"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm truncate">
                                {ultimoReporte ? (
                                  <div className="flex flex-col">
                                    <span className="text-gray-700">
                                      {formatDate(ultimoReporte.FECHA_REPORTE)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {tiempoReporte}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-block bg-red-50 text-red-600 px-2 py-1 rounded-full font-semibold">
                                    Sin reporte – {tiempoSinReporte}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm truncate">
                                {asesorAsignado ? (
                                  <span
                                    className={
                                      !ultimoReporte
                                        ? "text-red-700 font-bold"
                                        : "text-gray-800"
                                    }
                                  >
                                    {asesorAsignado.NOMBRE}
                                  </span>
                                ) : (
                                  "Sin asignar"
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap flex items-center">
                                {asesorAsignado && (
                                  <div className="mr-2">
                                    <ReasignarCliente
                                      clienteId={cliente.ID}
                                      asesorActual={asesorAsignado.NOMBRE}
                                    />
                                  </div>
                                )}
                                <button
                                  onClick={() => setClienteSeleccionado(cliente)}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  Ver Historial
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex justify-end items-center space-x-2 mt-4">
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Página {currentPage} de {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                          }
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>



        )}
      </div>

      {/* Modal de Historial de Cliente */}
      {clienteSeleccionado && (
        <HistorialCliente
          cliente={clienteSeleccionado}
          reportes={reportes.filter((r) => r.ID_CLIENTE === clienteSeleccionado.ID)}
          asesor={asesores.find((a) => a.ID === clienteSeleccionado.ID_ASESOR)}
          admin={true}
          onClose={() => setClienteSeleccionado(null)}
        />
      )}


      {/* Modal de Detalle de Asesor */}
      {asesorSeleccionado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-8xl bg-white shadow-xl rounded-lg">
            <DetalleAsesor
              asesor={asesorSeleccionado}
              estadisticas={estadisticas[asesorSeleccionado.ID]}
              clientes={clientes.filter((c) => c.ID_ASESOR === asesorSeleccionado.ID)}
              reportes={reportes.filter((r) => r.ID_ASESOR === asesorSeleccionado.ID)}
              registros={registros}
              promedioEquipo={{
                tasaCierre:
                  Object.values(estadisticas).reduce((acc, stats) => acc + stats.porcentajeCierre, 0) /
                  Object.keys(estadisticas).length,
                tiempoRespuesta:
                  Object.values(estadisticas).reduce((acc, stats) => acc + stats.tiempoPromedioRespuesta, 0) /
                  Object.keys(estadisticas).length,
                ventasPorMes:
                  Object.values(estadisticas).reduce((acc, stats) => acc + stats.ventasPorMes, 0) /
                  Object.keys(estadisticas).length,
              }}
              onBack={() => setAsesorSeleccionado(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
