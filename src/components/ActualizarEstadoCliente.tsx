import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Cliente, Asesor, EstadoAsesor } from '../types';
import { X, Loader2 } from 'lucide-react';
import { getCurrentEpoch, toEpoch } from '../utils/dateUtils';

interface ActualizarEstadoClienteProps {
  cliente: Cliente;
  asesor: Asesor;
  onComplete: () => void;
  onClose: () => void;
}

export default function ActualizarEstadoCliente({
  cliente,
  asesor,
  onComplete,
  onClose
}: ActualizarEstadoClienteProps) {
  const [estado, setEstado] = useState<EstadoAsesor>('SEGUIMIENTO');
  const [comentario, setComentario] = useState('');
  const [requiereSeguimiento, setRequiereSeguimiento] = useState(false);
  const [fechaSeguimiento, setFechaSeguimiento] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Crear nuevo reporte
      await supabase
        .from('GERSSON_REPORTES')
        .insert({
          ID_CLIENTE: cliente.ID,
          ID_ASESOR: asesor.ID,
          ESTADO_ANTERIOR: cliente.ESTADO, // estado previo
          ESTADO_NUEVO: estado,            // estado que seleccionas
          COMENTARIO: comentario,
          NOMBRE_ASESOR: asesor.NOMBRE,
          FECHA_REPORTE: getCurrentEpoch(),
          FECHA_SEGUIMIENTO: requiereSeguimiento && fechaSeguimiento
            ? toEpoch(new Date(fechaSeguimiento))
            : null
        });

      // Actualizar estado del cliente
      await supabase
        .from('GERSSON_CLIENTES')
        .update({ ESTADO: estado })
        .eq('ID', cliente.ID);

      onComplete(); // Avisamos al padre que terminamos
    } catch (error) {
      console.error('Error al crear reporte:', error);
      alert('Error al crear el reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Actualizar Estado del Cliente</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoAsesor)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              required
            >
              <option value="SEGUIMIENTO">En Seguimiento</option>
              <option value="NO CONTACTAR">No Contactar</option>
              <option value="NO CONTESTÓ">No Contestó</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comentario
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              rows={3}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="seguimiento"
              checked={requiereSeguimiento}
              onChange={(e) => setRequiereSeguimiento(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="seguimiento" className="text-sm font-medium text-gray-700">
              Requiere Seguimiento
            </label>
          </div>

          {requiereSeguimiento && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha de Seguimiento
              </label>
              <input
                type="datetime-local"
                value={fechaSeguimiento}
                onChange={(e) => setFechaSeguimiento(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 ${loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {loading ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Guardando...
              </span>
            ) : (
              'Guardar Reporte'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}