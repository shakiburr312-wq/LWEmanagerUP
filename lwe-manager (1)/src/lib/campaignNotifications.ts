import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CampaignNotification {
  id: string;
  message: string;
  date: string;
  type: 'reminder' | 'win' | 'lose' | 'info';
  lineup?: '1st Lineup' | 'second lineup' | 'all';
}

const NOTIFICATIONS_COLLECTION = 'campaignNotifications';
const LOCAL_STORAGE_KEY = 'lwe_campaign_notifications_fallback';

const DEFAULT_NOTIFICATIONS: CampaignNotification[] = [
  {
    id: 'notif_default_1',
    message: 'Welcome to the Match Campaigns division. Active campaigns will stream here.',
    date: new Date().toISOString(),
    type: 'info',
    lineup: 'all'
  }
];

let notificationWatchers: ((notifs: CampaignNotification[]) => void)[] = [];

function notifyWatchers(notifs: CampaignNotification[]) {
  notificationWatchers.forEach(cb => cb(notifs));
}

export function watchCampaignNotifications(callback: (notifs: CampaignNotification[]) => void) {
  notificationWatchers.push(callback);

  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_NOTIFICATIONS;
  callback(initial);

  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    orderBy('date', 'desc'),
    limit(40)
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const list: CampaignNotification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          message: data.message || '',
          date: data.date || '',
          type: data.type || 'info',
          lineup: data.lineup || 'all'
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyWatchers(list);
    },
    (error) => {
      console.warn("Firestore watchCampaignNotifications failed, using local fallback:", error);
    }
  );

  return () => {
    notificationWatchers = notificationWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

export async function addCampaignNotification(
  message: string,
  type: 'reminder' | 'win' | 'lose' | 'info',
  lineup: '1st Lineup' | 'second lineup' | 'all' = 'all'
) {
  const notifData = {
    message,
    type,
    lineup,
    date: new Date().toISOString()
  };

  // Local optimistic update
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: CampaignNotification[] = local ? JSON.parse(local) : [...DEFAULT_NOTIFICATIONS];
  const mockId = 'notif_local_' + Math.random().toString(36).substr(2, 9);
  list.unshift({ ...notifData, id: mockId });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
  notifyWatchers(list);

  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notifData);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore addCampaignNotification failed, saved locally:", error);
    return mockId;
  }
}

export async function clearAllNotifications(notifs: CampaignNotification[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
  notifyWatchers([]);

  try {
    const deletePromises = notifs.map(n => {
      if (!n.id.startsWith('notif_local_')) {
        return deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, n.id));
      }
      return Promise.resolve();
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn("Firestore clearAllNotifications failed:", error);
  }
}
