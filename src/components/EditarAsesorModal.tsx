import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { X, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Asesor } from '../types';

interface EditarAsesorModalProps {
  asesor: Asesor;
  onClose: () => void;
  onAsesorActualizado: () => void;
  onAsesorEliminado: () => void;
}

const EditarAsesorModal: React.FC<EditarAsesorModalProps> = ({ 
  asesor, 
  onClose, 
  onAsesorActualizado,
  onAsesorEliminado 
}) => {
  const [nombre, setNombre] = useState(asesor.NOMBRE || '');
  const [whatsapp, setWhatsapp] = useState(asesor.WHATSAPP || '');
  const [idTg, setIdTg] = useState(asesor.ID_TG || '');
  const [esAdmin, setEsAdmin] = useState(asesor.ES_ADMIN || false);
  const [prioridad, setPrioridad] = useState(asesor.PRIORIDAD || 1);
  const [limiteDiario, setLimiteDiario] = useState(asesor.LIMITE_DIARIO || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mostrarConfirmacionEliminar, setMostrarConfirmacionEliminar] = useState(false);
  const [loadingEliminar, setLoadingEliminar] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nombre.trim() || !whatsapp.trim()) {
      setError('Por favor, completa todos los campos obligatorios');
      return;
    }

    // Validar formato de WhatsApp (solo números)
    const whatsappRegex = /^\d+$/;
    if (!whatsappRegex.test(whatsapp)) {
      setError('El WhatsApp debe contener solo números');
      return;
    }

    // Validar ID de Telegram si se proporciona (solo números)
    if (idTg && !/^\d+$/.test(idTg)) {
      setError('El ID de Telegram debe contener solo números');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const asesorActualizado = {
        NOMBRE: nombre.trim(),
        WHATSAPP: whatsapp.trim(),
        ID_TG: idTg.trim() || null,
        ES_ADMIN: esAdmin,
        PRIORIDAD: prioridad,
        LIMITE_DIARIO: limiteDiario ? parseInt(limiteDiario) : null
      };

      await apiClient.request(`/GERSSON_ASESORES?ID=eq.${asesor.ID}`, 'PATCH', asesorActualizado);

      onAsesorActualizado();
      onClose();
    } catch (err: any) {
      console.error('Error actualizando asesor:', err);
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setError('Ya existe un asesor con este número de WhatsApp o ID de Telegram');
      } else {
        setError('Error al actualizar el asesor. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async () => {
    setLoadingEliminar(true);
    setError('');

    try {
      await apiClient.request(`/GERSSON_ASESORES?ID=eq.${asesor.ID}`, 'DELETE');
      onAsesorEliminado();
      onClose();
    } catch (err: any) {
      console.error('Error eliminando asesor:', err);
      const errorMessage = err.message || '';
      
      // Detectar diferentes tipos de violaciones de foreign key
      if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
        if (errorMessage.includes('conversaciones')) {
          setError('No se puede eliminar el asesor porque tiene conversaciones asociadas. Las conversaciones se mantendrán en el historial.');
        } else if (errorMessage.includes('reportes') || errorMessage.includes('GERSSON_REPORTES')) {
          setError('No se puede eliminar el asesor porque tiene reportes históricos asociados. Los reportes son importantes para mantener el historial de ventas.');
        } else if (errorMessage.includes('clientes') || errorMessage.includes('GERSSON_CLIENTES')) {
          setError('No se puede eliminar el asesor porque tiene clientes asignados. Reasigna primero a sus clientes antes de eliminar.');
        } else if (errorMessage.includes('cupos') || errorMessage.includes('GERSSON_CUPOS_VIP')) {
          setError('No se puede eliminar el asesor porque tiene cupos VIP asignados.');
        } else {
          setError('No se puede eliminar el asesor porque tiene datos asociados en otras tablas. Verifica que no tenga clientes, reportes o conversaciones activas.');
        }
      } else if (err.status === 409) {
        setError('Conflicto: No se puede eliminar el asesor porque tiene referencias en otras tablas. Verifica las relaciones antes de eliminar.');
      } else {
        setError(`Error al eliminar el asesor: ${errorMessage || 'Error desconocido'}. Intenta nuevamente.`);
      }
    } finally {
      setLoadingEliminar(false);
      setMostrarConfirmacionEliminar(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Editar Asesor</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        {!mostrarConfirmacionEliminar ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: María García"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp (sin +) *
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ej: 1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Telegram (opcional)
                </label>
                <input
                  type="text"
                  value={idTg}
                  onChange={(e) => setIdTg(e.target.value)}
                  placeholder="Ej: 123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ID numérico de Telegram para notificaciones automáticas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridad
                </label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>1 - Baja</option>
                  <option value={2}>2 - Normal</option>
                  <option value={3}>3 - Alta</option>
                  <option value={4}>4 - Muy Alta</option>
                  <option value={5}>5 - Crítica</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Prioridad para asignación automática de clientes
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Límite Diario (opcional)
                </label>
                <input
                  type="number"
                  value={limiteDiario}
                  onChange={(e) => setLimiteDiario(e.target.value)}
                  placeholder="Ej: 50"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Máximo número de clientes asignados por día
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="esAdmin"
                  checked={esAdmin}
                  onChange={(e) => setEsAdmin(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="esAdmin" className="ml-2 text-sm text-gray-700">
                  Es administrador
                </label>
              </div>
            </div>
            
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setMostrarConfirmacionEliminar(true)}
                className="px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition duration-200 flex items-center space-x-2"
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
                <span>Eliminar</span>
              </button>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition duration-200 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          // Confirmación de eliminación
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Eliminar Asesor?
            </h3>
            <p className="text-gray-600 mb-2">
              Estás a punto de eliminar a <strong>{asesor.NOMBRE}</strong>.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Esta acción no se puede deshacer. Si el asesor tiene clientes asignados, debes reasignarlos primero.
            </p>
            
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setMostrarConfirmacionEliminar(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200"
                disabled={loadingEliminar}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={loadingEliminar}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition duration-200 flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>{loadingEliminar ? 'Eliminando...' : 'Eliminar Definitivamente'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditarAsesorModal;