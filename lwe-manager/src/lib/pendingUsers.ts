import { 
  collection, 
  doc, 
  updateDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser } from '../types';

const LOCAL_STORAGE_KEY = 'lwe_pending_users_fallback';

let pendingWatchers: ((users: AppUser[]) => void)[] = [];

function notifyPendingWatchers(users: AppUser[]) {
  pendingWatchers.forEach(cb => cb(users));
}

/**
 * Listens to all users with pending status in real-time
 */
export function watchPendingUsers(callback: (users: AppUser[]) => void) {
  pendingWatchers.push(callback);

  // Return local pending users immediately
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : [];
  callback(initial);

  const q = query(
    collection(db, 'users'), 
    where('status', '==', 'pending')
  );

  const unsub = onSnapshot(
    q, 
    (snapshot) => {
      const pending: AppUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        pending.push({
          uid: doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'player',
          status: data.status || 'pending',
          inGameRole: data.inGameRole || 'Fragger',
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString(),
          lineup: data.lineup || '1st Lineup',
        });
      });
      
      // Sort in-memory to avoid Firestore index requirement
      pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pending));
      notifyPendingWatchers(pending);
    },
    (error) => {
      console.warn("Firestore watchPendingUsers failed, using local storage fallback:", error);
    }
  );

  return () => {
    pendingWatchers = pendingWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Approve a pending user:
 * 1. Update users/{uid} to status: 'active'
 * 2. Create players/{uid} with initial values
 */
export async function approveUser(uid: string, name: string, email: string, inGameRole: string = 'Fragger') {
  // Update local pending list (remove approved user)
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: AppUser[] = JSON.parse(local);
    const updated = list.filter(u => u.uid !== uid);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyPendingWatchers(updated);
  }

  // Add the approved user as a player in local storage immediately
  try {
    const localPlayers = localStorage.getItem('lwe_players_fallback_v2');
    const pList = localPlayers ? JSON.parse(localPlayers) : [];
    if (!pList.some((p: any) => p.id === uid || p.userId === uid)) {
      pList.push({
        id: uid,
        userId: uid,
        name: name,
        role: inGameRole,
        status: 'active',
        kd: 0,
        kills: 0,
        damage: 0,
        salary: 0,
        warnings: 0,
        joinedAt: new Date().toISOString(),
        wallet: 0,
        matches: 0,
        booyahs: 0,
        lineup: '1st Lineup'
      });
      localStorage.setItem('lwe_players_fallback_v2', JSON.stringify(pList));
    }
  } catch (e) {
    console.warn("Error updating local player list during approval:", e);
  }

  try {
    const userRef = doc(db, 'users', uid);
    const playerRef = doc(db, 'players', uid);

    await updateDoc(userRef, {
      status: 'active'
    });

    const userSnap = await getDoc(userRef);
    const lineup = userSnap.exists() ? (userSnap.data().lineup || '1st Lineup') : '1st Lineup';

    await setDoc(playerRef, {
      userId: uid,
      name: name,
      role: inGameRole,
      status: 'active',
      kd: 0,
      kills: 0,
      damage: 0,
      salary: 0,
      warnings: 0,
      joinedAt: new Date().toISOString(),
      wallet: 0,
      matches: 0,
      booyahs: 0,
      lineup: lineup
    });
  } catch (error) {
    console.warn("Firestore approveUser failed, approved locally:", error);
  }
}

/**
 * Reject a pending user: update users/{uid} to status: 'rejected'
 */
export async function rejectUser(uid: string) {
  // Update local pending list (remove rejected user)
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: AppUser[] = JSON.parse(local);
    const updated = list.filter(u => u.uid !== uid);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyPendingWatchers(updated);
  }

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      status: 'rejected'
    });
  } catch (error) {
    console.warn("Firestore rejectUser failed, rejected locally:", error);
  }
}
