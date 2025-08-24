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
  Info
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
  cliente_id?: number;
  asesor_nombre?: string;
  manychat_status?: 'success' | 'error' | 'skipped';
  flodesk_status?: 'success' | 'error' | 'skipped';
  telegram_status?: 'success' | 'error' | 'skipped';
  processing_time_ms?: number;
  error_message?: string;
  received_at: string;
  processed_at?: string;
  raw_webhook_data?: any;
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
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Detalles del Comprador
                                </Typography>
                                <Typography variant="body2">Email: {log.buyer_email || 'N/A'}</Typography>
                                <Typography variant="body2">País: {log.buyer_country || 'N/A'}</Typography>
                                <Typography variant="body2">Producto: {log.product_name || 'N/A'}</Typography>
                                <Typography variant="body2">Transacción: {log.transaction_id || 'N/A'}</Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Procesamiento
                                </Typography>
                                <Typography variant="body2">Cliente ID: {log.cliente_id || 'N/A'}</Typography>
                                <Typography variant="body2">
                                  Procesado: {log.processed_at ? new Date(log.processed_at).toLocaleString() : 'N/A'}
                                </Typography>
                                {log.error_message && (
                                  <Alert severity="error" size="small" sx={{ mt: 1 }}>
                                    {log.error_message}
                                  </Alert>
                                )}
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