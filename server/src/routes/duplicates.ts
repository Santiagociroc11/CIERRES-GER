import { Router } from 'express';
import winston from 'winston';
import { 
  getClienteById,
  updateCliente,
  deleteCliente,
  insertRegistro,
  getRegistrosByClienteId,
  getReportesByClienteId
} from '../dbClient';

const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Interface para respuesta de duplicados
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

// Función para calcular valor de negocio
function calculateBusinessValue(cliente: any, reportes: number, registros: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  // CRITICAL: Cliente pagado/venta consolidada
  if (cliente.ESTADO === 'PAGADO' || cliente.ESTADO === 'VENTA CONSOLIDADA') {
    return 'CRITICAL';
  }
  
  // HIGH: Con compras o muchos reportes
  if (cliente.FECHA_COMPRA || cliente.MONTO_COMPRA || reportes > 3) {
    return 'HIGH';
  }
  
  // MEDIUM: En seguimiento o con actividad
  if (cliente.ESTADO === 'SEGUIMIENTO' || reportes > 0 || registros > 2) {
    return 'MEDIUM';
  }
  
  // LOW: Básico
  return 'LOW';
}

// GET /api/duplicates/:clienteId - Buscar duplicados de un cliente específico
router.get('/:clienteId', async (req, res) => {
  try {
    const clienteId = parseInt(req.params.clienteId);
    
    if (isNaN(clienteId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente inválido'
      });
    }

    logger.info('Buscando duplicados para cliente', { clienteId });

    // Obtener cliente principal
    const clientePrincipal = await getClienteById(clienteId);
    if (!clientePrincipal) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Buscar duplicados por últimos 7 dígitos del WhatsApp
    const whatsappSuffix = clientePrincipal.WHATSAPP.slice(-7);
    
    const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;
    const response = await fetch(
      `${POSTGREST_URL}/GERSSON_CLIENTES?select=*&WHATSAPP=ilike.*${whatsappSuffix}*`
    );

    if (!response.ok) {
      logger.error('Error consultando duplicados', { 
        status: response.status, 
        statusText: response.statusText 
      });
      return res.status(500).json({
        success: false,
        error: 'Error consultando base de datos'
      });
    }

    const duplicados = await response.json();
    
    // Filtrar solo los que realmente son diferentes al cliente principal
    const duplicadosReales = duplicados.filter((d: any) => d.ID !== clienteId);

    if (duplicadosReales.length === 0) {
      return res.json({
        success: true,
        duplicates: [],
        message: 'No se encontraron duplicados para este cliente'
      });
    }

    // Enriquecer cada duplicado con información adicional
    const duplicadosEnriquecidos: DuplicateInfo[] = await Promise.all(
      [...duplicados].map(async (cliente) => {
        try {
          // Obtener reportes del cliente
          const reportes = await getReportesByClienteId(cliente.ID);
          const totalReportes = reportes.length;
          const ultimoReporte = reportes.length > 0 
            ? reportes[reportes.length - 1].FECHA_REPORTE 
            : undefined;

          // Obtener registros del cliente
          const registros = await getRegistrosByClienteId(cliente.ID);
          const totalRegistros = registros.length;

          // Calcular valor de negocio
          const businessValue = calculateBusinessValue(cliente, totalReportes, totalRegistros);

          return {
            ID: cliente.ID,
            NOMBRE: cliente.NOMBRE,
            ESTADO: cliente.ESTADO,
            WHATSAPP: cliente.WHATSAPP,
            FECHA_CREACION: cliente.FECHA_CREACION,
            ID_ASESOR: cliente.ID_ASESOR,
            NOMBRE_ASESOR: cliente.NOMBRE_ASESOR,
            WHA_ASESOR: cliente.WHA_ASESOR,
            FECHA_COMPRA: cliente.FECHA_COMPRA,
            MONTO_COMPRA: cliente.MONTO_COMPRA,
            totalReportes,
            totalRegistros,
            ultimoReporte,
            businessValue
          };
        } catch (error) {
          logger.error('Error enriqueciendo cliente', { clienteId: cliente.ID, error });
          return {
            ID: cliente.ID,
            NOMBRE: cliente.NOMBRE,
            ESTADO: cliente.ESTADO,
            WHATSAPP: cliente.WHATSAPP,
            FECHA_CREACION: cliente.FECHA_CREACION,
            totalReportes: 0,
            totalRegistros: 0,
            businessValue: 'LOW' as const
          };
        }
      })
    );

    // Ordenar por valor de negocio y fecha de creación
    const businessValueOrder = { 'CRITICAL': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 };
    duplicadosEnriquecidos.sort((a, b) => {
      const valueA = businessValueOrder[a.businessValue];
      const valueB = businessValueOrder[b.businessValue];
      
      if (valueA !== valueB) {
        return valueA - valueB;
      }
      
      // Si tienen el mismo valor de negocio, ordenar por fecha (más antiguo primero)
      return parseInt(a.FECHA_CREACION) - parseInt(b.FECHA_CREACION);
    });

    logger.info('Duplicados encontrados', { 
      clienteId, 
      whatsappSuffix,
      totalDuplicados: duplicadosEnriquecidos.length,
      duplicadosReales: duplicadosEnriquecidos.filter(d => d.ID !== clienteId).length
    });

    res.json({
      success: true,
      originalClient: duplicadosEnriquecidos.find(d => d.ID === clienteId),
      duplicates: duplicadosEnriquecidos.filter(d => d.ID !== clienteId),
      whatsappSuffix,
      totalFound: duplicadosEnriquecidos.length
    });

  } catch (error) {
    logger.error('Error buscando duplicados', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// POST /api/duplicates/merge - Fusionar duplicados
router.post('/merge', async (req, res) => {
  try {
    const { winnerId, loserId } = req.body;

    if (!winnerId || !loserId || winnerId === loserId) {
      return res.status(400).json({
        success: false,
        error: 'IDs de cliente inválidos'
      });
    }

    logger.info('Iniciando fusión de duplicados', { winnerId, loserId });

    // Obtener ambos clientes con información completa
    const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;
    
    const [winnerResponse, loserResponse] = await Promise.all([
      fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${winnerId}&select=*`),
      fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${loserId}&select=*`)
    ]);

    if (!winnerResponse.ok || !loserResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Error consultando clientes'
      });
    }

    const winnerData = await winnerResponse.json();
    const loserData = await loserResponse.json();
    
    const winner = winnerData[0];
    const loser = loserData[0];

    if (!winner || !loser) {
      return res.status(404).json({
        success: false,
        error: 'Uno o ambos clientes no encontrados'
      });
    }

    // 1. NO transferir reportes - son específicos del asesor
    // Los reportes del duplicado se eliminan junto con el cliente
    
    // 2. Transferir SOLO registros del perdedor al ganador (son acciones externas del sistema)
    let registrosTransferidos = 0;
    try {
      const registrosLoser = await getRegistrosByClienteId(loserId);
      logger.info('Registros encontrados para transferir', { 
        loserId, 
        cantidad: registrosLoser.length 
      });
      
      for (const registro of registrosLoser) {
        try {
          await insertRegistro({
            ID_CLIENTE: winnerId,
            TIPO_EVENTO: registro.TIPO_EVENTO,
            FECHA_EVENTO: registro.FECHA_EVENTO
          });
          registrosTransferidos++;
        } catch (registroError) {
          logger.error('Error transfiriendo registro individual', {
            registroId: registro.ID,
            error: registroError instanceof Error ? registroError.message : 'Error desconocido'
          });
          // Continuar con el siguiente registro
        }
      }
    } catch (registrosError) {
      logger.error('Error obteniendo registros del cliente perdedor', {
        loserId,
        error: registrosError instanceof Error ? registrosError.message : 'Error desconocido'
      });
      // Continuar con la fusión sin transferir registros
    }

    // 3. Consolidar datos del ganador con la mejor información
    logger.info('Consolidando datos de clientes', { winnerId, loserId });
    const datosConsolidados = {
      NOMBRE: winner.NOMBRE.length > loser.NOMBRE.length ? winner.NOMBRE : loser.NOMBRE,
      ESTADO: winner.ESTADO === 'PAGADO' || winner.ESTADO === 'VENTA CONSOLIDADA' 
        ? winner.ESTADO 
        : (loser.ESTADO === 'PAGADO' || loser.ESTADO === 'VENTA CONSOLIDADA' 
          ? loser.ESTADO 
          : winner.ESTADO),
      WHATSAPP: winner.WHATSAPP.length > loser.WHATSAPP.length ? winner.WHATSAPP : loser.WHATSAPP,
      FECHA_COMPRA: winner.FECHA_COMPRA || loser.FECHA_COMPRA,
      MONTO_COMPRA: winner.MONTO_COMPRA || loser.MONTO_COMPRA,
      MONEDA_COMPRA: winner.MONEDA_COMPRA || loser.MONEDA_COMPRA,
      PAIS: winner.PAIS || loser.PAIS,
      // Mantener el asesor más reciente
      ID_ASESOR: loser.ID_ASESOR || winner.ID_ASESOR,
      NOMBRE_ASESOR: loser.NOMBRE_ASESOR || winner.NOMBRE_ASESOR,
      WHA_ASESOR: loser.WHA_ASESOR || winner.WHA_ASESOR,
      // Datos de soporte más recientes
      soporte_tipo: loser.soporte_tipo || winner.soporte_tipo,
      soporte_prioridad: loser.soporte_prioridad || winner.soporte_prioridad,
      soporte_duda: loser.soporte_duda || winner.soporte_duda,
      soporte_descripcion: loser.soporte_descripcion || winner.soporte_descripcion,
      soporte_fecha_ultimo: Math.max(
        winner.soporte_fecha_ultimo || 0, 
        loser.soporte_fecha_ultimo || 0
      ) || undefined
    };

    // 4. Actualizar cliente ganador con datos consolidados
    try {
      logger.info('Actualizando cliente ganador', { winnerId, datosConsolidados });
      await updateCliente(winnerId, datosConsolidados);
    } catch (updateError) {
      logger.error('Error actualizando cliente ganador', { 
        winnerId, 
        error: updateError instanceof Error ? updateError.message : 'Error desconocido' 
      });
      throw updateError;
    }

    // 5. Eliminar cliente perdedor
    try {
      logger.info('Eliminando cliente perdedor', { loserId });
      await deleteCliente(loserId);
    } catch (deleteError) {
      logger.error('Error eliminando cliente perdedor', { 
        loserId, 
        error: deleteError instanceof Error ? deleteError.message : 'Error desconocido' 
      });
      throw deleteError;
    }

    // 6. Registrar evento de fusión
    await insertRegistro({
      ID_CLIENTE: winnerId,
      TIPO_EVENTO: 'FUSION_DUPLICADOS',
      FECHA_EVENTO: Math.floor(Date.now() / 1000)
    });

    logger.info('Fusión completada exitosamente', { 
      winnerId, 
      loserId,
      reportesEliminados: 'con_cliente_duplicado',
      registrosTransferidos,
      action: 'solo_registros_transferidos'
    });

    res.json({
      success: true,
      message: 'Duplicados fusionados exitosamente',
      data: {
        mergedClientId: winnerId,
        deletedClientId: loserId,
        transferredRecords: registrosTransferidos,
        consolidatedData: datosConsolidados,
        note: 'Reportes eliminados con cliente duplicado - Solo registros (acciones del sistema) transferidos'
      }
    });

  } catch (error) {
    logger.error('Error fusionando duplicados', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;