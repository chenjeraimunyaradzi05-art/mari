'use client';

import { useState, useRef } from 'react';
import {
  X,
  Image,
  Video,
  FileText,
  Link as LinkIcon,
  Hash,
  AtSign,
  Smile,
  Globe,
  Users,
  Lock,
  ChevronDown,
  Send,
  Loader2,
} from 'lucide-react';
import { useCreatePost, useAuthStore } from '@/lib/hooks';
import { mediaApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
type MediaType = 'TEXT' | 'IMAGE' | 'VIDEO';

const visibilityOptions = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, description: 'Anyone can see this' },
  { value: 'FOLLOWERS', label: 'Followers', icon: Users, description: 'Only followers can see' },
  { value: 'PRIVATE', label: 'Only me', icon: Lock, description: 'Only you can see' },
];

const postTypes = [
  { value: 'REGULAR', label: 'Regular Post', icon: FileText },
  { value: 'WIN', label: 'Share a Win 🎉', icon: FileText },
  { value: 'QUESTION', label: 'Ask a Question', icon: FileText },
];

export default function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [postType, setPostType] = useState('REGULAR');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>('TEXT');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { mutate: createPost, isPending } = useCreatePost();

  const handleSubmit = () => {
    if (!content.trim() && mediaUrls.length === 0) return;

    createPost(
      { 
        content, 
        visibility, 
        type: mediaType !== 'TEXT' ? mediaType : postType,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        isPublic: visibility === 'PUBLIC',
      },
      {
        onSuccess: () => {
          setContent('');
          setAttachments([]);
          setPreviewUrls([]);
          setMediaUrls([]);
          setMediaType('TEXT');
          onClose();
        },
      }
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of files) {
        // Create preview for images
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          setPreviewUrls((prev) => [...prev, url]);
        } else if (file.type.startsWith('video/')) {
          // For videos, show filename as preview
          setPreviewUrls((prev) => [...prev, `video:${file.name}`]);
        }
        
        setAttachments((prev) => [...prev, file]);

        // Upload the file
        const uploadType = type === 'video' ? 'video' : 'post';
        const res = await mediaApi.upload(uploadType, file);
        const uploadedUrl = res.data?.data?.url;
        
        if (uploadedUrl) {
          setMediaUrls((prev) => [...prev, uploadedUrl]);
          setMediaType(type === 'video' ? 'VIDEO' : 'IMAGE');
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
    if (mediaUrls.length <= 1) {
      setMediaType('TEXT');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create Post
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-semibold">
            {user?.firstName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">
              {user?.firstName} {user?.lastName}
            </p>
            
            {/* Visibility Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {(() => {
                  const option = visibilityOptions.find((o) => o.value === visibility);
                  const Icon = option?.icon || Globe;
                  return (
                    <>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{option?.label}</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  );
                })()}
              </button>

              {showVisibilityMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-48">
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setVisibility(option.value as Visibility);
                        setShowVisibilityMenu(false);
                      }}
                      className={cn(
                        'w-full flex items-start space-x-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700',
                        visibility === option.value && 'bg-primary-50 dark:bg-primary-900/20'
                      )}
                    >
                      <option.icon className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {option.label}
                        </p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Post Type Tabs */}
        <div className="px-4 flex space-x-2 overflow-x-auto">
          {postTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setPostType(type.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition',
                postType === type.value
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder={
              postType === 'WIN'
                ? 'Share your win! What achievement are you celebrating? 🎉'
                : postType === 'QUESTION'
                ? 'Ask the community a question...'
                : "What's on your mind?"
            }
          />

          {/* Media Previews */}
          {previewUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative">
                  {url.startsWith('video:') ? (
                    <div className="w-full h-32 bg-gray-900 rounded-lg flex items-center justify-center">
                      <div className="text-center text-white">
                        <Video className="w-8 h-8 mx-auto mb-1" />
                        <span className="text-xs truncate max-w-[100px] block">
                          {url.replace('video:', '')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt="Attachment"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}
                  <button
                    onClick={() => removeAttachment(index)}
                    disabled={isUploading}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {isUploading && index === previewUrls.length - 1 && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              title="Add image"
            >
              <Image className="w-5 h-5" />
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              title="Add video"
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Add link"
            >
              <LinkIcon className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Add hashtag"
            >
              <Hash className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Mention someone"
            >
              <AtSign className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e, 'image')}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => handleFileSelect(e, 'video')}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {content.length}/2000 characters
            {mediaUrls.length > 0 && ` • ${mediaUrls.length} media attached`}
          </span>
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && mediaUrls.length === 0) || isPending || isUploading}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50"
          >
            {isPending || isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isUploading ? 'Uploading...' : 'Posting...'}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
