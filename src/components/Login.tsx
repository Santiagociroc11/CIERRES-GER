import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { Asesor } from '../types';
import { UserCheck, Lock } from 'lucide-react';
import AuditorLogin from './AuditorLogin';

interface LoginProps {
  onLogin: (asesor: Asesor, isAdmin: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuditor, setShowAuditor] = useState(false);

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
      const admins = await apiClient.request<any[]>(
        `/gersson_admins?whatsapp=eq.${whatsapp}&select=*`
      );

      if (admins && admins.length > 0) {
        const adminData = admins[0];
        const adminUser: Asesor = {
          ID: adminData.id,
          NOMBRE: adminData.nombre,
          WHATSAPP: adminData.whatsapp,
          LINK: 0,
          RECHAZADOS: 0,
          CARRITOS: 0,
          TICKETS: 0,
          ES_ADMIN: true,
        };
        localStorage.setItem('userSession', JSON.stringify({ asesor: adminUser, isAdmin: true }));
        onLogin(adminUser, true);
        return;
      }

      const asesores = await apiClient.request<Asesor[]>(
        `/GERSSON_ASESORES?WHATSAPP=eq.${whatsapp}&select=*`
      );

      if (!asesores || asesores.length === 0) {
        setError('Usuario no encontrado');
        return;
      }

      const asesorData = asesores[0];
      localStorage.setItem('userSession', JSON.stringify({ asesor: asesorData, isAdmin: false }));
      onLogin(asesorData, false);
    } catch (err: any) {
      console.error('Error en login:', err);
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setWhatsapp(value);
  };

  if (showAuditor) {
    return (
      <AuditorLogin 
        onLogin={() => {
          const auditorUser: Asesor = {
            ID: 0,
            NOMBRE: 'Auditor',
            WHATSAPP: '',
            LINK: 0,
            RECHAZADOS: 0,
            CARRITOS: 0,
            TICKETS: 0,
            ES_ADMIN: true,
            ES_REVISOR: true,
          };
          localStorage.setItem('userSession', JSON.stringify({ asesor: auditorUser, isAdmin: true }));
          onLogin(auditorUser, true);
        }}
      />
    );
  }

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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">o</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAuditor(true)}
            className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-600 bg-purple-50 hover:bg-purple-100"
          >
            <Lock className="h-4 w-4 mr-2" />
            Acceso de Auditor
          </button>
        </form>
      </div>
    </div>
  );
}