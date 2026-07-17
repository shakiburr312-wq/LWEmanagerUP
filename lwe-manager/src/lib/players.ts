import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  increment, 
  onSnapshot, 
  query, 
  getDoc,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PlayerProfile, SalaryTransaction } from '../types';

const LOCAL_STORAGE_KEY = 'lwe_players_fallback_v2';

const DEFAULT_PLAYERS: PlayerProfile[] = [
  { id: 'p1', userId: 'u1', name: 'Zeeshan', role: 'IGL', status: 'active', kd: 1.8, kills: 450, damage: 89000, salary: 500, warnings: 0, joinedAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(), wallet: 0, matches: 30, booyahs: 12, lineup: '1st Lineup' },
  { id: 'p2', userId: 'u2', name: 'Tanvir', role: 'Fragger', status: 'active', kd: 1.5, kills: 380, damage: 72000, salary: 400, warnings: 1, joinedAt: new Date(Date.now() - 25*24*60*60*1000).toISOString(), wallet: 0, matches: 28, booyahs: 10, lineup: '1st Lineup' },
  { id: 'p3', userId: 'u3', name: 'Raju', role: 'Fragger', status: 'active', kd: 1.2, kills: 310, damage: 64000, salary: 350, warnings: 3, joinedAt: new Date(Date.now() - 20*24*60*60*1000).toISOString(), wallet: 0, matches: 25, booyahs: 8, lineup: 'second lineup' },
  { id: 'p4', userId: 'u4', name: 'Asif', role: 'Sniper', status: 'active', kd: 2.1, kills: 520, damage: 95000, salary: 600, warnings: 0, joinedAt: new Date(Date.now() - 15*24*60*60*1000).toISOString(), wallet: 0, matches: 32, booyahs: 15, lineup: '1st Lineup' }
];

let playerWatchers: ((players: PlayerProfile[]) => void)[] = [];

function notifyPlayerWatchers(players: PlayerProfile[]) {
  playerWatchers.forEach(cb => cb(players));
}

/**
 * Listens to all players in the roster in real-time
 */
export function watchPlayers(callback: (players: PlayerProfile[]) => void) {
  playerWatchers.push(callback);

  // Deliver current local state immediately
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_PLAYERS;
  callback(initial);

  const q = query(collection(db, 'players'));

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const playersList: PlayerProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        playersList.push({
          id: doc.id,
          userId: data.userId || doc.id,
          name: data.name || '',
          role: data.role || 'Fragger',
          status: data.status || 'active',
          kd: Number(data.kd) || 0,
          kills: Number(data.kills) || 0,
          damage: Number(data.damage) || 0,
          salary: Number(data.salary) || 0,
          warnings: Number(data.warnings) || 0,
          joinedAt: data.joinedAt || new Date().toISOString(),
          wallet: Number(data.wallet) || 0,
          matches: Number(data.matches) || 0,
          booyahs: Number(data.booyahs) || 0,
          lineup: data.lineup || '1st Lineup',
          photoUrl: data.photoUrl || '',
          mvpPhotoUrl: data.mvpPhotoUrl || '',
          lineupId: data.lineupId || '',
          isOnline: data.isOnline || false,
          lastActive: data.lastActive || '',
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(playersList));
      callback(playersList);
    },
    (error) => {
      console.warn("Firestore watchPlayers failed, using local storage fallback:", error);
    }
  );

  return () => {
    playerWatchers = playerWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Manually add a player (usually by Admin)
 */
export async function addPlayer(player: Omit<PlayerProfile, 'id'>) {
  const playerWithId = {
    ...player,
    joinedAt: new Date().toISOString()
  };

  // Optimistic save in localStorage
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: PlayerProfile[] = local ? JSON.parse(local) : [...DEFAULT_PLAYERS];
  const mockId = 'player_local_' + Math.random().toString(36).substr(2, 9);
  list.push({ ...playerWithId, id: mockId });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  notifyPlayerWatchers(list);

  try {
    const playersRef = collection(db, 'players');
    const docRef = await addDoc(playersRef, playerWithId);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore addPlayer failed, saved locally:", error);
    return mockId;
  }
}

/**
 * Update general player statistics or profile fields
 */
export async function updatePlayer(playerId: string, data: Partial<PlayerProfile>) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PlayerProfile[] = JSON.parse(local);
    const index = list.findIndex(p => p.id === playerId);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyPlayerWatchers(list);
    }
  }

  try {
    const playerRef = doc(db, 'players', playerId);
    await updateDoc(playerRef, data);
  } catch (error) {
    console.warn("Firestore updatePlayer failed, updated locally only:", error);
    throw error;
  }
}

export async function updatePlayerWallet(playerId: string, amountChange: number) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PlayerProfile[] = JSON.parse(local);
    const index = list.findIndex(p => p.id === playerId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        wallet: (list[index].wallet || 0) + amountChange
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyPlayerWatchers(list);
    }
  }

  try {
    const playerRef = doc(db, 'players', playerId);
    await setDoc(playerRef, {
      wallet: increment(amountChange)
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore updatePlayerWallet failed, updated locally only:", error);
  }
}

/**
 * Adds a salary payment:
 * 1. Increment player's wallet balance
 * 2. Add log entry to salaryTransactions collection
 * 3. Add log entry to central financeTransactions collection
 */
export async function addSalaryPayment(
  playerId: string, 
  playerName: string, 
  amount: number, 
  reason: string, 
  addedBy: string,
  paymentMethod: 'bKash' | 'Nagad',
  adminId?: string,
  payoutMode: 'direct' | 'wallet_withdraw' | 'wallet_credit' = 'direct'
) {
  // 1. Update player's wallet balance locally and in Firestore depending on payoutMode
  if (payoutMode === 'wallet_withdraw') {
    await updatePlayerWallet(playerId, -amount);
  } else if (payoutMode === 'wallet_credit') {
    await updatePlayerWallet(playerId, amount);
  }

  // 2. Update Admin's Wallet (main balance) locally and in Firestore if adminId is provided
  if (adminId) {
    await updatePlayerWallet(adminId, -amount);
  }

  // Record mock transactions locally as well to remain responsive
  try {
    const localFinance = localStorage.getItem('lwe_finance_tx_fallback_v2');
    const fList = localFinance ? JSON.parse(localFinance) : [];
    fList.unshift({
      id: 'fin_local_' + Math.random().toString(36).substr(2, 9),
      type: 'salary_payment',
      amount,
      description: `Salary Paid to ${playerName} via ${paymentMethod} (${reason} - ${payoutMode === 'wallet_withdraw' ? 'Wallet Withdrawal' : payoutMode === 'wallet_credit' ? 'Wallet Credit' : 'Direct Payout'})`,
      addedBy,
      date: new Date().toISOString()
    });
    localStorage.setItem('lwe_finance_tx_fallback_v2', JSON.stringify(fList));
  } catch (e) {
    console.warn("Failed to update local finance list during salary:", e);
  }

  try {
    const salaryTransRef = collection(db, 'salaryTransactions');
    const financeTransRef = collection(db, 'financeTransactions');
    const date = new Date().toISOString();

    await addDoc(salaryTransRef, {
      playerId,
      playerName,
      amount,
      reason: `${reason} (${payoutMode === 'wallet_withdraw' ? 'Wallet Withdrawal' : payoutMode === 'wallet_credit' ? 'Wallet Credit' : 'Direct Payout'})`,
      addedBy,
      paymentMethod,
      date
    });

    await addDoc(financeTransRef, {
      type: 'salary_payment',
      amount,
      description: `Salary Paid to ${playerName} via ${paymentMethod} (${reason} - ${payoutMode === 'wallet_withdraw' ? 'Wallet Withdrawal' : payoutMode === 'wallet_credit' ? 'Wallet Credit' : 'Direct Payout'})`,
      addedBy,
      date
    });
  } catch (error) {
    console.warn("Firestore addSalaryPayment logging failed:", error);
  }
}

/**
 * Issue a Warning to a player
 * 1. Increments player.warnings by 1
 */
export async function issueWarning(playerId: string, adminName: string, reason: string) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PlayerProfile[] = JSON.parse(local);
    const index = list.findIndex(p => p.id === playerId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        warnings: (list[index].warnings || 0) + 1
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyPlayerWatchers(list);
    }
  }

  try {
    const playerRef = doc(db, 'players', playerId);
    const warningsLogRef = collection(db, 'warningLogs');
    const date = new Date().toISOString();

    await updateDoc(playerRef, {
      warnings: increment(1)
    });

    await addDoc(warningsLogRef, {
      playerId,
      adminName,
      reason,
      date
    });
  } catch (error) {
    console.warn("Firestore issueWarning failed, updated locally only:", error);
  }
}

