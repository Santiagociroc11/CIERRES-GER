import React, { useState } from 'react';
import { Cliente, Reporte } from '../types';
import { AlertTriangle, MessageSquare, Phone, Search, Clock } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

interface ClientesPendientesProps {
  clientes: Cliente[];
  reportes: Reporte[];
  onActualizarEstado: (cliente: Cliente) => void;
}

export default function ClientesPendientes({
  clientes,
  reportes,
  onActualizarEstado
}: ClientesPendientesProps) {
  const [busqueda, setBusqueda] = useState('');

  // Obtener el último reporte de un cliente
  const obtenerUltimoReporte = (clienteId: number) => {
    const reportesCliente = reportes.filter(r => r.ID_CLIENTE === clienteId);
    if (!reportesCliente.length) return null;
    return reportesCliente.sort((a, b) => b.FECHA_REPORTE - a.FECHA_REPORTE)[0];
  };

  // Filtrar clientes que necesitan actualización de estado
  const clientesPendientes = clientes.filter(cliente => {
    const ultimoReporte = obtenerUltimoReporte(cliente.ID);
    return ultimoReporte && cliente.ESTADO !== ultimoReporte.ESTADO_NUEVO && cliente.ESTADO !== 'PAGADO';
  });

  // Filtrar por búsqueda
  const clientesFiltrados = clientesPendientes.filter(cliente =>
    cliente.NOMBRE.toLowerCase().includes(busqueda.toLowerCase()) ||
    cliente.WHATSAPP.includes(busqueda)
  );

  const abrirWhatsApp = (numero: string) => {
    if (!numero) return;
    const numeroLimpio = numero.replace(/\D/g, '');
    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">
              Actualización de Estado Pendiente
            </h2>
          </div>
          <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {clientesPendientes.length} pendientes
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Estos clientes tienen un reporte con un estado diferente al actual y necesitan actualización.
        </p>
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nombre o WhatsApp..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map(cliente => {
            const ultimoReporte = obtenerUltimoReporte(cliente.ID);
            if (!ultimoReporte) return null;

            return (
              <div key={cliente.ID} className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200">
                <h3 className="font-semibold text-gray-900 mb-2">{cliente.NOMBRE}</h3>
                
                <div className="space-y-3">
                  {/* Estados: Estado Actual en rojo y Último Reporte en gris */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">Estado Actual:</span>
                      <span className="px-3 py-1 text-sm font-bold rounded-full border-2 border-red-600 bg-red-100 text-red-800 shadow">
                        {cliente.ESTADO}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">Último Reporte:</span>
                      <span className="px-3 py-1 text-sm font-bold rounded-full border-2 border-gray-400 bg-gray-100 text-gray-800 shadow">
                        {ultimoReporte.ESTADO_NUEVO}
                      </span>
                    </div>
                  </div>

                  {/* Fecha y comentario del último reporte */}
                  <div className="bg-white rounded p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(ultimoReporte.FECHA_REPORTE)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{ultimoReporte.COMENTARIO}</p>
                  </div>

                  {/* Botones de acción */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => abrirWhatsApp(cliente.WHATSAPP)}
                      className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300"
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      <span className="font-medium">Contactar</span>
                    </button>
                    <button
                      onClick={() => onActualizarEstado(cliente)}
                      className="flex items-center justify-center px-3 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition duration-300"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      <span className="font-medium">Actualizar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {clientesFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay clientes pendientes de actualización de estado
          </div>
        )}
      </div>
    </div>
  );
}
