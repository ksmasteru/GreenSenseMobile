import { createContext, useContext, useEffect, useState } from 'react';
import {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  saveRefreshToken,
  deleteRefreshToken,
} from '@/services/apiClient';

const SessionContext = createContext(null);
export function useSession() {
  // TODO: read the context, throw if null (same pattern apiClient functions
  // use for "misuse should fail loud, not silently return undefined")
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be wrapped in <sessionProvider>');
  return value;
}

export function SessionProvider({ children }) {
  // TODO: isAuthenticated + isLoading state
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setToken] = useState(null);
  // cold start
  useEffect(() => {
    // TODO: this is the startup bootstrap we talked about — call
    // refreshAccessToken() once, flip isLoading false when it settles,
    // derive isAuthenticated from whether it returned a token
    const fetchToken = async () => {
      const data = await refreshAccessToken();
      setToken(data);
      setIsAuthenticated(!!data);
      setIsLoading(false);
    }
    fetchToken();
  }, []);

  // makes a change of state!
  const signIn = async (tokens) => {
    // TODO: persist via setAccessToken/saveRefreshToken, flip isAuthenticated
    setAccessToken(tokens.accessToken);
    await saveRefreshToken(tokens.refreshToken);
    setIsAuthenticated(true);
  };
  // makes a change of state!
  const signOut = async () => {
    // TODO: deleteRefreshToken + setAccessToken(null), flip isAuthenticated
    console.log('loggout launched');
    setAccessToken(null);
    await deleteRefreshToken();
    setIsAuthenticated(false);
  };

  // TODO: return <SessionContext.Provider value={...}>{children}</SessionContext.Provider>
  return (
    <SessionContext.Provider value={{isAuthenticated, isLoading, signIn, signOut}}>{children}</SessionContext.Provider>
  )
  }
