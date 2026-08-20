'use client';

import { Sun, Moon, Monitor, Check, Palette } from 'lucide-react';
import { useAuthStore, useUIStore, type UIAccentColor, type UIFontSize } from '@/lib/store';
import { cn } from '@/lib/utils';

type ThemePreference = 'light' | 'dark' | 'system';

const themes: Array<{
  id: ThemePreference;
  name: string;
  icon: typeof Sun;
  description: string;
}> = [
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

const accentColors: Array<{
  id: UIAccentColor;
  name: string;
  class: string;
}> = [
  { id: 'rose', name: 'Rose', class: 'bg-rose-500' },
  { id: 'purple', name: 'Purple', class: 'bg-violet-500' },
  { id: 'blue', name: 'Blue', class: 'bg-blue-500' },
  { id: 'green', name: 'Green', class: 'bg-emerald-500' },
  { id: 'pink', name: 'Pink', class: 'bg-pink-500' },
  { id: 'orange', name: 'Orange', class: 'bg-orange-500' },
  { id: 'teal', name: 'Teal', class: 'bg-teal-500' },
];

const fontSizes: Array<{
  id: UIFontSize;
  name: string;
  size: string;
}> = [
  { id: 'small', name: 'Small', size: '14px' },
  { id: 'medium', name: 'Medium', size: '16px' },
  { id: 'large', name: 'Large', size: '18px' },
];

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only peer"
        aria-label={label}
      />
      <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:bg-slate-700 dark:peer-focus:ring-primary-800 rtl:peer-checked:after:-translate-x-full" />
    </label>
  );
}

export default function AppearanceSettingsPage() {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    fontSize,
    setFontSize,
    compactMode,
    setCompactMode,
    reduceMotion,
    setReduceMotion,
  } = useUIStore();
  const { user } = useAuthStore();

  const displayName =
    user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'ATHENA member';
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
    displayName.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Appearance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Customize how ATHENA looks on your device
        </p>
      </div>

      {/* Theme Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Theme
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themes.map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={() => setTheme(themeOption.id)}
              className={cn(
                'relative flex flex-col items-center rounded-lg border-2 p-6 transition',
                theme === themeOption.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              {theme === themeOption.id && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                  themeOption.id === 'light' && 'bg-yellow-100',
                  themeOption.id === 'dark' && 'bg-slate-800',
                  themeOption.id === 'system' && 'bg-gradient-to-br from-yellow-100 to-slate-800'
                )}
              >
                <themeOption.icon
                  className={cn(
                    'w-6 h-6',
                    themeOption.id === 'light' && 'text-yellow-600',
                    themeOption.id === 'dark' && 'text-slate-300',
                    themeOption.id === 'system' && 'text-slate-600'
                  )}
                />
              </div>
              <span className="font-medium text-slate-900 dark:text-white">
                {themeOption.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
                {themeOption.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Palette className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Accent Color
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
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
                accentColor === color.id && 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900'
              )}
              aria-label={`Use ${color.name} accent color`}
              title={color.name}
            >
              {accentColor === color.id && (
                <Check className="absolute inset-0 m-auto w-5 h-5 text-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
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
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <span
                className="font-medium text-slate-900 dark:text-white"
                style={{ fontSize: size.size }}
              >
                Aa
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                {size.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Preview
        </h2>
        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
              {initials}
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {displayName}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                This is how text will appear
              </p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
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
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Compact Mode
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Reduce spacing and padding for a more compact view
            </p>
          </div>
          <Toggle
            checked={compactMode}
            label="Compact mode"
            onChange={setCompactMode}
          />
        </div>
      </div>

      {/* Reduce Motion */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Reduce Motion
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Minimize animations and transitions
            </p>
          </div>
          <Toggle
            checked={reduceMotion}
            label="Reduce motion"
            onChange={setReduceMotion}
          />
        </div>
      </div>
    </div>
  );
}
