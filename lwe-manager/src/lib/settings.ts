// Replacement of /src/lib/settings.ts - Added seasonStartDate to settings and watch/save logic
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  getDoc,
  getDocs,
  collection,
  query,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MVPSettings, SiteSettings, Lineup, PlayerProfile } from '../types';

const SETTINGS_DOC_ID = 'mvp';
const LOCAL_STORAGE_KEY = 'lwe_mvp_settings_fallback';
const DEFAULT_SETTINGS: MVPSettings = { 
  kdWeight: 10, 
  killsWeight: 1, 
  damageWeight: 0.1,
  seasonStartDate: '2026-07-01T00:00:00.000Z'
};

let settingsWatchers: ((settings: MVPSettings) => void)[] = [];

function notifyWatchers(settings: MVPSettings) {
  settingsWatchers.forEach(cb => cb(settings));
}

/**
 * Save MVP weights
 */
export async function saveMVPSettings(settings: MVPSettings) {
  // Always update local storage first to remain responsive
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  notifyWatchers(settings);

  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, settings);
  } catch (error) {
    console.warn("Firestore saveMVPSettings failed (using local storage fallback):", error);
  }
}

/**
 * Watch MVP weights in real-time
 */
export function watchMVPSettings(callback: (settings: MVPSettings) => void) {
  settingsWatchers.push(callback);

  // Return initial local state immediately
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_SETTINGS;
  callback(initial);

  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);

  const unsub = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const updated: MVPSettings = {
          kdWeight: Number(data.kdWeight) ?? 10,
          killsWeight: Number(data.killsWeight) ?? 1,
          damageWeight: Number(data.damageWeight) ?? 0.1,
          seasonStartDate: data.seasonStartDate || '2026-07-01T00:00:00.000Z'
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        callback(updated);
      } else {
        callback(DEFAULT_SETTINGS);
      }
    },
    (error) => {
      console.warn("Firestore watchMVPSettings failed, using local storage fallback:", error);
      // Already supplied callback with local state, so do nothing here to prevent crashing
    }
  );

  return () => {
    settingsWatchers = settingsWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Check and reset the season if a new calendar month has started or 30 days have passed (Admin only writes)
 */
export async function checkAndResetSeason(settings: MVPSettings, isAdmin: boolean) {
  if (!settings.seasonStartDate) return;
  const start = new Date(settings.seasonStartDate);
  const now = new Date();
  
  const isNewMonth = now.getMonth() !== start.getMonth() || now.getFullYear() !== start.getFullYear();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  if (isNewMonth || diffDays >= 30) {
    if (isAdmin) {
      try {
        const updated: MVPSettings = {
          ...settings,
          seasonStartDate: now.toISOString()
        };
        await saveMVPSettings(updated);
      } catch (error) {
        console.warn("Season auto-reset failed (silently ignoring):", error);
      }
    }
  }
}

/**
 * Completely resets the season manually:
 * 1. Sets seasonStartDate to now
 * 2. Deletes all performance logs from Firestore
 * 3. Resets all active players' stats (kills, kd, damage, matches, booyahs, assists, healing) back to 0
 */
export async function manualResetSeasonAndStats(settings: MVPSettings, players: PlayerProfile[]) {
  const now = new Date();
  
  // 1. Update season start date in settings
  const updatedSettings: MVPSettings = {
    ...settings,
    seasonStartDate: now.toISOString()
  };
  await saveMVPSettings(updatedSettings);

  // 2. Delete all performance logs from Firestore safely with chunking
  try {
    const logsQuerySnapshot = await getDocs(collection(db, 'performanceLogs'));
    const logDocs = logsQuerySnapshot.docs;
    if (logDocs.length > 0) {
      for (let i = 0; i < logDocs.length; i += 400) {
        const chunk = logDocs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        await batch.commit();
      }
    }
  } catch (error) {
    console.warn("Failed to delete performance logs during reset:", error);
    throw error;
  }

  // Clear local storage cache for performance logs
  localStorage.setItem('lwe_performance_logs_fallback_v1', JSON.stringify([]));

  // 3. Reset all players' stats in Firestore to 0 safely with chunking
  try {
    const playersQuerySnapshot = await getDocs(collection(db, 'players'));
    const playerDocs = playersQuerySnapshot.docs;
    const activePlayerDocs = playerDocs.filter(docSnap => {
      const data = docSnap.data();
      return (data.status || 'active') === 'active';
    });

    if (activePlayerDocs.length > 0) {
      for (let i = 0; i < activePlayerDocs.length; i += 400) {
        const chunk = activePlayerDocs.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const docSnap of chunk) {
          batch.update(docSnap.ref, {
            matches: 0,
            booyahs: 0,
            kills: 0,
            damage: 0,
            assists: 0,
            healing: 0,
            kd: 0
          });
        }
        await batch.commit();
      }
    }

    // Update local storage for players
    const localPlayers = localStorage.getItem('lwe_players_fallback_v2');
    if (localPlayers) {
      const list: PlayerProfile[] = JSON.parse(localPlayers);
      const updatedList = list.map(p => {
        if (p.status === 'active') {
          return {
            ...p,
            matches: 0,
            booyahs: 0,
            kills: 0,
            damage: 0,
            assists: 0,
            healing: 0,
            kd: 0
          };
        }
        return p;
      });
      localStorage.setItem('lwe_players_fallback_v2', JSON.stringify(updatedList));
    }
  } catch (error) {
    console.warn("Failed to reset player stats during reset:", error);
    throw error;
  }
}

