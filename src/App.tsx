import React, { useState } from 'react';
import DashboardAsesor from './components/DashboardAsesor';
import DashboardAdmin from './components/DashboardAdmin';
import Login from './components/Login';
import { Asesor } from './types';
import { supabase } from './lib/supabase';

function App() {
  const [asesorActual, setAsesorActual] = useState<Asesor | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLogin = async (asesor: Asesor, isAdmin: boolean) => {
    setAsesorActual(asesor);
    setIsAdmin(isAdmin);
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