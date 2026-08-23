import { redirect } from 'next/navigation';

// SuperAppNav and middleware's protectedRoutes both treat /settings as a real
// destination, but the settings surface itself lives under /dashboard/settings
// (which is where /settings/privacy already sends its "Back to Settings" link).
export default function SettingsPage() {
  redirect('/dashboard/settings');
}
