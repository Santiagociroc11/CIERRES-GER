// CrearClienteModal.tsx
import React, { useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { X } from 'lucide-react';
import { Asesor } from '../types';

interface CrearClienteModalProps {
  asesores: Asesor[];
  onClose: () => void;
  onClienteCreado: () => void; // callback para refrescar datos, si se requiere
}

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({ asesores, onClose, onClienteCreado }) => {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [asesorId, setAsesorId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clienteExistente, setClienteExistente] = useState<any | null>(null);

  // Función para obtener el nombre del asesor a partir de su ID
  const getNombreAsesor = (id: number) => {
    const asesor = asesores.find(a => a.ID === id);
    return asesor ? asesor.NOMBRE : 'Sin asignar';
  };

  // Función que chequea si existe un cliente con los últimos 6 dígitos del WhatsApp
  const checkExistingClient = async () => {
    if (!whatsapp || whatsapp.trim().length < 6) {
      setClienteExistente(null);
      return;
    }
    const last6 = whatsapp.slice(-6);
    try {
      // Obtenemos todos los clientes; en un ambiente real, podrías optimizar la consulta
      const clientesData = await apiClient.request<any[]>('/GERSSON_CLIENTES?select=*');
      const matchingClient = clientesData.find(cliente => {
        const clienteWhatsApp = String(cliente.WHATSAPP || '');
        return clienteWhatsApp.slice(-6) === last6;
      });
      setClienteExistente(matchingClient || null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !whatsapp || !asesorId) {
      setError('Por favor, completa todos los campos');
      return;
    }
    setError('');
    
    // Si se encontró un cliente similar, preguntar si se desea continuar
    if (clienteExistente) {
      const confirmar = window.confirm(
        `Ya existe un cliente con WhatsApp similar:\n\nNombre: ${clienteExistente.NOMBRE}\nTeléfono: ${clienteExistente.WHATSAPP}\nAsignado a: ${getNombreAsesor(clienteExistente.ID_ASESOR)}\nFecha de creación: ${
          clienteExistente.FECHA_CREACION
            ? new Date(clienteExistente.FECHA_CREACION * 1000).toLocaleString()
            : 'Sin info'
        }\n\n¿Deseas crear otro cliente de todas formas?`
      );
      if (!confirmar) return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/clientes/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), whatsapp: whatsapp.trim(), asesorId: Number(asesorId) })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Error ${res.status}`);
      }
      onClienteCreado();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error al crear el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Crear Cliente</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">WhatsApp (sin +)</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              onBlur={checkExistingClient}
              placeholder="Ej: 1234567890"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
            {clienteExistente && (
              <div className="p-2 bg-yellow-100 border border-yellow-300 rounded mt-2">
                <p className="text-sm font-semibold">Cliente existente:</p>
                <p className="text-sm">Nombre: {clienteExistente.NOMBRE}</p>
                <p className="text-sm">Teléfono: {clienteExistente.WHATSAPP}</p>
                <p className="text-sm">Asignado a: {getNombreAsesor(clienteExistente.ID_ASESOR)}</p>
                <p className="text-sm">
                  Fecha de creación:{' '}
                  {clienteExistente.FECHA_CREACION
                    ? new Date(clienteExistente.FECHA_CREACION * 1000).toLocaleString()
                    : 'Sin info'}
                </p>
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Asesor</label>
            <select
              value={asesorId}
              onChange={(e) => setAsesorId(Number(e.target.value))}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="">Selecciona un asesor</option>
              {asesores.map((asesor) => (
                <option key={asesor.ID} value={asesor.ID}>
                  {asesor.NOMBRE}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {loading ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CrearClienteModal;
