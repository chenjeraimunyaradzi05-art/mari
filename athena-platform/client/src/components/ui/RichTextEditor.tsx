'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const commands: { icon: React.ElementType; command: string; label: string }[] = [
  { icon: Bold, command: 'bold', label: 'Bold' },
  { icon: Italic, command: 'italic', label: 'Italic' },
  { icon: Underline, command: 'underline', label: 'Underline' },
  { icon: List, command: 'insertUnorderedList', label: 'Bullet list' },
];

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const runCommand = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900', className)}>
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        {commands.map((item) => (
          <button
            key={item.command}
            type="button"
            onClick={() => runCommand(item.command)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={item.label}
          >
            <item.icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[160px] px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none"
        onInput={() => {
          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
