import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { apiClient } from '../lib/apiClient';

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

export default function ChatModal({ isOpen, onClose, cliente, asesor }: ChatModalProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      cargarMensajes();
    }
  }, [isOpen, cliente.ID]);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const cargarMensajes = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.request<Mensaje[]>(
        `/conversaciones?select=*&or=(id_cliente.eq.${cliente.ID},wha_cliente.ilike.*${cliente.WHATSAPP.slice(-7)}*)&order=timestamp.asc`
      );
      setMensajes(response || []);
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    try {
      const mensajeData = {
        id_asesor: asesor.ID,
        id_cliente: cliente.ID,
        wha_cliente: cliente.WHATSAPP,
        modo: 'saliente' as const,
        timestamp: Math.floor(Date.now() / 1000),
        mensaje: nuevoMensaje.trim()
      };

      await apiClient.request('/conversaciones', 'POST', mensajeData);
      setNuevoMensaje('');
      await cargarMensajes();
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{cliente.NOMBRE}</h2>
              <p className="text-sm text-gray-500">{cliente.WHATSAPP}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-2" />
              <p>No hay historial de conversación</p>
            </div>
          ) : (
            mensajes.map((mensaje) => (
              <div
                key={mensaje.id}
                className={`flex ${mensaje.modo === 'saliente' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    mensaje.modo === 'saliente'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{mensaje.mensaje}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(mensaje.timestamp * 1000).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={enviarMensaje} className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!nuevoMensaje.trim()}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 