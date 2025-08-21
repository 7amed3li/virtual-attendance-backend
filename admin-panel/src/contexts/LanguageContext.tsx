import { createContext, useContext, type ReactNode } from 'react';
import i18n from '../lib/i18n'; // Import the centralized i18n instance

// The context no longer needs to manage language switching,
// as the app will only be in Turkish.
// We keep the provider structure for consistency and future-proofing.

interface LanguageContextType {
  language: 'tr';
}

interface LanguageProviderProps {
  children: ReactNode;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  // The document direction is always LTR now.
  document.documentElement.dir = 'ltr';

  const value = {
    language: 'tr' as const
  };
  
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
