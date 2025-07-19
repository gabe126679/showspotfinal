// context/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserProfile {
  name: string;
  profilePictureUrl: string;
}

interface UserContextType extends UserProfile {
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [name, setName] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');

  const refreshUserData = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { data } = await supabase
      .from('spotters')
      .select('full_name, spotter_profile_picture')
      .eq('id', user.id)
      .single();

    if (data) {
      setName(data.full_name);
      setProfilePictureUrl(data.spotter_profile_picture);
    }
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  return (
    <UserContext.Provider value={{ name, profilePictureUrl, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
