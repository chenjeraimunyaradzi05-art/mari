import React from 'react';

export default function DeleteUserForm() {
  const handleDelete = (e) => {
    e.preventDefault();
    // TODO: Call API to delete user and handle confirmation
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      alert('Account deletion stub');
    }
  };

  return (
    <form onSubmit={handleDelete}>
      <div className="text-red-700">Danger zone</div>
      <div className="mt-2">
        <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded">Delete Account</button>
      </div>
    </form>
  );
}
