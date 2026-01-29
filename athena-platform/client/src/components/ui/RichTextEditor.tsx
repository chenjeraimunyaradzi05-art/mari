'use client';

import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...'
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[160px] px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none prose prose-sm dark:prose-invert max-w-none',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900', className)}>
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={cn(
            'p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
            editor?.isActive('bold') && 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
          )}
          aria-label="Bold"
          disabled={!editor}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={cn(
            'p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
            editor?.isActive('italic') && 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
          )}
          aria-label="Italic"
          disabled={!editor}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={cn(
            'p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
            editor?.isActive('underline') && 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
          )}
          aria-label="Underline"
          disabled={!editor}
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={cn(
            'p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
            editor?.isActive('bulletList') && 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
          )}
          aria-label="Bullet list"
          disabled={!editor}
        >
          <List className="w-4 h-4" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
