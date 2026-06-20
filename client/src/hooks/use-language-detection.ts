import { useState, useEffect } from 'react';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh-CN' | 'ru';

const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage> = {
  'en': 'en',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ja': 'ja',
  'ko': 'ko',
  'zh': 'zh-CN',
  'ru': 'ru'
};

export const useLanguageDetection = () => {
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLanguage>('en');

  useEffect(() => {
    const detectLanguage = () => {
      // Get browser language
      const browserLang = navigator.language.split('-')[0];
      
      // Check if browser language is supported, otherwise default to English
      const supportedLang = SUPPORTED_LANGUAGES[browserLang] || 'en';
      
      setDetectedLanguage(supportedLang);
      
      // Store the detected language in localStorage for persistence
      localStorage.setItem('preferredLanguage', supportedLang);
    };

    // Check if there's a stored language preference
    const storedLang = localStorage.getItem('preferredLanguage') as SupportedLanguage;
    if (storedLang && SUPPORTED_LANGUAGES[storedLang]) {
      setDetectedLanguage(storedLang);
    } else {
      detectLanguage();
    }
  }, []);

  const updateLanguage = (lang: SupportedLanguage) => {
    setDetectedLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  return {
    detectedLanguage,
    updateLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES
  };
};
