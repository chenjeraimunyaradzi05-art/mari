'use client';

/**
 * Chat Input - Message composer with media attachments
 * Drag-and-drop file upload, emoji picker, voice messages
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/stores/chat.store';
import { useUIStore } from '@/lib/stores/ui.store';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Smile,
  X,
  File,
  Camera,
  Video,
  StopCircle,
  Play,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';

interface ChatInputProps {
  conversationId: string;
  onSend?: (message: { content: string; attachments?: File[] }) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface FilePreview {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'file';
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  file: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

export function ChatInput({
  conversationId,
  onSend,
  className,
  placeholder = 'Type a message...',
  disabled = false,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();

  const { addMessage, setTyping } = useChatStore();
  const { addToast } = useUIStore();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [content]);

  // Cleanup file previews
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview.startsWith('blob:')) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, [files]);

  // Send typing indicator
  useEffect(() => {
    const isTyping = content.length > 0;
    setTyping(conversationId, isTyping);

    return () => {
      setTyping(conversationId, false);
    };
  }, [content, conversationId, setTyping]);

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      const newFiles: FilePreview[] = [];
      const errors: string[] = [];

      Array.from(selectedFiles).forEach((file) => {
        // Check file count
        if (files.length + newFiles.length >= MAX_FILES) {
          errors.push(`Maximum ${MAX_FILES} files allowed`);
          return;
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name} exceeds 50MB limit`);
          return;
        }

        // Determine file type
        let type: 'image' | 'video' | 'file' = 'file';
        if (ALLOWED_TYPES.image.includes(file.type)) {
          type = 'image';
        } else if (ALLOWED_TYPES.video.includes(file.type)) {
          type = 'video';
        }

        newFiles.push({
          file,
          preview: type === 'image' || type === 'video'
            ? URL.createObjectURL(file)
            : '',
          type,
        });
      });

      if (errors.length > 0) {
        addToast({ type: 'error', title: errors[0] });
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [files.length, addToast]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file.preview.startsWith('blob:')) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new globalThis.File([blob], `voice-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        setFiles((prev) => [
          ...prev,
          { file, preview: URL.createObjectURL(blob), type: 'file' },
        ]);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      addToast({ type: 'error', title: 'Microphone access denied' });
    }
  }, [addToast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const handleSend = useCallback(async () => {
    if ((!content.trim() && files.length === 0) || disabled || isUploading) {
      return;
    }

    setIsUploading(true);

    try {
      // Upload files first
      let uploadedAttachments: any[] = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f.file));

        const uploadResponse = await api.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedAttachments = uploadResponse.data.files || [];
      }

      // Create optimistic message
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversationId,
        content: content.trim(),
        senderId: 'current-user', // Will be replaced by actual user
        createdAt: new Date().toISOString(),
        type: 'text' as const,
        status: 'sending' as const,
        attachments: uploadedAttachments,
      };

      addMessage(conversationId, optimisticMessage);

      // Send message
      await api.post(`/api/conversations/${conversationId}/messages`, {
        content: content.trim(),
        attachments: uploadedAttachments.map((a: any) => a.id),
      });

      // Clear input
      setContent('');
      setFiles([]);

      if (onSend) {
        onSend({ content: content.trim(), attachments: files.map((f) => f.file) });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to send message' });
    } finally {
      setIsUploading(false);
    }
  }, [content, files, conversationId, disabled, isUploading, addMessage, addToast, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-500/10 border-2 border-dashed border-emerald-500 rounded-lg flex items-center justify-center z-10">
          <p className="text-emerald-500 font-medium">Drop files here</p>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-2 overflow-x-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="relative shrink-0 group"
              >
                {file.type === 'image' ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : file.type === 'video' ? (
                  <video
                    src={file.preview}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center p-2">
                    <File className="h-6 w-6 text-zinc-400" />
                    <span className="text-[10px] text-zinc-500 truncate w-full text-center">
                      {file.file.name.split('.').pop()}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-4">
        {/* Attachment button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={disabled || isRecording}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Photos & Videos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <File className="h-4 w-4 mr-2" />
              Document
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Camera className="h-4 w-4 mr-2" />
              Camera
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* Text input or recording UI */}
        {isRecording ? (
          <div className="flex-1 flex items-center gap-4 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono">{formatRecordingTime(recordingTime)}</span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={cancelRecording}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={stopRecording}>
              <StopCircle className="h-4 w-4 mr-1" />
              Done
            </Button>
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 resize-none min-h-[40px] max-h-[150px] py-2 rounded-full px-4"
            rows={1}
          />
        )}

        {/* Emoji button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={disabled || isRecording}
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-4 text-center text-zinc-500">
              Emoji picker placeholder
            </div>
          </PopoverContent>
        </Popover>

        {/* Send or Voice button */}
        {content.trim() || files.length > 0 ? (
          <Button
            size="icon"
            className="shrink-0 rounded-full"
            onClick={handleSend}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={startRecording}
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default ChatInput;
