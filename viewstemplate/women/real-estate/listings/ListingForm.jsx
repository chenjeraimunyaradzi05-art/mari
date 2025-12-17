import React, { useState } from 'react';

export default function ListingForm({ initial = {} }){
  const [title, setTitle] = useState(initial.title || '');
  const [price, setPrice] = useState(initial.price || '');

  const submit = (e) => { e.preventDefault(); alert('Listing saved (stub)'); };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Price</label>
        <input value={price} onChange={e=>setPrice(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">Save</button>
    </form>
  );
}
