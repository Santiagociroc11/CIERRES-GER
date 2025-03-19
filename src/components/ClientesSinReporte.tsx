import React, { useState } from 'react';
import { Cliente, esEstadoCritico } from '../types';
import { 
  MessageSquare, DollarSign, Phone, ChevronLeft, ChevronRight, 
  Calendar, Clock, MapPin, AlertCircle, Link as LinkIcon, ShoppingCart, Ticket 
} from 'lucide-react';
import { formatDate, formatInactivityTime } from '../utils/dateUtils';

interface ClientesSinReporteProps {
  clientes: Cliente[];
  onActualizarEstado: (cliente: Cliente) => void;
  onReportarVenta: (cliente: Cliente) => void;
}

export default function ClientesSinReporte({
  clientes,
  onActualizarEstado,
  onReportarVenta
}: ClientesSinReporteProps) {
  const [pagina, setPagina] = useState(1);
  const [clientesPorPagina] = useState(6);
  const [busqueda, setBusqueda] = useState('');

  // Filtrar clientes por búsqueda
  const clientesFiltrados = clientes.filter(cliente =>
    cliente.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
    cliente.WHATSAPP.includes(busqueda)
  );

  // Ordenar por fecha de asignación (si existe) o por fecha de creación (más reciente primero)
  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => {
    const fechaA = (Number(a.FECHA_CREACION)) * 1000;
    const fechaB = (Number(b.FECHA_CREACION)) * 1000;
    return fechaB - fechaA;
  });

  // Calcular páginas
  const totalPaginas = Math.ceil(clientesOrdenados.length / clientesPorPagina);
  const clientesPaginados = clientesOrdenados.slice(
    (pagina - 1) * clientesPorPagina,
    pagina * clientesPorPagina
  );

  // Función para generar el rango de páginas a mostrar
  const getPaginationRange = () => {
    const delta = 1; // Número de páginas a mostrar a cada lado de la página actual
    const range = [];
    const rangeWithDots = [];

    range.push(1);
    for (let i = Math.max(2, pagina - delta); i <= Math.min(totalPaginas - 1, pagina + delta); i++) {
      range.push(i);
    }
    if (totalPaginas > 1) {
      range.push(totalPaginas);
    }
    let prev = 0;
    for (const i of range) {
      if (prev + 1 < i) {
        rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      prev = i;
    }
    return rangeWithDots;
  };

  const abrirWhatsApp = (numero: string) => {
    if (!numero) return;
    const numeroLimpio = numero.replace(/\D/g, '');
    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
  };

  // Calcular tiempo de inactividad
  const getInactivityStatus = (fechaCreacion: string) => {
    const creationTime = new Date(fechaCreacion).getTime() / 1000;
    return formatInactivityTime(creationTime);
  };

  // Obtener ícono, color y etiqueta según el estado
  const getEstadoInfo = (estado: string) => {
    switch (estado) {
      case 'LINK':
        return { icon: LinkIcon, color: 'purple', label: 'Link' };
      case 'CARRITOS':
        return { icon: ShoppingCart, color: 'amber', label: 'Carrito Abandonado' };
      case 'TICKETS':
        return { icon: Ticket, color: 'indigo', label: 'Ticket' };
      case 'RECHAZADOS':
        return { icon: AlertCircle, color: 'rose', label: 'Rechazado' };
      case 'MASIVOS':
        return { icon: MessageSquare, color: 'blue', label: 'Masivos' };
      default:
        return { icon: MessageSquare, color: 'gray', label: estado };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-8">
      {/* Encabezado */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <MessageSquare className="h-5 w-5 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Clientes Sin Reporte</h2>
          </div>
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {clientes.length} pendientes
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Estos clientes necesitan atención inmediata ya que no tienen ningún reporte de gestión.
        </p>
      </div>

      {/* Barra de búsqueda */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="Buscar por nombre o WhatsApp..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
        />
      </div>

      {/* Lista de clientes */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientesPaginados.map((cliente) => {
            const inactivityStatus = getInactivityStatus(cliente.FECHA_CREACION);
            const isUrgent = inactivityStatus.includes('días');
            const isCritical = esEstadoCritico(cliente.ESTADO);
            const estadoInfo = getEstadoInfo(cliente.ESTADO);
            const EstadoIcon = estadoInfo.icon;

            return (
              <div
                key={cliente.ID}
                className={`rounded-lg p-5 transition-shadow hover:shadow-2xl ${
                  isCritical 
                    ? `bg-${estadoInfo.color}-50 border-2 border-${estadoInfo.color}-200` 
                    : isUrgent 
                      ? 'bg-red-50 border-2 border-red-200'
                      : 'bg-yellow-50 border'
                }`}
              >
                {/* Etiqueta de estado */}
                <div className={`flex items-center gap-2 mb-4 text-${estadoInfo.color}-700 bg-${estadoInfo.color}-100 px-3 py-1 rounded-md`}>
                  <EstadoIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Estado: {isCritical ? '⚠️ ' : ''}{estadoInfo.label}
                  </span>
                </div>

                {/* Información del cliente */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 text-lg">{cliente.NOMBRE}</h3>

                  {/* Botón de WhatsApp */}
                  <button
                    onClick={() => abrirWhatsApp(cliente.WHATSAPP)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">Contactar: {cliente.WHATSAPP}</span>
                  </button>

                  {/* Detalles adicionales */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Asignado: {formatDate(cliente.FECHA_ASIGNADO || cliente.FECHA_CREACION)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>Inactividad: {inactivityStatus}</span>
                    </div>
                    {cliente.PAIS && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>País: {cliente.PAIS}</span>
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => onActualizarEstado(cliente)}
                      className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      <span className="font-medium">Estado</span>
                    </button>
                    <button
                      onClick={() => onReportarVenta(cliente)}
                      className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span className="font-medium">Venta</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="mt-6 flex flex-col gap-4 sm:flex-row items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
            <div className="text-sm text-gray-700 text-center sm:text-left">
              <p>
                Mostrando <span className="font-medium">{(pagina - 1) * clientesPorPagina + 1}</span> a{' '}
                <span className="font-medium">
                  {Math.min(pagina * clientesPorPagina, clientesOrdenados.length)}
                </span>{' '}
                de <span className="font-medium">{clientesOrdenados.length}</span> resultados
              </p>
            </div>
            <div className="flex justify-center items-center space-x-1">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Anterior</span>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-1">
                {getPaginationRange().map((item, index) => (
                  <React.Fragment key={index}>
                    {item === '...' ? (
                      <span className="px-2 py-2 text-gray-700">...</span>
                    ) : (
                      <button
                        onClick={() => setPagina(Number(item))}
                        className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 
                          ${pagina === item
                            ? 'bg-yellow-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {item}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Siguiente</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
