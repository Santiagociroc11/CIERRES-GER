import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Pagination,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Refresh,
  Visibility,
  CheckCircle,
  Error,
  Pending,
  Schedule,
  Info,
  PlayArrow,
  Done,
  Close,
  SkipNext,
  Timeline,
  Person,
  ShoppingCart,
  Message,
  Email,
  Telegram,
  AccessTime,
  MonetizationOn,
  Public
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';

interface WebhookLog {
  id: number;
  event_type: string;
  flujo: string;
  status: 'received' | 'processing' | 'success' | 'error';
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_country?: string;
  product_name?: string;
  transaction_id?: string;
  purchase_amount?: number;
  purchase_date?: string;
  cliente_id?: number;
  asesor_id?: number;
  asesor_nombre?: string;
  // Estados detallados de integraciones
  manychat_status?: 'success' | 'error' | 'skipped';
  manychat_flow_id?: string;
  manychat_subscriber_id?: string;
  manychat_error?: string;
  flodesk_status?: 'success' | 'error' | 'skipped';
  flodesk_segment_id?: string;
  flodesk_error?: string;
  telegram_status?: 'success' | 'error' | 'skipped';
  telegram_chat_id?: string;
  telegram_message_id?: string;
  telegram_error?: string;
  processing_time_ms?: number;
  error_message?: string;
  error_stack?: string;
  received_at: string;
  processed_at?: string;
  raw_webhook_data?: any;
  // Nuevos campos para pasos de procesamiento
  processing_steps?: ProcessingStep[];
  integration_results?: IntegrationResults;
}

interface ProcessingStep {
  step: string;
  status: 'starting' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  timestamp: string;
  duration_ms?: number;
}

interface IntegrationResults {
  manychat: {
    status: 'success' | 'error' | 'skipped';
    flowId?: string;
    subscriberId?: string;
    error?: string;
  };
  flodesk: {
    status: 'success' | 'error' | 'skipped';
    segmentId?: string;
    error?: string;
  };
  telegram: {
    status: 'success' | 'error' | 'skipped';
    chatId?: string;
    messageId?: string;
    error?: string;
  };
}

interface WebhookStats {
  date: string;
  flujo: string;
  status: string;
  count: number;
  avg_processing_time_ms: number;
  manychat_success: number;
  manychat_errors: number;
  flodesk_success: number;
  flodesk_errors: number;
  telegram_success: number;
  telegram_errors: number;
}

const STATUS_COLORS = {
  received: 'info',
  processing: 'warning', 
  success: 'success',
  error: 'error'
} as const;

const STATUS_ICONS = {
  received: <Schedule />,
  processing: <Pending />,
  success: <CheckCircle />,
  error: <Error />
};

const INTEGRATION_COLORS = {
  success: 'success',
  error: 'error',
  skipped: 'default'
} as const;

const STEP_COLORS = {
  starting: 'info',
  completed: 'success',
  failed: 'error',
  skipped: 'default'
} as const;

const STEP_ICONS = {
  starting: <PlayArrow />,
  completed: <Done />,
  failed: <Close />,
  skipped: <SkipNext />
};

