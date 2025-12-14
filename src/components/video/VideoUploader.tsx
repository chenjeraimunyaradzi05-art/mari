'use client';

import { useState } from 'react';

export function VideoUploader() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    setUploading(true);
    setError(null);
    setResult(null);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const res = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4">Upload Video Resume</h3>
      
      <div className="mb-4">
        <input 
          type="file" 
          accept="video/*" 
          onChange={handleUpload} 
          disabled={uploading}
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-violet-50 file:text-violet-700
            hover:file:bg-violet-100
          "
        />
      </div>

      {uploading && (
        <div className="text-blue-600 animate-pulse">
          Processing video... This may take a moment.
        </div>
      )}

      {error && (
        <div className="text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          <div className="p-2 bg-green-50 text-green-700 rounded">
            Video processed successfully!
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Thumbnail</p>
              <img 
                src={result.thumbnailPath} 
                alt="Thumbnail" 
                className="w-full rounded border" 
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Preview</p>
              <video 
                src={result.videoPath} 
                controls 
                className="w-full rounded border" 
              />
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Duration: {result.duration.toFixed(1)}s | Format: {result.format}
          </div>
        </div>
      )}
    </div>
  );
}
