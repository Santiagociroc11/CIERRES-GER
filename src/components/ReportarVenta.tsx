import React, { useState } from 'react';
import { apiClient } from '../lib/apiClient';
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

export default function ReportarVenta({
  cliente,
  asesor,
  onComplete,
  onClose,
}: ReportarVentaProps) {
  const [tipoVenta, setTipoVenta] = useState<'INTERNA' | 'EXTERNA' | ''>('');
  const [esStripe, setEsStripe] = useState(false);
  const [comentario, setComentario] = useState('');
  const [pais, setPais] = useState('');
  const [correoInscripcion, setCorreoInscripcion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correoPago, setCorreoPago] = useState('');
  const [imagenPago, setImagenPago] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [medioPago, setMedioPago] = useState('');

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Por favor, selecciona un archivo de imagen válido.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe superar los 5MB.');
        return;
      }

      setImagenPago(file);
      setError('');

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnviarVenta = async (imagenPagoUrl: string) => {
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        clienteID: cliente.ID,
        asesorID: asesor.ID,
        nombreAsesor: asesor.NOMBRE,
        tipoVenta,
        comentario,
        imagenPagoUrl,
      };

      if (tipoVenta === 'EXTERNA') {
        payload.medioPago = medioPago || undefined;
        payload.pais = pais || undefined;
        payload.correoInscripcion = correoInscripcion || undefined;
        payload.telefono = telefono || undefined;
        payload.correoPago = esStripe ? correoPago : undefined;
      }

      const response = await fetch(
        'https://n8n.automscc.com/webhook/reporte-venta-tg',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error('Error al enviar la venta a la API');
      }
    } catch (apiError) {
      console.error('Error al enviar la venta:', apiError);
      setError(
        apiError instanceof Error
          ? apiError.message
          : 'Error desconocido al enviar a la API'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!tipoVenta) {
      setError('Selecciona si la venta es interna (Hotmart) o externa.');
      setLoading(false);
      return;
    }

    if (tipoVenta === 'EXTERNA') {
      if (!pais.trim()) {
        setError('Para pagos externos, se requiere el país del cliente.');
        setLoading(false);
        return;
      }
      if (!correoInscripcion.trim()) {
        setError('Para pagos externos, se requiere el correo de inscripción.');
        setLoading(false);
        return;
      }
      if (!telefono.trim()) {
        setError('Para pagos externos, se requiere el teléfono de inscripción.');
        setLoading(false);
        return;
      }
      if (esStripe && !correoPago.trim()) {
        setError('Para pagos Stripe, es necesario el correo con el que se pagó.');
        setLoading(false);
        return;
      }
      if (!medioPago.trim()) {
        setError('Para pagos externos, se debe especificar el medio de pago.');
        setLoading(false);
        return;
      }
    }

    let imagenPagoUrl = '';
    try {
      if (imagenPago) {
        imagenPagoUrl = await uploadToMinio(imagenPago, 'pagos');
      }
    } catch (uploadError) {
      setError('Error al subir la imagen. Por favor, intenta de nuevo.');
      setLoading(false);
      return;
    }

    try {
      await apiClient.request(
        `/GERSSON_REPORTES?ID_CLIENTE=eq.${cliente.ID}&COMPLETADO=eq.false&FECHA_SEGUIMIENTO=not.is.null`,
        'PATCH',
        { COMPLETADO: true }
      );
    } catch (error: any) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Error al reportar la venta.');
      return;
    }
    

    try {
      await apiClient.request('/GERSSON_REPORTES', 'POST', {
        ID_CLIENTE: cliente.ID,
        ID_ASESOR: asesor.ID,
        ESTADO_ANTERIOR: cliente.ESTADO,
        ESTADO_NUEVO: 'PAGADO',
        COMENTARIO: comentario,
        NOMBRE_ASESOR: asesor.NOMBRE,
        IMAGEN_PAGO_URL: imagenPagoUrl,
        FECHA_REPORTE: getCurrentEpoch(),
        TIPO_VENTA: tipoVenta,
        PAIS_CLIENTE: tipoVenta === 'EXTERNA' ? pais : null,
        CORREO_INSCRIPCION: tipoVenta === 'EXTERNA' ? correoInscripcion : null,
        TELEFONO_CLIENTE: tipoVenta === 'EXTERNA' ? telefono : null,
        CORREO_PAGO: esStripe ? correoPago : null,
        MEDIO_PAGO: tipoVenta === 'EXTERNA' ? medioPago : null,
      });
    } catch (error: any) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Error al reportar la venta.');
      return;
    }
    

    try {
      await apiClient.request(
        `/GERSSON_CLIENTES?ID=eq.${cliente.ID}`,
        'PATCH',
        {
          ESTADO: 'PAGADO',
          FECHA_COMPRA: getCurrentEpoch(),
          PAIS: tipoVenta === 'EXTERNA' ? pais : null,
        }
      );
    } catch (error: any) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Error al reportar la venta.');
      return;
    }
    

    if (tipoVenta === 'EXTERNA') {
      await handleEnviarVenta(imagenPagoUrl);
    }
    
    if (!error) {
      setLoading(false);
      onComplete();
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

           {/* Explicación adicional sobre interna/externa */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-700">
          <p>
            <strong>¿Venta Interna (Hotmart) o Externa?</strong> <br />
            <ul className="list-disc list-inside">
              <li>
                <strong>Interna (Dentro de Hotmart):</strong> Medios de
                pago de Hotmart (Paypal, tarjetas, etc.) o el link oficial de
                Hotmart.
              </li>
              <li>
                <strong>Externa (Fuera de Hotmart):</strong> medios
                externos como Western Union u otros disponibles en los medios de pago dados en la información del asesor. (No
                aplica ticket ni Paypal de Hotmart).
              </li>
            </ul>
          </p>
        </div>
        
          {/* Tipo de Venta */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo de Venta
            </label>
            <select
              value={tipoVenta}
              onChange={(e) =>
                setTipoVenta(e.target.value as 'INTERNA' | 'EXTERNA' | '')
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Selecciona --</option>
              <option value="INTERNA">Interna (Por Hotmart)</option>
              <option value="EXTERNA">Externa (Fuera de Hotmart)</option>
            </select>
          </div>

          {/* Cliente (solo lectura) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Cliente</label>
            <input
              type="text"
              value={cliente.NOMBRE}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50"
              disabled
            />
          </div>

          {/* Datos adicionales si es EXTERNA */}
          {tipoVenta === 'EXTERNA' && (
            <>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Medio de Pago
                </label>
                <input
                  type="text"
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="Ej: Transferencia, Western Union, Stripe, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  País
                </label>
                <input
                  type="text"
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="Ej: Colombia, México, España..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Correo de Inscripción
                </label>
                <input
                  type="email"
                  value={correoInscripcion}
                  onChange={(e) => setCorreoInscripcion(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="Número de teléfono"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="stripeCheck"
                  checked={esStripe}
                  onChange={(e) => setEsStripe(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="stripeCheck" className="text-sm text-gray-700">
                  ¿Fue pago con Stripe?
                </label>
              </div>

              {/* Solo si es Stripe, correo de pago */}
              {esStripe && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Correo con el que hizo el pago en Stripe
                  </label>
                  <input
                    type="email"
                    value={correoPago}
                    onChange={(e) => setCorreoPago(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                    placeholder="correo-de-pago@ejemplo.com"
                    required
                  />
                </div>
              )}
            </>
          )}

          {/* Comentarios para ambos tipos de venta */}
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

          {/* Comprobante de Pago (siempre) */}
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
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus:ring-green-500">
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
                    <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 5MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Botón de Confirmar */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''
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
