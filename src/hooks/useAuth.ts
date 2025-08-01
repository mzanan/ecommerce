import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserSessionData } from '@/types/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionData, setSessionData] = useState<UserSessionData>({});
  const [isLoading, setIsLoading] = useState(true);

  const updateSessionData = useCallback(async (user: User | null) => {
    if (user) {
        setSessionData({
          name: user.user_metadata?.full_name || user.email?.split('@')[0],
          email: user.email,
          avatarUrl: user.user_metadata?.avatar_url
        });
    } else {
      setSessionData({});
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        await updateSessionData(currentUser);
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        await updateSessionData(currentUser);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [updateSessionData]);

  return {
    user,
    sessionData,
    isLoading,
    isAuthenticated: !!user
  };
} 