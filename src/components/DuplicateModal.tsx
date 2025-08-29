import { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  DollarSign,
  Phone,
  User,
  MessageSquare,
  FileText,
  Activity,
  Crown,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatDate, formatDateOnly } from '../utils/dateUtils';

interface DuplicateInfo {
  ID: number;
  NOMBRE: string;
  ESTADO: string;
  WHATSAPP: string;
  FECHA_CREACION: string;
  ID_ASESOR?: number;
  NOMBRE_ASESOR?: string;
  WHA_ASESOR?: string;
  FECHA_COMPRA?: string;
  MONTO_COMPRA?: number;
  totalReportes: number;
  totalRegistros: number;
  ultimoReporte?: string;
  businessValue: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface DuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: number;
  clienteName: string;
  onMergeSuccess: () => void;
}

export default function DuplicateModal({ 
  isOpen, 
  onClose, 
  clienteId, 
  clienteName,
  onMergeSuccess 
}: DuplicateModalProps) {
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [originalClient, setOriginalClient] = useState<DuplicateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && clienteId) {
      loadDuplicates();
    }
  }, [isOpen, clienteId]);

  const loadDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/duplicates/${clienteId}`);
      const data = await response.json();
      
      if (data.success) {
        setDuplicates(data.duplicates || []);
        setOriginalClient(data.originalClient || null);
        
        // Pre-seleccionar el más valioso
        if (data.duplicates && data.duplicates.length > 0) {
          const allClients = [data.originalClient, ...data.duplicates].filter(Boolean);
          const bestClient = allClients.sort((a, b) => {
            const valueOrder = { 'CRITICAL': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 };
            return valueOrder[a.businessValue] - valueOrder[b.businessValue];
          })[0];
          setSelectedWinner(bestClient?.ID || null);
        }
      } else {
        setError(data.error || 'Error al cargar duplicados');
      }
    } catch (err) {
      setError('Error de conexión al cargar duplicados');
      console.error('Error loading duplicates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedWinner) {
      setError('Debe seleccionar un cliente ganador');
      return;
    }

    const allClients = [originalClient, ...duplicates].filter(Boolean) as DuplicateInfo[];
    const loser = allClients.find(c => c.ID !== selectedWinner);
    
    if (!loser) {
      setError('No se encontró el cliente a eliminar');
      return;
    }

    setMerging(true);
    setError(null);

    try {
      const response = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          winnerId: selectedWinner,
          loserId: loser.ID,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onMergeSuccess();
        onClose();
      } else {
        setError(data.error || 'Error al fusionar duplicados');
      }
    } catch (err) {
      setError('Error de conexión al fusionar duplicados');
      console.error('Error merging duplicates:', err);
    } finally {
      setMerging(false);
    }
  };

  const getBusinessValueBadge = (value: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
    const config = {
      CRITICAL: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: AlertTriangle },
      HIGH: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: TrendingUp },
      MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: Activity },
      LOW: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: FileText }
    };
    
    const { bg, text, border, icon: Icon } = config[value] || config.LOW;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${bg} ${text} ${border}`}>
        <Icon className="w-3 h-3 mr-1" />
        {value}
      </span>
    );
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'VENTA CONSOLIDADA':
        return 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500';
      case 'PAGADO':
        return 'bg-green-100 text-green-800';
      case 'SEGUIMIENTO':
        return 'bg-blue-100 text-blue-800';
      case 'NO CONTACTAR':
        return 'bg-red-100 text-red-800';
      case 'CARRITOS':
        return 'bg-orange-100 text-orange-800';
      case 'LINK':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  const allClients = [originalClient, ...duplicates].filter(Boolean) as DuplicateInfo[];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Detectar y Fusionar Duplicados
              </h2>
              <p className="text-sm text-gray-500">
                Cliente: {clienteName} (ID: {clienteId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={merging}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Buscando duplicados...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No se encontraron duplicados
              </h3>
              <p className="mt-2 text-gray-500">
                Este cliente no tiene duplicados en el sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Instrucciones</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Se encontraron <strong>{duplicates.length + 1} registros duplicados</strong>. 
                      Seleccione cuál mantener como registro principal. El resto será eliminado 
                      y sus reportes/registros se fusionarán al seleccionado.
                    </p>
                  </div>
                </div>
              </div>

              {/* Duplicate Cards */}
              <div className="grid gap-4">
                {allClients.map((client) => (
                  <div
                    key={client.ID}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedWinner === client.ID
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedWinner(client.ID)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedWinner === client.ID
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 bg-white'
                        }`}>
                          {selectedWinner === client.ID && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 flex items-center">
                            {client.NOMBRE}
                            {selectedWinner === client.ID && (
                              <Crown className="w-4 h-4 text-yellow-500 ml-2" />
                            )}
                          </h3>
                          <p className="text-sm text-gray-500">ID: {client.ID}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getBusinessValueBadge(client.businessValue)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(client.ESTADO)}`}>
                          {client.ESTADO}
                        </span>
                      </div>
                    </div>

                    {/* Client Details */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{client.WHATSAPP}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Creado: {formatDateOnly(client.FECHA_CREACION)}</span>
                      </div>
                      {client.NOMBRE_ASESOR && (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>Asesor: {client.NOMBRE_ASESOR}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="mt-3 flex items-center space-x-6 text-sm">
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        <span>{client.totalReportes} reportes</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Activity className="w-4 h-4 text-green-400" />
                        <span>{client.totalRegistros} registros</span>
                      </div>
                      {client.MONTO_COMPRA && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4 text-yellow-400" />
                          <span>${client.MONTO_COMPRA}</span>
                        </div>
                      )}
                    </div>

                    {client.ultimoReporte && (
                      <div className="mt-2 text-xs text-gray-500">
                        Último reporte: {formatDate(client.ultimoReporte)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={merging}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleMerge}
                  disabled={!selectedWinner || merging}
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    !selectedWinner || merging
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {merging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Fusionando...
                    </>
                  ) : (
                    'Fusionar Duplicados'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}