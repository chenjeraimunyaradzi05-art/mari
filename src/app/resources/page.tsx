import Link from 'next/link';

export default function ResourcesPage() {
  const resources = [
    {
      id: 1,
      title: "Financial Wellness Guide",
      type: "PDF Guide",
      category: "Finance",
      description: "A comprehensive guide to managing your personal finances, investments, and retirement planning.",
      icon: "💰",
      color: "bg-emerald-100 text-emerald-600"
    },
    {
      id: 2,
      title: "Tech Interview Cheatsheet",
      type: "Template",
      category: "Career",
      description: "Common algorithms, system design patterns, and behavioral questions to help you ace your interview.",
      icon: "💻",
      color: "bg-blue-100 text-blue-600"
    },
    {
      id: 3,
      title: "Leadership Workshop Recording",
      type: "Video",
      category: "Leadership",
      description: "Watch the replay of our exclusive workshop on leading with empathy and effectiveness.",
      icon: "🎥",
      color: "bg-purple-100 text-purple-600"
    },
    {
      id: 4,
      title: "Startup Pitch Deck Template",
      type: "Template",
      category: "Business",
      description: "A proven slide deck structure to help you present your startup idea to investors.",
      icon: "🚀",
      color: "bg-pink-100 text-pink-600"
    }
  ];

  return (
    <div className="aura-container py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Resource Library</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Tools, templates, and guides to support your professional and personal growth.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {['All Resources', 'Finance', 'Career', 'Leadership', 'Business', 'Wellbeing'].map((filter, i) => (
          <button key={filter} className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${i === 0 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            {filter}
          </button>
        ))}
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map(resource => (
          <div key={resource.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${resource.color}`}>
                {resource.icon}
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg uppercase tracking-wide">
                {resource.type}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
              {resource.title}
            </h3>
            <p className="text-slate-600 text-sm mb-6 line-clamp-2">
              {resource.description}
            </p>
            <button className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2">
              <span>Download</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
