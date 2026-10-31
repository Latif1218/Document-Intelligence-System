import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('docintel_theme');
    return saved === 'warm' ? 'warm' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Remove existing theme classes
    root.classList.remove('dark', 'theme-dark', 'theme-warm');
    body.classList.remove('theme-dark', 'theme-warm');

    if (theme === 'dark') {
      root.classList.add('dark', 'theme-dark');
      body.classList.add('theme-dark');
    } else {
      root.classList.add('theme-warm');
      body.classList.add('theme-warm');
    }

    localStorage.setItem('docintel_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'warm' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;

