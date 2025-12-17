import React from 'react';

export default function CreatePostModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded p-6 w-full max-w-md">
        <h3 className="font-bold mb-2">Create Post</h3>
        <textarea className="w-full border rounded p-2 mb-3" rows={4} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
          <button className="px-3 py-1 bg-emerald-600 text-white rounded">Post</button>
        </div>
      </div>
    </div>
  );
}
