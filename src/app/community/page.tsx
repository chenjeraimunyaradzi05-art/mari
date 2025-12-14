import Link from 'next/link';

export default function CommunityPage() {
  // Mock data for groups
  const groups = [
    {
      id: 1,
      name: "Women in Tech Leadership",
      description: "A space for women leaders in technology to share insights, challenges, and opportunities.",
      members: 1250,
      type: "Public",
      imageColor: "bg-indigo-100 text-indigo-600"
    },
    {
      id: 2,
      name: "Startup Founders Circle",
      description: "Connect with fellow founders, find co-founders, and get advice on fundraising.",
      members: 840,
      type: "Private",
      imageColor: "bg-pink-100 text-pink-600"
    },
    {
      id: 3,
      name: "Digital Marketing Pros",
      description: "Discuss the latest trends in SEO, social media, and content marketing.",
      members: 3200,
      type: "Public",
      imageColor: "bg-green-100 text-green-600"
    },
    {
      id: 4,
      name: "Remote Work Lifestyle",
      description: "Tips and tricks for staying productive and healthy while working from home.",
      members: 5600,
      type: "Public",
      imageColor: "bg-blue-100 text-blue-600"
    },
    {
      id: 5,
      name: "Fintech Innovators",
      description: "Exploring the future of finance and technology.",
      members: 450,
      type: "Private",
      imageColor: "bg-purple-100 text-purple-600"
    },
    {
      id: 6,
      name: "Creative Designers",
      description: "Share your portfolio, get feedback, and find inspiration.",
      members: 1800,
      type: "Public",
      imageColor: "bg-orange-100 text-orange-600"
    }
  ];

  const aiSuggestions = [
    {
      id: 101,
      name: "AI & Machine Learning",
      reason: "Based on your interest in 'Data Science'",
      members: 900
    },
    {
      id: 102,
      name: "Next.js Developers",
      reason: "Based on your skill 'Next.js'",
      members: 150
    }
  ];

  return (
    <div className="aura-container py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Groups & Communities</h1>
          <p className="text-slate-600">Connect with like-minded professionals and grow your network.</p>
        </div>
        <Link href="/community/create" className="aura-btn aura-btn-primary">
          + Create Group
        </Link>
      </div>

      {/* AI Suggestions */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
           <span className="text-xl">✨</span>
           <h3 className="font-bold text-indigo-900 text-lg">AI-Powered Suggestions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {aiSuggestions.map(suggestion => (
              <div key={suggestion.id} className="bg-gradient-to-r from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100 flex justify-between items-center">
                 <div>
                    <h4 className="font-bold text-slate-900">{suggestion.name}</h4>
                    <p className="text-xs text-indigo-600 font-medium mt-1">{suggestion.reason}</p>
                    <p className="text-xs text-slate-500 mt-1">{suggestion.members} members</p>
                 </div>
                 <button className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors">
                    Join Group
                 </button>
              </div>
           ))}
        </div>
      </div>

      {/* All Groups Grid */}
      <h3 className="font-bold text-slate-900 text-lg mb-6">Explore Groups</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map(group => (
          <div key={group.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group-card">
            <div className="flex justify-between items-start mb-4">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${group.imageColor}`}>
                  {group.name.charAt(0)}
               </div>
               <span className={`px-2 py-1 rounded-md text-xs font-bold ${group.type === 'Private' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                  {group.type}
               </span>
            </div>
            
            <h4 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
               <Link href={`/community/${group.id}`}>{group.name}</Link>
            </h4>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2 h-10">
               {group.description}
            </p>
            
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
               <span className="text-xs text-slate-500 font-medium">{group.members.toLocaleString()} members</span>
               <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                  View Group &rarr;
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
