import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthContextType, AppRole, Profile, Outlet } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, roleRes, outletsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
        supabase.from('user_roles').select('*').eq('user_id', userId).single(),
        supabase.from('outlets').select('*'),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (roleRes.data) {
        const r = roleRes.data as any;
        setRole(r.role as AppRole);
        setOutletId(r.outlet_id);
      }
      if (outletsRes.data) setOutlets(outletsRes.data as Outlet[]);
    } catch (e) {
      console.error('Error fetching user data:', e);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setOutletId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    setOutletId(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, role, outletId, outlets,
      isAdmin: role === 'admin',
      loading, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
