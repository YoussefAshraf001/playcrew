"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";
import { auth, db } from "@/app/lib/firebase";
import { FontPreset, ThemePreset } from "@/app/lib/themes";
import { NavbarLayout } from "@/app/lib/uiPreferences";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

type CropData = {
  x: number;
  y: number;
  zoom: number;
};

type MediaValue =
  | { type: "image"; data: string }
  | { type: "gif"; data: string; crop: CropData };

interface UserProfile {
  uid: string;
  username?: string;
  avatar?: MediaValue;
  avatarBase64?: string;
  avatarUrl?: string;
  email?: string;
  bio?: string;
  wallpaper?: MediaValue;
  themePreset?: ThemePreset;
  fontPreset?: FontPreset;
  navbarLayout?: NavbarLayout;
  hasSeenWhatsNew?: boolean;
  [key: string]: unknown;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setProfile: Dispatch<SetStateAction<UserProfile | null>>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  setProfile: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  const uid = user?.uid as string | undefined;
  const resolvedProfile = uid ? profile : null;
  const loading = !authResolved || (Boolean(uid) && !profileResolved);

  useEffect(() => {
    // Listen to auth state changes
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthResolved(true);
      setProfileResolved(!currentUser);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authResolved || !uid) {
      return;
    }

    const docRef = doc(db, "users", uid);

    // Listen to realtime updates from Firestore
    const unsubProfile = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setProfileResolved(true);
      },
      () => {
        setProfileResolved(true);
      },
    );

    return () => unsubProfile();
  }, [uid, authResolved]);

  return (
    <UserContext.Provider
      value={{ user, profile: resolvedProfile, loading, setProfile }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
