import React, { useState, useEffect, useRef } from 'use-strict';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../lib/theme';

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Laptop,
};

export const ThemeToggleButton = () => {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isMounted) {
    return null; // Don't render on server
  }

  const CurrentIcon = themeIcons[theme];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-3 rounded-xl text-gray-400 hover:bg-gray-700 hover:text-white transition duration-150 w-full"
        aria-label={`Switch theme. Current theme: ${theme}`}
      >
        <CurrentIcon className="w-5 h-5" />
        <span className="text-sm font-medium capitalize">{theme}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 w-full bg-gray-700 rounded-xl shadow-lg border border-gray-600">
          {Object.keys(themeIcons).map((themeKey) => {
            const Icon = themeIcons[themeKey];
            return (
              <button key={themeKey} onClick={() => { setTheme(themeKey); setIsOpen(false); }} className="flex items-center space-x-3 p-3 text-left w-full text-gray-300 hover:bg-gray-600 hover:text-white first:rounded-t-xl last:rounded-b-xl">
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium capitalize">{themeKey}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
