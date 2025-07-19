// lib/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type User = {
  id: string;
  full_name: string;
  spotter_profile_picture: string;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userSession = sessionData.session?.user;

      if (userSession) {
        const { data, error } = await supabase
          .from("spotters")
          .select("id, full_name, spotter_profile_picture")
          .eq("id", userSession.id)
          .single();

        if (!error && data) setUser(data);
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};
