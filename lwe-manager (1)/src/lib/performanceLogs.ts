// New file /src/lib/performanceLogs.ts - Real-time subscription and log addition for player daily stats
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { PerformanceLog } from '../types';

const COLLECTION_NAME = 'performanceLogs';
const LOCAL_STORAGE_KEY = 'lwe_performance_logs_fallback_v1';

let logsWatchers: ((logs: PerformanceLog[]) => void)[] = [];

function notifyWatchers(logs: PerformanceLog[]) {
  logsWatchers.forEach(cb => cb(logs));
}

/**
 * Watch performance logs in real-time
 */
export function watchPerformanceLogs(callback: (logs: PerformanceLog[]) => void) {
  logsWatchers.push(callback);

  // Load from local storage immediately for speed
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : [];
  callback(initial);

  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('date', 'desc')
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const logs: PerformanceLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          playerId: data.playerId || '',
          playerName: data.playerName || '',
          date: data.date || '',
          matches: Number(data.matches) || 0,
          booyahs: Number(data.booyahs) || 0,
          kills: Number(data.kills) || 0,
          damage: Number(data.damage) || 0,
          addedBy: data.addedBy || 'Admin'
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
      notifyWatchers(logs);
    },
    (error) => {
      console.warn("Firestore watchPerformanceLogs failed, using local storage fallback:", error);
    }
  );

  return () => {
    logsWatchers = logsWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Add a list of performance logs (bulk saving)
 */
export async function addPerformanceLogs(newLogs: Omit<PerformanceLog, 'id'>[]) {
  if (newLogs.length === 0) return;

  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const currentList: PerformanceLog[] = local ? JSON.parse(local) : [];
  
  const savedLogsWithId = newLogs.map(log => ({
    ...log,
    id: 'log_local_' + Math.random().toString(36).substr(2, 9)
  }));

  const updatedList = [...savedLogsWithId, ...currentList];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
  notifyWatchers(updatedList);

  // Save to Firestore
  const promises = newLogs.map(log => addDoc(collection(db, COLLECTION_NAME), log));
  await Promise.all(promises);
}

/**
 * Update an existing performance log entry
 */
export async function updatePerformanceLog(logId: string, updatedFields: Partial<PerformanceLog>) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PerformanceLog[] = JSON.parse(local);
    const idx = list.findIndex(log => log.id === logId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatedFields };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyWatchers(list);
    }
  }

  // Update in Firestore (only if not a mock local ID)
  if (!logId.startsWith('log_local_')) {
    const docRef = doc(db, COLLECTION_NAME, logId);
    await updateDoc(docRef, updatedFields);
  }
}

/**
 * Delete a performance log entry
 */
export async function deletePerformanceLog(logId: string) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PerformanceLog[] = JSON.parse(local);
    const updated = list.filter(log => log.id !== logId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyWatchers(updated);
  }

  // Delete in Firestore (only if not a mock local ID)
  if (!logId.startsWith('log_local_')) {
    const docRef = doc(db, COLLECTION_NAME, logId);
    await deleteDoc(docRef);
  }
}

