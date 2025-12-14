import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      member: true,
    },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  const member = user.member;
  const profileData = (member?.profileData || {}) as any;

  const profile = {
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    username: user.email.split('@')[0],
    isVerified: false,
    profileType: user.role,
    bio: profileData.life_inspiration || "No bio yet.",
    website: "",
    location: profileData.location || "Unknown Location",
    coverUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
    avatarUrl: "https://ui-avatars.com/api/?name=" + encodeURIComponent(`${user.firstName || ''} ${user.lastName || ''}`) + "&background=random&size=200",
    stats: {
      followers: 0,
      following: 0,
      posts: 0
    },
    skills: ["React", "Next.js", "TypeScript"] // Placeholder skills
  };

  return (
    <div className="aura-container py-8">
      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-indigo-100/60 mb-8">
        {/* Cover Image */}
        <div className="h-48 bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200 relative">
           {/* In a real app, use next/image with the coverUrl */}
           <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
        </div>

        <div className="relative px-6 pb-8">
          <div className="relative -mt-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              {/* Avatar */}
              <div className="h-32 w-32 overflow-hidden rounded-3xl border-4 border-white shadow-lg shadow-indigo-200 bg-white">
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="h-full w-full object-cover"
                />
              </div>
              
              {/* Profile Info */}
              <div className="space-y-2 mb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {profile.displayName}
                  </h1>
                  {profile.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 border border-indigo-100">
                      Verified
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-pink-500 border border-pink-100">
                    {profile.profileType}
                  </span>
                </div>
                
                <p className="text-sm text-slate-600 font-medium">@{profile.username}</p>
                
                <p className="max-w-2xl text-sm leading-relaxed text-slate-700">
                  {profile.bio}
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm text-slate-500 pt-1">
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      <span>🔗</span> {profile.website.replace('https://', '')}
                    </a>
                  )}
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <span>📍</span> {profile.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pb-2">
              <Link href="/profile/edit" className="aura-btn aura-btn-primary text-sm py-2 px-6">
                Edit Profile
              </Link>
              <button className="aura-btn aura-btn-outline text-sm py-2 px-4">
                Share
              </button>
            </div>
          </div>
          
          {/* Stats & Tabs */}
          <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex gap-8">
                <div className="text-center">
                   <span className="block font-bold text-xl text-slate-900">{profile.stats.posts}</span>
                   <span className="text-xs text-slate-500 uppercase tracking-wider">Posts</span>
                </div>
                <div className="text-center">
                   <span className="block font-bold text-xl text-slate-900">{profile.stats.followers}</span>
                   <span className="text-xs text-slate-500 uppercase tracking-wider">Followers</span>
                </div>
                <div className="text-center">
                   <span className="block font-bold text-xl text-slate-900">{profile.stats.following}</span>
                   <span className="text-xs text-slate-500 uppercase tracking-wider">Following</span>
                </div>
             </div>

             <div className="flex gap-2">
                <button className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-sm">Timeline</button>
                <button className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors">About</button>
                <button className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors">Media</button>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Sidebar */}
        <div className="space-y-6">
           {/* Skills Card */}
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Skills & Expertise</h3>
              <div className="flex flex-wrap gap-2">
                 {profile.skills.map(skill => (
                    <span key={skill} className="px-3 py-1 bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-100">
                       {skill}
                    </span>
                 ))}
              </div>
           </div>

           {/* Completion Card */}
           <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <h3 className="font-bold text-lg mb-2">Profile Strength</h3>
              <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                 <div className="bg-white h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <p className="text-sm text-indigo-100 mb-4">
                 Your profile is <strong>85%</strong> complete. Add your work experience to reach 100%.
              </p>
              <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-colors">
                 Complete Profile
              </button>
           </div>
        </div>

        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
           {/* Create Post */}
           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                 <img src={profile.avatarUrl} alt="Me" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                 <input type="text" placeholder={`Share your thoughts, ${profile.displayName.split(' ')[0]}...`} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
                 <div className="flex justify-between items-center mt-3">
                    <div className="flex gap-2">
                       <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">📷</button>
                       <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">🎥</button>
                       <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">📅</button>
                    </div>
                    <button className="aura-btn aura-btn-primary py-1.5 px-4 text-sm">Post</button>
                 </div>
              </div>
           </div>

           {/* Sample Post */}
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                       <img src={profile.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                    </div>
                    <div>
                       <h4 className="font-bold text-slate-900 text-sm">{profile.displayName}</h4>
                       <p className="text-xs text-slate-500">2 hours ago • Public</p>
                    </div>
                 </div>
                 <button className="text-slate-400 hover:text-slate-600">•••</button>
              </div>
              <p className="text-slate-700 mb-4">
                 Just finished migrating the first section of the new Athena platform to Next.js! 🚀 The performance improvements are incredible. Can&apos;t wait to share more updates soon. #NextJS #WebDev #Athena
              </p>
              <div className="h-64 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-400">
                 {/* Placeholder for post image */}
                 <span>Post Image Placeholder</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                 <button className="flex items-center gap-2 text-slate-500 hover:text-pink-600 text-sm font-medium transition-colors">
                    <span>❤️</span> 24 Likes
                 </button>
                 <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors">
                    <span>💬</span> 5 Comments
                 </button>
                 <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors">
                    <span>↗️</span> Share
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