/**
 * Watch site-wide settings in real-time
 */
export function watchSiteSettings(callback: (settings: SiteSettings) => void) {
  // Deliver current local state immediately as fallback
  const local = localStorage.getItem('lwe_site_settings_fallback');
  if (local) {
    try {
      callback(JSON.parse(local));
    } catch (e) {
      console.warn("Failed to parse local site settings:", e);
    }
  }

  const docRef = doc(db, 'settings', 'site');
  const unsub = onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as SiteSettings;
      localStorage.setItem('lwe_site_settings_fallback', JSON.stringify(data));
      callback(data);
    } else {
      callback({});
    }
  }, (error) => {
    console.warn("Firestore watchSiteSettings failed:", error);
    // If watch fails (e.g., when not signed in on the Login page), keep the cached local storage settings
  });
  return unsub;
}

/**
 * Save site-wide settings
 */
export async function saveSiteSettings(settings: SiteSettings) {
  // Sanitize settings to remove undefined values before saving to Firestore
  const sanitized = JSON.parse(JSON.stringify(settings)) as SiteSettings;
  localStorage.setItem('lwe_site_settings_fallback', JSON.stringify(sanitized));

  try {
    const docRef = doc(db, 'settings', 'site');
    await setDoc(docRef, sanitized, { merge: true });
  } catch (error) {
    console.error("Firestore saveSiteSettings failed:", error);
    throw error;
  }
}

/**
 * Watch all lineups in real-time
 */
export function watchLineups(callback: (lineups: Lineup[]) => void) {
  const q = query(collection(db, 'lineups'));
  const unsub = onSnapshot(q, (snapshot) => {
    const lineupsList: Lineup[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      lineupsList.push({
        id: doc.id,
        name: data.name || doc.id,
        logoUrl: data.logoUrl || '',
      });
    });

    // Default fallbacks if none configured
    if (lineupsList.length === 0) {
      callback([
        { id: '1st Lineup', name: '1st Lineup', logoUrl: '' },
        { id: 'second lineup', name: 'second lineup', logoUrl: '' }
      ]);
    } else {
      callback(lineupsList);
    }
  }, (error) => {
    console.warn("Firestore watchLineups failed, returning defaults:", error);
    callback([
      { id: '1st Lineup', name: '1st Lineup', logoUrl: '' },
      { id: 'second lineup', name: 'second lineup', logoUrl: '' }
    ]);
  });
  return unsub;
}

/**
 * Save lineup logo
 */
export async function saveLineupLogo(lineupId: string, name: string, logoUrl: string) {
  try {
    const docRef = doc(db, 'lineups', lineupId);
    await setDoc(docRef, { name, logoUrl }, { merge: true });
  } catch (error) {
    console.error("Firestore saveLineupLogo failed:", error);
    throw error;
  }
}

