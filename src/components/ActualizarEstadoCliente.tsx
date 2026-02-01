import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { Cliente, Asesor, EstadoAsesor, TemperaturaLead, EtiquetaCliente, COLORES_ETIQUETAS, COMENTARIO_SOLO_ESPERANDO } from '../types';
import { X, Loader2, Flame, ThermometerSun, Snowflake, Tag, Plus, Check } from 'lucide-react';
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
  
  // Estados para temperatura y etiquetas
  const [temperatura, setTemperatura] = useState<TemperaturaLead | ''>(cliente.temperatura || '');
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<EtiquetaCliente[]>([]);
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<number[]>([]);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [colorNuevaEtiqueta, setColorNuevaEtiqueta] = useState('blue');
  const [creandoEtiqueta, setCreandoEtiqueta] = useState(false);
  const [cargandoEtiquetas, setCargandoEtiquetas] = useState(false);

  // Cargar etiquetas del asesor al montar el componente
  useEffect(() => {
    const cargarEtiquetas = async () => {
      setCargandoEtiquetas(true);
      try {
        const data = await apiClient.request<EtiquetaCliente[]>(
          `/etiquetas_clientes?id_asesor=eq.${asesor.ID}&activo=eq.true&order=uso_count.desc`
        );
        if (Array.isArray(data)) {
          setEtiquetasDisponibles(data);
          
          // Si el cliente ya tiene etiquetas, seleccionarlas
          if (cliente.etiquetas) {
            const etiquetasCliente = cliente.etiquetas.split(',').filter(e => e.trim());
            const idsSeleccionados = data
              .filter(e => etiquetasCliente.includes(e.nombre))
              .map(e => e.id);
            setEtiquetasSeleccionadas(idsSeleccionados);
          }
        }
      } catch (error) {
        console.error('Error cargando etiquetas:', error);
      } finally {
        setCargandoEtiquetas(false);
      }
    };
    
    cargarEtiquetas();
  }, [asesor.ID, cliente.etiquetas]);

  // Función para crear nueva etiqueta
  const handleCrearEtiqueta = async () => {
    if (!nuevaEtiqueta.trim()) return;
    
    setCreandoEtiqueta(true);
    try {
      const data = await apiClient.request<EtiquetaCliente[]>(
        '/etiquetas_clientes',
        'POST',
        {
          id_asesor: asesor.ID,
          nombre: nuevaEtiqueta.trim(),
          color: colorNuevaEtiqueta,
          uso_count: 0,
          activo: true
        }
      );
      
      if (Array.isArray(data) && data.length > 0) {
        setEtiquetasDisponibles([...etiquetasDisponibles, data[0]]);
        setEtiquetasSeleccionadas([...etiquetasSeleccionadas, data[0].id]);
        setNuevaEtiqueta('');
      }
    } catch (error: any) {
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        alert('Ya existe una etiqueta con ese nombre');
      } else {
        console.error('Error creando etiqueta:', error);
      }
    } finally {
      setCreandoEtiqueta(false);
    }
  };

  // Toggle selección de etiqueta
  const toggleEtiqueta = (etiquetaId: number) => {
    if (etiquetasSeleccionadas.includes(etiquetaId)) {
      setEtiquetasSeleccionadas(etiquetasSeleccionadas.filter(id => id !== etiquetaId));
    } else {
      setEtiquetasSeleccionadas([...etiquetasSeleccionadas, etiquetaId]);
    }
  };

  // Obtener clase de color para etiqueta
  const getColorClass = (color: string) => {
    const colorConfig = COLORES_ETIQUETAS.find(c => c.id === color);
    return colorConfig?.class || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Verifica si se requiere fecha obligatoria (para SEGUIMIENTO y NO CONTESTÓ)
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
    const esSoloEsperando = estado === 'ESPERANDO RESPUESTA';
    if (!esSoloEsperando && comentario.trim().length < 25) {
      alert('El comentario es muy corto.');
      return;
    }
    setLoading(true);

    const comentarioFinal = esSoloEsperando ? COMENTARIO_SOLO_ESPERANDO : comentario;
  
    try {
      console.log("🚀 Enviando reporte...");
  
      // 🔹 Preparar etiquetas como string (solo si no es solo "esperando respuesta")
      const etiquetasNombres = esSoloEsperando ? [] : etiquetasSeleccionadas
        .map(id => etiquetasDisponibles.find(e => e.id === id)?.nombre)
        .filter(Boolean);
      const etiquetasString = etiquetasNombres.length > 0 
        ? etiquetasNombres.join(',') 
        : null;
      
      // Incrementar uso de etiquetas seleccionadas (solo si no es solo "esperando respuesta")
      if (!esSoloEsperando) {
        for (const etiquetaId of etiquetasSeleccionadas) {
          try {
            await apiClient.request(`/rpc/increment_etiqueta_uso`, 'POST', { etiqueta_id: etiquetaId });
          } catch (e) {
            // Ignorar errores de incremento, no es crítico
          }
        }
      }

      // 🔹 Datos que se enviarán al reporte
      const reporteData: Record<string, any> = {
        ID_CLIENTE: cliente.ID,
        ID_ASESOR: asesor.ID,
        ESTADO_ANTERIOR: cliente.ESTADO,
        ESTADO_NUEVO: estado,
        COMENTARIO: comentarioFinal,
        NOMBRE_ASESOR: asesor.NOMBRE,
        FECHA_REPORTE: getCurrentEpoch(),
        FECHA_SEGUIMIENTO: !esSoloEsperando && requiereFecha && fechaSeguimiento ? toEpoch(new Date(fechaSeguimiento)) : null,
        temperatura: esSoloEsperando ? null : (temperatura || null),
        etiquetas: etiquetasString
      };
  
      console.log("📤 Datos a enviar a /GERSSON_REPORTES:", reporteData);
  
      // 🔹 Intentar crear el reporte
      const reporteResponse = await apiClient.request('/GERSSON_REPORTES', 'POST', reporteData);
      console.log("✅ Respuesta de /GERSSON_REPORTES:", reporteResponse);
  
      // 🔹 Actualización del estado del cliente (incluye temperatura y etiquetas)
      const updateData: Record<string, any> = { 
        ESTADO: estado,
        temperatura: esSoloEsperando ? null : (temperatura || null),
        etiquetas: etiquetasString,
        temperatura_fecha: esSoloEsperando ? null : (temperatura ? getCurrentEpoch() : null)
      };
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
              <option value="ESPERANDO RESPUESTA">
                Esperando respuesta (ya contacté, aguardando que responda)
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

          {/* Selector de Temperatura (oculto para "Esperando respuesta") */}
          {estado === 'SEGUIMIENTO' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🌡️ Temperatura del Lead
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setTemperatura('CALIENTE')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border-2 transition-all ${
                    temperatura === 'CALIENTE' 
                      ? 'border-red-500 bg-red-50 text-red-700' 
                      : 'border-gray-200 hover:border-red-300 text-gray-600'
                  }`}
                >
                  <Flame className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Caliente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemperatura('TIBIO')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border-2 transition-all ${
                    temperatura === 'TIBIO' 
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700' 
                      : 'border-gray-200 hover:border-yellow-300 text-gray-600'
                  }`}
                >
                  <ThermometerSun className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Tibio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemperatura('FRIO')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border-2 transition-all ${
                    temperatura === 'FRIO' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-blue-300 text-gray-600'
                  }`}
                >
                  <Snowflake className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Frío</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                🔥 Caliente = Alta probabilidad de compra | 🌡️ Tibio = Interés moderado | ❄️ Frío = Poco interés
              </p>
            </div>
          )}

          {/* Selector de Etiquetas Personalizadas (oculto para "Esperando respuesta") */}
          {estado === 'SEGUIMIENTO' && (
            <div>
              <button
                type="button"
                onClick={() => setMostrarEtiquetas(!mostrarEtiquetas)}
                className="flex items-center text-sm font-medium text-gray-700 mb-2 hover:text-blue-600"
              >
                <Tag className="h-4 w-4 mr-1" />
                Etiquetas del Lead
                <span className="ml-2 text-xs text-gray-400">
                  {etiquetasSeleccionadas.length > 0 ? `(${etiquetasSeleccionadas.length} seleccionadas)` : '(opcional)'}
                </span>
              </button>
              
              {mostrarEtiquetas && (
                <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                  {/* Etiquetas existentes */}
                  {cargandoEtiquetas ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      <span className="ml-2 text-xs text-gray-400">Cargando...</span>
                    </div>
                  ) : etiquetasDisponibles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {etiquetasDisponibles.map((etiqueta) => (
                        <button
                          key={etiqueta.id}
                          type="button"
                          onClick={() => toggleEtiqueta(etiqueta.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all border flex items-center gap-1 ${
                            etiquetasSeleccionadas.includes(etiqueta.id)
                              ? 'bg-blue-500 text-white border-blue-500'
                              : `${getColorClass(etiqueta.color)} hover:opacity-80`
                          }`}
                        >
                          {etiqueta.emoji && <span>{etiqueta.emoji}</span>}
                          {etiqueta.nombre}
                          {etiquetasSeleccionadas.includes(etiqueta.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-2">
                      No tienes etiquetas creadas. ¡Crea tu primera!
                    </p>
                  )}
                  
                  {/* Crear nueva etiqueta */}
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs text-gray-500 mb-2">Crear nueva etiqueta:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nuevaEtiqueta}
                        onChange={(e) => setNuevaEtiqueta(e.target.value)}
                        placeholder="Nombre de la etiqueta..."
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        maxLength={50}
                      />
                      <select
                        value={colorNuevaEtiqueta}
                        onChange={(e) => setColorNuevaEtiqueta(e.target.value)}
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                      >
                        {COLORES_ETIQUETAS.map((color) => (
                          <option key={color.id} value={color.id}>
                            {color.nombre}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCrearEtiqueta}
                        disabled={!nuevaEtiqueta.trim() || creandoEtiqueta}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {creandoEtiqueta ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comentario, texto de ayuda y fecha: ocultos para "Esperando respuesta" */}
          {estado !== 'ESPERANDO RESPUESTA' && (
            <>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comentario <span className="text-gray-500 font-normal">(mínimo 25 caracteres)</span>
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              rows={3}
              minLength={25}
              placeholder="Escribe al menos 25 caracteres..."
              required
            />
            {comentario.length > 0 && comentario.trim().length < 25 && (
              <p className="text-xs text-amber-600 mt-1">
                Comentario muy corto.
              </p>
            )}
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
            </>
          )}

          {requiereFecha && estado !== 'ESPERANDO RESPUESTA' && (
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
              text-sm font-medium text-white
              ${estado === 'ESPERANDO RESPUESTA' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-blue-600 hover:bg-blue-700'}
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {loading ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Guardando...
              </span>
            ) : estado === 'ESPERANDO RESPUESTA' ? (
              'Marcar como esperando respuesta'
            ) : (
              'Guardar Reporte'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
