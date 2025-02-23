import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadToMinio } from '../lib/minio';
import { Cliente, Asesor } from '../types';
import { X, Upload, DollarSign, Image, AlertCircle } from 'lucide-react';
import { getCurrentEpoch } from '../utils/dateUtils';

interface ReportarVentaProps {
  cliente: Cliente;
  asesor: Asesor;
  onComplete: () => void;
  onClose: () => void;
}

export default function ReportarVenta({ cliente, asesor, onComplete, onClose }: ReportarVentaProps) {
  const [medioPago, setMedioPago] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState('COP');
  const [comentario, setComentario] = useState('');
  const [imagenPago, setImagenPago] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona un archivo de imagen válido');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe superar los 5MB');
        return;
      }

      setImagenPago(file);
      setError('');

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let imagenPagoUrl = '';

      // Subir imagen a MinIO si existe
      if (imagenPago) {
        try {
          imagenPagoUrl = await uploadToMinio(imagenPago, 'pagos');
        } catch (uploadError) {
          throw new Error('Error al subir la imagen. Por favor, intenta de nuevo.');
        }
      }

      // Eliminar todos los seguimientos pendientes
      const { error: seguimientosError } = await supabase
        .from('GERSSON_REPORTES')
        .delete()
        .eq('ID_CLIENTE', cliente.ID)
        .eq('COMPLETADO', false)
        .not('FECHA_SEGUIMIENTO', 'is', null);

      if (seguimientosError) throw new Error(`Error al eliminar seguimientos: ${seguimientosError.message}`);

      // Crear nuevo reporte de venta
      const { error: reporteError } = await supabase
        .from('GERSSON_REPORTES')
        .insert({
          ID_CLIENTE: cliente.ID,
          ID_ASESOR: asesor.ID,
          ESTADO_ANTERIOR: cliente.ESTADO,
          ESTADO_NUEVO: 'PAGADO',
          COMENTARIO: comentario,
          NOMBRE_ASESOR: asesor.NOMBRE,
          IMAGEN_PAGO_URL: imagenPagoUrl,
          FECHA_REPORTE: getCurrentEpoch()
        });

      if (reporteError) throw new Error(`Error al crear el reporte: ${reporteError.message}`);

      // Actualizar estado del cliente
      const { error: clienteError } = await supabase
        .from('GERSSON_CLIENTES')
        .update({
          ESTADO: 'PAGADO',
          FECHA_COMPRA: getCurrentEpoch(),
          MEDIO_COMPRA: medioPago,
          MONTO_COMPRA: parseFloat(monto),
          MONEDA_COMPRA: moneda
        })
        .eq('ID', cliente.ID);

      if (clienteError) throw new Error(`Error al actualizar el cliente: ${clienteError.message}`);

      onComplete();
    } catch (error) {
      console.error('Error al reportar venta:', error);
      setError(error instanceof Error ? error.message : 'Error al reportar la venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <DollarSign className="h-6 w-6 text-green-500 mr-2" />
            <h3 className="text-lg font-medium">Reportar Venta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cliente
            </label>
            <input
              type="text"
              value={cliente.NOMBRE}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Medio de Pago
            </label>
            <input
              type="text"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
              placeholder="Ej: Transferencia, Efectivo, etc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Monto de la Venta
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="focus:ring-green-500 focus:border-green-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Moneda
              </label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="COP">COP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comentarios de la Venta
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Detalles adicionales de la venta..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comprobante de Pago
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="mx-auto h-32 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagenPago(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Image className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-ring-green-500">
                        <span>Subir comprobante</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleImagenChange}
                          required
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, GIF hasta 5MB
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <Upload className="animate-spin h-5 w-5 mr-2" />
                Procesando Venta...
              </span>
            ) : (
              'Confirmar Venta'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}