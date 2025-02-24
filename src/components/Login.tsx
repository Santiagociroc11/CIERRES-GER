import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Asesor } from '../types';
import { UserCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (asesor: Asesor, isAdmin: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Verificar si ya existe una sesión persistida al montar el componente
  useEffect(() => {
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      try {
        const { asesor, isAdmin } = JSON.parse(sessionData);
        onLogin(asesor, isAdmin);
      } catch (err) {
        console.error('Error al parsear la sesión:', err);
        localStorage.removeItem('userSession');
      }
    }
  }, [onLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Primero verificar si es un administrador
      const { data: adminData, error: adminError } = await supabase
        .from('gersson_admins')
        .select('*')
        .eq('whatsapp', whatsapp)
        .single();

      if (adminError && adminError.code !== 'PGRST116') {
        console.log('Error al buscar admin:', adminError);
      }

      if (adminData) {
        const adminUser: Asesor = {
          ID: adminData.id,
          NOMBRE: adminData.nombre,
          WHATSAPP: adminData.whatsapp,
          LINK: 0,
          RECHAZADOS: 0,
          CARRITOS: 0,
          TICKETS: 0,
          ES_ADMIN: true
        };
        // Guardar sesión en localStorage
        localStorage.setItem('userSession', JSON.stringify({ asesor: adminUser, isAdmin: true }));
        onLogin(adminUser, true);
        return;
      }

      // Si no es admin, verificar si es asesor
      const { data: asesorData, error: asesorError } = await supabase
        .from('GERSSON_ASESORES')
        .select('*')
        .eq('WHATSAPP', whatsapp)
        .single();

      if (asesorError && asesorError.code !== 'PGRST116') {
        console.log('Error al buscar asesor:', asesorError);
      }

      if (!asesorData) {
        setError('Usuario no encontrado');
        return;
      }

      // Guardar sesión en localStorage
      localStorage.setItem('userSession', JSON.stringify({ asesor: asesorData, isAdmin: false }));
      onLogin(asesorData, false);
    } catch (err) {
      console.error('Error completo:', err);
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Limpiar el número de WhatsApp
    value = value.replace(/\D/g, '');
    setWhatsapp(value);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <UserCheck className="mx-auto h-12 w-12 text-blue-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Acceso al Sistema
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa con tu número de WhatsApp
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
              Número de WhatsApp
            </label>
            <div className="mt-1">
              <input
                id="whatsapp"
                name="whatsapp"
                type="text"
                required
                value={whatsapp}
                onChange={handleWhatsAppChange}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Solo números, sin espacios ni símbolos"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
