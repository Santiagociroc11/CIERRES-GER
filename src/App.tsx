import React, { useState } from 'react';
import DashboardAsesor from './components/DashboardAsesor';
import DashboardAdmin from './components/DashboardAdmin';
import AuditorDashboard from './components/AuditorDashboard';
import Login from './components/Login';
import { Asesor } from './types';
import { apiClient } from './lib/apiClient';

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

  if (asesorActual.ES_REVISOR) {
    return (
      <AuditorDashboard />
    );
  }

  return isAdmin ? (
    <DashboardAdmin asesor={asesorActual} onLogout={() => setAsesorActual(null)} />
  ) : (
    <DashboardAsesor asesorInicial={asesorActual} onLogout={() => setAsesorActual(null)} />
  );
}

export default App;