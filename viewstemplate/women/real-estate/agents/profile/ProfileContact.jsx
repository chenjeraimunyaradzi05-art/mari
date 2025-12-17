import React from 'react';

export default function ProfileContact({ contact }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2 text-emerald-700">Contact</h2>
      <ul className="text-gray-700">
        <li><span className="font-medium">Email:</span> {contact.email}</li>
        <li><span className="font-medium">Phone:</span> {contact.phone}</li>
        <li><span className="font-medium">Website:</span> <a href={contact.website} className="text-emerald-600 underline" target="_blank" rel="noopener noreferrer">{contact.website}</a></li>
      </ul>
    </div>
  );
}
