import Link from 'next/link';
import Image from 'next/image';

export default function BlogPage() {
  // Mock data for blog posts
  const posts = [
    {
      id: 1,
      title: "Breaking the Glass Ceiling in Tech",
      excerpt: "Strategies for women to advance their careers in male-dominated industries.",
      author: "Sarah Jenkins",
      date: "Dec 10, 2025",
      category: "Career Advice",
      imageColor: "bg-pink-100"
    },
    {
      id: 2,
      title: "The Future of Remote Work",
      excerpt: "How to stay productive and maintain work-life balance in a remote-first world.",
      author: "Elena Rodriguez",
      date: "Dec 08, 2025",
      category: "Lifestyle",
      imageColor: "bg-blue-100"
    },
    {
      id: 3,
      title: "Mastering React Server Components",
      excerpt: "A deep dive into the latest features of Next.js and React 19.",
      author: "Munyaradzi Chenjerai",
      date: "Dec 05, 2025",
      category: "Engineering",
      imageColor: "bg-indigo-100"
    },
    {
      id: 4,
      title: "Fundraising 101 for Female Founders",
      excerpt: "Tips from top VCs on how to pitch your startup and secure funding.",
      author: "Dr. Emily Chen",
      date: "Dec 01, 2025",
      category: "Startup",
      imageColor: "bg-green-100"
    }
  ];

  return (
    <div className="aura-container py-12">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-indigo-600 font-semibold tracking-wider text-sm uppercase mb-2 block">Our Blog</span>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">Insights, Stories & Resources</h1>
        <p className="text-slate-600 text-lg leading-relaxed">
          Expert advice, inspiring stories, and the latest trends to help you grow your career and business.
        </p>
      </div>

      {/* Featured Post */}
      <div className="mb-16">
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-2xl">
           <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/90 to-purple-900/80 z-10"></div>
           {/* Placeholder for featured image */}
           <div className="absolute inset-0 bg-slate-800"></div> 
           
           <div className="relative z-20 p-8 md:p-16 flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                 <span className="inline-block px-3 py-1 rounded-full bg-pink-500 text-white text-xs font-bold uppercase tracking-wide">Featured</span>
                 <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                    Why Mentorship is the Key to Closing the Gender Gap in Tech
                 </h2>
                 <p className="text-indigo-100 text-lg">
                    Research shows that mentorship programs significantly increase retention and promotion rates for women in technology. Here's how to find the right mentor for you.
                 </p>
                 <div className="flex items-center gap-4 pt-4">
                    <div className="w-10 h-10 rounded-full bg-white/20"></div>
                    <div>
                       <p className="font-bold text-sm">Jessica Williams</p>
                       <p className="text-xs text-indigo-200">CEO, Athena</p>
                    </div>
                 </div>
              </div>
              <div className="flex-1 flex justify-center">
                 <button className="aura-btn bg-white text-indigo-900 hover:bg-indigo-50 px-8 py-4 text-lg shadow-lg">
                    Read Article
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
         {['All', 'Career Advice', 'Engineering', 'Startup', 'Lifestyle', 'Leadership'].map((cat, i) => (
            <button key={cat} className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
               {cat}
            </button>
         ))}
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map(post => (
          <article key={post.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
            <div className={`h-48 ${post.imageColor} relative overflow-hidden`}>
               <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20 group-hover:scale-110 transition-transform duration-500">
                  📝
               </div>
               <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-bold text-slate-900">
                     {post.category}
                  </span>
               </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <div className="mb-4">
                 <span className="text-xs text-slate-500 font-medium">{post.date}</span>
                 <h3 className="text-xl font-bold text-slate-900 mt-2 mb-3 group-hover:text-indigo-600 transition-colors">
                    <Link href={`/blog/${post.id}`}>{post.title}</Link>
                 </h3>
                 <p className="text-slate-600 text-sm line-clamp-3">
                    {post.excerpt}
                 </p>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                 <span className="text-sm font-medium text-slate-700">{post.author}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-16 bg-indigo-50 rounded-3xl p-12 text-center">
         <h2 className="text-2xl font-bold text-indigo-900 mb-4">Subscribe to our newsletter</h2>
         <p className="text-indigo-700 mb-8 max-w-xl mx-auto">
            Get the latest articles, resources, and event updates delivered directly to your inbox.
         </p>
         <form className="max-w-md mx-auto flex gap-2">
            <input type="email" placeholder="Enter your email" className="flex-1 rounded-full border-indigo-200 px-6 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <button className="aura-btn aura-btn-primary px-8">Subscribe</button>
         </form>
      </div>
    </div>
  );
}
