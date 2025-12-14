'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'account', label: 'Account', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy', icon: '🛡️' }
  ];

  return (
    <div className="aura-container py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Settings</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-6 py-4 text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Profile Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">First Name</label>
                    <input type="text" defaultValue="Munyaradzi" className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Last Name</label>
                    <input type="text" defaultValue="Chenjerai" className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Bio</label>
                    <textarea rows={4} className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" defaultValue="Passionate about technology and community building."></textarea>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button className="aura-btn aura-btn-primary">Save Changes</button>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Account Security</h2>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                  <input type="email" defaultValue="munya@example.com" className="w-full rounded-xl border-slate-200 bg-slate-50" disabled />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Current Password</label>
                  <input type="password" className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
                  <input type="password" className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button className="aura-btn aura-btn-primary">Update Password</button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {['Email me about new job matches', 'Email me about mentorship requests', 'Notify me when someone comments on my post', 'Weekly newsletter'].map((item, i) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5" />
                      <span className="text-slate-700 font-medium">{item}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button className="aura-btn aura-btn-primary">Save Preferences</button>
                </div>
              </div>
            )}
            
            {activeTab === 'privacy' && (
               <div className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Privacy Settings</h2>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                     <h3 className="font-bold text-slate-900 mb-2">Profile Visibility</h3>
                     <p className="text-sm text-slate-600 mb-4">Control who can see your profile information.</p>
                     <select className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500">
                        <option>Public (Everyone)</option>
                        <option>Community Members Only</option>
                        <option>Private (Only Me)</option>
                     </select>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                     <button className="aura-btn aura-btn-primary">Update Privacy</button>
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
