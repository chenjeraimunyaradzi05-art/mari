import React, { useState } from 'react';

export default function UpdatePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Integrate with API to change password
    alert('Password updated (stub)');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Current Password</label>
        <input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">New Password</label>
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Confirm Password</label>
        <input type="password" value={passwordConfirmation} onChange={(e)=>setPasswordConfirmation(e.target.value)} className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">Change Password</button>
      </div>
    </form>
  );
}
