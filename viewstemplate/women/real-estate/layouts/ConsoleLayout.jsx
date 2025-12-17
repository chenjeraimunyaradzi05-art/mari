import React from 'react';
import ProfileSidebar from '../agents/profile/ProfileSidebar';

export default function ConsoleLayout({ children }){
  return (
    <div className="flex gap-8">
      <div className="flex-1">{children}</div>
      <ProfileSidebar agent={{ name: 'Sidebar Agent', title: 'Agent' }} />
    </div>
  );
}
