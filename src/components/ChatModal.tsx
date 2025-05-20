import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Phone, FileText, Calendar, Activity } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Reporte, Registro } from '../types';

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

interface Mensaje {
  id: number;
  id_asesor: number;
  id_cliente: number;
  wha_cliente: string;
  modo: 'entrante' | 'saliente';
  timestamp: number;
  mensaje: string;
}

// Tipo unificado para los elementos del timeline
type TimelineItem = {
  id: string;
  timestamp: number;
  tipo: 'mensaje' | 'reporte' | 'registro';
  contenido: Mensaje | Reporte | Registro;
};

export default function ChatModal({ isOpen, onClose, cliente, asesor }: ChatModalProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
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
      // Convertir mensajes a timeline items
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

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) {
        setIsLoading(true);
      }
      
      // Cargar mensajes, reportes y registros en paralelo
      const [mensajesData, reportesData, registrosData] = await Promise.all([
        apiClient.request<Mensaje[]>(
          `/conversaciones?select=*&or=(id_cliente.eq.${cliente.ID},wha_cliente.ilike.*${cliente.WHATSAPP.slice(-7)}*)&order=timestamp.asc`
        ),
        apiClient.request<Reporte[]>(
          `/GERSSON_REPORTES?ID_CLIENTE=eq.${cliente.ID}&order=FECHA_REPORTE.asc`
        ),
        apiClient.request<Registro[]>(
          `/GERSSON_REGISTROS?ID_CLIENTE=eq.${cliente.ID}&order=FECHA_EVENTO.asc`
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
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      if (!silencioso) {
        setIsLoading(false);
      }
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    try {
      // 1. Guardar en la base de datos
      const mensajeData = {
        id_asesor: asesor.ID,
        id_cliente: cliente.ID,
        wha_cliente: cliente.WHATSAPP,
        modo: 'saliente' as const,
        timestamp: Math.floor(Date.now() / 1000),
        mensaje: nuevoMensaje.trim()
      };
      await apiClient.request('/conversaciones', 'POST', mensajeData);

      // 2. Enviar a Evolution API
      const instance = asesor.NOMBRE;
      const number = cliente.WHATSAPP.replace(/\D/g, ''); // Solo dígitos
      const text = nuevoMensaje.trim();

      const response = await fetch(
        `${evolutionApiUrl}/message/sendText/${encodeURIComponent(instance)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({ number, text }),
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error enviando mensaje a Evolution API: ${response.status} - ${errorText}`);
      }

      setNuevoMensaje('');
      await cargarDatos(true);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      // Aquí puedes mostrar un toast o alerta al usuario si quieres
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
              `}
            >
              <span>{mensaje.mensaje}</span>
              <span className={`block text-xs mt-1 text-right ${mensaje.modo === 'saliente' ? 'text-blue-100' : 'text-gray-400'}`}>
                {formatChatDate(mensaje.timestamp)}
              </span>
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
              <p className="text-gray-600 text-xs mb-1">{registro.DESCRIPCION}</p>
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
        <div className="p-4 border-b flex items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-100 rounded-t-2xl">
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
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-2" />
              <p>No hay historial de interacción</p>
            </div>
          ) : (
            timeline.map(item => renderTimelineItem(item))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={enviarMensaje} className="p-4 border-t bg-white sticky bottom-0">
          <div className="flex space-x-2 items-center">
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm text-base"
              autoFocus
            />
            <button
              type="submit"
              disabled={!nuevoMensaje.trim()}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              <Send className="h-5 w-5" />
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
    </div>
  );
} 