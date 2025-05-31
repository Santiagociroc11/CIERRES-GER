import React, { useState, useEffect } from 'react';
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
  // Primero se selecciona el producto
  const [producto, setProducto] = useState<'PRINCIPAL' | 'DOWNSELL' | ''>('');
  // Si el producto es downsell, solo se permite venta interna
  const [tipoVenta, setTipoVenta] = useState<'INTERNA' | 'EXTERNA' | ''>('');
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
  const [nombreCliente, setNombreCliente] = useState(cliente.NOMBRE);
  
  // Nuevos campos para Western Union y Bancolombia
  const [actividadEconomica, setActividadEconomica] = useState('');
  const [cedulaComprador, setCedulaComprador] = useState('');
  const [otroMedioPago, setOtroMedioPago] = useState('');

  // Si se selecciona "DOWNSELL", forzamos que la venta sea interna
  useEffect(() => {
    if (producto === 'DOWNSELL') {
      setTipoVenta('INTERNA');
    }
  }, [producto]);

  // Limpiar campos específicos cuando cambia el medio de pago
  useEffect(() => {
    if (medioPago !== 'WESTERN_UNION') {
      setActividadEconomica('');
    }
    if (medioPago !== 'BANCOLOMBIA') {
      setCedulaComprador('');
    }
    if (medioPago !== 'STRIPE') {
      setCorreoPago('');
    }
    if (medioPago !== 'OTRO') {
      setOtroMedioPago('');
    }
  }, [medioPago]);

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
        payload.medioPago = medioPago === 'OTRO' ? otroMedioPago : medioPago;
        payload.pais = pais || undefined;
        payload.correoInscripcion = correoInscripcion || undefined;
        payload.telefono = telefono || undefined;
        payload.correoPago = medioPago === 'STRIPE' ? correoPago : undefined;
        
        // Agregar campos específicos según el medio de pago
        if (medioPago === 'WESTERN_UNION') {
          payload.actividadEconomica = actividadEconomica || undefined;
        }
        if (medioPago === 'BANCOLOMBIA') {
          payload.cedulaComprador = cedulaComprador || undefined;
        }
      }

      const response = await fetch(
        import.meta.env.VITE_ENDPOINT_VENTAEXTERNA,
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

    if (!producto) {
      setError('Selecciona primero el producto (Principal o Downsell).');
      setLoading(false);
      return;
    }

    if (!tipoVenta) {
      setError('Selecciona si la venta es interna (Hotmart) o externa.');
      setLoading(false);
      return;
    }

    // Si el producto es downsell, forzamos venta interna
    if (producto === 'DOWNSELL' && tipoVenta !== 'INTERNA') {
      setError('Las ventas downsell solo pueden ser internas.');
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
      if (!medioPago.trim()) {
        setError('Para pagos externos, se debe especificar el medio de pago.');
        setLoading(false);
        return;
      }
      
      // Validaciones específicas para Western Union
      if (medioPago === 'WESTERN_UNION' && !actividadEconomica.trim()) {
        setError('Para pagos por Western Union, se requiere la actividad económica del comprador.');
        setLoading(false);
        return;
      }
      
      // Validaciones específicas para Bancolombia
      if (medioPago === 'BANCOLOMBIA' && !cedulaComprador.trim()) {
        setError('Para pagos por Bancolombia, se requiere la cédula del comprador.');
        setLoading(false);
        return;
      }
      
      // Validaciones específicas para Stripe
      if (medioPago === 'STRIPE' && !correoPago.trim()) {
        setError('Para pagos por Stripe, se requiere el correo con el que se pagó.');
        setLoading(false);
        return;
      }
      
      // Validaciones específicas para Otro
      if (medioPago === 'OTRO' && !otroMedioPago.trim()) {
        setError('Para "Otro" medio de pago, se debe especificar cuál es.');
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
      const reporteData: Record<string, any> = {
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
        CORREO_PAGO: medioPago === 'STRIPE' ? correoPago : null,
        MEDIO_PAGO: tipoVenta === 'EXTERNA' ? (medioPago === 'OTRO' ? otroMedioPago : medioPago) : null,
        PRODUCTO: producto,
      };

      // Agregar campos específicos según el medio de pago
      if (tipoVenta === 'EXTERNA') {
        if (medioPago === 'WESTERN_UNION') {
          reporteData.ACTIVIDAD_ECONOMICA = actividadEconomica;
        }
        if (medioPago === 'BANCOLOMBIA') {
          reporteData.CEDULA_COMPRADOR = cedulaComprador;
        }
      }

      await apiClient.request('/GERSSON_REPORTES', 'POST', reporteData);
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
          NOMBRE: nombreCliente,
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

  // Función para determinar si mostrar campo específico
  const mostrarCampoWestern = () => {
    return tipoVenta === 'EXTERNA' && medioPago === 'WESTERN_UNION';
  };

  const mostrarCampoBancolombia = () => {
    return tipoVenta === 'EXTERNA' && medioPago === 'BANCOLOMBIA';
  };

  const mostrarCampoStripe = () => {
    return tipoVenta === 'EXTERNA' && medioPago === 'STRIPE';
  };

  const mostrarCampoOtro = () => {
    return tipoVenta === 'EXTERNA' && medioPago === 'OTRO';
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
          {/* Selección del Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Producto
            </label>
            <select
              value={producto}
              onChange={(e) => setProducto(e.target.value as 'PRINCIPAL' | 'DOWNSELL' | '')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Selecciona Producto --</option>
              <option value="PRINCIPAL">Producto Principal</option>
              <option value="DOWNSELL">Downsell</option>
            </select>
          </div>

          {/* Tipo de Venta */}
          {producto !== 'DOWNSELL' && (
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
          )}
          {producto === 'DOWNSELL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tipo de Venta
              </label>
              <input
                type="text"
                value="Interna (Downsell solo por Hotmart)"
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700"
              />
            </div>
          )}

          {/* Nombre del Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre Cliente</label>
            <input
              type="text"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
              placeholder="Nombre del cliente"
              required
            />
            <label className="block text-xs font-normal text-gray-500">
              👆🏻 Si ves que no es el nombre correcto, modifícalo y ponlo completo (nombre y apellido).
            </label>
          </div>

          {/* Datos adicionales para ventas EXTERNAS */}
          {tipoVenta === 'EXTERNA' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Medio de Pago
                </label>
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">-- Selecciona Medio de Pago --</option>
                  <option value="WESTERN_UNION">Western Union</option>
                  <option value="BANCOLOMBIA">Bancolombia</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              {/* Campo específico para Otro */}
              {mostrarCampoOtro() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Especificar Medio de Pago
                  </label>
                  <input
                    type="text"
                    value={otroMedioPago}
                    onChange={(e) => setOtroMedioPago(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                    placeholder="Ej: Zelle, bold, Remitly, pichincha, etc."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📝 Especifica el medio de pago utilizado
                  </p>
                </div>
              )}

              {/* Campo específico para Western Union */}
              {mostrarCampoWestern() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Actividad Económica del Comprador
                  </label>
                  <input
                    type="text"
                    value={actividadEconomica}
                    onChange={(e) => setActividadEconomica(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                    placeholder="Ej: Empleado, Independiente, Estudiante, etc."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📋 Requerido para pagos por Western Union
                  </p>
                </div>
              )}

              {/* Campo específico para Bancolombia */}
              {mostrarCampoBancolombia() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cédula del Comprador
                  </label>
                  <input
                    type="text"
                    value={cedulaComprador}
                    onChange={(e) => setCedulaComprador(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                    placeholder="Número de cédula"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    🆔 Requerido para pagos por Bancolombia
                  </p>
                </div>
              )}

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

              {/* Campo específico para Stripe */}
              {mostrarCampoStripe() && (
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
                  <p className="text-xs text-gray-500 mt-1">
                    📧 Requerido para pagos por Stripe
                  </p>
                </div>
              )}

              
            </>
          )}

          {/* Comentarios de la Venta */}
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

          {/* Comprobante de Pago */}
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
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500">
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

          {/* Botón Confirmar Venta */}
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

