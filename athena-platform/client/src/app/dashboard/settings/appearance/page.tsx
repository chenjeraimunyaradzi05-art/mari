'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Check, Palette } from 'lucide-react';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const themes = [
  {
    id: 'light',
    name: 'Light',
    icon: Sun,
    description: 'Light mode with bright backgrounds',
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: Moon,
    description: 'Dark mode for low-light environments',
  },
  {
    id: 'system',
    name: 'System',
    icon: Monitor,
    description: 'Automatically match your system settings',
  },
];

const accentColors = [
  { id: 'purple', name: 'Purple', color: '#8B5CF6', class: 'bg-purple-500' },
  { id: 'blue', name: 'Blue', color: '#3B82F6', class: 'bg-blue-500' },
  { id: 'green', name: 'Green', color: '#10B981', class: 'bg-emerald-500' },
  { id: 'pink', name: 'Pink', color: '#EC4899', class: 'bg-pink-500' },
  { id: 'orange', name: 'Orange', color: '#F97316', class: 'bg-orange-500' },
  { id: 'teal', name: 'Teal', color: '#14B8A6', class: 'bg-teal-500' },
];

const fontSizes = [
  { id: 'small', name: 'Small', size: '14px' },
  { id: 'medium', name: 'Medium', size: '16px' },
  { id: 'large', name: 'Large', size: '18px' },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useUIStore();
  const [selectedTheme, setSelectedTheme] = useState(theme || 'system');
  const [accentColor, setAccentColor] = useState('purple');
  const [fontSize, setFontSize] = useState('medium');

  useEffect(() => {
    setTheme(selectedTheme as 'light' | 'dark' | 'system');
  }, [selectedTheme, setTheme]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Appearance
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Customize how ATHENA looks on your device
        </p>
      </div>

      {/* Theme Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Theme
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themes.map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={() => setSelectedTheme(themeOption.id as 'light' | 'dark' | 'system')}
              className={cn(
                'relative flex flex-col items-center p-6 rounded-xl border-2 transition',
                selectedTheme === themeOption.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {selectedTheme === themeOption.id && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                  themeOption.id === 'light' && 'bg-yellow-100',
                  themeOption.id === 'dark' && 'bg-gray-800',
                  themeOption.id === 'system' && 'bg-gradient-to-br from-yellow-100 to-gray-800'
                )}
              >
                <themeOption.icon
                  className={cn(
                    'w-6 h-6',
                    themeOption.id === 'light' && 'text-yellow-600',
                    themeOption.id === 'dark' && 'text-gray-300',
                    themeOption.id === 'system' && 'text-gray-600'
                  )}
                />
              </div>
              <span className="font-medium text-gray-900 dark:text-white">
                {themeOption.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                {themeOption.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Palette className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Accent Color
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Choose your preferred accent color for buttons and highlights
        </p>
        <div className="flex flex-wrap gap-3">
          {accentColors.map((color) => (
            <button
              key={color.id}
              onClick={() => setAccentColor(color.id)}
              className={cn(
                'relative w-12 h-12 rounded-full transition-transform hover:scale-110',
                color.class,
                accentColor === color.id && 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900'
              )}
              title={color.name}
            >
              {accentColor === color.id && (
                <Check className="absolute inset-0 m-auto w-5 h-5 text-white" />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Note: Custom accent colors coming soon
        </p>
      </div>

      {/* Font Size */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Font Size
        </h2>
        <div className="flex items-center space-x-4">
          {fontSizes.map((size) => (
            <button
              key={size.id}
              onClick={() => setFontSize(size.id)}
              className={cn(
                'flex-1 py-3 px-4 rounded-lg border-2 transition text-center',
                fontSize === size.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <span
                className="font-medium text-gray-900 dark:text-white"
                style={{ fontSize: size.size }}
              >
                Aa
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                {size.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Preview
        </h2>
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
              A
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Sample User
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This is how text will appear
              </p>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            The quick brown fox jumps over the lazy dog. This is a preview of
            your selected appearance settings.
          </p>
          <div className="flex items-center space-x-2">
            <button className="btn-primary px-4 py-2 text-sm">
              Primary Button
            </button>
            <button className="btn-outline px-4 py-2 text-sm">
              Secondary Button
            </button>
          </div>
        </div>
      </div>

      {/* Compact Mode */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Compact Mode
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Reduce spacing and padding for a more compact view
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>

      {/* Reduce Motion */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Reduce Motion
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Minimize animations and transitions
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
