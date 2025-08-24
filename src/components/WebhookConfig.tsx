import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Snackbar,
  Divider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Refresh, Save, RestoreFromTrash } from '@mui/icons-material';
import { toast } from 'react-hot-toast';

interface HotmartConfig {
  numericos: {
    CARRITOS: string;
    RECHAZADOS: string;
    COMPRAS: string;
    TICKETS: string;
  };
  mailer: {
    CARRITOS: string;
    RECHAZADOS: string;
    COMPRAS: string;
    TICKETS: string;
  };
  tablas: {
    CARRITOS: string;
    RECHAZADOS: string;
    COMPRAS: string;
    TICKETS: string;
  };
}

const FLUJO_LABELS = {
  CARRITOS: 'Carritos Abandonados',
  RECHAZADOS: 'Pagos Rechazados',
  COMPRAS: 'Compras Aprobadas',
  TICKETS: 'Tickets Impresos'
};

const WebhookConfig: React.FC = () => {
  const [config, setConfig] = useState<HotmartConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hotmart/config');
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.data);
      } else {
        throw new Error(data.error || 'Error cargando configuración');
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      toast.error('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/hotmart/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Configuración guardada exitosamente');
        setSnackbar({
          open: true,
          message: 'Configuración guardada exitosamente',
          severity: 'success'
        });
      } else {
        throw new Error(data.error || 'Error guardando configuración');
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error('Error guardando configuración');
      setSnackbar({
        open: true,
        message: 'Error guardando configuración',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!window.confirm('¿Estás seguro de que quieres resetear la configuración a los valores por defecto?')) {
      return;
    }
    
    try {
      setSaving(true);
      const response = await fetch('/api/hotmart/config/reset', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.data);
        toast.success('Configuración reseteada exitosamente');
        setSnackbar({
          open: true,
          message: 'Configuración reseteada exitosamente',
          severity: 'success'
        });
      } else {
        throw new Error(data.error || 'Error reseteando configuración');
      }
    } catch (error) {
      console.error('Error reseteando configuración:', error);
      toast.error('Error reseteando configuración');
      setSnackbar({
        open: true,
        message: 'Error reseteando configuración',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (section: keyof HotmartConfig, flujo: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [flujo]: value
      }
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Cargando configuración...</Typography>
      </Box>
    );
  }

  if (!config) {
    return (
      <Alert severity="error">
        No se pudo cargar la configuración. Intenta recargar la página.
      </Alert>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Configuración de Webhooks
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Configura los valores para ManyChat, MailerLite y tablas de seguimiento para cada flujo de Hotmart.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Configuración de Hotmart
            </Typography>
            <Box>
              <Tooltip title="Recargar configuración">
                <IconButton onClick={loadConfig} disabled={loading}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Tooltip title="Resetear a valores por defecto">
                <IconButton onClick={resetConfig} disabled={saving} color="warning">
                  <RestoreFromTrash />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* ManyChat (Numericos) */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
            <Chip label="ManyChat" color="primary" size="small" sx={{ mr: 1 }} />
            IDs de Flujo
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(config.numericos).map(([flujo, value]) => (
              <Grid item xs={12} sm={6} md={3} key={`numericos-${flujo}`}>
                <TextField
                  fullWidth
                  label={FLUJO_LABELS[flujo as keyof typeof FLUJO_LABELS]}
                  value={value}
                  onChange={(e) => handleConfigChange('numericos', flujo, e.target.value)}
                  size="small"
                  helperText={`ID: ${flujo}`}
                />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* MailerLite */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            <Chip label="MailerLite" color="secondary" size="small" sx={{ mr: 1 }} />
            IDs de Grupo
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(config.mailer).map(([flujo, value]) => (
              <Grid item xs={12} sm={6} md={3} key={`mailer-${flujo}`}>
                <TextField
                  fullWidth
                  label={FLUJO_LABELS[flujo as keyof typeof FLUJO_LABELS]}
                  value={value}
                  onChange={(e) => handleConfigChange('mailer', flujo, e.target.value)}
                  size="small"
                  helperText={`Grupo: ${flujo}`}
                />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Tablas de Seguimiento */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            <Chip label="Base de Datos" color="success" size="small" sx={{ mr: 1 }} />
            Tablas de Seguimiento
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(config.tablas).map(([flujo, value]) => (
              <Grid item xs={12} sm={6} md={3} key={`tablas-${flujo}`}>
                <TextField
                  fullWidth
                  label={FLUJO_LABELS[flujo as keyof typeof FLUJO_LABELS]}
                  value={value}
                  onChange={(e) => handleConfigChange('tablas', flujo, e.target.value)}
                  size="small"
                  helperText={`Tabla: ${flujo}`}
                />
              </Grid>
            ))}
          </Grid>

          <Box display="flex" justifyContent="flex-end" mt={3}>
            <Button
              variant="contained"
              onClick={saveConfig}
              disabled={saving}
              startIcon={<Save />}
              size="large"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Información de Webhook
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            URL del webhook para configurar en Hotmart:
          </Typography>
          <Box
            component="code"
            sx={{
              display: 'block',
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
          >
            {window.location.origin}/api/hotmart/webhook
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WebhookConfig;
