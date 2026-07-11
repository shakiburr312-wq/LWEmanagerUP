import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlayerProfile, PerformanceLog } from '../types';
import { updatePlayer } from './players';

const SYNC_SETTINGS_DOC_ID = 'sync_state';
const LOCAL_STORAGE_SYNC_KEY = 'lwe_last_sync_date';

/**
 * Perform manual or automated scoring synchronization.
 * Calculates sum of matches, booyahs, kills, and damage for each player from performance logs
 * and updates their core profile documents.
 */
export async function performScoreSync(
  players: PlayerProfile[],
  performanceLogs: PerformanceLog[]
): Promise<{ success: boolean; updatedCount: number }> {
  try {
    let updatedCount = 0;

    // Filter active players to update their scores
    const activePlayers = players.filter(p => p.status === 'active');

    for (const player of activePlayers) {
      // Find all logs for this player
      const playerLogs = performanceLogs.filter(log => log.playerId === player.id);

      // Aggregate stats
      const totalMatches = playerLogs.reduce((sum, log) => sum + (Number(log.matches) || 0), 0);
      const totalBooyahs = playerLogs.reduce((sum, log) => sum + (Number(log.booyahs) || 0), 0);
      const totalKills = playerLogs.reduce((sum, log) => sum + (Number(log.kills) || 0), 0);
      const totalDamage = playerLogs.reduce((sum, log) => sum + (Number(log.damage) || 0), 0);
      
      let calculatedKd = 0;
      if (totalMatches > 0) {
        const deaths = totalMatches - totalBooyahs;
        const divisor = Math.max(1, deaths);
        calculatedKd = Number((totalKills / divisor).toFixed(2));
      }

      // Only update if there is an actual difference to save database write costs
      const hasDiff = 
        player.matches !== totalMatches ||
        player.booyahs !== totalBooyahs ||
        player.kills !== totalKills ||
        player.damage !== totalDamage ||
        Math.abs(player.kd - calculatedKd) > 0.01;

      if (hasDiff) {
        await updatePlayer(player.id, {
          matches: totalMatches,
          booyahs: totalBooyahs,
          kills: totalKills,
          damage: totalDamage,
          kd: calculatedKd
        });
        updatedCount++;
      }
    }

    return { success: true, updatedCount };
  } catch (error) {
    console.error("Failed to perform score sync:", error);
    return { success: false, updatedCount: 0 };
  }
}

/**
 * Checks if score synchronization is needed for the current calendar date.
 * If needed and the user is an admin, performs the sync automatically in the background.
 * Also triggers automatically if any player's stats are out-of-sync (e.g. due to a formula change).
 */
export async function checkAndTriggerDailySync(
  players: PlayerProfile[],
  performanceLogs: PerformanceLog[],
  isAdmin: boolean
): Promise<{ triggered: boolean; success: boolean; updatedCount: number }> {
  // Use current local date format YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString('en-CA'); 

  // Check if any active player has stats or K/D out of sync (e.g. due to formula update)
  let needsFormulaSync = false;
  if (players.length > 0 && performanceLogs.length > 0) {
    for (const player of players.filter(p => p.status === 'active')) {
      const playerLogs = performanceLogs.filter(log => log.playerId === player.id);
      const totalMatches = playerLogs.reduce((sum, log) => sum + (Number(log.matches) || 0), 0);
      const totalBooyahs = playerLogs.reduce((sum, log) => sum + (Number(log.booyahs) || 0), 0);
      const totalKills = playerLogs.reduce((sum, log) => sum + (Number(log.kills) || 0), 0);
      const totalDamage = playerLogs.reduce((sum, log) => sum + (Number(log.damage) || 0), 0);
      
      let calculatedKd = 0;
      if (totalMatches > 0) {
        const deaths = totalMatches - totalBooyahs;
        const divisor = Math.max(1, deaths);
        calculatedKd = Number((totalKills / divisor).toFixed(2));
      }

      if (
        player.matches !== totalMatches ||
        player.booyahs !== totalBooyahs ||
        player.kills !== totalKills ||
        player.damage !== totalDamage ||
        Math.abs(player.kd - calculatedKd) > 0.01
      ) {
        needsFormulaSync = true;
        break;
      }
    }
  }

  // Fast check in local storage, but bypass if we specifically need a formula synchronization
  const lastLocalSync = localStorage.getItem(LOCAL_STORAGE_SYNC_KEY);
  if (lastLocalSync === todayStr && !needsFormulaSync) {
    return { triggered: false, success: false, updatedCount: 0 };
  }

  try {
    const docRef = doc(db, 'settings', SYNC_SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    let lastDbSyncDate = '';

    if (docSnap.exists()) {
      lastDbSyncDate = docSnap.data().lastSyncDate || '';
    }

    // If today is different from last sync date, OR we have out-of-sync stats due to the new formula, trigger sync!
    if (lastDbSyncDate !== todayStr || needsFormulaSync) {
      if (isAdmin && players.length > 0 && performanceLogs.length > 0) {
        console.log(`[Score Sync] Syncing player stats (needsFormulaSync: ${needsFormulaSync}): ${todayStr}`);
        const result = await performScoreSync(players, performanceLogs);
        
        if (result.success) {
          // Update Firestore sync log status
          await setDoc(docRef, {
            lastSyncDate: todayStr,
            lastSyncTimestamp: new Date().toISOString()
          }, { merge: true });

          // Update local storage to prevent repeating
          localStorage.setItem(LOCAL_STORAGE_SYNC_KEY, todayStr);
          return { triggered: true, success: true, updatedCount: result.updatedCount };
        }
      }
    } else {
      // Store current date locally so we don't fetch setting doc continuously
      localStorage.setItem(LOCAL_STORAGE_SYNC_KEY, todayStr);
    }
  } catch (error) {
    console.warn("Error running checkAndTriggerDailySync:", error);
  }

  return { triggered: false, success: false, updatedCount: 0 };
}