const WebhookLogs: React.FC = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<WebhookStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFlujo, setFilterFlujo] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      const offset = (page - 1) * pageSize;
      const response = await fetch(`/api/hotmart/webhook-logs?limit=${pageSize}&offset=${offset}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text) {
        throw new Error('Respuesta vacía del servidor');
      }
      
      const data = JSON.parse(text);
      
      if (data.success) {
        setLogs(data.data);
        setError(null);
      } else {
        throw new Error(data.error || 'Error cargando logs');
      }
    } catch (err) {
      console.error('Error cargando webhook logs:', err);
      setError('Error cargando logs de webhooks');
      toast.error('Error cargando logs');
    }
  }, [page, pageSize]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/hotmart/webhook-stats?days=7');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text) {
        console.warn('Respuesta vacía para estadísticas, continuando...');
        return;
      }
      
      const data = JSON.parse(text);
      
      if (data.success) {
        setStats(data.data);
      } else {
        throw new Error(data.error || 'Error cargando estadísticas');
      }
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
      toast.error('Error cargando estadísticas');
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadLogs(), loadStats()]);
    setLoading(false);
  }, [loadLogs, loadStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadLogs();
      loadStats();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadLogs, loadStats]);

  const handleRowExpand = (logId: number) => {
    setExpandedRow(expandedRow === logId ? null : logId);
  };

  const handleViewDetail = async (logId: number) => {
    try {
      const response = await fetch(`/api/hotmart/webhook-logs/${logId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text) {
        throw new Error('Respuesta vacía del servidor');
      }
      
      const data = JSON.parse(text);
      
      if (data.success) {
        setSelectedLog(data.data);
        setDetailDialogOpen(true);
      } else {
        toast.error('Error cargando detalle del log');
      }
    } catch (error) {
      console.error('Error cargando detalle del log:', error);
      toast.error('Error cargando detalle del log');
    }
  };

  const getStatusChip = (status: WebhookLog['status']) => (
    <Chip
      icon={STATUS_ICONS[status]}
      label={status.toUpperCase()}
      color={STATUS_COLORS[status]}
      size="small"
    />
  );

  const getIntegrationChip = (status?: 'success' | 'error' | 'skipped') => {
    if (!status) return null;
    return (
      <Chip
        label={status.toUpperCase()}
        color={INTEGRATION_COLORS[status]}
        size="small"
        sx={{ mr: 0.5 }}
      />
    );
  };

  const getStepChip = (status: ProcessingStep['status']) => (
    <Chip
      icon={STEP_ICONS[status]}
      label={status.toUpperCase()}
      color={STEP_COLORS[status]}
      size="small"
    />
  );

  const renderProcessingTimeline = (steps?: ProcessingStep[]) => {
    if (!steps || steps.length === 0) return null;

    return (
      <Box mt={2}>
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <Timeline sx={{ mr: 1 }} />
          Timeline de Procesamiento
        </Typography>
        <Box sx={{ pl: 2 }}>
          {steps.map((step, index) => (
            <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              {getStepChip(step.status)}
              <Typography variant="body2" sx={{ ml: 1, flex: 1 }}>
                {step.step}
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                {new Date(step.timestamp).toLocaleTimeString()}
              </Typography>
              {step.duration_ms && (
                <Chip 
                  label={`${step.duration_ms}ms`} 
                  size="small" 
                  variant="outlined" 
                  sx={{ ml: 1 }} 
                />
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const renderIntegrationDetails = (log: WebhookLog) => (
    <Box mt={2}>
      <Typography variant="subtitle2" gutterBottom>
        Detalles de Integraciones
      </Typography>
      <Grid container spacing={2}>
        {/* ManyChat Details */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ p: 1 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Message sx={{ mr: 1, color: log.manychat_status === 'success' ? 'success.main' : log.manychat_status === 'error' ? 'error.main' : 'grey.500' }} />
              <Typography variant="subtitle2">ManyChat</Typography>
              {getIntegrationChip(log.manychat_status)}
            </Box>
            {log.manychat_flow_id && (
              <Typography variant="caption" display="block">Flow ID: {log.manychat_flow_id}</Typography>
            )}
            {log.manychat_subscriber_id && (
              <Typography variant="caption" display="block">Subscriber: {log.manychat_subscriber_id}</Typography>
            )}
            {log.manychat_error && (
              <Alert severity="error" size="small" sx={{ mt: 1, fontSize: '0.75rem' }}>
                {log.manychat_error}
              </Alert>
            )}
          </Card>
        </Grid>

        {/* Flodesk Details */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ p: 1 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Email sx={{ mr: 1, color: log.flodesk_status === 'success' ? 'success.main' : log.flodesk_status === 'error' ? 'error.main' : 'grey.500' }} />
              <Typography variant="subtitle2">Flodesk</Typography>
              {getIntegrationChip(log.flodesk_status)}
            </Box>
            {log.flodesk_segment_id && (
              <Typography variant="caption" display="block">Segment: {log.flodesk_segment_id}</Typography>
            )}
            {log.flodesk_error && (
              <Alert severity="error" size="small" sx={{ mt: 1, fontSize: '0.75rem' }}>
                {log.flodesk_error}
              </Alert>
            )}
          </Card>
        </Grid>

        {/* Telegram Details */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ p: 1 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Telegram sx={{ mr: 1, color: log.telegram_status === 'success' ? 'success.main' : log.telegram_status === 'error' ? 'error.main' : 'grey.500' }} />
              <Typography variant="subtitle2">Telegram</Typography>
              {getIntegrationChip(log.telegram_status)}
            </Box>
            {log.telegram_chat_id && (
              <Typography variant="caption" display="block">Chat: {log.telegram_chat_id}</Typography>
            )}
            {log.telegram_message_id && (
              <Typography variant="caption" display="block">Message: {log.telegram_message_id}</Typography>
            )}
            {log.telegram_error && (
              <Alert severity="error" size="small" sx={{ mt: 1, fontSize: '0.75rem' }}>
                {log.telegram_error}
              </Alert>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const filteredLogs = logs.filter(log => {
    if (filterStatus && log.status !== filterStatus) return false;
    if (filterFlujo && log.flujo !== filterFlujo) return false;
    return true;
  });

  // Calcular estadísticas resumidas
  const totalLogs = logs.length;
  const successRate = totalLogs > 0 ? (logs.filter(l => l.status === 'success').length / totalLogs * 100).toFixed(1) : '0';
  const avgProcessingTime = logs.length > 0 
    ? (logs.filter(l => l.processing_time_ms).reduce((acc, l) => acc + (l.processing_time_ms || 0), 0) / logs.filter(l => l.processing_time_ms).length).toFixed(0)
    : '0';

  if (loading && logs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Logs de Webhooks
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant={autoRefresh ? "contained" : "outlined"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="small"
          >
            Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outlined"
            onClick={loadData}
            startIcon={<Refresh />}
            disabled={loading}
            size="small"
          >
            Actualizar
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Estadísticas generales */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="textSecondary" gutterBottom>
                Total Webhooks
              </Typography>
              <Typography variant="h4">
                {totalLogs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="textSecondary" gutterBottom>
                Tasa de Éxito
              </Typography>
              <Typography variant="h4" color="success.main">
                {successRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="textSecondary" gutterBottom>
                Tiempo Promedio
              </Typography>
              <Typography variant="h4">
                {avgProcessingTime}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="textSecondary" gutterBottom>
                Estado
              </Typography>
              <Typography variant="h4" color={autoRefresh ? "success.main" : "text.secondary"}>
                {autoRefresh ? 'LIVE' : 'PAUSADO'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Estado"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                size="small"
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="received">Received</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="error">Error</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Flujo"
                value={filterFlujo}
                onChange={(e) => setFilterFlujo(e.target.value)}
                size="small"
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="CARRITOS">Carritos</MenuItem>
                <MenuItem value="COMPRAS">Compras</MenuItem>
                <MenuItem value="RECHAZADOS">Rechazados</MenuItem>
                <MenuItem value="TICKETS">Tickets</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabla de logs */}
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>Tiempo</TableCell>
                  <TableCell>Evento</TableCell>
                  <TableCell>Flujo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Asesor</TableCell>
                  <TableCell>Integraciones</TableCell>
                  <TableCell>Duración</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleRowExpand(log.id)}
                        >
                          {expandedRow === log.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(log.received_at).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.event_type}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={log.flujo} size="small" />
                      </TableCell>
                      <TableCell>
                        {getStatusChip(log.status)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.buyer_name || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {log.buyer_phone}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.asesor_nombre || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {getIntegrationChip(log.manychat_status)}
                          {getIntegrationChip(log.flodesk_status)}
                          {getIntegrationChip(log.telegram_status)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {log.processing_time_ms ? `${log.processing_time_ms}ms` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Ver detalle">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetail(log.id)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                        <Collapse in={expandedRow === log.id} timeout="auto" unmountOnExit>
                          <Box margin={1}>
                            <Grid container spacing={3}>
                              {/* Información del Comprador */}
                              <Grid item xs={12} md={6}>
                                <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Person sx={{ mr: 1 }} />
                                    Detalles del Comprador
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Email sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">{log.buyer_email || 'N/A'}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Public sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">{log.buyer_country || 'N/A'}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <ShoppingCart sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">{log.product_name || 'N/A'}</Typography>
                                  </Box>
                                  {log.purchase_amount && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                      <MonetizationOn sx={{ mr: 1, fontSize: 16 }} />
                                      <Typography variant="body2">${log.purchase_amount}</Typography>
                                    </Box>
                                  )}
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Info sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">TX: {log.transaction_id || 'N/A'}</Typography>
                                  </Box>
                                </Card>
                              </Grid>

                              {/* Información de Procesamiento */}
                              <Grid item xs={12} md={6}>
                                <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Schedule sx={{ mr: 1 }} />
                                    Procesamiento
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Person sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">Cliente ID: {log.cliente_id || 'N/A'}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <AccessTime sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">
                                      Procesado: {log.processed_at ? new Date(log.processed_at).toLocaleString() : 'N/A'}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Schedule sx={{ mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2">
                                      Duración: {log.processing_time_ms || 0}ms
                                    </Typography>
                                  </Box>
                                  {log.asesor_nombre && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                      <Person sx={{ mr: 1, fontSize: 16 }} />
                                      <Typography variant="body2">Asesor: {log.asesor_nombre}</Typography>
                                    </Box>
                                  )}
                                  {log.error_message && (
                                    <Alert severity="error" size="small" sx={{ mt: 1 }}>
                                      {log.error_message}
                                    </Alert>
                                  )}
                                </Card>
                              </Grid>

                              {/* Detalles de Integraciones */}
                              <Grid item xs={12}>
                                {renderIntegrationDetails(log)}
                              </Grid>

                              {/* Timeline de Procesamiento */}
                              <Grid item xs={12}>
                                {renderProcessingTimeline(log.processing_steps)}
                              </Grid>
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination
              count={Math.ceil(totalLogs / pageSize)}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Dialog de detalle */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Detalle del Webhook - ID: {selectedLog?.id}
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Información General
                  </Typography>
                  <Typography variant="body2"><strong>Evento:</strong> {selectedLog.event_type}</Typography>
                  <Typography variant="body2"><strong>Flujo:</strong> {selectedLog.flujo}</Typography>
                  <Typography variant="body2"><strong>Estado:</strong> {selectedLog.status}</Typography>
                  <Typography variant="body2"><strong>Recibido:</strong> {new Date(selectedLog.received_at).toLocaleString()}</Typography>
                  {selectedLog.processed_at && (
                    <Typography variant="body2">
                      <strong>Procesado:</strong> {new Date(selectedLog.processed_at).toLocaleString()}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Duración:</strong> {selectedLog.processing_time_ms || 0}ms
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Estados de Integración
                  </Typography>
                  <Typography variant="body2">
                    <strong>ManyChat:</strong> {getIntegrationChip(selectedLog.manychat_status)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Flodesk:</strong> {getIntegrationChip(selectedLog.flodesk_status)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Telegram:</strong> {getIntegrationChip(selectedLog.telegram_status)}
                  </Typography>
                </Grid>
              </Grid>
              
              {selectedLog.raw_webhook_data && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>
                    Datos Raw del Webhook
                  </Typography>
                  <TextField
                    multiline
                    fullWidth
                    minRows={10}
                    value={JSON.stringify(selectedLog.raw_webhook_data, null, 2)}
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                    sx={{ fontFamily: 'monospace' }}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebhookLogs;