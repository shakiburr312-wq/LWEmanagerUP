import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { SalaryRequest } from '../types';
import { updatePlayerWallet } from './players';
import { addFinanceTransaction } from './finance';

const REQUESTS_COLLECTION = 'salaryRequests';
const LOCAL_STORAGE_KEY = 'lwe_salary_requests_fallback_v1';

let requestWatchers: ((requests: SalaryRequest[]) => void)[] = [];

function notifyRequestWatchers(requests: SalaryRequest[]) {
  requestWatchers.forEach(cb => cb(requests));
}

export function watchSalaryRequests(callback: (requests: SalaryRequest[]) => void) {
  requestWatchers.push(callback);

  // Load from local storage immediately for speed
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : [];
  callback(initial);

  const q = query(
    collection(db, REQUESTS_COLLECTION),
    orderBy('date', 'desc')
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const requests: SalaryRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          playerId: data.playerId || '',
          playerName: data.playerName || '',
          amount: Number(data.amount) || 0,
          reason: data.reason || '',
          status: data.status || 'pending',
          date: data.date || '',
          approvedAt: data.approvedAt || undefined,
          approvedBy: data.approvedBy || undefined,
          paymentMethod: data.paymentMethod || undefined
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(requests));
      notifyRequestWatchers(requests);
    },
    (error) => {
      console.warn("Firestore watchSalaryRequests failed, using local storage fallback:", error);
    }
  );

  return () => {
    requestWatchers = requestWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

export async function addSalaryRequest(
  playerId: string,
  playerName: string,
  amount: number,
  reason: string
) {
  const requestData = {
    playerId,
    playerName,
    amount,
    reason,
    status: 'pending' as const,
    date: new Date().toISOString()
  };

  // Local fallback save
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: SalaryRequest[] = local ? JSON.parse(local) : [];
  const mockId = 'req_local_' + Math.random().toString(36).substr(2, 9);
  list.unshift({ ...requestData, id: mockId });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  notifyRequestWatchers(list);

  try {
    const docRef = await addDoc(collection(db, REQUESTS_COLLECTION), requestData);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore addSalaryRequest failed, saved locally:", error);
    return mockId;
  }
}

export async function approveSalaryRequest(
  requestId: string,
  playerId: string,
  playerName: string,
  amount: number,
  adminId: string,
  adminName: string,
  paymentMethod: 'bKash' | 'Nagad'
) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: SalaryRequest[] = JSON.parse(local);
    const index = list.findIndex(r => r.id === requestId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: adminName,
        paymentMethod
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyRequestWatchers(list);
    }
  }

  try {
    const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: adminName,
      paymentMethod
    });

    // 1. Deduct from Admin Wallet (organization balance)
    await updatePlayerWallet(adminId, -amount);

    // 2. Add to Player's Wallet
    await updatePlayerWallet(playerId, amount);

    // 3. Log into financeTransactions central log
    await addFinanceTransaction(
      'salary_payment',
      amount,
      `Salary Request Approved for ${playerName} via ${paymentMethod} (${requestId})`,
      adminName,
      adminId
    );

    // 4. Log into salaryTransactions
    const salaryTransRef = collection(db, 'salaryTransactions');
    await addDoc(salaryTransRef, {
      playerId,
      playerName,
      amount,
      reason: `Salary Request Approved: ${requestId}`,
      addedBy: adminName,
      paymentMethod,
      date: new Date().toISOString()
    });

  } catch (error) {
    console.warn("Firestore approveSalaryRequest failed:", error);
  }
}

export async function rejectSalaryRequest(
  requestId: string,
  adminName: string
) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: SalaryRequest[] = JSON.parse(local);
    const index = list.findIndex(r => r.id === requestId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        status: 'rejected',
        approvedAt: new Date().toISOString(),
        approvedBy: adminName
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyRequestWatchers(list);
    }
  }

  try {
    const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      approvedAt: new Date().toISOString(),
      approvedBy: adminName
    });
  } catch (error) {
    console.warn("Firestore rejectSalaryRequest failed:", error);
  }
}
