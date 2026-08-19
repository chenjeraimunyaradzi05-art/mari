import { redirect } from 'next/navigation';

// Groups live under Communities; this route exists because public pages link
// to /groups. Permanent home: /communities.
export default function GroupsPage() {
  redirect('/communities');
}
