import React, { useState } from 'react';

export default function UpdateProfileInformationForm() {
  const [name, setName] = useState('Jane Doe');
  const [email, setEmail] = useState('jane.doe@example.com');

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Integrate with API to update profile
    alert('Profile saved (stub)');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">Save</button>
      </div>
    </form>
  );
}
