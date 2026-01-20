'use client';

import { useState } from 'react';
import { UploadCloud, Sparkles, Tag, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { cn } from '@/lib/utils';

export default function CreatorStudioPage() {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('Career Growth');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Creator Upload Studio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload, polish, and publish your next career story.
          </p>
        </div>
        <Button className="gap-2">
          <Sparkles className="w-4 h-4" /> Publish
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div
            className={cn(
              'border-2 border-dashed rounded-2xl p-8 text-center transition',
              file ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700'
            )}
          >
            <UploadCloud className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Drag and drop a video here, or click to browse
            </p>
            <input
              type="file"
              accept="video/*"
              className="mt-4 block w-full text-sm text-gray-500"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="mt-2 text-xs text-emerald-600">Selected: {file.name}</p>
            )}
          </div>

          <div className="space-y-3">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. Negotiating your offer with confidence"
            />
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Write a compelling description for your audience..."
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-white dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Details</h2>
            <Input
              label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Interview, salary, leadership"
              icon={<Tag className="w-4 h-4 text-gray-400" />}
            />
            <Input
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Career Growth"
              icon={<Folder className="w-4 h-4 text-gray-400" />}
            />
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Publishing checklist</p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li>• Add a clear, concise title</li>
                <li>• Include 2-3 tags</li>
                <li>• Add a short summary</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-white dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Preview</h2>
            <div className="aspect-video rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
              {file ? 'Video ready for preview' : 'Upload to preview'}
            </div>
            <Button variant="outline" className="w-full">
              Save Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
