'use client';

/**
 * Rich Text Editor - Tiptap-based editor for articles/posts
 * Phase 3: Web Client - Super App Core
 */

import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image as ImageIcon,
  Video,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
  AtSign,
  Hash,
  Smile,
  Paperclip,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Note: This is a mock implementation without actual Tiptap dependency
// In production, install: npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link etc.

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  readOnly?: boolean;
  onMention?: (query: string) => Promise<{ id: string; name: string; avatar?: string }[]>;
  onHashtag?: (query: string) => Promise<{ id: string; name: string; count?: number }[]>;
}

interface EditorState {
  html: string;
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isBlockquote: boolean;
  isCode: boolean;
  headingLevel: number | null;
  textAlign: 'left' | 'center' | 'right';
}

export function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Write something...',
  className,
  minHeight = '200px',
  maxHeight = '500px',
  readOnly = false,
  onMention,
  onHashtag,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isImageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const [editorState, setEditorState] = useState<EditorState>({
    html: content,
    text: '',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isBulletList: false,
    isOrderedList: false,
    isBlockquote: false,
    isCode: false,
    headingLevel: null,
    textAlign: 'left',
  });

  // Initialize content
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content;
    }
  }, []);

  const handleCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateEditorState();
  }, []);

  const updateEditorState = useCallback(() => {
    setEditorState((prev) => ({
      ...prev,
      isBold: document.queryCommandState('bold'),
      isItalic: document.queryCommandState('italic'),
      isUnderline: document.queryCommandState('underline'),
      isStrike: document.queryCommandState('strikeThrough'),
      isBulletList: document.queryCommandState('insertUnorderedList'),
      isOrderedList: document.queryCommandState('insertOrderedList'),
    }));
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const text = editorRef.current.textContent || '';
      setEditorState((prev) => ({ ...prev, html, text }));
      onChange?.(html);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          handleCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          handleCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          handleCommand('underline');
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            handleCommand('redo');
          } else {
            handleCommand('undo');
          }
          break;
      }
    }
  }, [handleCommand]);

  const insertLink = useCallback(() => {
    if (linkUrl) {
      const text = linkText || linkUrl;
      const html = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${text}</a>`;
      handleCommand('insertHTML', html);
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  }, [linkUrl, linkText, handleCommand]);

  const insertImage = useCallback(() => {
    if (imageUrl) {
      const html = `<img src="${imageUrl}" alt="${imageAlt}" class="max-w-full h-auto rounded-lg my-4" />`;
      handleCommand('insertHTML', html);
    }
    setImageDialogOpen(false);
    setImageUrl('');
    setImageAlt('');
  }, [imageUrl, imageAlt, handleCommand]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Handle pasted images
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // In production, upload to server
          const reader = new FileReader();
          reader.onload = () => {
            const html = `<img src="${reader.result}" alt="Pasted image" class="max-w-full h-auto rounded-lg my-4" />`;
            handleCommand('insertHTML', html);
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }

    // Strip formatting from pasted text (optional)
    // const text = e.clipboardData.getData('text/plain');
    // handleCommand('insertText', text);
  }, [handleCommand]);

  const handleHeading = useCallback((level: 1 | 2 | 3) => {
    handleCommand('formatBlock', `h${level}`);
    setEditorState((prev) => ({
      ...prev,
      headingLevel: prev.headingLevel === level ? null : level,
    }));
  }, [handleCommand]);

  const ToolbarButton = ({
    icon: Icon,
    label,
    isActive = false,
    onClick,
    disabled = false,
  }: {
    icon: React.ElementType;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={isActive}
          onPressedChange={onClick}
          disabled={disabled || readOnly}
          className="h-8 w-8 p-0"
        >
          <Icon className="h-4 w-4" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-zinc-50 dark:bg-zinc-900/50">
          {/* Text formatting */}
          <ToolbarButton
            icon={Bold}
            label="Bold (⌘B)"
            isActive={editorState.isBold}
            onClick={() => handleCommand('bold')}
          />
          <ToolbarButton
            icon={Italic}
            label="Italic (⌘I)"
            isActive={editorState.isItalic}
            onClick={() => handleCommand('italic')}
          />
          <ToolbarButton
            icon={Underline}
            label="Underline (⌘U)"
            isActive={editorState.isUnderline}
            onClick={() => handleCommand('underline')}
          />
          <ToolbarButton
            icon={Strikethrough}
            label="Strikethrough"
            isActive={editorState.isStrike}
            onClick={() => handleCommand('strikeThrough')}
          />

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Headings */}
          <ToolbarButton
            icon={Heading1}
            label="Heading 1"
            isActive={editorState.headingLevel === 1}
            onClick={() => handleHeading(1)}
          />
          <ToolbarButton
            icon={Heading2}
            label="Heading 2"
            isActive={editorState.headingLevel === 2}
            onClick={() => handleHeading(2)}
          />
          <ToolbarButton
            icon={Heading3}
            label="Heading 3"
            isActive={editorState.headingLevel === 3}
            onClick={() => handleHeading(3)}
          />

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Lists */}
          <ToolbarButton
            icon={List}
            label="Bullet List"
            isActive={editorState.isBulletList}
            onClick={() => handleCommand('insertUnorderedList')}
          />
          <ToolbarButton
            icon={ListOrdered}
            label="Numbered List"
            isActive={editorState.isOrderedList}
            onClick={() => handleCommand('insertOrderedList')}
          />
          <ToolbarButton
            icon={Quote}
            label="Quote"
            isActive={editorState.isBlockquote}
            onClick={() => handleCommand('formatBlock', 'blockquote')}
          />
          <ToolbarButton
            icon={Code}
            label="Code"
            isActive={editorState.isCode}
            onClick={() => handleCommand('formatBlock', 'pre')}
          />

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Alignment */}
          <ToolbarButton
            icon={AlignLeft}
            label="Align Left"
            isActive={editorState.textAlign === 'left'}
            onClick={() => handleCommand('justifyLeft')}
          />
          <ToolbarButton
            icon={AlignCenter}
            label="Align Center"
            isActive={editorState.textAlign === 'center'}
            onClick={() => handleCommand('justifyCenter')}
          />
          <ToolbarButton
            icon={AlignRight}
            label="Align Right"
            isActive={editorState.textAlign === 'right'}
            onClick={() => handleCommand('justifyRight')}
          />

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Insert */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setLinkDialogOpen(true)}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Link</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setImageDialogOpen(true)}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Image</TooltipContent>
          </Tooltip>

          <ToolbarButton
            icon={Minus}
            label="Horizontal Rule"
            onClick={() => handleCommand('insertHorizontalRule')}
          />

          <div className="flex-1" />

          {/* Undo/Redo */}
          <ToolbarButton
            icon={Undo}
            label="Undo (⌘Z)"
            onClick={() => handleCommand('undo')}
          />
          <ToolbarButton
            icon={Redo}
            label="Redo (⌘⇧Z)"
            onClick={() => handleCommand('redo')}
          />
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSelect={updateEditorState}
        className={cn(
          'p-4 focus:outline-none prose prose-zinc dark:prose-invert max-w-none',
          'prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline',
          'prose-blockquote:border-l-4 prose-blockquote:border-zinc-300 prose-blockquote:pl-4 prose-blockquote:italic',
          'prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800 prose-pre:p-4 prose-pre:rounded-lg',
          readOnly && 'cursor-default'
        )}
        style={{
          minHeight,
          maxHeight,
          overflowY: 'auto',
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Character count */}
      {!readOnly && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 border-t">
          <span>
            {editorState.text.length} characters
          </span>
          <span>
            {editorState.text.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      )}

      {/* Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Text (optional)</Label>
              <Input
                placeholder="Link text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertLink}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <Input
                placeholder="Describe the image"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertImage}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RichTextEditor;
