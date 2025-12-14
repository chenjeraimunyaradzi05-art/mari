import Link from 'next/link';

export default function NotificationsPage() {
  // Mock data
  const aiNotifications = [
    {
      id: 1,
      title: "Skill Gap Identified",
      message: "Based on your recent job views, learning 'TypeScript' could increase your match rate by 40%.",
      action: { label: "View Course", url: "/resources/typescript" }
    },
    {
      id: 2,
      title: "Networking Opportunity",
      message: "3 mentors in your field are available for a session this week.",
      action: { label: "Find Mentor", url: "/mentors" }
    }
  ];

  const notifications = [
    {
      id: 1,
      type: "Connection Request",
      data: { message: "Sarah Jenkins wants to connect with you." },
      read_at: null,
      created_at: "2 hours ago"
    },
    {
      id: 2,
      type: "Event Reminder",
      data: { message: "Women in Tech Summit starts in 24 hours." },
      read_at: "2025-12-10 10:00:00",
      created_at: "1 day ago"
    },
    {
      id: 3,
      type: "System Alert",
      data: { message: "Your profile is 80% complete. Add a bio to reach 100%." },
      read_at: null,
      created_at: "2 days ago"
    }
  ];

  return (
    <div className="aura-container py-12">
      <h1 className="text-3xl font-bold text-pink-700 mb-8">Notifications</h1>

      {/* AI-Powered Alerts */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
           <span className="text-2xl">✨</span>
           <h2 className="text-xl font-bold text-violet-600">AI-Powered Alerts & Suggestions</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {aiNotifications.length > 0 ? (
            aiNotifications.map(alert => (
              <div key={alert.id} className="bg-white p-6 rounded-2xl border border-violet-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500"></div>
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-pink-600">{alert.title}</h3>
                   <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-1 rounded-full">AI Alert</span>
                </div>
                <p className="text-slate-600 mb-4 text-sm">{alert.message}</p>
                {alert.action && (
                  <Link href={alert.action.url} className="inline-block text-sm font-bold text-violet-600 hover:text-violet-800 hover:underline">
                    {alert.action.label} →
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full text-slate-500 italic">No AI alerts at this time. Engage more for smart notifications!</div>
          )}
        </div>
      </div>

      {/* Standard Notifications */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {notifications.map(notification => (
            <div key={notification.id} className={`p-5 rounded-xl border transition-all ${notification.read_at ? 'bg-white border-slate-100 opacity-75' : 'bg-white border-pink-100 shadow-sm border-l-4 border-l-pink-500'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                     <span className="text-sm font-bold text-slate-700">{notification.type}</span>
                     {!notification.read_at && <span className="w-2 h-2 rounded-full bg-pink-500"></span>}
                  </div>
                  <p className="text-slate-600">{notification.data.message}</p>
                  <p className="text-xs text-slate-400 mt-2">{notification.created_at}</p>
                </div>
                <div className="flex gap-2">
                  {!notification.read_at && (
                    <button className="px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                      Mark as Read
                    </button>
                  )}
                  <button className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
