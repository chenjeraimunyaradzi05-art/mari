'use client';

/**
 * Media Attachment Upload - Chat media upload with preview
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Image as ImageIcon,
  Video,
  FileText,
  X,
  Upload,
  Loader2,
  AlertCircle,
  Camera,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';

export interface AttachmentPreview {
  id: string;
  file: File;
  type: 'image' | 'video' | 'file';
  previewUrl?: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
}

interface MediaAttachmentUploadProps {
  attachments: AttachmentPreview[];
  onAttachmentsChange: (attachments: AttachmentPreview[]) => void;
  onUpload: (file: File) => Promise<{ url: string; id: string }>;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
  disabled?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_MB = 25;
const MAX_FILES = 10;

export function MediaAttachmentUpload({
  attachments,
  onAttachmentsChange,
  onUpload,
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
  disabled = false,
}: MediaAttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const getFileType = useCallback((file: File): 'image' | 'video' | 'file' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type not supported: ${file.type}`;
    }
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File too large. Maximum size is ${maxFileSize}MB`;
    }
    if (attachments.length >= maxFiles) {
      return `Maximum ${maxFiles} files allowed`;
    }
    return null;
  }, [acceptedTypes, maxFileSize, maxFiles, attachments.length]);

  const createPreview = useCallback((file: File): AttachmentPreview => {
    const type = getFileType(file);
    let previewUrl: string | undefined;

    if (type === 'image' || type === 'video') {
      previewUrl = URL.createObjectURL(file);
    }

    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      type,
      previewUrl,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
    };
  }, [getFileType]);

  // Utility function for future external use - currently unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _updateAttachment = useCallback((_id: string, _updates: Partial<AttachmentPreview>) => {
    // Handled by handleFiles and retryUpload
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: AttachmentPreview[] = [];

    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        console.error(validationError);
        continue;
      }
      newAttachments.push(createPreview(file));
    }

    if (newAttachments.length === 0) return;

    const updatedAttachments = [...attachments, ...newAttachments];
    onAttachmentsChange(updatedAttachments);

    // Start uploads
    for (const attachment of newAttachments) {
      try {
        // Update status to uploading
        const uploadingList = updatedAttachments.map((a) =>
          a.id === attachment.id ? { ...a, status: 'uploading' as const } : a
        );
        onAttachmentsChange(uploadingList);

        const result = await onUpload(attachment.file);

        // Update with completed status
        const completedList = uploadingList.map((a) =>
          a.id === attachment.id
            ? { ...a, id: result.id, status: 'complete' as const, progress: 100 }
            : a
        );
        onAttachmentsChange(completedList);
      } catch {
        // Update with error status
        const errorList = updatedAttachments.map((a) =>
          a.id === attachment.id
            ? { ...a, status: 'error' as const, error: 'Upload failed' }
            : a
        );
        onAttachmentsChange(errorList);
      }
    }
  }, [attachments, onAttachmentsChange, onUpload, validateFile, createPreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeAttachment = (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const retryUpload = async (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (!attachment) return;

    // Update to uploading status
    const uploadingList = attachments.map((a) =>
      a.id === id ? { ...a, status: 'uploading' as const, error: undefined } : a
    );
    onAttachmentsChange(uploadingList);

    try {
      const result = await onUpload(attachment.file);
      const completedList = uploadingList.map((a) =>
        a.id === id
          ? { ...a, id: result.id, status: 'complete' as const, progress: 100 }
          : a
      );
      onAttachmentsChange(completedList);
    } catch {
      const errorList = uploadingList.map((a) =>
        a.id === id
          ? { ...a, status: 'error' as const, error: 'Upload failed' }
          : a
      );
      onAttachmentsChange(errorList);
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
          {attachments.map((attachment) => (
            <AttachmentPreviewItem
              key={attachment.id}
              attachment={attachment}
              onRemove={() => removeAttachment(attachment.id)}
              onRetry={() => retryUpload(attachment.id)}
            />
          ))}
        </div>
      )}

      {/* Upload button with popover */}
      <Popover className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || attachments.length >= maxFiles}
            className="h-9 w-9"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Add attachment</p>
            
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-zinc-200 dark:border-zinc-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-xs text-zinc-500">
                Drag & drop or click below
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col h-auto py-3"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
                disabled={disabled}
              >
                <ImageIcon className="h-5 w-5 mb-1" />
                <span className="text-xs">Photo</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col h-auto py-3"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*';
                    fileInputRef.current.click();
                  }
                }}
                disabled={disabled}
              >
                <Video className="h-5 w-5 mb-1" />
                <span className="text-xs">Video</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col h-auto py-3"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
                    fileInputRef.current.click();
                  }
                }}
                disabled={disabled}
              >
                <FileText className="h-5 w-5 mb-1" />
                <span className="text-xs">File</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (cameraInputRef.current) {
                  cameraInputRef.current.click();
                }
              }}
              disabled={disabled}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>

            <p className="text-xs text-zinc-400 text-center">
              Max {maxFileSize}MB per file • {maxFiles - attachments.length} remaining
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

interface AttachmentPreviewItemProps {
  attachment: AttachmentPreview;
  onRemove: () => void;
  onRetry: () => void;
}

function AttachmentPreviewItem({ attachment, onRemove, onRetry }: AttachmentPreviewItemProps) {
  const { type, previewUrl, name, status, progress } = attachment;

  return (
    <div className="relative group">
      <div className={cn(
        'w-20 h-20 rounded-lg overflow-hidden border',
        status === 'error' 
          ? 'border-red-300 dark:border-red-800' 
          : 'border-zinc-200 dark:border-zinc-700'
      )}>
        {type === 'image' && previewUrl ? (
          <Image 
            src={previewUrl} 
            alt={name} 
            width={80}
            height={80}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : type === 'video' && previewUrl ? (
          <video 
            src={previewUrl} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
            <FileText className="h-8 w-8 text-zinc-400" />
          </div>
        )}

        {/* Upload overlay */}
        {status === 'uploading' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div 
            className="absolute inset-0 bg-red-500/80 flex items-center justify-center cursor-pointer"
            onClick={onRetry}
          >
            <AlertCircle className="h-6 w-6 text-white" />
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Progress bar */}
      {status === 'uploading' && (
        <Progress value={progress} className="h-1 mt-1" />
      )}

      {/* File name */}
      <p className="text-xs text-zinc-500 truncate w-20 mt-1" title={name}>
        {name}
      </p>
    </div>
  );
}

export default MediaAttachmentUpload;
