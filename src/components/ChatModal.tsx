import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Phone, FileText, Calendar, Activity, Check, CheckCheck, Clock, AlertCircle, RefreshCw, Search, Clock as ClockIcon } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Reporte, Registro, QuickReply, ScheduledMessage } from '../types';

function formatChatDate(ts: number) {
  const date = new Date(ts * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  } else if (isYesterday) {
    return `ayer ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`;
  } else {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`;
  }
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: {
    ID: number;
    NOMBRE: string;
    WHATSAPP: string;
  };
  asesor: {
    ID: number;
    NOMBRE: string;
  };
}

type EstadoMensaje = 'enviando' | 'enviado' | 'entregado' | 'leido' | 'error';

interface Mensaje {
  id: number;
  id_asesor: number;
  id_cliente: number;
  wha_cliente: string;
  modo: 'entrante' | 'saliente';
  timestamp: number;
  mensaje: string;
  estado?: EstadoMensaje;
}

interface MensajeTemporal extends Omit<Mensaje, 'id'> {
  id: string;
  temporal: true;
  intentos?: number;
  maxIntentos?: number;
}

// Tipo unificado para los elementos del timeline
type TimelineItem = {
  id: string;
  timestamp: number;
  tipo: 'mensaje' | 'reporte' | 'registro';
  contenido: Mensaje | MensajeTemporal | Reporte | Registro;
};

export default function ChatModal({ isOpen, onClose, cliente, asesor }: ChatModalProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Nuevas funcionalidades
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTimeline, setFilteredTimeline] = useState<TimelineItem[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Estado para mensajes en proceso (sin agregar al timeline)
  const [mensajesEnProceso, setMensajesEnProceso] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const evolutionApiUrl = import.meta.env.VITE_EVOLUTIONAPI_URL;
  const evolutionApiKey = import.meta.env.VITE_EVOLUTIONAPI_TOKEN;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Detectar si el usuario está en la parte inferior
  const handleScroll = () => {
    if (messageContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
      const bottomThreshold = 100; // px del fondo
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < bottomThreshold;
      setIsAtBottom(isScrolledToBottom);
    }
  };

  // Generar timeline unificado
  useEffect(() => {
    const items: TimelineItem[] = [
      // Convertir mensajes persistentes a timeline items
      ...mensajes.map((msg): TimelineItem => ({
        id: `msg-${msg.id}`,
        timestamp: msg.timestamp,
        tipo: 'mensaje',
        contenido: msg
      })),
      
      // Convertir reportes a timeline items
      ...reportes.map((rep): TimelineItem => ({
        id: `rep-${rep.ID}`,
        timestamp: rep.FECHA_REPORTE,
        tipo: 'reporte',
        contenido: rep
      })),
      
      // Convertir registros a timeline items
      ...registros.map((reg): TimelineItem => ({
        id: `reg-${reg.ID}`,
        timestamp: Number(reg.FECHA_EVENTO), // Asumiendo que es timestamp en segundos
        tipo: 'registro',
        contenido: reg
      }))
    ];
    
    // Ordenar por timestamp ascendente
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    setTimeline(items);
    setFilteredTimeline(items); // Inicializar filtrado con todos los items
  }, [mensajes, reportes, registros]);

  useEffect(() => {
    if (isOpen) {
      cargarDatos(false); // Carga inicial con spinner
      
      // Configurar polling para actualizar mensajes cada 3 segundos
      const pollingInterval = setInterval(() => {
        cargarDatos(true); // Actualizaciones silenciosas
      }, 3000);
      
      // Limpiar intervalo al cerrar modal o desmontar componente
      return () => {
        clearInterval(pollingInterval);
      };
    }
  }, [isOpen, cliente.ID]);

  useEffect(() => {
    // Solo hacer scroll automático si el usuario ya estaba en el fondo
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [timeline]);

  // Función de búsqueda en tiempo real
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTimeline(timeline);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = timeline.filter(item => {
      if (item.tipo === 'mensaje') {
        const mensaje = item.contenido as Mensaje | MensajeTemporal;
        return mensaje.mensaje.toLowerCase().includes(query);
      } else if (item.tipo === 'reporte') {
        const reporte = item.contenido as Reporte;
        return (
          reporte.COMENTARIO?.toLowerCase().includes(query) ||
          reporte.ESTADO_ANTERIOR?.toLowerCase().includes(query) ||
          reporte.ESTADO_NUEVO.toLowerCase().includes(query)
        );
      } else if (item.tipo === 'registro') {
        const registro = item.contenido as Registro;
        return registro.TIPO_EVENTO?.toLowerCase().includes(query);
      }
      return false;
    });
    
    setFilteredTimeline(filtered);
  }, [searchQuery, timeline]);

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) {
        setIsLoading(true);
      }
      
      // Cargar mensajes, reportes y registros en paralelo
      const [mensajesData, reportesData, registrosData, quickRepliesData] = await Promise.all([
        apiClient.request<Mensaje[]>(
          `/conversaciones?select=*&id_cliente=eq.${cliente.ID}&order=timestamp.asc`
        ),
        apiClient.request<Reporte[]>(
          `/GERSSON_REPORTES?ID_CLIENTE=eq.${cliente.ID}&order=FECHA_REPORTE.asc`
        ),
        apiClient.request<Registro[]>(
          `/GERSSON_REGISTROS?ID_CLIENTE=eq.${cliente.ID}&order=FECHA_EVENTO.asc`
        ),
        apiClient.request<QuickReply[]>(
          `/chat_quick_replies?id_asesor=eq.${asesor.ID}&activo=eq.true&order=orden.asc`
        )
      ]);
      
      // Solo actualizar si hay datos nuevos o es la carga inicial
      const hayDatosNuevos = 
        mensajesData.length > mensajes.length || 
        reportesData.length > reportes.length || 
        registrosData.length > registros.length;
        
      if (!silencioso || hayDatosNuevos) {
        setMensajes(mensajesData || []);
        setReportes(reportesData || []);
        setRegistros(registrosData || []);
      }
      
      // Siempre actualizar respuestas rápidas
      setQuickReplies(quickRepliesData || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      if (!silencioso) {
        setIsLoading(false);
      }
    }
  };

  const enviarMensajeInterno = async (texto: string) => {
    const timestamp = Math.floor(Date.now() / 1000);
    
    try {
      // NOTA: Los mensajes salientes se guardan en BD desde whatsappEvents.ts
      // después de confirmar el envío exitoso desde Evolution API
      
      // Enviar a Evolution API
      const instance = asesor.NOMBRE;
      const number = cliente.WHATSAPP.replace(/\D/g, '');
      
      const response = await fetch(
        `${evolutionApiUrl}/message/sendText/${encodeURIComponent(instance)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({ number, text: texto }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error enviando mensaje a Evolution API: ${response.status} - ${errorText}`);
      }
      
      // Mensaje enviado exitosamente - se guardará en BD desde whatsappEvents.ts
      setError(null);
      
      // Recargar datos para mostrar el mensaje enviado
      setTimeout(() => {
        cargarDatos(true);
      }, 1000);
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMsg);
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || enviando) return;

    setEnviando(true);
    const texto = nuevoMensaje.trim();
    setNuevoMensaje('');
    
    await enviarMensajeInterno(texto);
    setEnviando(false);
  };

  // Función para usar respuesta rápida
  const usarRespuestaRapida = (texto: string) => {
    setNuevoMensaje(texto);
  };

  // Función para programar mensaje
  const programarMensaje = async () => {
    if (!scheduledMessage.trim() || !scheduledDate || !scheduledTime) return;
    
    try {
      const fechaCompleta = `${scheduledDate}T${scheduledTime}`;
      const timestamp = new Date(fechaCompleta).getTime() / 1000;
      
      const scheduledData = {
        id_asesor: asesor.ID,
        id_cliente: cliente.ID,
        wha_cliente: cliente.WHATSAPP,
        mensaje: scheduledMessage,
        fecha_envio: fechaCompleta,
        estado: 'pendiente'
      };
      
      await apiClient.request('/chat_scheduled_messages', 'POST', scheduledData);
      
      // Limpiar formulario
      setScheduledMessage('');
      setScheduledDate('');
      setScheduledTime('');
      setShowScheduleModal(false);
      
      // Mostrar confirmación
      alert('Mensaje programado exitosamente');
      
    } catch (error) {
      console.error('Error programando mensaje:', error);
      setError('Error al programar mensaje');
    }
  };

  const renderEstadoMensaje = (mensaje: Mensaje) => {
    if (mensaje.modo !== 'saliente') return null;
    
    const estado = mensaje.estado || 'enviado';
    
    switch (estado) {
      case 'enviando':
        return <Clock className="h-3 w-3 text-blue-200 animate-pulse" />;
      case 'enviado':
        return <Check className="h-3 w-3 text-blue-200" />;
      case 'entregado':
        return <CheckCheck className="h-3 w-3 text-blue-200" />;
      case 'leido':
        return <CheckCheck className="h-3 w-3 text-green-200" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-300" />;
      default:
        return null;
    }
  };

  // Renderizar elemento de timeline según su tipo
  const renderTimelineItem = (item: TimelineItem) => {
    switch (item.tipo) {
      case 'mensaje': {
        const mensaje = item.contenido as Mensaje;
        
        return (
          <div
            key={item.id}
            className={`flex ${mensaje.modo === 'saliente' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`relative max-w-[75%] px-4 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-line break-words
                ${mensaje.modo === 'saliente'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-br-md'
                  : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'}
                ${mensaje.estado === 'error' ? 'border-red-300 bg-red-50' : ''}
              `}
            >
              <span className={mensaje.estado === 'error' ? 'text-red-700' : ''}>
                {mensaje.mensaje}
              </span>
              <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${mensaje.modo === 'saliente' ? 'text-blue-100' : 'text-gray-400'}`}>
                <span>{formatChatDate(mensaje.timestamp)}</span>
                {renderEstadoMensaje(mensaje)}
              </div>
            </div>
          </div>
        );
      }
      
      case 'reporte': {
        const reporte = item.contenido as Reporte;
        return (
          <div key={item.id} className="flex justify-center my-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 max-w-[85%] text-center text-sm">
              <div className="flex items-center justify-center mb-1">
                <FileText className="h-4 w-4 text-blue-500 mr-1" />
                <span className="font-medium text-blue-700">
                  {reporte.ESTADO_ANTERIOR} → {reporte.ESTADO_NUEVO}
                </span>
              </div>
              <p className="text-gray-600 text-xs mb-1">{reporte.COMENTARIO}</p>
              <div className="text-xs text-gray-500 flex items-center justify-center">
                <Calendar className="h-3 w-3 mr-1" />
                {formatChatDate(reporte.FECHA_REPORTE)}
              </div>
            </div>
          </div>
        );
      }
      
      case 'registro': {
        const registro = item.contenido as Registro;
        return (
          <div key={item.id} className="flex justify-center my-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 max-w-[85%] text-center text-sm">
              <div className="flex items-center justify-center mb-1">
                <Activity className="h-4 w-4 text-amber-500 mr-1" />
                <span className="font-medium text-amber-700">
                  {registro.TIPO_EVENTO || 'Actividad registrada'}
                </span>
              </div>
              <p className="text-gray-600 text-xs mb-1">{registro.TIPO_EVENTO}</p>
              <div className="text-xs text-gray-500 flex items-center justify-center">
                <Calendar className="h-3 w-3 mr-1" />
                {formatChatDate(Number(registro.FECHA_EVENTO))}
              </div>
            </div>
          </div>
        );
      }
      
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  // Avatar: primera letra del nombre
  const avatarColor = 'bg-gradient-to-br from-blue-400 to-indigo-600';
  const avatar = (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow ${avatarColor}`}>
      {cliente.NOMBRE?.charAt(0).toUpperCase() || '?'}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col border border-gray-200 animate-slideUp">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-100 rounded-t-2xl">
          {/* Información del cliente */}
          <div className="flex items-center gap-4 mb-3">
            {avatar}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{cliente.NOMBRE}</h2>
                <a href={`https://wa.me/${cliente.WHATSAPP.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="Abrir en WhatsApp">
                  <Phone className="h-5 w-5 text-green-500" />
                </a>
              </div>
              <div className="text-xs text-gray-500">{cliente.WHATSAPP}</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>
          
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el chat..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
            />
          </div>
        </div>

        {/* Timeline Container with onScroll handler */}
        <div 
          ref={messageContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
        >
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-2" />
              <p>{searchQuery ? 'No se encontraron resultados' : 'No hay historial de interacción'}</p>
            </div>
          ) : (
            filteredTimeline.map(item => renderTimelineItem(item))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Respuestas Rápidas */}
        {quickReplies.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickReplies.map((reply) => (
                <button
                  key={reply.id}
                  onClick={() => usarRespuestaRapida(reply.texto)}
                  className="px-3 py-1 bg-white border border-blue-200 rounded-full text-sm text-blue-700 hover:bg-blue-50 whitespace-nowrap transition-colors"
                >
                  {reply.texto}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={enviarMensaje} className="p-4 border-t bg-white sticky bottom-0">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>Error: {error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex space-x-2 items-center">
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
              title="Programar mensaje"
            >
              <ClockIcon className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm text-base"
              autoFocus
              disabled={enviando}
            />
            <button
              type="submit"
              disabled={!nuevoMensaje.trim() || enviando}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg flex items-center justify-center"
            >
              {enviando ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .animate-fadeIn { animation: fadeIn 0.2s; }
        .animate-slideUp { animation: slideUp 0.3s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Modal para Programar Mensaje */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Programar Mensaje</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje
                </label>
                <textarea
                  value={scheduledMessage}
                  onChange={(e) => setScheduledMessage(e.target.value)}
                  placeholder="Escribe el mensaje que quieres programar..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={programarMensaje}
                  disabled={!scheduledMessage.trim() || !scheduledDate || !scheduledTime}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Programar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 