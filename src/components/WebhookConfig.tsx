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
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Collapse
} from '@mui/material';
import { Refresh, Save, RestoreFromTrash, Wifi, Search, Send, PersonAdd, Email, Telegram } from '@mui/icons-material';
import { toast } from 'react-hot-toast';

interface HotmartConfig {
  numericos: {
    CARRITOS: string;
    RECHAZADOS: string;
    COMPRAS: string;
    TICKETS: string;
  };
  flodesk: {
    CARRITOS: string;
    RECHAZADOS: string;
    COMPRAS: string;
    TICKETS: string;
  };
  tokens: {
    manychat: string;
    flodesk: string;
    telegram: string;
  };
  telegram: {
    groupChatId: string;
    threadId: string;
  };
}

interface Advisor {
  ID: number;
  NOMBRE: string;
  ID_TG: string;
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
  const [testing, setTesting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Individual testing states
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [testStates, setTestStates] = useState({
    manychat: { loading: false, phoneNumber: '', result: null as any },
    flodesk: { loading: false, email: '', segmentId: 'COMPRAS', result: null as any },
    telegram: { loading: false, advisorId: '', messageType: 'test', clientName: '', result: null as any }
  });
  const [showTestSections, setShowTestSections] = useState(false);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfig();
  }, []);

  // Cargar asesores con Telegram cuando se muestren las secciones de test
  useEffect(() => {
    if (showTestSections) {
      loadAdvisors();
    }
  }, [showTestSections]);

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

  const loadAdvisors = async () => {
    try {
      const response = await fetch('/api/hotmart/advisors-with-telegram');
      const data = await response.json();
      
      if (data.success) {
        setAdvisors(data.data);
      } else {
        throw new Error(data.error || 'Error cargando asesores');
      }
    } catch (error) {
      console.error('Error cargando asesores:', error);
      toast.error('Error cargando asesores');
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

  const handleConfigChange = (section: 'numericos' | 'flodesk', flujo: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [flujo]: value
      }
    });
  };

  const handleTokenChange = (tokenType: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      tokens: {
        ...config.tokens,
        [tokenType]: value
      }
    });
  };

  const handleTelegramChange = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      telegram: {
        ...config.telegram,
        [field]: value
      }
    });
  };

  const testConnections = async () => {
    if (!config) return;
    
    try {
      setTesting(true);
      const response = await fetch('/api/hotmart/test-connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        const results = data.data;
        let message = 'Resultados de conexión:\n';
        
        Object.entries(results).forEach(([service, result]: [string, any]) => {
          const status = result.status === 'success' ? '✅' : 
                        result.status === 'warning' ? '⚠️' : '❌';
          message += `${status} ${service.toUpperCase()}: ${result.message}\n`;
        });
        
        toast.success('Pruebas de conexión completadas');
        alert(message);
      } else {
        throw new Error(data.error || 'Error probando conexiones');
      }
    } catch (error) {
      console.error('Error probando conexiones:', error);
      toast.error('Error probando conexiones');
    } finally {
      setTesting(false);
    }
  };

  // Individual test functions
  const testManyChat = async (action: 'search' | 'create' | 'sendFlow') => {
    const phoneNumber = testStates.manychat.phoneNumber;
    if (!phoneNumber.trim()) {
      toast.error('Por favor ingresa un número de teléfono');
      return;
    }

    // Para sendFlow, necesitamos subscriber ID y flow ID
    if (action === 'sendFlow') {
      const subscriberId = prompt('Ingresa el Subscriber ID:');
      const flowId = prompt('Ingresa el Flow ID:');
      
      if (!subscriberId || !flowId) {
        toast.error('Subscriber ID y Flow ID son requeridos para enviar flujo');
        return;
      }
      
      // Actualizar el body con los parámetros adicionales
      const body = { phoneNumber, action, subscriberId, flowId };
    }

    setTestStates(prev => ({
      ...prev,
      manychat: { ...prev.manychat, loading: true, result: null as any }
    }));

    try {
      let body: any = { phoneNumber, action };
      
      // Para sendFlow, agregar parámetros adicionales
      if (action === 'sendFlow') {
        const subscriberId = prompt('Ingresa el Subscriber ID:');
        const flowId = prompt('Ingresa el Flow ID:');
        
        if (!subscriberId || !flowId) {
          toast.error('Subscriber ID y Flow ID son requeridos para enviar flujo');
          return;
        }
        
        body = { phoneNumber, action, subscriberId, flowId };
      }

      const response = await fetch('/api/hotmart/test-manychat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      setTestStates(prev => ({
        ...prev,
        manychat: { ...prev.manychat, result: data }
      }));

      if (data.success) {
        toast.success(`Prueba ManyChat (${action}) completada exitosamente`);
      } else {
        toast.error(`Error en prueba ManyChat: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing ManyChat:', error);
      toast.error('Error probando ManyChat');
      setTestStates(prev => ({
        ...prev,
        manychat: { ...prev.manychat, result: { success: false, error: 'Error de conexión' } }
      }));
    } finally {
      setTestStates(prev => ({
        ...prev,
        manychat: { ...prev.manychat, loading: false }
      }));
    }
  };

  const testFlodesk = async () => {
    const { email, segmentId } = testStates.flodesk;
    if (!email.trim()) {
      toast.error('Por favor ingresa un email');
      return;
    }

    setTestStates(prev => ({
      ...prev,
      flodesk: { ...prev.flodesk, loading: true, result: null as any }
    }));

    try {
      const response = await fetch('/api/hotmart/test-flodesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, segmentId })
      });

      const data = await response.json();
      
      setTestStates(prev => ({
        ...prev,
        flodesk: { ...prev.flodesk, result: data }
      }));

      if (data.success) {
        toast.success('Prueba Flodesk completada exitosamente');
      } else {
        toast.error(`Error en prueba Flodesk: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing Flodesk:', error);
      toast.error('Error probando Flodesk');
      setTestStates(prev => ({
        ...prev,
        flodesk: { ...prev.flodesk, result: { success: false, error: 'Error de conexión' } }
      }));
    } finally {
      setTestStates(prev => ({
        ...prev,
        flodesk: { ...prev.flodesk, loading: false }
      }));
    }
  };

  const testTelegram = async () => {
    const { advisorId, messageType, clientName } = testStates.telegram;
    if (!advisorId) {
      toast.error('Por favor selecciona un asesor');
      return;
    }

    setTestStates(prev => ({
      ...prev,
      telegram: { ...prev.telegram, loading: true, result: null as any }
    }));

    try {
      const response = await fetch('/api/hotmart/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          advisorId: parseInt(advisorId), 
          messageType,
          clientName: clientName || 'Cliente de Prueba',
          clientPhone: '57300000000' // Número por defecto para pruebas
        })
      });

      const data = await response.json();
      
      setTestStates(prev => ({
        ...prev,
        telegram: { ...prev.telegram, result: data }
      }));

      if (data.success) {
        toast.success('Prueba Telegram completada exitosamente');
      } else {
        toast.error(`Error en prueba Telegram: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing Telegram:', error);
      toast.error('Error probando Telegram');
      setTestStates(prev => ({
        ...prev,
        telegram: { ...prev.telegram, result: { success: false, error: 'Error de conexión' } }
      }));
    } finally {
      setTestStates(prev => ({
        ...prev,
        telegram: { ...prev.telegram, loading: false }
      }));
    }
  };

  const updateTestState = (service: 'manychat' | 'flodesk' | 'telegram', field: string, value: string) => {
    setTestStates(prev => ({
      ...prev,
      [service]: { ...prev[service], [field]: value }
    }));
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
        Configura los IDs de flujo, segmentos y tokens de API para la integración completa de Hotmart con ManyChat, Flodesk y Telegram.
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

          {/* Flodesk */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            <Chip label="Flodesk" color="secondary" size="small" sx={{ mr: 1 }} />
            IDs de Segmento
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(config.flodesk).map(([flujo, value]) => (
              <Grid item xs={12} sm={6} md={3} key={`flodesk-${flujo}`}>
                <TextField
                  fullWidth
                  label={FLUJO_LABELS[flujo as keyof typeof FLUJO_LABELS]}
                  value={value}
                  onChange={(e) => handleConfigChange('flodesk', flujo, e.target.value)}
                  size="small"
                  helperText={`Segmento: ${flujo}`}
                />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Tokens de API */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            <Chip label="Tokens API" color="warning" size="small" sx={{ mr: 1 }} />
            Configuración de Tokens
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="ManyChat Token"
                value={config.tokens.manychat}
                onChange={(e) => handleTokenChange('manychat', e.target.value)}
                size="small"
                helperText="Token de autenticación para ManyChat API"
                type="password"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Flodesk Token"
                value={config.tokens.flodesk}
                onChange={(e) => handleTokenChange('flodesk', e.target.value)}
                size="small"
                helperText="Token de autenticación para Flodesk API"
                type="password"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Telegram Bot Token"
                value={config.tokens.telegram}
                onChange={(e) => handleTokenChange('telegram', e.target.value)}
                size="small"
                helperText="Token del bot de Telegram"
                type="password"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Configuración de Telegram */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            <Chip label="Telegram Config" color="info" size="small" sx={{ mr: 1 }} />
            Configuración de Grupo
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="ID del Grupo/Chat"
                value={config.telegram.groupChatId}
                onChange={(e) => handleTelegramChange('groupChatId', e.target.value)}
                size="small"
                helperText="ID del grupo de Telegram donde se envían las notificaciones de venta (ej: -1002176532359)"
                placeholder="-1002176532359"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Thread ID"
                value={config.telegram.threadId}
                onChange={(e) => handleTelegramChange('threadId', e.target.value)}
                size="small"
                helperText="ID del hilo/tema específico dentro del grupo (ej: 807)"
                placeholder="807"
                type="number"
              />
            </Grid>
          </Grid>

          <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                onClick={testConnections}
                disabled={testing}
                startIcon={<Wifi />}
                size="large"
              >
                {testing ? 'Probando...' : 'Probar Conexiones'}
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => setShowTestSections(!showTestSections)}
                size="large"
              >
                {showTestSections ? 'Ocultar Tests Individuales' : 'Mostrar Tests Individuales'}
              </Button>
            </Box>
            
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

      {/* Secciones de Test Individuales */}
      <Collapse in={showTestSections}>
        <Box mt={3}>
          {/* Test ManyChat */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Chip label="ManyChat" color="primary" size="small" sx={{ mr: 1 }} />
                Test Individual
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Número de Teléfono"
                    value={testStates.manychat.phoneNumber}
                    onChange={(e) => updateTestState('manychat', 'phoneNumber', e.target.value)}
                    placeholder="57300000000"
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      onClick={() => testManyChat('search')}
                      disabled={testStates.manychat.loading}
                      startIcon={<Search />}
                      size="small"
                    >
                      Buscar
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => testManyChat('create')}
                      disabled={testStates.manychat.loading}
                      startIcon={<PersonAdd />}
                      size="small"
                    >
                      Crear
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => testManyChat('sendFlow')}
                      disabled={testStates.manychat.loading}
                      startIcon={<Send />}
                      size="small"
                    >
                      Enviar Flujo
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              {/* Resultado del test */}
              {testStates.manychat.result && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Resultado:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: testStates.manychat.result.success ? 'success.light' : 'error.light',
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto'
                    }}
                  >
                    {JSON.stringify(testStates.manychat.result, null, 2)}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Test Flodesk */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Chip label="Flodesk" color="secondary" size="small" sx={{ mr: 1 }} />
                Test Individual
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={testStates.flodesk.email}
                    onChange={(e) => updateTestState('flodesk', 'email', e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    size="small"
                    type="email"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Segmento</InputLabel>
                    <Select
                      value={testStates.flodesk.segmentId}
                      onChange={(e) => updateTestState('flodesk', 'segmentId', e.target.value)}
                      label="Segmento"
                    >
                      {Object.entries(FLUJO_LABELS).map(([key, label]) => (
                        <MenuItem key={key} value={key}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    onClick={testFlodesk}
                    disabled={testStates.flodesk.loading}
                    startIcon={<Email />}
                    fullWidth
                    size="small"
                  >
                    {testStates.flodesk.loading ? 'Probando...' : 'Probar Flodesk'}
                  </Button>
                </Grid>
              </Grid>

              {/* Resultado del test */}
              {testStates.flodesk.result && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Resultado:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: testStates.flodesk.result.success ? 'success.light' : 'error.light',
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto'
                    }}
                  >
                    {JSON.stringify(testStates.flodesk.result, null, 2)}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Test Telegram */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Chip label="Telegram" color="info" size="small" sx={{ mr: 1 }} />
                Test Individual
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Asesor</InputLabel>
                    <Select
                      value={testStates.telegram.advisorId}
                      onChange={(e) => updateTestState('telegram', 'advisorId', e.target.value)}
                      label="Asesor"
                    >
                      <MenuItem value="">
                        <em>Seleccionar asesor</em>
                      </MenuItem>
                      {advisors.map((advisor) => (
                        <MenuItem key={advisor.ID} value={advisor.ID}>
                          {advisor.NOMBRE}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo de Mensaje</InputLabel>
                    <Select
                      value={testStates.telegram.messageType}
                      onChange={(e) => updateTestState('telegram', 'messageType', e.target.value)}
                      label="Tipo de Mensaje"
                    >
                      <MenuItem value="test">Mensaje de Prueba</MenuItem>
                      <MenuItem value="venta">Notificación de Venta</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Nombre Cliente (opcional)"
                    placeholder="Cliente de Prueba"
                    size="small"
                    onChange={(e) => updateTestState('telegram', 'clientName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    variant="outlined"
                    onClick={testTelegram}
                    disabled={testStates.telegram.loading}
                    startIcon={<Telegram />}
                    fullWidth
                    size="small"
                  >
                    {testStates.telegram.loading ? 'Probando...' : 'Probar Telegram'}
                  </Button>
                </Grid>
              </Grid>

              {/* Resultado del test */}
              {testStates.telegram.result && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Resultado:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: testStates.telegram.result.success ? 'success.light' : 'error.light',
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto'
                    }}
                  >
                    {JSON.stringify(testStates.telegram.result, null, 2)}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Collapse>

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
