import React, { useState, useEffect } from 'react'
import GachaAnalyzer from './GachaAnalyzer'
import LoadingScreen from './LoadingScreen'
import { ErrorBoundary } from './components'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (theme) => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(themeMode);
    localStorage.setItem('theme', themeMode);

    // Listen for system changes if mode is system
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        if (e.matches) root.classList.add('dark');
        else root.classList.remove('dark');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  return (
    <ErrorBoundary>
      {isLoading && (
        <LoadingScreen onComplete={() => setIsLoading(false)} />
      )}
      <div className={`App ${isLoading ? 'hidden' : 'block'}`}>
        <GachaAnalyzer themeMode={themeMode} setThemeMode={setThemeMode} />
      </div>
    </ErrorBoundary>
  )
}

export default App