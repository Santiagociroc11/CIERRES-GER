import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { uploadToMinio } from '../lib/minio';
import { Cliente, Asesor } from '../types';
import { X, Upload, DollarSign, Image, AlertCircle, FileVideo, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { getCurrentEpoch } from '../utils/dateUtils';

interface ReportarYConsolidarVentaProps {
  cliente: Cliente;
  asesor: Asesor;
  onComplete: () => void;
  onClose: () => void;
}

export default function ReportarYConsolidarVenta({
  cliente,
  asesor,
  onComplete,
  onClose,
}: ReportarYConsolidarVentaProps) {
  // Estado del stepper
  const [paso, setPaso] = useState<1 | 2>(1);

  // === PASO 1: Datos de la Venta ===
  const [producto, setProducto] = useState<'PRINCIPAL' | 'DOWNSELL' | ''>('');
  const [tipoVenta, setTipoVenta] = useState<'INTERNA' | 'EXTERNA' | ''>('');
  const [comentarioVenta, setComentarioVenta] = useState('');
  const [pais, setPais] = useState('');
  const [correoInscripcion, setCorreoInscripcion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correoPago, setCorreoPago] = useState('');
  const [correoRegistroInterno, setCorreoRegistroInterno] = useState('');
  const [imagenPago, setImagenPago] = useState<File | null>(null);
  const [previewPago, setPreviewPago] = useState<string | null>(null);
  const [medioPago, setMedioPago] = useState('');
  const [nombreCliente, setNombreCliente] = useState(cliente.NOMBRE);
  const [actividadEconomica, setActividadEconomica] = useState('');
  const [cedulaComprador, setCedulaComprador] = useState('');
  const [otroMedioPago, setOtroMedioPago] = useState('');

  // === PASO 2: Evidencia de Consolidación ===
  const [imagenInicio, setImagenInicio] = useState<File | null>(null);
  const [imagenFin, setImagenFin] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [comentarioConsolidacion, setComentarioConsolidacion] = useState('');
  const [previewInicio, setPreviewInicio] = useState<string | null>(null);
  const [previewFin, setPreviewFin] = useState<string | null>(null);

  // === Estados generales ===
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finalStatus, setFinalStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

  // === Handlers de imágenes ===
  const handleImagenPagoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      reader.onloadend = () => setPreviewPago(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (file: File | null) => void,
    setPreview: (url: string | null) => void
  ) => {
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
      setImage(file);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Por favor, selecciona un archivo de video válido.');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('El video no debe superar los 100MB.');
        return;
      }
      setVideo(file);
      setError('');
    }
  };

  // === Validación Paso 1 ===
  const validarPaso1 = (): boolean => {
    setError('');

    if (!producto) {
      setError('Selecciona primero el producto (Principal o Downsell).');
      return false;
    }

    if (!tipoVenta) {
      setError('Selecciona si la venta es interna (Hotmart) o externa.');
      return false;
    }

    if (producto === 'DOWNSELL' && tipoVenta !== 'INTERNA') {
      setError('Las ventas downsell solo pueden ser internas.');
      return false;
    }

    if (tipoVenta === 'INTERNA') {
      if (!correoRegistroInterno.trim()) {
        setError('❌ OBLIGATORIO: Para ventas internas, se requiere el correo con el que se registró.');
        return false;
      }
    }

    if (tipoVenta === 'EXTERNA') {
      if (!medioPago.trim()) {
        setError('❌ OBLIGATORIO: Para pagos externos, se debe especificar el medio de pago.');
        return false;
      }
      if (medioPago === 'WESTERN_UNION' && !actividadEconomica.trim()) {
        setError('❌ OBLIGATORIO: Para pagos por Western Union, se requiere la actividad económica del comprador.');
        return false;
      }
      if (medioPago === 'BANCOLOMBIA' && !cedulaComprador.trim()) {
        setError('❌ OBLIGATORIO: Para pagos por Bancolombia, se requiere la cédula del comprador.');
        return false;
      }
      if (medioPago === 'STRIPE' && !correoPago.trim()) {
        setError('❌ OBLIGATORIO: Para pagos por Stripe, se requiere el correo con el que se pagó.');
        return false;
      }
      if (medioPago === 'OTRO' && !otroMedioPago.trim()) {
        setError('❌ OBLIGATORIO: Para "Otro" medio de pago, se debe especificar cuál es.');
        return false;
      }
      if (!pais.trim()) {
        setError('Para pagos externos, se requiere el país del cliente.');
        return false;
      }
      if (!correoInscripcion.trim()) {
        setError('Para pagos externos, se requiere el correo de inscripción.');
        return false;
      }
      if (!telefono.trim()) {
        setError('Para pagos externos, se requiere el teléfono de inscripción.');
        return false;
      }
    }

    if (!imagenPago) {
      setError('Por favor, sube el comprobante de pago.');
      return false;
    }

    return true;
  };

  // === Validación Paso 2 ===
  const validarPaso2 = (): boolean => {
    setError('');

    if (!imagenInicio) {
      setError('Por favor, sube la captura del inicio de la conversación.');
      return false;
    }
    if (!imagenFin) {
      setError('Por favor, sube la captura del fin de la conversación.');
      return false;
    }
    if (!video) {
      setError('Por favor, sube el video de la conversación.');
      return false;
    }

    return true;
  };

  // === Navegación del stepper ===
  const handleSiguiente = () => {
    if (validarPaso1()) {
      setPaso(2);
      setError('');
    }
  };

  const handleAnterior = () => {
    setPaso(1);
    setError('');
  };

  // === Enviar a Telegram (ventas externas) ===
  const handleEnviarVenta = async (imagenPagoUrl: string) => {
    try {
      const payload: Record<string, any> = {
        clienteID: cliente.ID,
        asesorID: asesor.ID,
        nombreAsesor: asesor.NOMBRE,
        tipoVenta,
        comentario: comentarioVenta,
        imagenPagoUrl,
      };

      if (tipoVenta === 'EXTERNA') {
        payload.medioPago = medioPago === 'OTRO' ? otroMedioPago : medioPago;
        payload.pais = pais || undefined;
        payload.correoInscripcion = correoInscripcion || undefined;
        payload.telefono = telefono || undefined;
        payload.correoPago = medioPago === 'STRIPE' ? correoPago : undefined;
        if (medioPago === 'WESTERN_UNION') {
          payload.actividadEconomica = actividadEconomica || undefined;
        }
        if (medioPago === 'BANCOLOMBIA') {
          payload.cedulaComprador = cedulaComprador || undefined;
        }
      }

      const response = await fetch('/api/pagosexternos-reisy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Error al enviar la venta a Telegram');
      }

      console.log('✅ Pago externo enviado exitosamente a Telegram:', data);
    } catch (apiError) {
      console.error('Error al enviar la venta a Telegram:', apiError);
      // No lanzamos error aquí para no interrumpir el flujo principal
    }
  };

  // === Submit final ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarPaso2()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Subir todos los archivos a MinIO
      console.log('Subiendo archivos a MinIO...');
      
      const imagenPagoUrl = await uploadToMinio(imagenPago!, 'pagos');
      const imagenInicioUrl = await uploadToMinio(imagenInicio!, 'consolidaciones');
      const imagenFinUrl = await uploadToMinio(imagenFin!, 'consolidaciones');
      const videoUrl = await uploadToMinio(video!, 'consolidaciones');

      console.log('Archivos subidos exitosamente');

      // 2. Marcar seguimientos anteriores como completados
      await apiClient.request(
        `/GERSSON_REPORTES?ID_CLIENTE=eq.${cliente.ID}&COMPLETADO=eq.false&FECHA_SEGUIMIENTO=not.is.null`,
        'PATCH',
        { COMPLETADO: true }
      );

      // 3. Crear reporte de venta (ESTADO: PAGADO)
      const reporteVentaData: Record<string, any> = {
        ID_CLIENTE: cliente.ID,
        ID_ASESOR: asesor.ID,
        ESTADO_ANTERIOR: cliente.ESTADO,
        ESTADO_NUEVO: 'PAGADO',
        COMENTARIO: comentarioVenta,
        NOMBRE_ASESOR: asesor.NOMBRE,
        IMAGEN_PAGO_URL: imagenPagoUrl,
        FECHA_REPORTE: getCurrentEpoch(),
        TIPO_VENTA: tipoVenta,
        PAIS_CLIENTE: tipoVenta === 'EXTERNA' ? pais : null,
        CORREO_INSCRIPCION: tipoVenta === 'EXTERNA' ? correoInscripcion : (tipoVenta === 'INTERNA' ? correoRegistroInterno : null),
        TELEFONO_CLIENTE: tipoVenta === 'EXTERNA' ? telefono : null,
        CORREO_PAGO: medioPago === 'STRIPE' ? correoPago : null,
        MEDIO_PAGO: tipoVenta === 'EXTERNA' ? (medioPago === 'OTRO' ? otroMedioPago : medioPago) : null,
        PRODUCTO: producto,
      };

      if (tipoVenta === 'EXTERNA') {
        if (medioPago === 'WESTERN_UNION') {
          reporteVentaData.ACTIVIDAD_ECONOMICA = actividadEconomica;
        }
        if (medioPago === 'BANCOLOMBIA') {
          reporteVentaData.CEDULA_COMPRADOR = cedulaComprador;
        }
      }

      await apiClient.request('/GERSSON_REPORTES', 'POST', reporteVentaData);
      console.log('Reporte de venta creado (PAGADO)');

      // 4. Crear reporte de consolidación (ESTADO: VENTA CONSOLIDADA)
      const reporteConsolidacionData = {
        ID_CLIENTE: cliente.ID,
        ID_ASESOR: asesor.ID,
        ESTADO_ANTERIOR: 'PAGADO',
        ESTADO_NUEVO: 'VENTA CONSOLIDADA',
        COMENTARIO: comentarioConsolidacion || 'Sin comentarios',
        NOMBRE_ASESOR: asesor.NOMBRE,
        FECHA_REPORTE: getCurrentEpoch(),
        consolidado: true,
        imagen_inicio_conversacion: imagenInicioUrl,
        imagen_fin_conversacion: imagenFinUrl,
        video_conversacion: videoUrl,
      };

      await apiClient.request('/GERSSON_REPORTES', 'POST', reporteConsolidacionData);
      console.log('Reporte de consolidación creado (VENTA CONSOLIDADA)');

      // 5. Actualizar el estado del cliente
      await apiClient.request(
        `/GERSSON_CLIENTES?ID=eq.${cliente.ID}`,
        'PATCH',
        {
          NOMBRE: nombreCliente,
          ESTADO: 'VENTA CONSOLIDADA',
          FECHA_COMPRA: getCurrentEpoch(),
          PAIS: tipoVenta === 'EXTERNA' ? pais : null,
        }
      );
      console.log('Cliente actualizado a VENTA CONSOLIDADA');

      // 6. Enviar a Telegram si es venta externa
      if (tipoVenta === 'EXTERNA') {
        await handleEnviarVenta(imagenPagoUrl);
      }

      setFinalStatus('success');
    } catch (err: any) {
      console.error('Error en el proceso:', err);
      setError(err.message || 'Error al procesar la venta');
      setFinalStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // === Pantalla de éxito ===
  if (finalStatus === 'success') {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
        <div className="p-5 border w-full max-w-md shadow-lg rounded-md bg-white text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">¡Venta registrada y consolidada!</h3>
          <p className="text-sm text-gray-500 mb-4">
            La venta ha sido reportada y consolidada exitosamente.
          </p>
          <button
            onClick={onComplete}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Aceptar
          </button>
        </div>
      </div>
    );
  }

  // === Pantalla de error ===
  if (finalStatus === 'error') {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
        <div className="p-5 border w-full max-w-md shadow-lg rounded-md bg-white text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">Error en el proceso</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => setFinalStatus('idle')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  // === Indicador de pasos ===
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="flex items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${paso >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          {paso > 1 ? <Check className="h-5 w-5" /> : '1'}
        </div>
        <span className={`ml-2 text-sm font-medium ${paso >= 1 ? 'text-green-600' : 'text-gray-500'}`}>
          Datos de Venta
        </span>
      </div>
      <div className={`w-16 h-1 mx-4 ${paso >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
      <div className="flex items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${paso >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          2
        </div>
        <span className={`ml-2 text-sm font-medium ${paso >= 2 ? 'text-green-600' : 'text-gray-500'}`}>
          Evidencia
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white mb-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <DollarSign className="h-6 w-6 text-green-500 mr-2" />
            <h3 className="text-lg font-medium">Reportar y Consolidar Venta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Indicador de pasos */}
        <StepIndicator />

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* === PASO 1: Datos de la Venta === */}
        {paso === 1 && (
          <div className="space-y-4">
            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Producto</label>
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
                <label className="block text-sm font-medium text-gray-700">Tipo de Venta</label>
                <select
                  value={tipoVenta}
                  onChange={(e) => setTipoVenta(e.target.value as 'INTERNA' | 'EXTERNA' | '')}
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
                <label className="block text-sm font-medium text-gray-700">Tipo de Venta</label>
                <input
                  type="text"
                  value="Interna (Downsell solo por Hotmart)"
                  disabled
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700"
                />
              </div>
            )}

            {/* Campo de correo para ventas INTERNAS */}
            {tipoVenta === 'INTERNA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Correo con el que se registró <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={correoRegistroInterno}
                  onChange={(e) => setCorreoRegistroInterno(e.target.value)}
                  className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="correo-registro@ejemplo.com"
                  required
                />
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ OBLIGATORIO para ventas internas por Hotmart
                </p>
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
                    Medio de Pago <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value)}
                    className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">-- Selecciona Medio de Pago --</option>
                    <option value="WESTERN_UNION">Western Union</option>
                    <option value="BANCOLOMBIA">Bancolombia</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ OBLIGATORIO para ventas externas
                  </p>
                </div>

                {/* Campo específico para Otro */}
                {medioPago === 'OTRO' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Especificar Medio de Pago <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={otroMedioPago}
                      onChange={(e) => setOtroMedioPago(e.target.value)}
                      className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                      placeholder="Ej: Zelle, bold, Remitly, pichincha, etc."
                      required
                    />
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠️ OBLIGATORIO: Especifica el medio de pago utilizado
                    </p>
                  </div>
                )}

                {/* Campo específico para Western Union */}
                {medioPago === 'WESTERN_UNION' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Actividad Económica del Comprador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={actividadEconomica}
                      onChange={(e) => setActividadEconomica(e.target.value)}
                      className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                      placeholder="Ej: Empleado, Independiente, Estudiante, etc."
                      required
                    />
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠️ OBLIGATORIO para pagos por Western Union
                    </p>
                  </div>
                )}

                {/* Campo específico para Bancolombia */}
                {medioPago === 'BANCOLOMBIA' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Cédula del Comprador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cedulaComprador}
                      onChange={(e) => setCedulaComprador(e.target.value)}
                      className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                      placeholder="Número de cédula"
                      required
                    />
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠️ OBLIGATORIO para pagos por Bancolombia
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">País</label>
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
                  <label className="block text-sm font-medium text-gray-700">Correo de Inscripción</label>
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
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                    placeholder="Número de teléfono"
                    required
                  />
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    📱 Formato: Número con indicativo tal como aparece en WhatsApp (ej: +573001234567)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Sin espacios, paréntesis ni guiones</p>
                </div>

                {/* Campo específico para Stripe */}
                {medioPago === 'STRIPE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Correo con el que hizo el pago en Stripe <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={correoPago}
                      onChange={(e) => setCorreoPago(e.target.value)}
                      className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                      placeholder="correo-de-pago@ejemplo.com"
                      required
                    />
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠️ OBLIGATORIO para pagos por Stripe
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Comentarios de la Venta */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Comentarios de la Venta</label>
              <textarea
                value={comentarioVenta}
                onChange={(e) => setComentarioVenta(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                rows={2}
                placeholder="Detalles adicionales de la venta..."
                required
              />
            </div>

            {/* Comprobante de Pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Comprobante de Pago</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {previewPago ? (
                    <div className="relative">
                      <img src={previewPago} alt="Preview" className="mx-auto h-32 w-auto object-contain" />
                      <button
                        type="button"
                        onClick={() => { setImagenPago(null); setPreviewPago(null); }}
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
                          <input type="file" className="sr-only" accept="image/*" onChange={handleImagenPagoChange} required />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 5MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Botón Siguiente */}
            <button
              type="button"
              onClick={handleSiguiente}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Siguiente
              <ChevronRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        )}

        {/* === PASO 2: Evidencia de Consolidación === */}
        {paso === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Aviso importante */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Importante:</strong> Todas las pruebas deben tener el número visible del cliente o algo que lo identifique plenamente.
              </p>
            </div>

            {/* Comentario opcional */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Comentario adicional (opcional)</label>
              <textarea
                value={comentarioConsolidacion}
                onChange={(e) => setComentarioConsolidacion(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
                rows={2}
                placeholder="Agrega un comentario sobre la consolidación..."
              />
            </div>

            {/* Imagen de inicio de conversación */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Captura del inicio de la conversación <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {previewInicio ? (
                    <div className="relative">
                      <img src={previewInicio} alt="Preview inicio" className="mx-auto h-32 w-auto object-contain" />
                      <button
                        type="button"
                        onClick={() => { setImagenInicio(null); setPreviewInicio(null); }}
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
                          <span>Subir captura inicial</span>
                          <input
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e, setImagenInicio, setPreviewInicio)}
                            required
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Imagen de fin de conversación */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Captura del fin de la conversación <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {previewFin ? (
                    <div className="relative">
                      <img src={previewFin} alt="Preview fin" className="mx-auto h-32 w-auto object-contain" />
                      <button
                        type="button"
                        onClick={() => { setImagenFin(null); setPreviewFin(null); }}
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
                          <span>Subir captura final</span>
                          <input
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e, setImagenFin, setPreviewFin)}
                            required
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Video de la conversación */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Video de la conversación <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {video ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FileVideo className="h-12 w-12 text-green-500" />
                      <span className="text-sm text-gray-600">{video.name}</span>
                      <button
                        type="button"
                        onClick={() => setVideo(null)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileVideo className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus:ring-green-500">
                          <span>Subir video</span>
                          <input type="file" className="sr-only" accept="video/*" onChange={handleVideoChange} required />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">MP4, WebM hasta 100MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Botones de navegación */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleAnterior}
                className="flex-1 flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <ChevronLeft className="mr-2 h-5 w-5" />
                Anterior
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <Upload className="animate-spin h-5 w-5 mr-2" />
                    Procesando...
                  </span>
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Confirmar Venta
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
