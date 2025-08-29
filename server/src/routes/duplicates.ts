import { Router } from 'express';
import winston from 'winston';
import { 
  getClienteById,
  updateCliente,
  deleteCliente,
  insertRegistro,
  getRegistrosByClienteId,
  getReportesByClienteId,
  deleteReporte
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
    const { winnerId, loserIds } = req.body;

    if (!winnerId || !loserIds || !Array.isArray(loserIds) || loserIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe especificar un winnerId y un array de loserIds'
      });
    }

    // Validar que winnerId no esté en loserIds
    if (loserIds.includes(winnerId)) {
      return res.status(400).json({
        success: false,
        error: 'El cliente ganador no puede estar en la lista de perdedores'
      });
    }

    logger.info('Iniciando fusión de múltiples duplicados', { 
      winnerId, 
      loserIds, 
      totalDuplicates: loserIds.length + 1 
    });

    // Obtener todos los clientes (ganador + perdedores)
    const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL;
    const allIds = [winnerId, ...loserIds];
    
    const clientResponses = await Promise.all(
      allIds.map(id => fetch(`${POSTGREST_URL}/GERSSON_CLIENTES?ID=eq.${id}&select=*`))
    );

    // Verificar que todas las respuestas sean exitosas
    for (let i = 0; i < clientResponses.length; i++) {
      if (!clientResponses[i].ok) {
        return res.status(500).json({
          success: false,
          error: `Error consultando cliente ID: ${allIds[i]}`
        });
      }
    }

    const clientData = await Promise.all(clientResponses.map(r => r.json()));
    const clients = clientData.map(data => data[0]).filter(Boolean);

    if (clients.length !== allIds.length) {
      return res.status(404).json({
        success: false,
        error: 'Algunos clientes no fueron encontrados'
      });
    }

    const winner = clients.find(c => c.ID === winnerId);
    const losers = clients.filter(c => loserIds.includes(c.ID));

    // 1. NO transferir reportes - son específicos del asesor
    // Los reportes del duplicado se eliminan junto con el cliente
    
    // 2. Transferir SOLO registros de TODOS los perdedores al ganador (son acciones externas del sistema)
    let registrosTransferidos = 0;
    
    for (const loser of losers) {
      try {
        const registrosLoser = await getRegistrosByClienteId(loser.ID);
        logger.info('Registros encontrados para transferir', { 
          loserId: loser.ID, 
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
              loserId: loser.ID,
              error: registroError instanceof Error ? registroError.message : 'Error desconocido'
            });
            // Continuar con el siguiente registro
          }
        }
      } catch (registrosError) {
        logger.error('Error obteniendo registros del cliente perdedor', {
          loserId: loser.ID,
          error: registrosError instanceof Error ? registrosError.message : 'Error desconocido'
        });
        // Continuar con el siguiente cliente perdedor
      }
    }

    // 3. Consolidar datos del ganador con la mejor información de TODOS los duplicados
    logger.info('Consolidando datos de múltiples clientes', { winnerId, loserIds });
    
    // Encontrar los mejores valores entre todos los clientes (ganador + perdedores)
    const allClients = [winner, ...losers];
    
    const datosConsolidados = {
      // Nombre más largo
      NOMBRE: allClients.reduce((best, client) => 
        client.NOMBRE && client.NOMBRE.length > (best || '').length ? client.NOMBRE : best, winner.NOMBRE),
      
      // Estado prioritario (PAGADO/VENTA CONSOLIDADA > otros)
      ESTADO: allClients.find(c => c.ESTADO === 'PAGADO' || c.ESTADO === 'VENTA CONSOLIDADA')?.ESTADO || winner.ESTADO,
      
      // WhatsApp más largo
      WHATSAPP: allClients.reduce((best, client) => 
        client.WHATSAPP && client.WHATSAPP.length > (best || '').length ? client.WHATSAPP : best, winner.WHATSAPP),
      
      // Mejor información de compra
      FECHA_COMPRA: allClients.find(c => c.FECHA_COMPRA)?.FECHA_COMPRA || winner.FECHA_COMPRA,
      MONTO_COMPRA: allClients.find(c => c.MONTO_COMPRA)?.MONTO_COMPRA || winner.MONTO_COMPRA,
      MONEDA_COMPRA: allClients.find(c => c.MONEDA_COMPRA)?.MONEDA_COMPRA || winner.MONEDA_COMPRA,
      
      // País
      PAIS: allClients.find(c => c.PAIS)?.PAIS || winner.PAIS,
      
      // Mantener el asesor del cliente ganador (el seleccionado por el usuario)
      // Solo usar asesor de perdedores si el ganador no tiene asesor asignado
      ID_ASESOR: winner.ID_ASESOR || allClients.find(c => c.ID_ASESOR)?.ID_ASESOR,
      NOMBRE_ASESOR: winner.NOMBRE_ASESOR || allClients.find(c => c.NOMBRE_ASESOR)?.NOMBRE_ASESOR,
      WHA_ASESOR: winner.WHA_ASESOR || allClients.find(c => c.WHA_ASESOR)?.WHA_ASESOR,
      
      // Datos de soporte más recientes
      soporte_tipo: allClients.find(c => c.soporte_tipo)?.soporte_tipo || winner.soporte_tipo,
      soporte_prioridad: allClients.find(c => c.soporte_prioridad)?.soporte_prioridad || winner.soporte_prioridad,
      soporte_duda: allClients.find(c => c.soporte_duda)?.soporte_duda || winner.soporte_duda,
      soporte_descripcion: allClients.find(c => c.soporte_descripcion)?.soporte_descripcion || winner.soporte_descripcion,
      soporte_fecha_ultimo: Math.max(...allClients.map(c => c.soporte_fecha_ultimo || 0)) || undefined
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

    // 5. Eliminar TODOS los clientes perdedores (después de transferir registros)
    let clientesEliminados = 0;
    const erroresEliminacion = [];
    
    for (const loser of losers) {
      try {
        logger.info('Eliminando reportes del cliente perdedor', { loserId: loser.ID });
        // Eliminar reportes del cliente perdedor
        const reportesLoser = await getReportesByClienteId(loser.ID);
        for (const reporte of reportesLoser) {
          await deleteReporte(reporte.ID);
        }
        
        logger.info('Eliminando registros restantes del cliente perdedor', { loserId: loser.ID });
        // Los registros ya fueron transferidos, pero por si quedó alguno
        await fetch(`${POSTGREST_URL}/GERSSON_REGISTROS?ID_CLIENTE=eq.${loser.ID}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        logger.info('Eliminando cliente perdedor', { loserId: loser.ID });
        await deleteCliente(loser.ID);
        clientesEliminados++;
        
      } catch (deleteError) {
        logger.error('Error eliminando cliente perdedor y dependencias', { 
          loserId: loser.ID, 
          error: deleteError instanceof Error ? deleteError.message : 'Error desconocido' 
        });
        erroresEliminacion.push({
          clienteId: loser.ID,
          error: deleteError instanceof Error ? deleteError.message : 'Error desconocido'
        });
        // Continuar con el siguiente cliente
      }
    }

    // Si hubo errores parciales, reportarlos pero no fallar la operación si se eliminó al menos uno
    if (erroresEliminacion.length > 0) {
      logger.warn('Algunos clientes no pudieron ser eliminados completamente', {
        erroresEliminacion,
        clientesEliminadosExitosamente: clientesEliminados,
        totalClientes: losers.length
      });
    }

    // 6. Registrar evento de fusión
    await insertRegistro({
      ID_CLIENTE: winnerId,
      TIPO_EVENTO: 'FUSION_DUPLICADOS',
      FECHA_EVENTO: Math.floor(Date.now() / 1000)
    });

    logger.info('Fusión de múltiples duplicados completada exitosamente', { 
      winnerId, 
      loserIds,
      clientesEliminados,
      totalDuplicados: losers.length,
      registrosTransferidos,
      erroresEliminacion: erroresEliminacion.length,
      action: 'multiples_clientes_duplicados_eliminados_completamente'
    });

    res.json({
      success: true,
      message: `Fusión de ${losers.length} duplicados completada exitosamente`,
      data: {
        mergedClientId: winnerId,
        deletedClientIds: loserIds,
        clientesEliminadosExitosamente: clientesEliminados,
        totalDuplicados: losers.length,
        transferredRecords: registrosTransferidos,
        consolidatedData: datosConsolidados,
        errorsCount: erroresEliminacion.length,
        errors: erroresEliminacion,
        note: `${clientesEliminados} clientes duplicados eliminados completamente junto con sus reportes - ${registrosTransferidos} registros transferidos al ganador`
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