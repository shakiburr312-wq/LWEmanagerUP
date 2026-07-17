import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  updateDoc,
  deleteDoc,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FinanceTransaction } from '../types';
import { updatePlayerWallet } from './players';

const LOCAL_STORAGE_KEY = 'lwe_finance_tx_fallback_v2';

const DEFAULT_TRANSACTIONS: FinanceTransaction[] = [];

let financeWatchers: ((transactions: FinanceTransaction[]) => void)[] = [];

function notifyFinanceWatchers(transactions: FinanceTransaction[]) {
  financeWatchers.forEach(cb => cb(transactions));
}

/**
 * Add a new finance transaction (investment, tournament profit, salary payment, or withdrawal)
 */
export async function addFinanceTransaction(
  type: 'invest' | 'tournament_profit' | 'salary_payment' | 'withdraw',
  amount: number,
  description: string,
  addedBy: string,
  adminId?: string
) {
  const transactionData = {
    type,
    amount,
    description,
    addedBy,
    date: new Date().toISOString()
  };

  // Optimistic/Fallback local update
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: FinanceTransaction[] = local ? JSON.parse(local) : [...DEFAULT_TRANSACTIONS];
  const mockId = 'finance_local_' + Math.random().toString(36).substr(2, 9);
  list.unshift({ ...transactionData, id: mockId });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  notifyFinanceWatchers(list);

  try {
    const financeRef = collection(db, 'financeTransactions');
    await addDoc(financeRef, transactionData);

    // Adjust Admin Wallet (central balance) in Firestore if adminId is provided
    if (adminId) {
      let change = 0;
      if (type === 'invest' || type === 'tournament_profit') {
        change = amount;
      } else if (type === 'withdraw' || type === 'salary_payment') {
        change = -amount;
      }

      if (change !== 0) {
        await updatePlayerWallet(adminId, change);
      }
    }
  } catch (error) {
    console.warn("Firestore addFinanceTransaction failed, saved locally:", error);
  }
}

/**
 * Watch finance transactions in real-time
 */
export function watchFinanceTransactions(callback: (transactions: FinanceTransaction[]) => void) {
  financeWatchers.push(callback);

  // Deliver current local state immediately
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_TRANSACTIONS;
  callback(initial);

  const q = query(
    collection(db, 'financeTransactions'),
    orderBy('date', 'desc')
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const list: FinanceTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          type: data.type || 'invest',
          amount: Number(data.amount) || 0,
          description: data.description || '',
          date: data.date || new Date().toISOString(),
          addedBy: data.addedBy || 'System',
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyFinanceWatchers(list);
    },
    (error) => {
      console.warn("Firestore watchFinanceTransactions failed, using local storage fallback:", error);
    }
  );

  return () => {
    financeWatchers = financeWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

/**
 * Manually delete a ledger transaction (Admin feature)
 */
export async function deleteFinanceTransaction(txId: string) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: FinanceTransaction[] = JSON.parse(local);
    const updated = list.filter(t => t.id !== txId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyFinanceWatchers(updated);
  }

  // Delete from Firestore (only if not a mock local ID)
  if (!txId.startsWith('finance_local_')) {
    const docRef = doc(db, 'financeTransactions', txId);
    await deleteDoc(docRef);
  }
}

