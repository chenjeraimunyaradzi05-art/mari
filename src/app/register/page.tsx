"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Loader2, 
  User, 
  GraduationCap, 
  Building2, 
  Briefcase, 
  Rocket, 
  TrendingUp, 
  Users, 
  Scale, 
  Home, 
  Shield, 
  Network, 
  MessageCircle, 
  Landmark, 
  BookOpen, 
  PiggyBank 
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    pronouns: '',
    pronouns_custom: '',
    account_type: 'candidate',
    intent: '',
    desired_portals: [] as string[],
    wellness_preferences: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, arrayName: 'desired_portals' | 'wellness_preferences') => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const currentArray = prev[arrayName];
      if (checked) {
        return { ...prev, [arrayName]: [...currentArray, value] };
      } else {
        return { ...prev, [arrayName]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.password_confirmation) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // Split name into first and last
      const nameParts = formData.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const payload = {
        firstName,
        lastName,
        email: formData.email,
        password: formData.password,
        role: formData.account_type === 'candidate' ? 'MEMBER' : 
              formData.account_type === 'mentor' ? 'MENTOR' : 
              formData.account_type === 'business' ? 'COMPANY' : 'MEMBER',
        profileData: {
          pronouns: formData.pronouns === 'self_described' ? formData.pronouns_custom : formData.pronouns,
          intent: formData.intent,
          desired_portals: formData.desired_portals,
          wellness_preferences: formData.wellness_preferences,
        }
      };

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Redirect to login page after successful registration
      router.push('/login?registered=true');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Side - Hero Content (Support Column) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-50 border-r border-slate-200 p-12 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-12">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-6">What brings you to Athena?</h3>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 font-bold">1</div>
                <div>
                  <strong className="block text-slate-900 text-lg">Career momentum</strong>
                  <p className="text-slate-600">Unlock sponsors, roles, and rituals that advance your next leap.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 font-bold">2</div>
                <div>
                  <strong className="block text-slate-900 text-lg">Launch or grow a venture</strong>
                  <p className="text-slate-600">Match with mentors, capital allies, and distribution partners.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 font-bold">3</div>
                <div>
                  <strong className="block text-slate-900 text-lg">Build wealth & money confidence</strong>
                  <p className="text-slate-600">Tap into financial wellbeing hubs, coaches, and literacy labs.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-bold">4</div>
                <div>
                  <strong className="block text-slate-900 text-lg">Find community & support</strong>
                  <p className="text-slate-600">Curate safe spaces, masterminds, and accountability circles.</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Which portals do you want first?</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <strong className="block text-slate-900">Women Real Estate</strong>
                <p className="text-sm text-slate-600">Listings, relocation support, verified agents, and housing pathways.</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <strong className="block text-slate-900">Emergency Housing</strong>
                <p className="text-sm text-slate-600">Support for women escaping domestic abuse or violence.</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <strong className="block text-slate-900">Business Network</strong>
                <p className="text-sm text-slate-600">Founder hubs, supplier showcases, and capital matchmaking.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex flex-col p-8 lg:p-16 overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-10">
            <span className="text-rose-600 font-bold tracking-wider uppercase text-xs mb-2 block">Join Athena</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Craft your safer work, money, housing and wellbeing plan.</h1>
            <p className="text-slate-600">
              Already onboarded? <Link href="/login" className="text-rose-600 font-bold hover:underline">Sign in</Link>.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Full name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                  placeholder="Enter a secure password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Confirm password *</label>
                <input
                  type="password"
                  name="password_confirmation"
                  value={formData.password_confirmation}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                  placeholder="Repeat your password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Pronouns *</label>
              <select
                name="pronouns"
                value={formData.pronouns}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                required
              >
                <option value="" disabled>Select pronouns</option>
                <option value="she_her">She / Her</option>
                <option value="he_him">He / Him</option>
                <option value="they_them">They / Them</option>
                <option value="self_described">Self-described</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            {formData.pronouns === 'self_described' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Self-described pronouns *</label>
                <input
                  type="text"
                  name="pronouns_custom"
                  value={formData.pronouns_custom}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                  placeholder="e.g. Ze / Zir"
                  required
                />
              </div>
            )}

            <div>
              <span className="block text-sm font-bold text-slate-700 mb-3">Create account for *</span>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'candidate', title: 'Member', desc: 'I want to grow my career, wealth & wellbeing', icon: User, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
                  { value: 'mentor', title: 'Mentor', desc: 'I want to mentor and support others', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
                  { value: 'business', title: 'Company', desc: 'I want to hire or partner with Athena', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
                ].map((option) => (
                  <label 
                    key={option.value} 
                    className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all duration-200 group
                      ${formData.account_type === option.value 
                        ? `border-rose-600 ${option.bg} ring-1 ring-rose-600 shadow-md` 
                        : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-slate-50'
                      }`}
                  >
                    <input
                      type="radio"
                      name="account_type"
                      value={option.value}
                      checked={formData.account_type === option.value}
                      onChange={handleChange}
                      className="mt-1 mr-4 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <option.icon 
                          className={`w-5 h-5 ${formData.account_type === option.value ? option.color : 'text-slate-400 group-hover:text-slate-600'}`} 
                          fill={formData.account_type === option.value ? "currentColor" : "none"}
                        />
                        <strong className={`block text-lg ${formData.account_type === option.value ? 'text-slate-900' : 'text-slate-700'}`}>{option.title}</strong>
                      </div>
                      <p className="text-sm text-slate-600">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-bold text-slate-700 mb-3">What brings you to Athena? *</span>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'career_growth', title: 'Career momentum', desc: 'Unlock sponsors, roles, and rituals', icon: Briefcase },
                  { value: 'launch_business', title: 'Launch or grow a venture', desc: 'Match with mentors & capital', icon: Rocket },
                  { value: 'wealth_building', title: 'Build wealth', desc: 'Financial wellbeing & coaching', icon: TrendingUp },
                  { value: 'community_support', title: 'Community & support', desc: 'Safe spaces & accountability', icon: Users },
                  { value: 'policy_impact', title: 'Policy & impact', desc: 'Collaborate with civic partners', icon: Scale }
                ].map((option) => (
                  <label 
                    key={option.value} 
                    className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all duration-200 group
                      ${formData.intent === option.value 
                        ? 'border-rose-600 bg-rose-50 ring-1 ring-rose-600 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-slate-50'
                      }`}
                  >
                    <input
                      type="radio"
                      name="intent"
                      value={option.value}
                      checked={formData.intent === option.value}
                      onChange={handleChange}
                      className="mt-1 mr-4 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <option.icon 
                          className={`w-5 h-5 ${formData.intent === option.value ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600'}`} 
                          fill={formData.intent === option.value ? "currentColor" : "none"}
                        />
                        <strong className={`block text-lg ${formData.intent === option.value ? 'text-slate-900' : 'text-slate-700'}`}>{option.title}</strong>
                      </div>
                      <p className="text-sm text-slate-600">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-bold text-slate-700 mb-3">Which portals do you want to explore first? *</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'real_estate', label: 'Women Real Estate', icon: Home },
                  { value: 'emergency_housing', label: 'Emergency Housing', icon: Shield },
                  { value: 'business', label: 'Business Network', icon: Network },
                  { value: 'social_feed', label: 'Social Feed', icon: MessageCircle },
                  { value: 'public_sector', label: 'Public Sector', icon: Landmark },
                  { value: 'education', label: 'Education & TAFE', icon: BookOpen },
                  { value: 'financial_wellbeing', label: 'Financial Wellbeing', icon: PiggyBank }
                ].map((option) => (
                  <label 
                    key={option.value} 
                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all duration-200 group
                      ${formData.desired_portals.includes(option.value) 
                        ? 'border-rose-600 bg-rose-100 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-slate-50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={formData.desired_portals.includes(option.value)}
                      onChange={(e) => handleCheckboxChange(e, 'desired_portals')}
                      className="mr-3 text-rose-600 focus:ring-rose-500 rounded"
                    />
                    <option.icon 
                      className={`w-4 h-4 mr-2 ${formData.desired_portals.includes(option.value) ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600'}`} 
                      fill={formData.desired_portals.includes(option.value) ? "currentColor" : "none"}
                    />
                    <span className={`text-sm font-medium ${formData.desired_portals.includes(option.value) ? 'text-slate-900' : 'text-slate-700'}`}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xl shadow-rose-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Submit & Register'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
