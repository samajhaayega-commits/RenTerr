import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (authUser) {
        // Initial check and creation if missing
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const ADMIN_EMAIL = 'kamleshgehlot210@gmail.com';
          const newProfile: UserProfile = {
            uid: authUser.uid,
            displayName: authUser.displayName || 'Anonymous User',
            email: authUser.email,
            isVerified: false,
            role: (authUser.email === ADMIN_EMAIL) ? 'admin' : 'user',
            rating: 5,
            reviewCount: 0,
            verificationLevel: 1,
            trustScore: 50,
            isRestricted: false,
            outstandingBalance: 0,
            createdAt: serverTimestamp(),
            photoURL: authUser.photoURL || '',
          };
          await setDoc(userDocRef, newProfile);
        }

        // Real-time listener
        unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signOut = () => auth.signOut();

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
