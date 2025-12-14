"use client";

import React, { useEffect, useState } from 'react';

type SnackbarProps = {
  message: string;
  variant?: 'info' | 'success' | 'error';
  durationMs?: number;
};

const variants: Record<NonNullable<SnackbarProps['variant']>, { bg: string; border: string; color: string; icon: string }> = {
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'fas fa-info-circle' },
  success: { bg: '#ecfdf3', border: '#bbf7d0', color: '#166534', icon: 'fas fa-check-circle' },
  error: { bg: '#fef2f2', border: '#fecdd3', color: '#b91c1c', icon: 'fas fa-exclamation-circle' },
};

export function Snackbar({ message, variant = 'info', durationMs = 5000 }: SnackbarProps) {
  const [open, setOpen] = useState(true);
  const style = variants[variant];

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="snackbar"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        padding: '12px 14px',
        borderRadius: 12,
        boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
        minWidth: 280,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <i className={style.icon} aria-hidden="true" />
      <span style={{ lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setOpen(false)}
        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: style.color, cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}
