import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Cliente, Asesor, Reporte, EstadisticasAsesor } from '../types';
import { Calendar, Users, MessageSquare, List, Clock, TrendingUp, Target, Timer } from 'lucide-react';
import ClientesSinReporte from './ClientesSinReporte';
import ActualizarEstadoCliente from './ActualizarEstadoCliente';
import ReportarVenta from './ReportarVenta';
import ListaGeneralClientes from './ListaGeneralClientes';
import SeguimientosClientes from './SeguimientosClientes';
import EstadisticasAvanzadas from './EstadisticasAvanzadas';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';

interface DashboardAsesorProps {
  asesorInicial: Asesor;
  onLogout: () => void;
}

export default function DashboardAsesor({ asesorInicial, onLogout }: DashboardAsesorProps) {
  const [asesor] = useState<Asesor>(asesorInicial);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesSinReporte, setClientesSinReporte] = useState<Cliente[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [clienteParaEstado, setClienteParaEstado] = useState<Cliente | null>(null);
  const [clienteParaVenta, setClienteParaVenta] = useState<Cliente | null>(null);
  const [vistaActual, setVistaActual] = useState<'general' | 'seguimientos' | 'estadisticas'>('general');
  const [estadisticas, setEstadisticas] = useState<EstadisticasAsesor>({
    totalClientes: 0,
    clientesReportados: 0,
    ventasRealizadas: 0,
    seguimientosPendientes: 0,
    seguimientosCompletados: 0,
    porcentajeCierre: 0,
    ventasPorMes: 0,
    tiempoPromedioConversion: 0,
    tasaRespuesta: 0
  });

  const { toast, showToast, hideToast } = useToast();

  const handleLogout = async () => {
    localStorage.removeItem('userSession');
    onLogout();
  };

  useEffect(() => {
    cargarDatos();
  }, [asesor.ID]);

  const cargarDatos = async () => {
    try {
      console.log('Cargando datos para asesor:', asesor.ID);

      // Cargar clientes del asesor
      const { data: clientesData, error: clientesError } = await supabase
        .from('GERSSON_CLIENTES')
        .select('*')
        .eq('ID_ASESOR', asesor.ID);

      if (clientesError) {
        console.error('Error al cargar clientes:', clientesError);
        throw clientesError;
      }

      console.log('Clientes cargados:', clientesData?.length || 0);

      // Cargar reportes del asesor
      const { data: reportesData, error: reportesError } = await supabase
        .from('GERSSON_REPORTES')
        .select(`
          *,
          cliente:GERSSON_CLIENTES(*)
        `)
        .eq('ID_ASESOR', asesor.ID)
        .order('FECHA_SEGUIMIENTO', { ascending: true });

      if (reportesError) {
        console.error('Error al cargar reportes:', reportesError);
        throw reportesError;
      }

      console.log('Reportes cargados:', reportesData?.length || 0);

      if (clientesData && reportesData) {
        // Procesar clientes y sus estados
        const clientesProcesados = clientesData.map(cliente => {
          // Si el cliente está marcado como PAGADO por el backend
          if (cliente.ESTADO === 'PAGADO') {
            // Verificar si el asesor ha reportado la venta
            const tieneReporteVenta = reportesData.some(r =>
              r.ID_CLIENTE === cliente.ID &&
              r.ESTADO_NUEVO === 'PAGADO'
            );

            if (!tieneReporteVenta) {
              // Buscar el último estado reportado por el asesor
              const ultimoReporte = reportesData
                .filter(r => r.ID_CLIENTE === cliente.ID)
                .sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];

              // Si hay un reporte previo, usar ese estado
              if (ultimoReporte) {
                return { ...cliente, ESTADO: ultimoReporte.ESTADO_NUEVO };
              }
            }
          }
          return cliente;
        });

        console.log('Clientes procesados:', clientesProcesados.length);

        setClientes(clientesProcesados);
        setReportes(reportesData);

        // Filtrar clientes sin reporte
        const clientesConReporte = new Set(reportesData.map(r => r.ID_CLIENTE));
        const clientesSinReporteFiltrados = clientesProcesados.filter(c =>
          !clientesConReporte.has(c.ID)
        );
        setClientesSinReporte(clientesSinReporteFiltrados);

        // Calcular estadísticas
        const ventasRealizadas = reportesData.filter(r => r.ESTADO_NUEVO === 'PAGADO').length;
        const seguimientosPendientes = reportesData.filter(r =>
          r.FECHA_SEGUIMIENTO &&
          !r.COMPLETADO &&
          r.FECHA_SEGUIMIENTO >= Math.floor(Date.now() / 1000)
        ).length;
        const seguimientosCompletados = reportesData.filter(r => r.COMPLETADO).length;
        const totalSeguimientos = seguimientosPendientes + seguimientosCompletados;

        // Calcular tiempo promedio de conversión
        const ventasConFecha = reportesData.filter(r =>
          r.ESTADO_NUEVO === 'PAGADO' &&
          r.cliente?.FECHA_CREACION &&
          r.FECHA_REPORTE
        );

        const tiempoPromedioConversion = ventasConFecha.length > 0
          ? ventasConFecha.reduce((acc, venta) => {
            const tiempoConversion = venta.FECHA_REPORTE -
              (typeof venta.cliente?.FECHA_CREACION === 'string'
                ? parseInt(venta.cliente.FECHA_CREACION)
                : venta.cliente?.FECHA_CREACION || 0);
            return acc + tiempoConversion;
          }, 0) / ventasConFecha.length / (24 * 60 * 60) // Convertir a días
          : 0;

        // Calcular tasa de respuesta
        const tasaRespuesta = totalSeguimientos > 0
          ? (seguimientosCompletados / totalSeguimientos) * 100
          : 0;

        setEstadisticas({
          totalClientes: clientesProcesados.length,
          clientesReportados: clientesConReporte.size,
          ventasRealizadas,
          seguimientosPendientes,
          seguimientosCompletados,
          porcentajeCierre: clientesProcesados.length ? (ventasRealizadas / clientesProcesados.length) * 100 : 0,
          ventasPorMes: ventasRealizadas,
          tiempoPromedioConversion,
          tasaRespuesta
        });
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      showToast('Error al cargar los datos', 'error');
    }
  };

  const handleActualizarEstadoComplete = () => {
    setClienteParaEstado(null);
    cargarDatos();
    showToast('Estado actualizado correctamente', 'success');
  };

  const handleReportarVentaComplete = () => {
    setClienteParaVenta(null);
    cargarDatos();
    showToast('Venta reportada correctamente', 'success');
  };

  const handleMarcarCompletado = async (reporte: Reporte) => {
    try {
      const { error } = await supabase
        .from('GERSSON_REPORTES')
        .update({ COMPLETADO: true })
        .eq('ID', reporte.ID);

      if (error) throw error;

      showToast('Seguimiento marcado como completado', 'success');
      cargarDatos();
    } catch (error) {
      console.error('Error al marcar seguimiento como completado:', error);
      showToast('Error al marcar seguimiento como completado', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Dashboard de {asesor.NOMBRE}
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              Cerrar Sesión
            </button>
          </div>

          {/* Pestañas de navegación */}
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setVistaActual('general')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <List className="inline-block h-5 w-5 mr-2" />
              Vista General
            </button>
            <button
              onClick={() => setVistaActual('seguimientos')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === 'seguimientos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Clock className="inline-block h-5 w-5 mr-2" />
              Seguimientos
              {estadisticas.seguimientosPendientes > 0 && (
                <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {estadisticas.seguimientosPendientes}
                </span>
              )}
            </button>
            <button
              onClick={() => setVistaActual('estadisticas')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${vistaActual === 'estadisticas'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <TrendingUp className="inline-block h-5 w-5 mr-2" />
              Estadísticas
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Estadísticas Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Clientes</p>
                <p className="text-2xl font-semibold text-gray-900">{estadisticas.totalClientes}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Tasa de Cierre</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {estadisticas.porcentajeCierre.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Timer className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Tiempo Promedio</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {estadisticas.tiempoPromedioConversion.toFixed(1)} días
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Tasa de Respuesta</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {estadisticas.tasaRespuesta.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {vistaActual === 'general' && (
          <>
            {/* Clientes sin reporte siempre visibles arriba */}
            <ClientesSinReporte
              clientes={clientesSinReporte}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
            />

            <div className="h-4"></div> {/* Espaciador */}

            <ListaGeneralClientes
              clientes={clientes}
              reportes={reportes}
              onActualizarEstado={setClienteParaEstado}
              onReportarVenta={setClienteParaVenta}
            />
          </>
        )}

        {vistaActual === 'seguimientos' && (
          <SeguimientosClientes
            reportes={reportes}
            onActualizarEstado={setClienteParaEstado}
            onMarcarCompletado={handleMarcarCompletado}
          />
        )}

        {vistaActual === 'estadisticas' && (
          <EstadisticasAvanzadas
            estadisticas={estadisticas}
            reportes={reportes}
            clientes={clientes}
          />
        )}

        {/* Modales */}
        {clienteParaEstado && (
          <ActualizarEstadoCliente
            cliente={clienteParaEstado}
            asesor={asesor}
            onComplete={handleActualizarEstadoComplete}
            onClose={() => setClienteParaEstado(null)}
          />
        )}

        {clienteParaVenta && (
          <ReportarVenta
            cliente={clienteParaVenta}
            asesor={asesor}
            onComplete={handleReportarVentaComplete}
            onClose={() => setClienteParaVenta(null)}
          />
        )}

        {/* Toast notifications */}
        {toast.visible && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
          />
        )}
      </div>
    </div>
  );
}