import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface UserContextType {
  user: any | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true });

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch session on mount
    const getSession = async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user || null;
      setUser(sessionUser);
      setLoading(false);
    };

    getSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
