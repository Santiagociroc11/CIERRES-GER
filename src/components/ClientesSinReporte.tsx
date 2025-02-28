import React from 'react';
import { Cliente } from '../types';
import { MessageSquare, DollarSign } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import PhoneIcon from '@mui/icons-material/Phone';

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
  return (
    <div className="bg-white rounded-lg shadow mb-8">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <MessageSquare className="h-5 w-5 text-yellow-500 mr-2" />
          <h2 className="text-xl font-semibold text-gray-800">Clientes Sin Reporte</h2>
        </div>
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
          {clientes.length} pendientes
        </span>
      </div>
      <div className="p-6">
        {clientes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map((cliente) => {
              const whatsappUrl = `https://wa.me/${cliente.WHATSAPP.replace(/\D/g, '')}`;
              return (
                <div key={cliente.ID} className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900">{cliente.NOMBRE}</h3>
                  <Tooltip title="Enviar mensaje por WhatsApp">
                    <Link
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'primary.main',
                        fontWeight: 500,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        },
                        cursor: 'pointer',
                      }}
                    >
                      <PhoneIcon fontSize="small" />
                      Wha: +{cliente.WHATSAPP}
                    </Link>
                  </Tooltip>
                  <p className="text-sm text-gray-600 mt-1">
                    Asignado: {formatDate(cliente.FECHA_CREACION)}
                  </p>
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={() => onActualizarEstado(cliente)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Actualizar Estado
                    </button>
                    <button
                      onClick={() => onReportarVenta(cliente)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Reportar Venta
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No hay clientes pendientes de reporte</p>
        )}
      </div>
    </div>
  );
}
