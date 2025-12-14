import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
  const stats = [
    { label: "Active Members", value: "15,000+", color: "text-purple-600" },
    { label: "Mentorship Sessions", value: "45,000+", color: "text-pink-600" },
    { label: "Countries Reached", value: "120+", color: "text-indigo-600" },
    { label: "Success Stories", value: "5,000+", color: "text-emerald-600" }
  ];

  const values = [
    {
      title: "Empowerment",
      description: "We believe in giving women the tools, resources, and confidence to take control of their careers and financial futures.",
      icon: "💪",
      color: "bg-purple-100 text-purple-600"
    },
    {
      title: "Community",
      description: "We foster a supportive, inclusive environment where women can connect, collaborate, and lift each other up.",
      icon: "🤝",
      color: "bg-pink-100 text-pink-600"
    },
    {
      title: "Innovation",
      description: "We embrace technology and new ideas to solve the unique challenges faced by women in the modern workforce.",
      icon: "💡",
      color: "bg-indigo-100 text-indigo-600"
    }
  ];

  const team = [
    { name: "Jessica Williams", role: "Founder & CEO", image: "bg-purple-200" },
    { name: "Sarah Jenkins", role: "Head of Community", image: "bg-pink-200" },
    { name: "Dr. Emily Chen", role: "Chief Learning Officer", image: "bg-indigo-200" },
    { name: "Elena Rodriguez", role: "CTO", image: "bg-emerald-200" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32 bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="aura-container relative z-10 text-center">
          <span className="inline-block px-4 py-2 rounded-full bg-white border border-purple-200 text-purple-700 font-bold text-sm mb-6 shadow-sm">
            Our Mission
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-8 tracking-tight">
            Empowering Women to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Lead, Innovate, and Thrive</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-12">
            Athena is more than a platform; it's a movement. We are dedicated to closing the gender gap in technology and leadership by providing mentorship, education, and a powerful community.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mt-16">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl shadow-lg shadow-purple-100/50 border border-slate-50 hover:-translate-y-1 transition-transform duration-300">
                <div className={`text-4xl font-extrabold mb-2 ${stat.color}`}>{stat.value}</div>
                <div className="text-slate-500 font-medium text-sm uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-white">
        <div className="aura-container">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-3xl transform rotate-3 opacity-10"></div>
                <div className="relative bg-slate-100 rounded-3xl h-[500px] w-full overflow-hidden shadow-xl">
                   {/* Placeholder for Story Image */}
                   <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-6xl">🖼️</div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Our Story</h2>
              <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
                <p>
                  Founded in 2023, Athena began with a simple question: "Why are there still so few women in leadership roles?"
                </p>
                <p>
                  What started as a small mentorship group has grown into a global network of ambitious women supporting one another. We realized that access to networks and role models was the missing piece of the puzzle.
                </p>
                <p>
                  Today, we are proud to be the launchpad for thousands of careers, businesses, and dreams. We are building the future of work, one connection at a time.
                </p>
              </div>
              <div className="mt-10">
                <Link href="/join" className="aura-btn aura-btn-primary text-lg px-8 py-4">
                  Join Our Journey
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-slate-50">
        <div className="aura-container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Our Core Values</h2>
            <p className="text-lg text-slate-600">
              These principles guide everything we do, from the features we build to the partnerships we form.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 ${value.color}`}>
                  {value.icon}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{value.title}</h3>
                <p className="text-slate-600 leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="aura-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Meet the Team</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              The passionate individuals working behind the scenes to make our vision a reality.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="group text-center">
                <div className={`relative w-48 h-48 mx-auto rounded-full overflow-hidden mb-6 ${member.image} ring-4 ring-white shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                   {/* Placeholder for Team Image */}
                   <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-50">👤</div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{member.name}</h3>
                <p className="text-purple-600 font-medium">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
