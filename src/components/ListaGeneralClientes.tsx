import React, { useState, useEffect } from 'react';
import { Cliente, Reporte, Registro, EstadoCliente, esEstadoCritico, Asesor, AdminRole } from '../types';
import {
  Search,
  Phone,
  MessageSquare,
  DollarSign,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  Menu,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileVideo,
} from 'lucide-react';
import { formatDateOnly, isValidDate, formatDate } from '../utils/dateUtils';
import HistorialCliente from './HistorialCliente';
import ReasignarCliente from './ReasignarCliente';
import ConsolidarVenta from './ConsolidarVenta';

interface ListaGeneralClientesProps {
  clientes: Cliente[];
  reportes: Reporte[];
  onActualizarEstado: (cliente: Cliente) => void;
  onReportarVenta: (cliente: Cliente) => void;
  onChat: (cliente: Cliente) => void;
  admin: boolean;
  readOnly?: boolean;
  adminRole?: AdminRole;
}

export default function ListaGeneralClientes({
  clientes,
  reportes,
  onActualizarEstado,
  onReportarVenta,
  onChat,
  admin,
  readOnly = false,
  adminRole = 'supervisor'
}: ListaGeneralClientesProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoCliente | 'TODOS'>('TODOS');
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [mostrarSoloCriticos, setMostrarSoloCriticos] = useState(false);
  const [clienteAcciones, setClienteAcciones] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [forzarBusqueda, setForzarBusqueda] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [clienteConsolidar, setClienteConsolidar] = useState<Cliente | null>(null);
  const [reporteConsolidar, setReporteConsolidar] = useState<Reporte | null>(null);
  const clientesPorPagina = 20;

  useEffect(() => {
    setForzarBusqueda(clientes.length > 1000);
  }, [clientes.length]);

  const tieneReporteVenta = (clienteId: number) => {
    return reportes.some(
      (r) => r.ID_CLIENTE === clienteId && r.ESTADO_NUEVO === 'PAGADO'
    );
  };

  const estaConsolidado = (clienteId: number) => {
    return reportes.some(
      (r) => r.ID_CLIENTE === clienteId && (r.consolidado || r.ESTADO_NUEVO === 'VENTA CONSOLIDADA')
    );
  };

  const obtenerUltimoReporte = (clienteId: number) => {
    const reportesCliente = reportes.filter((r) => r.ID_CLIENTE === clienteId);
    if (!reportesCliente.length) return null;
    return reportesCliente.sort((a, b) => {
      const fechaA =
        typeof a.FECHA_REPORTE === 'string'
          ? parseInt(a.FECHA_REPORTE, 10)
          : a.FECHA_REPORTE;
      const fechaB =
        typeof b.FECHA_REPORTE === 'string'
          ? parseInt(b.FECHA_REPORTE, 10)
          : b.FECHA_REPORTE;
      return fechaB - fechaA;
    })[0];
  };

  const obtenerUltimoReportePagado = (clienteId: number) => {
    const reportesPagados = reportes.filter(
      (r) =>
        r.ID_CLIENTE === clienteId &&
        (r.ESTADO_NUEVO === 'PAGADO')
    );
    if (!reportesPagados.length) return null;
    return reportesPagados.sort((a, b) => {
      const fechaA =
        typeof a.FECHA_REPORTE === 'string'
          ? parseInt(a.FECHA_REPORTE, 10)
          : a.FECHA_REPORTE;
      const fechaB =
        typeof b.FECHA_REPORTE === 'string'
          ? parseInt(b.FECHA_REPORTE, 10)
          : b.FECHA_REPORTE;
      return fechaB - fechaA;
    })[0];
  };
  

  // Modificamos getEstadoTexto para incluir el tipo de producto en ventas
  const getEstadoTexto = (estado: EstadoCliente, clienteId: number) => {
    if (estado === 'PAGADO' || estado === 'VENTA CONSOLIDADA') {
      const ultimoReportePagado = obtenerUltimoReportePagado(clienteId);
      if (ultimoReportePagado) {
        const producto = ultimoReportePagado.PRODUCTO as string || '';
        return `${estado} (${producto})`;
      }
    }
    if (estado === 'PAGADO' && !tieneReporteVenta(clienteId)) {
      return 'PAGADO (NO REPORTADA)';
    }
    return estado;
  };  

  const getSortValue = (cliente: Cliente): number => {
    const ultimoRpt = obtenerUltimoReporte(cliente.ID);
    if ((!ultimoRpt || cliente.ESTADO !== ultimoRpt.ESTADO_NUEVO) && cliente.ESTADO !== 'PAGADO') {
      return 0;
    }
    if (cliente.ESTADO === 'NO CONTESTÓ') return 1;
    if (cliente.ESTADO === 'SEGUIMIENTO') return 2;
    if (cliente.ESTADO === 'PAGADO') return 3;
    if (cliente.ESTADO === 'VENTA CONSOLIDADA') return 4;
    if (cliente.ESTADO === "NO INTERESADO") return 5;
    if (cliente.ESTADO === "NO CONTACTAR") return 6;
    return 5;
  };

  const clientesFiltrados = clientes.filter((cliente) => {
    if (forzarBusqueda && !busqueda) return false;

    const coincideBusqueda =
      cliente.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
      cliente.WHATSAPP.includes(busqueda);

    const coincideEstado =
      filtroEstado === 'TODOS' || cliente.ESTADO === filtroEstado;
    const coincideCriticos = !mostrarSoloCriticos || esEstadoCritico(cliente.ESTADO);

    return coincideBusqueda && coincideEstado && coincideCriticos;
  });

  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => {
    const sortA = getSortValue(a);
    const sortB = getSortValue(b);
    if (sortA === sortB) {
      return (b.FECHA_CREACION as number) - (a.FECHA_CREACION as number);
    }
    return sortA - sortB;
  });

  const totalPaginas = Math.ceil(clientesOrdenados.length / clientesPorPagina);
  const clientesPaginados = clientesOrdenados.slice(
    (pagina - 1) * clientesPorPagina,
    pagina * clientesPorPagina
  );

  const tieneSeguimientoPendiente = (clienteId: number) => {
    return reportes.some(
      (r) =>
        r.ID_CLIENTE === clienteId &&
        r.FECHA_SEGUIMIENTO &&
        !r.COMPLETADO &&
        r.FECHA_SEGUIMIENTO >= Math.floor(Date.now() / 1000)
    );
  };

  const abrirWhatsApp = (numero: string) => {
    if (!numero) return;
    const numeroLimpio = numero.replace(/\D/g, '');
    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
  };

  const getEstadoColor = (estado: EstadoCliente, clienteId: number) => {
    if (estado === 'VENTA CONSOLIDADA') {
      return 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500';
    }
    if (estado === 'PAGADO') {
      const tieneReporte = tieneReporteVenta(clienteId);
      return tieneReporte
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800 border border-yellow-500';
    }
    switch (estado) {
      case 'SEGUIMIENTO':
        return 'bg-blue-100 text-blue-800';
      case 'NO CONTACTAR':
        return 'bg-red-100 text-red-800';
      case 'LINK':
        return 'bg-purple-200 text-purple-800 border-2 border-purple-400 font-bold';
      case 'CARRITOS':
        return 'bg-amber-100 text-amber-800 border-2 border-amber-500';
      case 'RECHAZADOS':
        return 'bg-rose-100 text-rose-800 border-2 border-rose-500';
      case 'TICKETS':
        return 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500';
      case 'NO CONTESTÓ':
        return 'bg-orange-100 text-orange-800';
      case 'MASIVOS':
        return 'bg-teal-100 text-teal-800 border-2 border-teal-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoTextoFinal = (estado: EstadoCliente, clienteId: number) => {
    return getEstadoTexto(estado, clienteId);
  };

  const handleConsolidarVenta = (cliente: Cliente) => {
    const reporte = reportes.find(r => 
      r.ID_CLIENTE === cliente.ID && 
      r.ESTADO_NUEVO === 'PAGADO' && 
      !r.consolidado
    );
    
    if (reporte) {
      const asesor: Asesor = {
        ID: reporte.ID_ASESOR,
        NOMBRE: reporte.NOMBRE_ASESOR,
        WHATSAPP: cliente.WHA_ASESOR,
        LINK: 0,
        RECHAZADOS: 0,
        CARRITOS: 0,
        TICKETS: 0
      };
      
      setClienteConsolidar(cliente);
      setReporteConsolidar({...reporte, asesor});
    }
  };

  const generarNumerosDePagina = () => {
    const paginas: (number | string)[] = [];
    const maxPaginasMostrar = 5;
    const mitad = Math.floor(maxPaginasMostrar / 2);

    if (totalPaginas <= maxPaginasMostrar) {
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else if (pagina <= mitad) {
      for (let i = 1; i <= maxPaginasMostrar; i++) {
        paginas.push(i);
      }
      paginas.push('...');
      paginas.push(totalPaginas);
    } else if (pagina >= totalPaginas - mitad + (maxPaginasMostrar % 2 === 0 ? 1 : 0)) {
      paginas.push(1);
      paginas.push('...');
      for (let i = totalPaginas - maxPaginasMostrar + 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      paginas.push(1);
      paginas.push('...');
      for (let i = pagina - mitad; i <= pagina + mitad; i++) {
        paginas.push(i);
      }
      paginas.push('...');
      paginas.push(totalPaginas);
    }
    return paginas;
  };

  return (
    <div className="bg-white rounded-lg shadow mb-8">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Lista General de Clientes</h2>
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {mostrarFiltros ? <X className="h-5 w-5 text-gray-500" /> : <Filter className="h-5 w-5 text-gray-500" />}
          </button>
        </div>
        <div className={`space-y-4 ${mostrarFiltros ? 'block' : 'hidden md:block'}`}>
          <div className="relative">
            <input
              type="text"
              placeholder={
                forzarBusqueda
                  ? "Ingresa al menos 3 caracteres para buscar..."
                  : "Buscar por nombre o WhatsApp..."
              }
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {forzarBusqueda && !busqueda && (
              <div className="mt-2 text-sm text-amber-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                Hay {clientes.length} clientes. Por favor, usa el buscador.
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoCliente | 'TODOS')}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 appearance-none"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="CARRITOS">Carritos</option>
                <option value="RECHAZADOS">Rechazados</option>
                <option value="TICKETS">Tickets</option>
                <option value="SEGUIMIENTO">En Seguimiento</option>
                <option value="NO INTERESADO">No Interesado</option>
                <option value="NO CONTESTÓ">No Contestó</option>
                <option value="PAGADO">Pagado</option>
                <option value="VENTA CONSOLIDADA">Venta Consolidada</option>
                <option value="LINK">Link</option>
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <button
              onClick={() => setMostrarSoloCriticos(!mostrarSoloCriticos)}
              className={`px-4 py-2 rounded-lg border ${mostrarSoloCriticos ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              <AlertCircle className={`inline-block h-4 w-4 mr-2 ${mostrarSoloCriticos ? 'text-amber-500' : 'text-gray-400'}`} />
              Solo críticos
            </button>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        {clientesPaginados.map((cliente) => {
          const ultimoReporte = obtenerUltimoReporte(cliente.ID);
          const tieneSeguimiento = tieneSeguimientoPendiente(cliente.ID);
          const consolidado = estaConsolidado(cliente.ID);
          return (
            <div key={cliente.ID} className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <button onClick={() => setClienteHistorial(cliente)} className="text-base font-medium text-gray-900 hover:text-blue-600">
                    {cliente.NOMBRE}
                  </button>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full w-fit ${
                      cliente.ESTADO === 'LINK' 
                        ? 'bg-purple-200 text-purple-800 border-2 border-purple-400 font-bold' 
                        : getEstadoColor(cliente.ESTADO, cliente.ID)
                    }`}>
                      {getEstadoTexto(cliente.ESTADO, cliente.ID)}
                    </span>
                    {/* Badge CRM para clientes de soporte */}
                    {cliente.ESTADO === 'LINK' && cliente.soporte_prioridad && (
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        cliente.soporte_prioridad === 'ALTA' 
                          ? 'bg-red-500 text-white' 
                          : cliente.soporte_prioridad === 'MEDIA'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {cliente.soporte_prioridad === 'ALTA' ? '🔥' : cliente.soporte_prioridad === 'MEDIA' ? '⚡' : '❄️'} 
                        {cliente.soporte_prioridad}
                      </span>
                    )}
                    {!ultimoReporte && <AlertCircle className="h-4 w-4 text-red-500" aria-label="Sin reporte" />}
                    {tieneSeguimiento && <Clock className="h-4 w-4 text-blue-500" aria-label="Seguimiento pendiente" />}
                  </div>
                </div>
                <button onClick={() => setClienteAcciones(clienteAcciones === cliente.ID ? null : cliente.ID)} className="p-1 hover:bg-gray-100 rounded-full">
                  <Menu className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              {ultimoReporte && (
                <div className="bg-gray-50 rounded p-3 text-sm">
                  <p className="text-gray-600">{ultimoReporte.COMENTARIO}</p>
                  <p className="text-gray-500 mt-1">
                    Último reporte: {formatDate(ultimoReporte.FECHA_REPORTE)}
                  </p>
                </div>
              )}
              {clienteAcciones === cliente.ID && !readOnly && (
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => onChat(cliente)}
                    className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                  </button>
                  <button onClick={() => abrirWhatsApp(cliente.WHATSAPP)} className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    <Phone className="h-4 w-4 mr-2" />
                    Contactar
                  </button>
                  {!tieneReporteVenta(cliente.ID) && (
                    <>
                      <button
                        onClick={() => {
                          onActualizarEstado(cliente);
                          setClienteAcciones(null);
                        }}
                        className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Actualizar Estado
                      </button>
                      <button
                        onClick={() => {
                          onReportarVenta(cliente);
                          setClienteAcciones(null);
                        }}
                        className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Reportar Venta
                      </button>
                    </>
                  )}
                  {tieneReporteVenta(cliente.ID) && !consolidado && (
                    <button
                      onClick={() => handleConsolidarVenta(cliente)}
                      className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                    >
                      <FileVideo className="h-4 w-4 mr-2" />
                      Consolidar Venta
                    </button>
                  )}
                  {readOnly && adminRole === 'admin' && (
                    <div className="mr-2">
                      <ReasignarCliente
                        clienteId={cliente.ID}
                        asesorActual={cliente.NOMBRE_ASESOR}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Último Reporte
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex flex-col">
                  <span>Fecha</span>
                  <span>Asignación</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                WhatsApp
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {clientesPaginados.map((cliente) => {
              const ultimoReporte = obtenerUltimoReporte(cliente.ID);
              const tieneSeguimiento = tieneSeguimientoPendiente(cliente.ID);
              const consolidado = estaConsolidado(cliente.ID);
              return (
                <tr key={cliente.ID} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <button onClick={() => setClienteHistorial(cliente)} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                        {cliente.NOMBRE}
                      </button>
                      {!ultimoReporte && (
                        <span className="ml-2 flex-shrink-0">
                          <AlertCircle className="h-5 w-5 text-red-500" aria-label="Sin reporte" />
                        </span>
                      )}
                      {tieneSeguimiento && (
                        <span className="ml-2 flex-shrink-0">
                          <Clock className="h-5 w-5 text-blue-500" aria-label="Seguimiento pendiente" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full w-fit ${
                          cliente.ESTADO === 'LINK' 
                            ? 'bg-purple-200 text-purple-800 border-2 border-purple-400 font-bold' 
                            : getEstadoColor(cliente.ESTADO, cliente.ID)
                        }`}>
                          {getEstadoTexto(cliente.ESTADO, cliente.ID)}
                        </span>
                        {/* Badge CRM para clientes de soporte */}
                        {cliente.ESTADO === 'LINK' && cliente.soporte_prioridad && (
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            cliente.soporte_prioridad === 'ALTA' 
                              ? 'bg-red-500 text-white' 
                              : cliente.soporte_prioridad === 'MEDIA'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-blue-500 text-white'
                          }`}>
                            {cliente.soporte_prioridad === 'ALTA' ? '🔥' : cliente.soporte_prioridad === 'MEDIA' ? '⚡' : '❄️'} 
                            {cliente.soporte_prioridad}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const ultimoRpt = obtenerUltimoReporte(cliente.ID);
                        if (
                          ultimoRpt &&
                          cliente.ESTADO !== ultimoRpt.ESTADO_NUEVO &&
                          cliente.ESTADO !== 'PAGADO'
                        ) {
                          return (
                            <span className="px-2 py-1 text-xs leading-5 font-semibold text-red-700 bg-red-50 rounded-full w-fit">
                              ACTUALIZACION PENDIENTE
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {cliente.ESTADO === 'PAGADO' && !tieneReporteVenta(cliente.ID) && !readOnly && (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1" aria-label="Venta sin reportar" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {ultimoReporte ? (
                      <div className="text-sm max-w-[200px]">
                        <p className="font-medium text-gray-900">
                          {formatDate(ultimoReporte.FECHA_REPORTE)}
                        </p>
                        <p className="text-gray-500 line-clamp-2 break-words">
                          {ultimoReporte.COMENTARIO}
                        </p>
                        {ultimoReporte.FECHA_SEGUIMIENTO && (
                          <p className="text-blue-600 text-xs mt-1 flex items-center">
                            <Clock className="h-4 w-4 inline mr-1" />
                            <span className="truncate">Seg: {formatDate(ultimoReporte.FECHA_SEGUIMIENTO)}</span>
                            {ultimoReporte.COMPLETADO && (
                              <CheckCircle className="h-4 w-4 inline ml-1 text-green-500" />
                            )}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-red-500 text-sm">Reporte pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {isValidDate(cliente.FECHA_CREACION) 
                      ? (
                        <div className="flex flex-col">
                          <span>{formatDate(cliente.FECHA_CREACION).split(' ')[0]}</span>
                          <span className="text-xs text-gray-400">{formatDate(cliente.FECHA_CREACION).split(' ')[1]}</span>
                        </div>
                      ) 
                      : 'Fecha no disponible'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => abrirWhatsApp(cliente.WHATSAPP)} className="inline-flex items-center text-blue-600 hover:text-blue-900">
                      <Phone className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="text-sm truncate max-w-[120px] block">{cliente.WHATSAPP}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center space-x-1">
                      <button
                        onClick={() => onChat(cliente)}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700"
                        aria-label="Chat"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        <span>Chat</span>
                      </button>
                      {!readOnly && !tieneReporteVenta(cliente.ID) && (
                        <>
                          <button onClick={() => onActualizarEstado(cliente)} 
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700">
                            <MessageSquare className="h-3.5 w-3.5 mr-1" />
                            <span>Estado</span>
                          </button>
                          <button onClick={() => onReportarVenta(cliente)} 
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700">
                            <DollarSign className="h-3.5 w-3.5 mr-1" />
                            <span>Venta</span>
                          </button>
                        </>
                      )}
                      {tieneReporteVenta(cliente.ID) && !estaConsolidado(cliente.ID) && (
                        <button
                          onClick={() => handleConsolidarVenta(cliente)}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-purple-600 hover:bg-purple-700"
                        >
                          <FileVideo className="h-3.5 w-3.5 mr-1" />
                          <span>Consolidar</span>
                        </button>
                      )}
                      {readOnly && adminRole === 'admin' && (
                        <div>
                          <ReasignarCliente
                            clienteId={cliente.ID}
                            asesorActual={cliente.NOMBRE_ASESOR}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Anterior
            </button>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="h-5 w-5 ml-2" />
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando <span className="font-medium">{(pagina - 1) * clientesPorPagina + 1}</span> - <span className="font-medium">{Math.min(pagina * clientesPorPagina, clientesOrdenados.length)}</span> de <span className="font-medium">{clientesOrdenados.length}</span> resultados
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPagina(1)}
                  disabled={pagina === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Primera
                </button>
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Anterior</span>
                </button>
                {generarNumerosDePagina().map((numero, index) => (
                  <React.Fragment key={index}>
                    {numero === '...' ? (
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                      </span>
                    ) : (
                      <button
                        onClick={() => setPagina(Number(numero))}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${pagina === numero
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        aria-current={pagina === numero ? "page" : undefined}
                      >
                        {numero}
                      </button>
                    )}
                  </React.Fragment>
                ))}
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Siguiente</span>
                </button>
                <button
                  onClick={() => setPagina(totalPaginas)}
                  disabled={pagina === totalPaginas}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Última
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {clienteHistorial && (
        <HistorialCliente
          cliente={clienteHistorial}
          reportes={reportes.filter(r => r.ID_CLIENTE === clienteHistorial.ID)}
          admin={admin}
          adminRole={adminRole}
          onClose={() => setClienteHistorial(null)}
        />
      )}

      {clienteConsolidar && reporteConsolidar && (
        <ConsolidarVenta
          cliente={clienteConsolidar}
          asesor={reporteConsolidar.asesor as Asesor}
          reporte={reporteConsolidar}
          onComplete={() => {
            setClienteConsolidar(null);
            setReporteConsolidar(null);
            // Refresh data if needed
          }}
          onClose={() => {
            setClienteConsolidar(null);
            setReporteConsolidar(null);
          }}
        />
      )}
    </div>
  );
}
