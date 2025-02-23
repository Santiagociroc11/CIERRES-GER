import React, { useState } from 'react';
import DashboardAsesor from './components/DashboardAsesor';
import DashboardAdmin from './components/DashboardAdmin';
import Login from './components/Login';
import { Asesor } from './types';
import { supabase } from './lib/supabase';

function App() {
  const [asesorActual, setAsesorActual] = useState<Asesor | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLogin = async (asesor: Asesor) => {
    try {
      // Verificar si el asesor es administrador
      const { data: adminData, error: adminError } = await supabase
        .from('GERSSON_ASESORES')
        .select('ES_ADMIN')
        .eq('ID', asesor.ID)
        .single();

      if (adminError) throw adminError;

      setIsAdmin(adminData?.ES_ADMIN || false);
      setAsesorActual(asesor);
    } catch (error) {
      console.error('Error al verificar rol de administrador:', error);
      // Si hay un error, asumimos que no es admin por seguridad
      setIsAdmin(false);
      setAsesorActual(asesor);
    }
  };

  if (!asesorActual) {
    return <Login onLogin={handleLogin} />;
  }

  return isAdmin ? (
    <DashboardAdmin onLogout={() => setAsesorActual(null)} />
  ) : (
    <DashboardAsesor asesorInicial={asesorActual} onLogout={() => setAsesorActual(null)} />
  );
}

export default App;