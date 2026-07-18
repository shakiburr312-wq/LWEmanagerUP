import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Announcement, AppUser } from '../types';

const ANNOUNCEMENTS_LOCAL_KEY = 'lwe_announcements_fallback_v1';
const USERS_LOCAL_KEY = 'lwe_active_users_fallback_v1';

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Welcome to the New LWE Manager!',
    content: 'We have launched the new live match campaign monitoring system, scoring metrics, and direct EmailJS integration. Stay tuned for matches!',
    createdBy: 'LWE Admin',
    createdAt: new Date(Date.now() - 24*60*60*1000).toISOString(),
    emailSent: true,
    recipientsCount: 4
  }
];

let announcementWatchers: ((announcements: Announcement[]) => void)[] = [];

function notifyAnnouncementWatchers(announcements: Announcement[]) {
  announcementWatchers.forEach(cb => cb(announcements));
}

/**
 * Listens to all announcements in real-time
 */
export function watchAnnouncements(callback: (announcements: Announcement[]) => void) {
  announcementWatchers.push(callback);

  // Deliver current local state immediately
  const local = localStorage.getItem(ANNOUNCEMENTS_LOCAL_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_ANNOUNCEMENTS;
  callback(initial);

  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const annList: Announcement[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        annList.push({
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          createdBy: data.createdBy || 'Admin',
          createdAt: data.createdAt || new Date().toISOString(),
          emailSent: !!data.emailSent,
          recipientsCount: Number(data.recipientsCount) || 0
        });
      });
      localStorage.setItem(ANNOUNCEMENTS_LOCAL_KEY, JSON.stringify(annList));
      callback(annList);
    },
    (error) => {
      console.warn("Firestore watchAnnouncements failed, using local storage fallback:", error);
    }
  );

  return () => {
    announcementWatchers = announcementWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Create a new Announcement
 */
export async function addAnnouncement(ann: Omit<Announcement, 'id'>) {
  const local = localStorage.getItem(ANNOUNCEMENTS_LOCAL_KEY);
  const list: Announcement[] = local ? JSON.parse(local) : [...DEFAULT_ANNOUNCEMENTS];
  const mockId = 'ann_local_' + Math.random().toString(36).substr(2, 9);
  
  const completeAnn = { ...ann, id: mockId };
  list.unshift(completeAnn);
  localStorage.setItem(ANNOUNCEMENTS_LOCAL_KEY, JSON.stringify(list));
  notifyAnnouncementWatchers(list);

  // Try Server API first
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ann)
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return data.id || mockId;
      }
      console.warn("Server API addAnnouncement failed, trying direct Firestore:", await response.text());
    } catch (e) {
      console.warn("Server API addAnnouncement failed with exception:", e);
    }
  }

  try {
    const annRef = collection(db, 'announcements');
    const docRef = await addDoc(annRef, ann);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore addAnnouncement failed, saved locally:", error);
    return mockId;
  }
}

/**
 * Watch active users to retrieve their emails for broadcasting
 */
export function watchActiveUsers(callback: (users: AppUser[]) => void) {
  // Deliver current local state immediately if any
  const local = localStorage.getItem(USERS_LOCAL_KEY);
  if (local) {
    callback(JSON.parse(local));
  }

  const q = query(
    collection(db, 'users'), 
    where('status', '==', 'active')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const activeUsers: AppUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        activeUsers.push({
          uid: doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'player',
          status: data.status || 'active',
          inGameRole: data.inGameRole || 'Fragger',
          createdAt: data.createdAt || '',
          lineup: data.lineup || '1st Lineup'
        });
      });
      localStorage.setItem(USERS_LOCAL_KEY, JSON.stringify(activeUsers));
      callback(activeUsers);
    },
    (error) => {
      console.warn("Firestore watchActiveUsers failed, using local fallback:", error);
    }
  );
}

/**
 * Update an existing Announcement
 */
export async function updateAnnouncement(id: string, ann: Partial<Omit<Announcement, 'id'>>) {
  const local = localStorage.getItem(ANNOUNCEMENTS_LOCAL_KEY);
  if (local) {
    const list: Announcement[] = JSON.parse(local);
    const index = list.findIndex(item => item.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...ann };
      localStorage.setItem(ANNOUNCEMENTS_LOCAL_KEY, JSON.stringify(list));
      notifyAnnouncementWatchers(list);
    }
  }

  // Try Server API first
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ann)
      });
      if (response.ok) {
        return;
      }
      console.warn("Server API updateAnnouncement failed, trying direct Firestore:", await response.text());
    } catch (e) {
      console.warn("Server API updateAnnouncement failed with exception:", e);
    }
  }

  try {
    const docRef = doc(db, 'announcements', id);
    await updateDoc(docRef, ann);
  } catch (error) {
    console.error("Firestore updateAnnouncement failed:", error);
    throw error;
  }
}

/**
 * Delete an existing Announcement
 */
export async function deleteAnnouncement(id: string) {
  const local = localStorage.getItem(ANNOUNCEMENTS_LOCAL_KEY);
  if (local) {
    const list: Announcement[] = JSON.parse(local);
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(ANNOUNCEMENTS_LOCAL_KEY, JSON.stringify(filtered));
    notifyAnnouncementWatchers(filtered);
  }

  // Try Server API first
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        return;
      }
      console.warn("Server API deleteAnnouncement failed, trying direct Firestore:", await response.text());
    } catch (e) {
      console.warn("Server API deleteAnnouncement failed with exception:", e);
    }
  }

  try {
    const docRef = doc(db, 'announcements', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Firestore deleteAnnouncement failed:", error);
    throw error;
  }
}

