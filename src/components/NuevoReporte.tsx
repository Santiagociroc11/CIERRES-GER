import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Cliente, Asesor } from '../types';
import { Upload, X } from 'lucide-react';

interface NuevoReporteProps {
  cliente: Cliente;
  asesor: Asesor;
  onComplete: () => void;
  onClose: () => void;
}

export default function NuevoReporte({ cliente, asesor, onComplete, onClose }: NuevoReporteProps) {
  const [estado, setEstado] = useState(cliente.ESTADO);
  const [comentario, setComentario] = useState('');
  const [fechaSeguimiento, setFechaSeguimiento] = useState('');
  const [medioPago, setMedioPago] = useState('');
  const [imagenConversacion, setImagenConversacion] = useState<File | null>(null);
  const [imagenPago, setImagenPago] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imagenConversacionUrl = '';
      let imagenPagoUrl = '';

      if (imagenConversacion) {
        const fileExt = imagenConversacion.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('reportes')
          .upload(`conversaciones/${fileName}`, imagenConversacion);

        if (uploadError) throw uploadError;
        imagenConversacionUrl = fileName;
      }

      if (imagenPago) {
        const fileExt = imagenPago.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('reportes')
          .upload(`pagos/${fileName}`, imagenPago);

        if (uploadError) throw uploadError;
        imagenPagoUrl = fileName;
      }

      // Crear nuevo reporte
      const { error: reporteError } = await supabase
        .from('GERSSON_REPORTES')
        .insert({
          ID_CLIENTE: cliente.ID,
          ID_ASESOR: asesor.ID,
          ESTADO_ANTERIOR: cliente.ESTADO,
          ESTADO_NUEVO: estado,
          COMENTARIO: comentario,
          NOMBRE_ASESOR: asesor.NOMBRE,
          FECHA_SEGUIMIENTO: fechaSeguimiento ? new Date(fechaSeguimiento).getTime() / 1000 : null,
          IMAGEN_CONVERSACION: imagenConversacionUrl,
          IMAGEN_PAGO: imagenPagoUrl
        });

      if (reporteError) throw reporteError;

      // Actualizar estado del cliente si es necesario
      if (estado !== cliente.ESTADO) {
        const { error: clienteError } = await supabase
          .from('GERSSON_CLIENTES')
          .update({ 
            ESTADO: estado,
            ...(estado === 'COMPRADO' ? {
              FECHA_COMPRA: new Date().toISOString(),
              MEDIO_COMPRA: medioPago
            } : {})
          })
          .eq('ID', cliente.ID);

        if (clienteError) throw clienteError;
      }

      onComplete();
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
          <h3 className="text-lg font-medium">Nuevo Reporte para {cliente.NOMBRE}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="SEGUIMIENTO">SEGUIMIENTO</option>
              <option value="COMPRADO">COMPRADO</option>
              <option value="RECHAZADO">RECHAZADO</option>
            </select>
          </div>

          {estado === 'COMPRADO' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Medio de Pago</label>
              <input
                type="text"
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Comentario</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de Seguimiento</label>
            <input
              type="datetime-local"
              value={fechaSeguimiento}
              onChange={(e) => setFechaSeguimiento(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Imagen de Conversación</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImagenConversacion(e.target.files?.[0] || null)}
              className="mt-1 block w-full"
            />
          </div>

          {estado === 'COMPRADO' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Comprobante de Pago</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImagenPago(e.target.files?.[0] || null)}
                className="mt-1 block w-full"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <Upload className="animate-spin h-5 w-5 mr-2" />
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