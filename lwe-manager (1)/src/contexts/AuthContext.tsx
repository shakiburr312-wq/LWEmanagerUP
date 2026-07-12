import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, inGameRole?: string, lineup?: '1st Lineup' | 'second lineup') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [playerWallet, setPlayerWallet] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribePlayer: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }
      if (unsubscribePlayer) {
        unsubscribePlayer();
        unsubscribePlayer = null;
      }

      if (!fUser) {
        setUser(null);
        setPlayerWallet(0);
        setLoading(false);
        return;
      }

      // 1. Set up a real-time listener on the user's role and status document
      const userDocRef = doc(db, 'users', fUser.uid);
      unsubscribeUser = onSnapshot(
        userDocRef,
        (snapshot) => {
          const isChfpoint = fUser.email === 'chfpoint@gmail.com';
          
          if (isChfpoint) {
            const hasCorrectDoc = snapshot.exists() && 
                                  snapshot.data().role === 'admin' && 
                                  snapshot.data().status === 'active';
            if (!hasCorrectDoc) {
              setDoc(userDocRef, {
                uid: fUser.uid,
                name: (snapshot.exists() ? snapshot.data().name : fUser.displayName) || 'LWE Admin',
                email: fUser.email || 'chfpoint@gmail.com',
                role: 'admin',
                status: 'active',
                inGameRole: (snapshot.exists() ? snapshot.data().inGameRole : 'IGL') || 'IGL',
                createdAt: snapshot.exists() ? (snapshot.data().createdAt || new Date().toISOString()) : new Date().toISOString()
              }, { merge: true }).catch(err => {
                console.error("Error auto-creating or updating admin document in Firestore:", err);
              });
            }
          }

          if (snapshot.exists()) {
            const data = snapshot.data();
            const uRole = isChfpoint ? 'admin' : (data.role || 'player');
            const uStatus = isChfpoint ? 'active' : (data.status || 'pending');
            const uName = data.name || (isChfpoint ? 'LWE Admin' : 'Player');
            const uInGameRole = data.inGameRole || 'Fragger';
            const uLineup = data.lineup || '1st Lineup';
            const uCreatedAt = data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString();

            setUser({
              uid: fUser.uid,
              name: uName,
              email: data.email || '',
              role: uRole,
              status: uStatus,
              inGameRole: uInGameRole,
              createdAt: uCreatedAt,
              lineup: uLineup,
            });

            // Auto-create/sync player profile if they are active
            if (uStatus === 'active') {
              const playerRef = doc(db, 'players', fUser.uid);
              getDoc(playerRef).then((pSnap) => {
                if (!pSnap.exists()) {
                  setDoc(playerRef, {
                    userId: fUser.uid,
                    name: uName,
                    role: uInGameRole,
                    status: 'active',
                    kd: 0,
                    kills: 0,
                    damage: 0,
                    salary: isChfpoint ? 0 : 300, // default salary
                    warnings: 0,
                    joinedAt: uCreatedAt,
                    wallet: 0,
                    matches: 0,
                    booyahs: 0,
                    lineup: uLineup,
                    isOnline: true,
                    lastActive: new Date().toISOString()
                  }).catch(e => console.error("Failed to auto-create player profile:", e));
                }
              });
            }
          } else {
            // Handle case where auth user exists but Firestore user doesn't yet
            setUser({
              uid: fUser.uid,
              name: fUser.displayName || (isChfpoint ? 'LWE Admin' : 'Player'),
              email: fUser.email || '',
              role: isChfpoint ? 'admin' : 'player',
              status: isChfpoint ? 'active' : 'pending',
              inGameRole: 'Fragger',
              createdAt: new Date().toISOString(),
              lineup: '1st Lineup',
            });
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error watching user document (this is normal if Firestore rules are not yet configured):", error);
          const isChfpoint = fUser.email === 'chfpoint@gmail.com';
          setUser({
            uid: fUser.uid,
            name: fUser.displayName || (isChfpoint ? 'LWE Admin' : 'Player'),
            email: fUser.email || '',
            role: isChfpoint ? 'admin' : 'player',
            status: isChfpoint ? 'active' : 'pending',
            inGameRole: 'Fragger',
            createdAt: new Date().toISOString(),
            lineup: '1st Lineup',
          });
          setLoading(false);
        }
      );

      // 2. Set up listener on players/{uid} for the real-time wallet balance
      const playerDocRef = doc(db, 'players', fUser.uid);
      unsubscribePlayer = onSnapshot(
        playerDocRef,
        (pSnap) => {
          if (pSnap.exists()) {
            setPlayerWallet(pSnap.data().wallet || 0);
          } else {
            setPlayerWallet(0);
          }
        },
        (error) => {
          console.error("Error watching player wallet:", error);
          setPlayerWallet(0);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribePlayer) unsubscribePlayer();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string, inGameRole?: string, lineup: '1st Lineup' | 'second lineup' = '1st Lineup') => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      // Save the user details in firestore
      const role = email === 'chfpoint@gmail.com' ? 'admin' : 'player';
      const status = email === 'chfpoint@gmail.com' ? 'active' : 'pending';
      const userPath = `users/${uid}`;
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          name,
          email,
          role,
          status,
          inGameRole: inGameRole || 'Fragger',
          lineup,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, userPath);
      }
    } catch (error) {
      throw error;
    }
  };

  // Presence Tracking Effect
  useEffect(() => {
    if (!user?.uid) return;

    // Immediately mark online
    import('../lib/players').then(({ updatePlayerPresence }) => {
      updatePlayerPresence(user.uid, true);
    });

    const handleOnline = () => {
      import('../lib/players').then(({ updatePlayerPresence }) => {
        updatePlayerPresence(user.uid, true);
      });
    };

    const handleOffline = () => {
      import('../lib/players').then(({ updatePlayerPresence }) => {
        updatePlayerPresence(user.uid, false);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleOnline();
      } else {
        handleOffline();
      }
    };

    window.addEventListener('focus', handleOnline);
    window.addEventListener('blur', handleOffline);
    window.addEventListener('beforeunload', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleOnline);
      window.removeEventListener('blur', handleOffline);
      window.removeEventListener('beforeunload', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Mark offline on unmount/logout
      import('../lib/players').then(({ updatePlayerPresence }) => {
        updatePlayerPresence(user.uid, false);
      });
    };
  }, [user?.uid]);

  const logout = async () => {
    try {
      if (user?.uid) {
        const { updatePlayerPresence } = await import('../lib/players');
        await updatePlayerPresence(user.uid, false);
      }
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const isAdmin = user?.role === 'admin' || firebaseUser?.email === 'chfpoint@gmail.com';
  const mergedUser = user ? { ...user, wallet: playerWallet } : null;

  return (
    <AuthContext.Provider value={{ user: mergedUser, firebaseUser, loading, isAdmin, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
