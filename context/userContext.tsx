import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GUEST_MODE_KEY = "@showspot_guest_mode";

interface UserContextType {
  user: any | null;
  loading: boolean;
  isGuest: boolean;
  signInAsGuest: () => Promise<void>;
  signOutGuest: () => Promise<void>;
  requireAuth: (action: string) => boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isGuest: false,
  signInAsGuest: async () => {},
  signOutGuest: async () => {},
  requireAuth: () => false,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState("");

  useEffect(() => {
    // Fetch session and guest mode on mount
    const initialize = async () => {
      // Check for guest mode
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);
      if (guestMode === "true") {
        setIsGuest(true);
      }

      // Check for actual user session
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user || null;
      setUser(sessionUser);

      // If user is logged in, clear guest mode
      if (sessionUser) {
        setIsGuest(false);
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
      }

      setLoading(false);
    };

    initialize();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);

      // If user signs in, clear guest mode
      if (session?.user) {
        setIsGuest(false);
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signInAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_MODE_KEY, "true");
    setIsGuest(true);
  }, []);

  const signOutGuest = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
    setIsGuest(false);
  }, []);

  // Returns true if auth is required (user is guest), false if user is authenticated
  const requireAuth = useCallback((action: string): boolean => {
    if (user) return false; // User is authenticated
    if (isGuest) return true; // User is guest, auth required
    return true; // No user at all
  }, [user, isGuest]);

  return (
    <UserContext.Provider value={{
      user,
      loading,
      isGuest,
      signInAsGuest,
      signOutGuest,
      requireAuth,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
