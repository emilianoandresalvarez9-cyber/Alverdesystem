import { backupService } from '../../shared/backup/backupService';
import { synchronizePendingOperations } from '../../shared/offline/sync';

export interface ShiftCloseResult {
  syncSuccess: boolean;
  synchronizedCount: number;
  failedCount: number;
}

export class ShiftService {
  /**
   * Cierre de caja (closeShift).
   * 1. Fuerza la sincronización de la cola offline hacia Supabase de forma definitiva.
   * 2. Desencadena el backup local en JSON utilizando el servicio de backup (Agente J).
   */
  public async closeShift(): Promise<ShiftCloseResult> {
    console.log('[ShiftService] Iniciando cierre de caja...');
    
    // 1. Vaciar la cola offline
    let syncResult = { synchronized: 0, failed: 0 };
    try {
      syncResult = await synchronizePendingOperations();
      console.log(`[ShiftService] Sincronización completada. Éxitos: ${syncResult.synchronized}, Fallos: ${syncResult.failed}`);
    } catch (error) {
      console.error('[ShiftService] Error crítico al sincronizar operaciones pendientes:', error);
    }

    // 2. Generar el backup local
    try {
      console.log('[ShiftService] Disparando backup local automático...');
      const dateString = new Date().toISOString().replace(/[:.]/g, '-');
      await backupService.downloadBackup(`cierre_caja_${dateString}.json`);
      console.log('[ShiftService] Backup local desencadenado.');
    } catch (error) {
      console.error('[ShiftService] Error al generar el backup local durante el cierre:', error);
    }

    return {
      syncSuccess: syncResult.failed === 0,
      synchronizedCount: syncResult.synchronized,
      failedCount: syncResult.failed,
    };
  }
}

export const shiftService = new ShiftService();
