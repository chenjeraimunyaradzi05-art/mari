import Link from 'next/link';
import { Facebook, Instagram, X } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 py-4">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-12">
        
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-4">
          
          {/* Brand Column (Span 4) */}
          <div className="lg:col-span-4 space-y-2">
            <Link href="/" className="inline-block">
              <span className="text-xl font-bold text-white tracking-tight">ATHENA</span>
            </Link>
            <p className="text-slate-400 leading-relaxed max-w-md text-xs">
              Connecting women with opportunities, mentors, and resources to accelerate their careers and businesses. Join the ecosystem building the future of work.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a href="#" className="p-1.5 bg-slate-800 hover:bg-purple-600 text-white rounded-full transition-all">
                <X className="w-3.5 h-3.5" />
              </a>
              <a href="#" className="p-1.5 bg-slate-800 hover:bg-purple-600 text-white rounded-full transition-all">
                <Instagram className="w-3.5 h-3.5" />
              </a>
              <a href="#" className="p-1.5 bg-slate-800 hover:bg-purple-600 text-white rounded-full transition-all">
                <Facebook className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Links Columns (Span 8 total) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Platform */}
            <div className="space-y-2">
              <h3 className="text-white font-bold text-sm">Platform</h3>
              <ul className="space-y-1 text-xs">
                <li><Link href="/jobs" className="hover:text-purple-400 transition-colors">Find Jobs</Link></li>
                <li><Link href="/mentors" className="hover:text-purple-400 transition-colors">Find Mentors</Link></li>
                <li><Link href="/events" className="hover:text-purple-400 transition-colors">Events</Link></li>
                <li><Link href="/companies" className="hover:text-purple-400 transition-colors">Companies</Link></li>
                <li><Link href="/resources" className="hover:text-purple-400 transition-colors">Resources</Link></li>
              </ul>
            </div>

            {/* Community */}
            <div className="space-y-2">
              <h3 className="text-white font-bold text-sm">Community</h3>
              <ul className="space-y-1 text-xs">
                <li><Link href="/blog" className="hover:text-purple-400 transition-colors">Blog</Link></li>
                <li><Link href="/success-stories" className="hover:text-purple-400 transition-colors">Success Stories</Link></li>
                <li><Link href="/partners" className="hover:text-purple-400 transition-colors">Partners</Link></li>
                <li><Link href="/about" className="hover:text-purple-400 transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-purple-400 transition-colors">Contact</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-2">
              <h3 className="text-white font-bold text-sm">Legal</h3>
              <ul className="space-y-1 text-xs">
                <li><Link href="/privacy" className="hover:text-purple-400 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-purple-400 transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-purple-400 transition-colors">Cookie Policy</Link></li>
                <li><Link href="/security" className="hover:text-purple-400 transition-colors">Security</Link></li>
              </ul>
            </div>

            {/* CTA Column */}
            <div className="space-y-2">
              <h3 className="text-white font-bold text-sm">Get Started</h3>
              <p className="text-[10px] text-slate-400">Ready to accelerate your career?</p>
              <Link href="/register" className="inline-flex items-center justify-center w-full px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all shadow-lg shadow-purple-900/20">
                Join Community
              </Link>
            </div>

          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-3 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-slate-500">
            © 2025 Athena. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Developed by Munyaradzi Chenjerai</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
