import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Kullanici } from '../services/api';

interface AuthContextType {
  kullanici: Kullanici | null;
  isAuthenticated: boolean;
  yukleniyor: boolean;
  giris: (token: string, kullanici: Kullanici) => Promise<void>;
  cikis: () => void;
  kullaniciGuncelle: (kullanici: Kullanici) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [kullanici, setKullanici] = useState<Kullanici | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setKullanici(parsedUser);
      } catch (error) {
        console.error('Kullanıcı bilgileri ayrıştırılamadı:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setYukleniyor(false);
  }, []);

  const giris = async (token: string, kullanici: Kullanici) => {
      localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(kullanici));
    setKullanici(kullanici);
  };

  const cikis = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setKullanici(null);
    // Logout'tan sonra login sayfasına yönlendir
    window.location.href = '/login';
  };

  const kullaniciGuncelle = (yeniKullanici: Kullanici) => {
    localStorage.setItem('auth_user', JSON.stringify(yeniKullanici));
    setKullanici(yeniKullanici);
  };

  const value = {
    kullanici,
    isAuthenticated: !!kullanici,
    yukleniyor,
    giris,
    cikis,
    kullaniciGuncelle,
    isAdmin: kullanici?.rol === 'admin'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;