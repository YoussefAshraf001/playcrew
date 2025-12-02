// app/context/UserContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { auth, db } from "@/app/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

interface UserProfile {
  uid: string;
  username?: string;
  avatarBase64?: string;
  avatarUrl?: string;
  displayName?: string | null;
  email?: string;
  [key: string]: any;
}

interface UserContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  setProfile: (profile: UserProfile) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  setProfile: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const docRef = doc(db, "users", user.uid);

    // Listen to realtime updates from Firestore
    const unsubProfile = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

  return (
    <UserContext.Provider value={{ user, profile, loading, setProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