/**
 * Set Banned status for a player
 * 1. Updates players/{playerId} status
 * 2. If playerId is also a registered user's uid, updates users/{playerId} status to 'banned' or 'active'
 */
export async function setBanStatus(playerId: string, isBanned: boolean) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PlayerProfile[] = JSON.parse(local);
    const index = list.findIndex(p => p.id === playerId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        status: isBanned ? 'banned' : 'active'
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyPlayerWatchers(list);
    }
  }

  try {
    const playerRef = doc(db, 'players', playerId);
    const userRef = doc(db, 'users', playerId);
    
    const playerStatus = isBanned ? 'banned' : 'active';
    const userStatus = isBanned ? 'banned' : 'active';

    await updateDoc(playerRef, {
      status: playerStatus
    });

    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        status: userStatus
      });
    }
  } catch (error) {
    console.warn("Firestore setBanStatus failed, updated locally only:", error);
  }
}

let salaryTransactionWatchers: ((txs: SalaryTransaction[]) => void)[] = [];

function notifySalaryTransactionWatchers(txs: SalaryTransaction[]) {
  salaryTransactionWatchers.forEach(cb => cb(txs));
}

/**
 * Watch salary payout transactions in real-time
 */
export function watchSalaryTransactions(callback: (txs: SalaryTransaction[]) => void) {
  salaryTransactionWatchers.push(callback);

  // Deliver current local state immediately
  const local = localStorage.getItem('lwe_salary_transactions_fallback_v1');
  const initial = local ? JSON.parse(local) : [];
  callback(initial);

  const q = query(collection(db, 'salaryTransactions'), orderBy('date', 'desc'));

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const txsList: SalaryTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        txsList.push({
          id: doc.id,
          playerId: data.playerId || '',
          playerName: data.playerName || '',
          amount: Number(data.amount) || 0,
          reason: data.reason || '',
          addedBy: data.addedBy || '',
          date: data.date || '',
          paymentMethod: data.paymentMethod || undefined
        });
      });
      localStorage.setItem('lwe_salary_transactions_fallback_v1', JSON.stringify(txsList));
      notifySalaryTransactionWatchers(txsList);
    },
    (error) => {
      console.warn("Firestore watchSalaryTransactions failed, using local fallback:", error);
    }
  );

  return () => {
    salaryTransactionWatchers = salaryTransactionWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Update player's online presence status
 */
export async function updatePlayerPresence(playerId: string, isOnline: boolean) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: PlayerProfile[] = JSON.parse(local);
    const index = list.findIndex(p => p.id === playerId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        isOnline,
        lastActive: new Date().toISOString()
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyPlayerWatchers(list);
    }
  }

  try {
    const playerRef = doc(db, 'players', playerId);
    await setDoc(playerRef, {
      isOnline,
      lastActive: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore updatePlayerPresence failed:", error);
  }
}
