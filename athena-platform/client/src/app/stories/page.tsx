import { redirect } from 'next/navigation';

// Member stories are published on the blog; this route exists because public
// pages link to /stories. Permanent home: /blog.
export default function StoriesPage() {
  redirect('/blog');
}
