'use client';

import { redirect } from 'next/navigation';

export default function ProfilePage() {
  // Redirect to the dashboard profile section
  redirect('/dashboard/profile');
}
