import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: any | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: any) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      // Basic client-side JWT expiration check
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token expired, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        // Invalid token format
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
    
    const handleUnauthorized = () => {
      signOut();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const signIn = (newToken: string, newUser: any) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
