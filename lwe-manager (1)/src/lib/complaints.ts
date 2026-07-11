import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Complaint } from '../types';

const LOCAL_STORAGE_KEY = 'lwe_complaints_fallback';

const DEFAULT_COMPLAINTS: Complaint[] = [
  { id: 'cmp1', playerId: 'u2', playerName: 'Tanvir', subject: 'In-game lag issues during scrim', message: 'I have been experiencing massive server lag in the 1st lineup scrims. Please investigate.', status: 'pending', date: new Date(Date.now() - 1*24*60*60*1000).toISOString() }
];

let complaintWatchers: ((complaints: Complaint[]) => void)[] = [];

function notifyComplaintWatchers(complaints: Complaint[]) {
  complaintWatchers.forEach(cb => cb(complaints));
}

/**
 * Add a new complaint from a player
 */
export async function addComplaint(playerId: string, playerName: string, subject: string, message: string) {
  const complaintData = {
    playerId,
    playerName,
    subject,
    message,
    status: 'pending' as const,
    date: new Date().toISOString()
  };

  // Optimistic/Fallback local save
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: Complaint[] = local ? JSON.parse(local) : [...DEFAULT_COMPLAINTS];
  const mockId = 'complaint_local_' + Math.random().toString(36).substr(2, 9);
  list.unshift({ ...complaintData, id: mockId });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  notifyComplaintWatchers(list);

  try {
    const complaintsRef = collection(db, 'complaints');
    await addDoc(complaintsRef, complaintData);
  } catch (error) {
    console.warn("Firestore addComplaint failed, saved locally:", error);
  }
}

/**
 * Reply to and resolve a complaint (Admin action)
 */
export async function replyToComplaint(complaintId: string, reply: string, replyBy: string) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: Complaint[] = JSON.parse(local);
    const index = list.findIndex(c => c.id === complaintId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        reply,
        replyBy,
        status: 'resolved',
        repliedAt: new Date().toISOString()
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyComplaintWatchers(list);
    }
  }

  try {
    const complaintRef = doc(db, 'complaints', complaintId);
    await updateDoc(complaintRef, {
      reply,
      replyBy,
      status: 'resolved',
      repliedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Firestore replyToComplaint failed, updated locally:", error);
  }
}

/**
 * Watch all complaints in real-time (Admins)
 */
export function watchComplaints(callback: (complaints: Complaint[]) => void) {
  complaintWatchers.push(callback);

  // Load from local storage immediately for speed/resilience
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_COMPLAINTS;
  callback(initial);

  const q = query(
    collection(db, 'complaints'),
    orderBy('date', 'desc')
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const list: Complaint[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          playerId: data.playerId || '',
          playerName: data.playerName || '',
          subject: data.subject || '',
          message: data.message || '',
          status: data.status || 'pending',
          reply: data.reply,
          replyBy: data.replyBy,
          date: data.date || new Date().toISOString(),
          repliedAt: data.repliedAt,
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyComplaintWatchers(list);
    },
    (error) => {
      console.warn("Firestore watchComplaints failed, using local storage fallback:", error);
    }
  );

  return () => {
    complaintWatchers = complaintWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Watch specific player's complaints (Player view)
 */
export function watchPlayerComplaints(playerId: string, callback: (complaints: Complaint[]) => void) {
  // Return current filtered local copy immediately
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: Complaint[] = local ? JSON.parse(local) : DEFAULT_COMPLAINTS;
  const filtered = list.filter(c => c.playerId === playerId);
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  callback(filtered);

  const q = query(
    collection(db, 'complaints'),
    where('playerId', '==', playerId)
  );

  // Create a listener that updates filtered player complaints specifically
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const list: Complaint[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          playerId: data.playerId || '',
          playerName: data.playerName || '',
          subject: data.subject || '',
          message: data.message || '',
          status: data.status || 'pending',
          reply: data.reply,
          replyBy: data.replyBy,
          date: data.date || new Date().toISOString(),
          repliedAt: data.repliedAt,
        });
      });
      
      // Sort in-memory to avoid Firestore index requirement
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Update local storage representation for this player's logs
      const allLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
      let allList: Complaint[] = allLocal ? JSON.parse(allLocal) : [...DEFAULT_COMPLAINTS];
      // Filter out old ones of this player, append new ones
      allList = allList.filter(c => c.playerId !== playerId).concat(list);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allList));
      
      callback(list);
    },
    (error) => {
      console.warn("Firestore watchPlayerComplaints failed, using local storage fallback:", error);
    }
  );

  return unsub;
}
