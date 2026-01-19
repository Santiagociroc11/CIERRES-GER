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
    botName?: string;
    botUsername?: string;
  };
  api?: {
    client_id: string;
    client_secret: string;
  };
}

interface SoporteConfig {
  phoneNumbers: {
    academySupport: string;
  };
  pageConfig?: {
    title?: string;
    subtitle?: string;
    primaryColor?: string;
  };
}

interface PagosExternosConfig {
  telegram: {
    groupChatId: string;
    threadId: string;
  };
}

interface Advisor {
  id: number;
  nombre: string;
  telegramId: string;
  whatsapp: string;
}

const FLUJO_LABELS = {
  CARRITOS: 'Carritos Abandonados',
  RECHAZADOS: 'Pagos Rechazados',
  COMPRAS: 'Compras Aprobadas',
  TICKETS: 'Tickets Impresos'
};

const WebhookConfig: React.FC = () => {
  console.log('Componente WebhookConfig renderizando...');
  const [config, setConfig] = useState<HotmartConfig | null>(null);
  const [soporteConfig, setSoporteConfig] = useState<SoporteConfig | null>(null);
  const [pagosExternosConfig, setPagosExternosConfig] = useState<PagosExternosConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [soporteLoading, setSoporteLoading] = useState(true);
  const [pagosExternosLoading, setPagosExternosLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [soporteSaving, setSoporteSaving] = useState(false);
  const [pagosExternosSaving, setPagosExternosSaving] = useState(false);
  const [pagosExternosTesting, setPagosExternosTesting] = useState(false);
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
  const [advisorsLoading, setAdvisorsLoading] = useState(false);
  const [testStates, setTestStates] = useState({
    manychat: { loading: false, phoneNumber: '', result: null as any },
    flodesk: { loading: false, email: '', segmentId: 'COMPRAS', result: null as any },
    telegram: { loading: false, advisorId: '', messageType: 'test', clientName: '', result: null as any }
  });
  const [showTestSections, setShowTestSections] = useState(false);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfig();
    loadSoporteConfig();
    loadPagosExternosConfig();
  }, []);

  // Cargar asesores con Telegram cuando se muestren las secciones de test
  useEffect(() => {
    console.log('useEffect showTestSections:', showTestSections, 'advisors.length:', advisors.length);
    if (showTestSections && advisors.length === 0) {
      console.log('Ejecutando loadAdvisors...');
      loadAdvisors();
    }
  }, [showTestSections, advisors.length]);

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

  const loadSoporteConfig = async () => {
    try {
      setSoporteLoading(true);
      const response = await fetch('/api/soporte/config');
      const data = await response.json();
      
      if (data.success) {
        setSoporteConfig(data.data);
      } else {
        throw new Error(data.error || 'Error cargando configuración de soporte');
      }
    } catch (error) {
      console.error('Error cargando configuración de soporte:', error);
      // Inicializar configuración vacía si no existe
      setSoporteConfig({
        phoneNumbers: {
          academySupport: ''
        },
        pageConfig: {
          title: 'SOPORTE GERSSON LOPEZ',
          subtitle: 'Antes de ingresar al chat con el asesor, proporciona estos datos para que te podamos atender rápidamente.',
          primaryColor: '#007AFF'
        }
      });
    } finally {
      setSoporteLoading(false);
    }
  };

  const loadPagosExternosConfig = async () => {
    try {
      setPagosExternosLoading(true);
      const response = await fetch('/api/pagos-externos/config');
      const data = await response.json();
      
      if (data.success) {
        setPagosExternosConfig(data.data);
      } else {
        throw new Error(data.error || 'Error cargando configuración de pagos externos');
      }
    } catch (error) {
      console.error('Error cargando configuración de pagos externos:', error);
      // Inicializar configuración vacía si no existe
      setPagosExternosConfig({
        telegram: {
          groupChatId: '',
          threadId: ''
        }
      });
    } finally {
      setPagosExternosLoading(false);
    }
  };

  const loadAdvisors = async () => {
    try {
      setAdvisorsLoading(true);
      console.log('Cargando asesores...');
      
      const response = await fetch('/api/hotmart/advisors-with-telegram');
      const data = await response.json();
      
      console.log('Respuesta de asesores:', data);
      
      if (data.success) {
        console.log('Antes de setAdvisors, advisors.length:', advisors.length);
        setAdvisors(data.data || []);
        console.log('Después de setAdvisors, data.data:', data.data);
        console.log('Asesores cargados:', data.data);
        if (data.data && data.data.length > 0) {
          toast.success(`${data.data.length} asesores cargados`);
        } else {
          toast('No se encontraron asesores con Telegram configurado', { icon: 'ℹ️' });
        }
      } else {
        throw new Error(data.error || 'Error cargando asesores');
      }
    } catch (error) {
      console.error('Error cargando asesores:', error);
      toast.error('Error cargando asesores');
      setAdvisors([]);
    } finally {
      setAdvisorsLoading(false);
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
        // Manejar el error con más detalle si está disponible
        const errorMessage = data.error || 'Error guardando configuración';
        let detailedMessage = errorMessage;
        
        if (data.details?.note) {
          detailedMessage += '. ' + data.details.note;
        }
        
        console.error('Detalles del error:', data);
        toast.error(detailedMessage);
        setSnackbar({
          open: true,
          message: detailedMessage,
          severity: 'error'
        });
        
        // Si hay configuración actual en los detalles, recargar la configuración
        if (data.details?.currentConfig && data.details.currentConfig !== 'No disponible') {
          console.log('Recargando configuración actualizada...');
          setTimeout(() => {
            loadConfig();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error guardando configuración';
      toast.error(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
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

  const handleApiChange = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      api: {
        ...config.api,
        [field]: value
      }
    });
  };

  const handleSoporteConfigChange = (field: string, value: string) => {
    if (!soporteConfig) return;
    
    setSoporteConfig({
      ...soporteConfig,
      phoneNumbers: {
        ...soporteConfig.phoneNumbers,
        [field]: value
      }
    });
  };

  const handlePageConfigChange = (field: string, value: string) => {
    if (!soporteConfig) return;
    
    setSoporteConfig({
      ...soporteConfig,
      pageConfig: {
        ...(soporteConfig.pageConfig || {}),
        [field]: value
      }
    });
  };

  const handlePagosExternosTelegramChange = (field: string, value: string) => {
    if (!pagosExternosConfig) return;
    
    setPagosExternosConfig({
      ...pagosExternosConfig,
      telegram: {
        ...pagosExternosConfig.telegram,
        [field]: value
      }
    });
  };

  const saveSoporteConfig = async () => {
    if (!soporteConfig) return;
    
    // Validar que el número de academia esté configurado
    if (!soporteConfig.phoneNumbers.academySupport?.trim()) {
      toast.error('El número de soporte academia es obligatorio');
      return;
    }
    
    try {
      setSoporteSaving(true);
      const response = await fetch('/api/soporte/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(soporteConfig)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Configuración de soporte guardada exitosamente');
        setSoporteConfig(data.data);
      } else {
        throw new Error(data.error || 'Error guardando configuración de soporte');
      }
    } catch (error) {
      console.error('Error guardando configuración de soporte:', error);
      toast.error('Error guardando configuración de soporte');
    } finally {
      setSoporteSaving(false);
    }
  };

  const savePagosExternosConfig = async () => {
    if (!pagosExternosConfig) return;
    
    try {
      setPagosExternosSaving(true);
      const response = await fetch('/api/pagos-externos/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pagosExternosConfig)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Configuración de pagos externos guardada exitosamente');
        setPagosExternosConfig(data.data);
      } else {
        throw new Error(data.error || 'Error guardando configuración de pagos externos');
      }
    } catch (error) {
      console.error('Error guardando configuración de pagos externos:', error);
      toast.error('Error guardando configuración de pagos externos');
    } finally {
      setPagosExternosSaving(false);
    }
  };

  const testPagosExternos = async () => {
    try {
      setPagosExternosTesting(true);
      const response = await fetch('/api/pagos-externos/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('✅ Mensaje de prueba enviado exitosamente. Revisa el grupo de Telegram.');
        console.log('Resultado de la prueba:', data);
      } else {
        toast.error(`❌ Error en la prueba: ${data.error || data.details || 'Error desconocido'}`);
        console.error('Error en prueba de pagos externos:', data);
      }
    } catch (error) {
      console.error('Error probando pagos externos:', error);
      toast.error('Error de conexión al probar pagos externos');
    } finally {
      setPagosExternosTesting(false);
    }
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

    // Debug: Ver el token que se está usando
    console.log('Token de Telegram configurado:', config?.tokens.telegram);
    console.log('Longitud del token:', config?.tokens.telegram?.length);
    console.log('Token visible (primeros 10 chars):', config?.tokens.telegram?.substring(0, 10) + '...');

    setTestStates(prev => ({
      ...prev,
      telegram: { ...prev.telegram, loading: true, result: null as any }
    }));

    try {
      const requestBody = { 
        advisorId: parseInt(advisorId), 
        messageType,
        clientName: clientName || 'Cliente de Prueba',
        clientPhone: '57300000000' // Número por defecto para pruebas
      };
      
      console.log('Enviando request a test-telegram:', requestBody);
      
      const response = await fetch('/api/hotmart/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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

  const testBotToken = async () => {
    if (!config?.tokens.telegram) {
      toast.error('No hay token de Telegram configurado');
      return;
    }

    try {
      console.log('Probando token del bot...');
      
      const response = await fetch(`https://api.telegram.org/bot${config.tokens.telegram}/getMe`);
      const data = await response.json();
      
      console.log('Respuesta de getMe:', data);
      
      if (data.ok) {
        const botInfo = data.result;
        const botUsername = botInfo.username || '';
        const botName = botInfo.first_name || '';
        
        // Actualizar automáticamente el botName y botUsername si están vacíos o diferentes
        const needsUpdate = 
          !config.telegram.botUsername || 
          config.telegram.botUsername !== botUsername ||
          (!config.telegram.botName || config.telegram.botName !== botName);
        
        if (needsUpdate) {
          setConfig({
            ...config,
            telegram: {
              ...config.telegram,
              botUsername: botUsername,
              botName: botName || config.telegram.botName // Mantener el nombre si ya existe uno personalizado
            }
          });
          toast.success(`✅ Bot válido: @${botUsername}. Configuración actualizada automáticamente.`);
          
          // Reiniciar el bot para que use la nueva configuración
          try {
            await fetch('/api/telegram/restart', { method: 'POST' });
            toast.success('Bot reiniciado con la nueva configuración');
          } catch (restartError) {
            console.warn('No se pudo reiniciar el bot automáticamente:', restartError);
          }
        } else {
          toast.success(`✅ Bot válido: @${botUsername}`);
        }
        
        console.log('Bot info:', botInfo);
      } else {
        toast.error(`Token inválido: ${data.description}`);
        console.error('Error del bot:', data);
      }
    } catch (error) {
      console.error('Error probando bot:', error);
      toast.error('Error de conexión con Telegram');
    }
  };

  const updateTestState = (service: 'manychat' | 'flodesk' | 'telegram', field: string, value: string) => {
    setTestStates(prev => ({
      ...prev,
      [service]: { ...prev[service], [field]: value }
    }));
  };

  if (loading || soporteLoading || pagosExternosLoading) {
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

  // Debug: Log del estado de asesores
  console.log('Estado actual de asesores:', advisors);
  console.log('Estado de loading de asesores:', advisorsLoading);
  console.log('showTestSections:', showTestSections);
  console.log('advisors.length:', advisors.length);
  console.log('Tipo de advisors:', typeof advisors);
  console.log('Es array:', Array.isArray(advisors));

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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre del Bot"
                value={config.telegram.botName || ''}
                onChange={(e) => handleTelegramChange('botName', e.target.value)}
                size="small"
                helperText="Nombre del bot para mostrar en los mensajes (ej: Bot de CIERRES-GER)"
                placeholder="Bot de CIERRES-GER"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username del Bot"
                value={config.telegram.botUsername || ''}
                onChange={(e) => handleTelegramChange('botUsername', e.target.value)}
                size="small"
                helperText="Username del bot sin @ (ej: cierres_ger_bot)"
                placeholder="cierres_ger_bot"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Configuración de API de Hotmart */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            <Chip label="Hotmart API" color="warning" size="small" sx={{ mr: 1 }} />
            Configuración de API de Hotmart
          </Typography>
          
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Credenciales para consultar datos faltantes cuando los webhooks no incluyen información completa (ej: teléfono).
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Client ID"
                value={config.api?.client_id || ''}
                onChange={(e) => handleApiChange('client_id', e.target.value)}
                size="small"
                helperText="Client ID de tu aplicación en Hotmart"
                placeholder="50ecdbd5-4e79-4861-992f-64bd60c93c6e"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Client Secret"
                value={config.api?.client_secret || ''}
                onChange={(e) => handleApiChange('client_secret', e.target.value)}
                size="small"
                type="password"
                helperText="Client Secret de tu aplicación en Hotmart"
                placeholder="f162814b-5591-47e4-b69f-b89db8ff6229"
              />
            </Grid>
          </Grid>

          {/* Botones de Acción */}
          <Box mt={3}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Acciones de Configuración
            </Typography>
            
            <Box display="flex" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
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
                variant={showTestSections ? "contained" : "outlined"}
                color="info"
                onClick={() => setShowTestSections(!showTestSections)}
                size="large"
                sx={{ 
                  borderWidth: showTestSections ? 0 : 2,
                  fontWeight: 'bold',
                  '&:hover': { borderWidth: showTestSections ? 0 : 2 },
                  minWidth: '280px'
                }}
              >
                {showTestSections ? '🔽 Ocultar Tests Individuales' : '🔼 Mostrar Tests Individuales'}
              </Button>
            </Box>
            
            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                onClick={saveConfig}
                disabled={saving}
                startIcon={<Save />}
                size="large"
                color="success"
              >
                {saving ? 'Guardando...' : '💾 Guardar Configuración'}
              </Button>
            </Box>
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

      {/* Configuración de Soporte */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Configuración de Soporte
            </Typography>
            <Box>
              <Tooltip title="Recargar configuración de soporte">
                <IconButton onClick={loadSoporteConfig} disabled={soporteLoading}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Configura los números de WhatsApp para redirigir clientes que ya compraron y necesitan soporte.
          </Typography>

          {soporteLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : soporteConfig ? (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                <Chip label="WhatsApp" color="success" size="small" sx={{ mr: 1 }} />
                Números de Soporte
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    label="Soporte Academia (Clientes que ya compraron)"
                    value={soporteConfig.phoneNumbers.academySupport || ''}
                    onChange={(e) => handleSoporteConfigChange('academySupport', e.target.value)}
                    size="small"
                    helperText="Número de WhatsApp con código de país (ej: 573012904922) - OBLIGATORIO"
                    placeholder="573012904922"
                    error={!soporteConfig.phoneNumbers.academySupport?.trim()}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Configuración de la Página */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                <Chip label="Página" color="primary" size="small" sx={{ mr: 1 }} />
                Personalización de la Página de Soporte
              </Typography>
              
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Personaliza el título, subtítulo y color principal de la página de soporte que verán tus clientes.
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Título de la Página"
                    value={soporteConfig.pageConfig?.title || 'SOPORTE GERSSON LOPEZ'}
                    onChange={(e) => handlePageConfigChange('title', e.target.value)}
                    size="small"
                    helperText="Título que aparecerá en la parte superior del formulario"
                    placeholder="SOPORTE GERSSON LOPEZ"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Subtítulo / Descripción"
                    value={soporteConfig.pageConfig?.subtitle || 'Antes de ingresar al chat con el asesor, proporciona estos datos para que te podamos atender rápidamente.'}
                    onChange={(e) => handlePageConfigChange('subtitle', e.target.value)}
                    size="small"
                    helperText="Texto descriptivo que aparece debajo del título"
                    placeholder="Antes de ingresar al chat con el asesor..."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Color Principal"
                    value={soporteConfig.pageConfig?.primaryColor || '#007AFF'}
                    onChange={(e) => handlePageConfigChange('primaryColor', e.target.value)}
                    size="small"
                    helperText="Color en formato hexadecimal (ej: #007AFF)"
                    placeholder="#007AFF"
                    inputProps={{ pattern: '^#[0-9A-Fa-f]{6}$' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      width: '100%',
                      height: 56,
                      backgroundColor: soporteConfig.pageConfig?.primaryColor || '#007AFF',
                      borderRadius: 1,
                      border: '1px solid #ddd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  >
                    Vista Previa del Color
                  </Box>
                </Grid>
              </Grid>

              <Box display="flex" justifyContent="flex-end" mt={3}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={saveSoporteConfig}
                  disabled={soporteSaving}
                  startIcon={soporteSaving ? <CircularProgress size={20} /> : <Save />}
                >
                  {soporteSaving ? 'Guardando...' : 'Guardar Configuración de Soporte'}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Información del Endpoint */}
              <Typography variant="h6" gutterBottom>
                Información de Endpoint
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                URL de la página de soporte para compartir con tus clientes:
              </Typography>
              <Box
                component="code"
                sx={{
                  display: 'block',
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  mb: 2
                }}
              >
                {window.location.origin}/soporte
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.8rem' }}>
                💡 Esta es la URL pública de la página de soporte. Los clientes pueden acceder directamente a este enlace.
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mt: 2 }}>
                URL del endpoint API del formulario (para integraciones avanzadas):
              </Typography>
              <Box
                component="code"
                sx={{
                  display: 'block',
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  mb: 2
                }}
              >
                {window.location.origin}/api/soporte/formulario-soporte
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.8rem' }}>
                💡 <strong>Método:</strong> POST | <strong>Campos:</strong> name, whatsapp, courseStatus (opcional)
              </Typography>
            </>
          ) : (
            <Alert severity="info">
              No se pudo cargar la configuración de soporte. Verifica la conexión.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuración de Pagos Externos */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Configuración de Pagos Externos
            </Typography>
            <Box>
              <Tooltip title="Recargar configuración de pagos externos">
                <IconButton onClick={loadPagosExternosConfig} disabled={pagosExternosLoading}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <Typography variant="body2" color="textSecondary" paragraph>
            Configura el grupo y tema de Telegram donde se enviarán las notificaciones de pagos externos reportados por los asesores.
          </Typography>

          {pagosExternosLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : pagosExternosConfig ? (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                <Chip label="Telegram" color="info" size="small" sx={{ mr: 1 }} />
                Grupo y Tema
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="ID del Grupo de Telegram"
                    value={pagosExternosConfig.telegram.groupChatId || ''}
                    onChange={(e) => handlePagosExternosTelegramChange('groupChatId', e.target.value)}
                    size="small"
                    helperText="ID del grupo (ej: -1001234567890). Si no se configura, usará el grupo de Hotmart."
                    placeholder="-1001234567890"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="ID del Tema/Hilo"
                    value={pagosExternosConfig.telegram.threadId || ''}
                    onChange={(e) => handlePagosExternosTelegramChange('threadId', e.target.value)}
                    size="small"
                    helperText="ID del tema/hilo dentro del grupo (ej: 5). Si no se configura, usará el tema de Hotmart."
                    placeholder="5"
                    type="number"
                  />
                </Grid>
              </Grid>

              <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
                <Button
                  variant="outlined"
                  color="info"
                  onClick={testPagosExternos}
                  disabled={pagosExternosTesting}
                  startIcon={pagosExternosTesting ? <CircularProgress size={20} /> : <Telegram />}
                >
                  {pagosExternosTesting ? 'Probando...' : 'Probar Configuración'}
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={savePagosExternosConfig}
                  disabled={pagosExternosSaving}
                  startIcon={pagosExternosSaving ? <CircularProgress size={20} /> : <Save />}
                >
                  {pagosExternosSaving ? 'Guardando...' : 'Guardar Configuración de Pagos Externos'}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Información del Endpoint */}
              <Typography variant="h6" gutterBottom>
                Información de Endpoint
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                URL del endpoint para reportar pagos externos:
              </Typography>
              <Box
                component="code"
                sx={{
                  display: 'block',
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  mb: 2
                }}
              >
                {window.location.origin}/api/pagosexternos-reisy
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.8rem' }}>
                💡 <strong>Método:</strong> POST | <strong>Campos requeridos:</strong> clienteID, imagenPagoUrl
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.8rem' }}>
                <strong>Campos opcionales:</strong> asesorID, nombreAsesor, tipoVenta, comentario, medioPago, pais, correoInscripcion, telefono, correoPago, cedulaComprador, actividadEconomica
              </Typography>
            </>
          ) : (
            <Alert severity="info">
              No se pudo cargar la configuración de pagos externos. Verifica la conexión.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Secciones de Test Individuales */}
      <Collapse in={showTestSections} timeout={400}>
        <Box mt={3}>
          {/* Header de Tests */}
          <Card sx={{ mb: 3, bgcolor: 'info.light' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom align="center" color="info.dark">
                🧪 Tests Individuales de Integración
              </Typography>
              <Typography variant="body1" align="center" color="info.dark">
                Prueba cada servicio por separado para verificar la configuración
              </Typography>
            </CardContent>
          </Card>
          
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <Chip label="Telegram" color="info" size="small" sx={{ mr: 1 }} />
                  Test Individual
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    onClick={loadAdvisors}
                    disabled={advisorsLoading}
                    startIcon={<Refresh />}
                    variant="outlined"
                  >
                    {advisorsLoading ? 'Cargando...' : 'Recargar Asesores'}
                  </Button>
                  <Button
                    size="small"
                    onClick={testBotToken}
                    disabled={testStates.telegram.loading}
                    startIcon={<Wifi />}
                    variant="outlined"
                    color="warning"
                  >
                    Test Bot Token
                  </Button>
                </Box>
              </Box>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Asesor</InputLabel>
                    <Select
                      value={testStates.telegram.advisorId}
                      onChange={(e) => updateTestState('telegram', 'advisorId', e.target.value)}
                      label="Asesor"
                      disabled={advisorsLoading}
                    >
                      <MenuItem value="">
                        <em>
                          {advisorsLoading ? 'Cargando asesores...' : 'Seleccionar asesor'}
                        </em>
                      </MenuItem>
                      {(() => {
                        console.log('Renderizando Select con', advisors.length, 'asesores');
                        console.log('advisors:', advisors);
                        return advisors.map((advisor) => {
                          console.log('Renderizando asesor:', advisor);
                          return (
                            <MenuItem key={advisor.id} value={advisor.id}>
                              {advisor.nombre}
                            </MenuItem>
                          );
                        });
                      })()}
                    </Select>
                    {advisorsLoading && (
                      <Box display="flex" alignItems="center" gap={1} mt={1}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Cargando asesores...
                        </Typography>
                      </Box>
                    )}
                    {!advisorsLoading && (
                      <Typography variant="caption" color="text.secondary" mt={1}>
                        {advisors.length > 0 ? `${advisors.length} asesores disponibles` : 'No hay asesores con Telegram configurado'}
                      </Typography>
                    )}
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
