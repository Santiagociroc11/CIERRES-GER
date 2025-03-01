import React, { useState } from 'react';
import { apiClient } from '../lib/apiClient';
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
  const [fechaSeguimiento, setFechaSeguimiento] = useState('');
  const [loading, setLoading] = useState(false);

  // Verifica si se requiere fecha obligatoria (para SEGUIMIENTO, NO INTERESADO y NO CONTESTÓ)
  const requiereFecha =
    estado === 'SEGUIMIENTO' ||
    estado === 'NO CONTESTÓ';

  // Función para formatear un Date en "YYYY-MM-DDTHH:mm" **en hora local**
  const formatLocalDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    // Retorna algo tipo: "2025-02-28T15:04"
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Calculamos "hora actual + 1 hora" en **hora local**
  const minFechaSeguimiento = (() => {
    const nowPlusOne = new Date();
    nowPlusOne.setHours(nowPlusOne.getHours() + 1);
    return formatLocalDateTime(nowPlusOne);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      console.log("🚀 Enviando reporte...");
  
      // 🔹 Datos que se enviarán al reporte
      const reporteData = {
        ID_CLIENTE: cliente.ID,
        ID_ASESOR: asesor.ID,
        ESTADO_ANTERIOR: cliente.ESTADO,
        ESTADO_NUEVO: estado,
        COMENTARIO: comentario,
        NOMBRE_ASESOR: asesor.NOMBRE,
        FECHA_REPORTE: getCurrentEpoch(),
        FECHA_SEGUIMIENTO: requiereFecha && fechaSeguimiento ? toEpoch(new Date(fechaSeguimiento)) : null
      };
  
      console.log("📤 Datos a enviar a /GERSSON_REPORTES:", reporteData);
  
      // 🔹 Intentar crear el reporte
      const reporteResponse = await apiClient.request('/GERSSON_REPORTES', 'POST', reporteData);
      console.log("✅ Respuesta de /GERSSON_REPORTES:", reporteResponse);
  
      // 🔹 Actualización del estado del cliente
      const updateData = { ESTADO: estado };
      console.log(`📤 Actualizando cliente ${cliente.ID} con datos:`, updateData);
  
      const updateResponse = await apiClient.request(`/GERSSON_CLIENTES?ID=eq.${cliente.ID}`, 'PATCH', updateData);
      console.log("✅ Respuesta de actualización en /GERSSON_CLIENTES:", updateResponse);
  
      onComplete();
    } catch (error: any) {
      console.error("❌ Error en handleSubmit:", error);
  
      // 🔹 Si la respuesta no es JSON, mostrar el cuerpo de la respuesta
      if (error.response) {
        console.error("🔍 Respuesta del servidor:", await error.response.text());
      }
      
      alert(`Error al crear el reporte: ${error.message || "Error desconocido"}`);
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
              <option value="SEGUIMIENTO">
                Seguimiento (cliente con posibilidad de compra)
              </option>
              <option value="NO INTERESADO">
                No Interesado (cliente que no va a comprar)
              </option>
              <option value="NO CONTESTÓ">No Contestó</option>
              <option value="NO CONTACTAR">
                No Contactar (no tiene Wha o imposible de contactar)
              </option>
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

          <p className="text-xs text-gray-500 mt-1">
            El comentario debe ir lo más específico posible y, si es una 
            actualización de seguimiento, <strong>SIEMPRE</strong> debe 
            llevar una acción futura.
            <br />
            <br />
            Ejemplo: "lo contacté y me dijo que estaba buscando el dinero 
            prestado, lo contactaré el viernes 27 a las 12:00 pm"
          </p>

          {requiereFecha && (
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
                // Aquí pasas el min en formato local
                min={minFechaSeguimiento}
              />
              <p className="text-xs text-gray-500 mt-2">
                Esta fecha es para realizar un seguimiento futuro al cliente y 
                aparecerá en la pestaña de <strong>SEGUIMIENTOS</strong> 
                ordenado por fecha y hora.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full flex justify-center py-2 px-4 rounded-md shadow-sm
              text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
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
