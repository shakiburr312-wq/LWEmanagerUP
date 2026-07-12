import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ChatMessage } from '../types';

const CHATS_COLLECTION = 'lineupChats';
const LOCAL_STORAGE_KEY_PREFIX = 'lwe_chats_fallback_';

let chatWatchers: { [lineup: string]: ((messages: ChatMessage[]) => void)[] } = {};

function notifyChatWatchers(lineup: string, messages: ChatMessage[]) {
  if (chatWatchers[lineup]) {
    chatWatchers[lineup].forEach(cb => cb(messages));
  }
}

/**
 * Watch real-time chat messages for a specific lineup division
 */
export function watchLineupChats(
  lineup: '1st Lineup' | 'second lineup', 
  callback: (messages: ChatMessage[]) => void
) {
  if (!chatWatchers[lineup]) {
    chatWatchers[lineup] = [];
  }
  chatWatchers[lineup].push(callback);

  // Load from local storage fallback immediately for lightning-fast loads
  const localKey = LOCAL_STORAGE_KEY_PREFIX + lineup.replace(/\s+/g, '_');
  const local = localStorage.getItem(localKey);
  const initial = local ? JSON.parse(local) : [];
  callback(initial);

  const q = query(
    collection(db, CHATS_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(150)
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.lineup === lineup) {
          messages.push({
            id: doc.id,
            lineup: data.lineup || lineup,
            senderId: data.senderId || '',
            senderName: data.senderName || '',
            senderRole: data.senderRole || '',
            senderPhotoUrl: data.senderPhotoUrl || '',
            message: data.message || '',
            timestamp: data.timestamp || ''
          });
        }
      });
      // Sort ascending for chronological view (the query fetched desc, we reverse it)
      messages.reverse();
      
      localStorage.setItem(localKey, JSON.stringify(messages));
      notifyChatWatchers(lineup, messages);
    },
    (error) => {
      console.warn(`Firestore watchLineupChats failed for ${lineup}, using local fallback:`, error);
    }
  );

  return () => {
    chatWatchers[lineup] = chatWatchers[lineup].filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Send a message to the lineup division chatbox
 */
export async function sendLineupChatMessage(
  lineup: '1st Lineup' | 'second lineup',
  senderId: string,
  senderName: string,
  senderRole: string,
  senderPhotoUrl: string,
  message: string
) {
  const messageData = {
    lineup,
    senderId,
    senderName,
    senderRole,
    senderPhotoUrl,
    message,
    timestamp: new Date().toISOString()
  };

  // Optimistic local update
  const localKey = LOCAL_STORAGE_KEY_PREFIX + lineup.replace(/\s+/g, '_');
  const local = localStorage.getItem(localKey);
  const list: ChatMessage[] = local ? JSON.parse(local) : [];
  const mockId = 'msg_local_' + Math.random().toString(36).substr(2, 9);
  
  const newMessage: ChatMessage = {
    ...messageData,
    id: mockId
  };
  
  list.push(newMessage);
  if (list.length > 50) {
    list.shift(); // keep last 50
  }
  localStorage.setItem(localKey, JSON.stringify(list));
  notifyChatWatchers(lineup, list);

  try {
    const docRef = await addDoc(collection(db, CHATS_COLLECTION), messageData);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore sendLineupChatMessage failed, message saved locally only:", error);
    return mockId;
  }
}
