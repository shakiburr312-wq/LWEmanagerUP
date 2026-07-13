import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  deleteDoc,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { InvestmentCampaign } from '../types';
import { updatePlayerWallet } from './players';

const CAMPAIGNS_COLLECTION = 'investmentCampaigns';
const LOCAL_STORAGE_KEY = 'lwe_campaigns_fallback_v2';

const DEFAULT_CAMPAIGNS: InvestmentCampaign[] = [];

let campaignWatchers: ((campaigns: InvestmentCampaign[]) => void)[] = [];

function notifyCampaignWatchers(campaigns: InvestmentCampaign[]) {
  campaignWatchers.forEach(cb => cb(campaigns));
}

export function watchInvestmentCampaigns(callback: (campaigns: InvestmentCampaign[]) => void) {
  campaignWatchers.push(callback);

  // Load from local storage immediately for speed/resilience
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const initial = local ? JSON.parse(local) : DEFAULT_CAMPAIGNS;
  callback(initial);

  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    orderBy('date', 'desc')
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const campaigns: InvestmentCampaign[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        campaigns.push({
          id: docSnap.id,
          title: data.title || '',
          category: data.category || 'scrim',
          amount: Number(data.amount) || 0,
          date: data.date || '',
          status: data.status || 'active',
          prizeAmount: data.prizeAmount !== undefined ? Number(data.prizeAmount) : undefined,
          resolvedAt: data.resolvedAt || undefined,
          addedBy: data.addedBy || 'Admin',
          lineup: data.lineup || '1st Lineup'
        });
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(campaigns));
      notifyCampaignWatchers(campaigns);
    },
    (error) => {
      console.warn("Firestore watchInvestmentCampaigns failed, using local storage fallback:", error);
    }
  );

  return () => {
    campaignWatchers = campaignWatchers.filter(cb => cb !== callback);
    unsub();
  };
}

export async function addInvestmentCampaign(
  title: string,
  category: 'champion rush' | 'scrim' | 'paid',
  amount: number,
  date: string,
  addedBy: string,
  lineup: '1st Lineup' | 'second lineup' = '1st Lineup',
  adminId?: string
) {
  const campaignData = {
    title,
    category,
    amount,
    date,
    status: 'active' as const,
    addedBy,
    lineup,
    createdAt: new Date().toISOString()
  };

  // Optimistic/Fallback local save
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  const list: InvestmentCampaign[] = local ? JSON.parse(local) : [...DEFAULT_CAMPAIGNS];
  const mockId = 'campaign_local_' + Math.random().toString(36).substr(2, 9);
  
  // We do NOT modify admin's wallet for investments or prize winnings anymore as per user request: "admin er wallet e just admin er salary count korba onno kichu na.."
  list.unshift({ ...campaignData, id: mockId });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  notifyCampaignWatchers(list);

  try {
    const docRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignData);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore addInvestmentCampaign failed, saved locally:", error);
    return mockId;
  }
}

export async function resolveInvestmentCampaign(
  campaignId: string,
  status: 'win' | 'lose',
  prizeAmount?: number,
  adminId?: string
) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: InvestmentCampaign[] = JSON.parse(local);
    const index = list.findIndex(c => c.id === campaignId);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        status,
        resolvedAt: new Date().toISOString(),
        prizeAmount: status === 'win' && prizeAmount !== undefined ? prizeAmount : list[index].prizeAmount
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      notifyCampaignWatchers(list);
    }
  }

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const updateData: any = {
    status,
    resolvedAt: new Date().toISOString()
  };

  if (status === 'win' && prizeAmount !== undefined) {
    updateData.prizeAmount = prizeAmount;
  }

  try {
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.warn("Firestore resolveInvestmentCampaign failed, updated locally only:", error);
  }
}

/**
 * Manually delete an investment campaign (Admin feature)
 */
export async function deleteInvestmentCampaign(campaignId: string) {
  // Update local storage first
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    const list: InvestmentCampaign[] = JSON.parse(local);
    const updated = list.filter(c => c.id !== campaignId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyCampaignWatchers(updated);
  }

  // Delete from Firestore (only if not a mock local ID)
  if (!campaignId.startsWith('campaign_local_')) {
    const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    await deleteDoc(docRef);
  }
}
