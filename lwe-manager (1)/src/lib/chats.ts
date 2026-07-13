import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  setDoc
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
 * Watch real-time chat messages for a specific channel/lineup division
 */
export function watchChats(
  channel: string,
  callback: (messages: ChatMessage[]) => void
) {
  if (!chatWatchers[channel]) {
    chatWatchers[channel] = [];
  }
  chatWatchers[channel].push(callback);

  // Load from local storage fallback immediately for lightning-fast loads
  const localKey = LOCAL_STORAGE_KEY_PREFIX + channel.replace(/\s+/g, '_');
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
        if (data.lineup === channel) {
          messages.push({
            id: doc.id,
            lineup: data.lineup || channel,
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
      notifyChatWatchers(channel, messages);
    },
    (error) => {
      console.warn(`Firestore watchChats failed for ${channel}, using local fallback:`, error);
    }
  );

  return () => {
    chatWatchers[channel] = chatWatchers[channel].filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Send a message to any channel (lineup or Global)
 */
export async function sendChatMessage(
  channel: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  senderPhotoUrl: string,
  message: string
) {
  const messageData = {
    lineup: channel,
    senderId,
    senderName,
    senderRole,
    senderPhotoUrl,
    message,
    timestamp: new Date().toISOString()
  };

  // Optimistic local update
  const localKey = LOCAL_STORAGE_KEY_PREFIX + channel.replace(/\s+/g, '_');
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
  notifyChatWatchers(channel, list);

  try {
    const docRef = await addDoc(collection(db, CHATS_COLLECTION), messageData);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore sendChatMessage failed, message saved locally only:", error);
    return mockId;
  }
}

/**
 * Watch real-time chat messages for a specific lineup division
 */
export function watchLineupChats(
  lineup: '1st Lineup' | 'second lineup', 
  callback: (messages: ChatMessage[]) => void
) {
  return watchChats(lineup, callback);
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
  return sendChatMessage(lineup, senderId, senderName, senderRole, senderPhotoUrl, message);
}

/**
 * Update the user's typing status in Firestore
 */
export async function updateTypingStatus(
  userId: string,
  name: string,
  lineup: string,
  isTyping: boolean
) {
  try {
    const typingRef = doc(db, 'typingStates', userId);
    await setDoc(typingRef, {
      userId,
      name,
      lineup,
      isTyping,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore updateTypingStatus failed:", error);
  }
}

/**
 * Watch typing status of other players in the lineup
 */
export function watchLineupTyping(
  lineup: string,
  currentUserId: string,
  callback: (usersTyping: string[]) => void
) {
  const q = query(
    collection(db, 'typingStates'),
    where('lineup', '==', lineup),
    where('isTyping', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const typingNames: string[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.userId !== currentUserId) {
          // Safety check: only count as typing if updated in the last 12 seconds
          const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).getTime() : 0;
          if (now - lastUpdated < 12000) {
            typingNames.push(data.name || 'Someone');
          }
        }
      });
      callback(typingNames);
    },
    (error) => {
      console.warn("Firestore watchLineupTyping failed:", error);
    }
  );
}
