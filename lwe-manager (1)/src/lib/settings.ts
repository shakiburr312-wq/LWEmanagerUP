// Replacement of /src/lib/settings.ts - Added seasonStartDate to settings and watch/save logic
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  getDoc,
  collection,
  query
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MVPSettings, SiteSettings, Lineup } from '../types';

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
        notifyWatchers(updated);
      } else {
        notifyWatchers(DEFAULT_SETTINGS);
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
 * Check and reset the season if 30 days have passed (Admin only writes)
 */
export async function checkAndResetSeason(settings: MVPSettings, isAdmin: boolean) {
  if (!settings.seasonStartDate) return;
  const start = new Date(settings.seasonStartDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  if (diffDays >= 30) {
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
 * Watch site-wide settings in real-time
 */
export function watchSiteSettings(callback: (settings: SiteSettings) => void) {
  const docRef = doc(db, 'settings', 'site');
  const unsub = onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as SiteSettings);
    } else {
      callback({});
    }
  }, (error) => {
    console.warn("Firestore watchSiteSettings failed:", error);
    callback({});
  });
  return unsub;
}

/**
 * Save site-wide settings
 */
export async function saveSiteSettings(settings: SiteSettings) {
  try {
    const docRef = doc(db, 'settings', 'site');
    await setDoc(docRef, settings, { merge: true });
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

