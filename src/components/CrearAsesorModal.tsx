import React, { useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { X } from 'lucide-react';

interface CrearAsesorModalProps {
  onClose: () => void;
  onAsesorCreado: () => void;
}

const CrearAsesorModal: React.FC<CrearAsesorModalProps> = ({ onClose, onAsesorCreado }) => {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    setLoading(true);
    setError('');

    try {
      const nuevoAsesor = {
        NOMBRE: nombre.trim(),
        WHATSAPP: whatsapp.trim(),
        ID_TG: '',
        ES_ADMIN: false,
        PRIORIDAD: 1,
        LIMITE_DIARIO: null,
        // Campos con valores por defecto según la estructura de la tabla
        LINK: 0,
        RECHAZADOS: 0,
        CARRITOS: 0,
        TICKETS: 0,
        COMPRAS: 0,
        MASIVOS: 0,
        current_weight: 0,
        FECHA_INICIO_REGLA: null,
        FECHA_FIN_REGLA: null,
        HISTORIAL: null
      };

      await apiClient.request('/GERSSON_ASESORES', 'POST', nuevoAsesor);

      onAsesorCreado();
      onClose();
    } catch (err: any) {
      console.error('Error creando asesor:', err);
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setError('Ya existe un asesor con este número de WhatsApp');
      } else {
        setError('Error al crear el asesor. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Crear Asesor</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: María García"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WhatsApp (sin +) *
            </label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3">
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
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition duration-200"
            >
              {loading ? 'Creando...' : 'Crear Asesor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CrearAsesorModal; 