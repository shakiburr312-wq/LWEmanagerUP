// Replacement of /src/types.ts - Updated to include seasonStartDate in MVPSettings and added PerformanceLog interface
export type UserRole = 'admin' | 'player';
export type UserStatus = 'pending' | 'active' | 'banned' | 'rejected';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  inGameRole?: string;
  wallet?: number;
  lineup?: '1st Lineup' | 'second lineup';
}

export interface PlayerProfile {
  id: string; // matches userId usually
  userId: string;
  name: string;
  role: string; // in-game role (e.g. Fragger, IGL, Sniper, Support)
  status: 'active' | 'inactive' | 'banned';
  kd: number;
  kills: number;
  damage: number;
  salary: number; // monthly salary rate or total
  warnings: number;
  joinedAt: string;
  wallet: number; // player's individual wallet balance
  matches?: number;
  booyahs?: number;
  lineup?: '1st Lineup' | 'second lineup';
  photoUrl?: string;
  mvpPhotoUrl?: string;
  lineupId?: string;
  isOnline?: boolean;
  lastActive?: string;
}

export interface Lineup {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface HeroBannerItem {
  id: string;
  imageUrl: string;
  title: string;
  linkUrl?: string;
}

export interface SiteSettings {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  logoUrl?: string;
  heroBanners?: HeroBannerItem[];
}

export interface SalaryTransaction {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  reason: string;
  addedBy: string; // admin name
  date: string;
  paymentMethod?: 'bKash' | 'Nagad';
}

export interface Complaint {
  id: string;
  playerId: string;
  playerName: string;
  subject: string;
  message: string;
  status: 'pending' | 'resolved';
  reply?: string;
  replyBy?: string;
  date: string;
  repliedAt?: string;
}

export interface FinanceTransaction {
  id: string;
  type: 'invest' | 'tournament_profit' | 'salary_payment' | 'withdraw';
  amount: number;
  description: string;
  date: string;
  addedBy: string;
}

export interface SalaryRequest {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  approvedAt?: string;
  approvedBy?: string;
  paymentMethod?: 'bKash' | 'Nagad';
}

export interface MVPSettings {
  kdWeight: number;
  killsWeight: number;
  damageWeight: number;
  seasonStartDate?: string;
}

export interface PerformanceLog {
  id?: string;
  playerId: string;
  playerName: string;
  date: string;
  matches: number;
  booyahs: number;
  kills: number;
  damage: number;
  addedBy: string;
}

export interface InvestmentCampaign {
  id: string;
  title: string;
  category: 'champion rush' | 'scrim' | 'paid';
  amount: number;
  date: string;
  status: 'active' | 'win' | 'lose';
  prizeAmount?: number;
  resolvedAt?: string;
  addedBy: string;
  lineup?: '1st Lineup' | 'second lineup';
}

export interface ChatMessage {
  id: string;
  lineup: '1st Lineup' | 'second lineup';
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderPhotoUrl?: string;
  message: string;
  timestamp: string;
}

