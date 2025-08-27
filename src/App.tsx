import React, { useState } from 'react';
import DashboardAsesor from './components/DashboardAsesor';
import DashboardAdmin from './components/DashboardAdmin';
import AuditorDashboard from './components/AuditorDashboard';
import Login from './components/Login';
import { Asesor, AdminRole } from './types';
import { apiClient } from './lib/apiClient';
import { Toaster } from 'react-hot-toast';

function App() {
  const [asesorActual, setAsesorActual] = useState<Asesor | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>('admin');

  const handleLogin = async (asesor: Asesor, isAdmin: boolean, adminRole?: AdminRole) => {
    setAsesorActual(asesor);
    setIsAdmin(isAdmin);
    setAdminRole(adminRole || 'admin');
  };

  return (
    <>
      {/* Configuración del Toaster para toda la aplicación */}
      <Toaster
        position="top-right"
        toastOptions={{
          success: {
            duration: 3000,
            style: {
              background: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
            },
          },
          error: {
            duration: 4000,
            style: {
              background: '#FEF2F2',
              color: '#B91C1C',
              border: '1px solid #FECACA',
            },
          },
        }}
      />

      {!asesorActual ? (
        <Login onLogin={handleLogin} />
      ) : asesorActual.ES_REVISOR ? (
        <AuditorDashboard />
      ) : isAdmin ? (
        <DashboardAdmin asesor={asesorActual} adminRole={adminRole} onLogout={() => setAsesorActual(null)} />
      ) : (
        <DashboardAsesor asesorInicial={asesorActual} onLogout={() => setAsesorActual(null)} />
      )}
    </>
  );
}

export default App;