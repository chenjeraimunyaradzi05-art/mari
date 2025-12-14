'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const mockAgencies = [
  { id: '1', name: 'Department of Education', hero_image_url: null },
  { id: '2', name: 'Department of Health', hero_image_url: null },
  { id: '3', name: 'Digital Transformation Agency', hero_image_url: null },
  { id: '4', name: 'CSIRO', hero_image_url: null },
  { id: '5', name: 'Department of Defence', hero_image_url: null },
];

export default function EditProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    // Personal Details
    avatar: '/images/placeholder-avatar.jpg',
    date_of_birth: '',
    gender: '',
    marital_status: '',
    children_details: '',
    religion: '',
    location: '',
    
    // Career & Aspirations
    dream_job: '',
    dream_company: '',
    dream_qualification: '',
    education_level: '',
    life_inspiration: '',
    resume_path: '',
    
    // Public Sector & Civic Impact
    civic_impact_goals: '',
    government_clearance: '',
    public_sector_interests: [] as string[],
    preferred_agencies: [] as string[],
    
    // Interests & Hobbies
    favorite_music: '',
    sporting_teams: '',
    hobbies: '',
    volunteer_work: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          
          // Map API data to form state
          const profileData = data.profileData || {};
          
          setFormData(prev => ({
            ...prev,
            // Core fields
            date_of_birth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
            gender: data.gender || '',
            education_level: data.educationLevel || '',
            
            // Extended profile data
            marital_status: profileData.marital_status || '',
            children_details: profileData.children_details || '',
            religion: profileData.religion || '',
            location: profileData.location || '',
            dream_job: profileData.dream_job || '',
            dream_company: profileData.dream_company || '',
            dream_qualification: profileData.dream_qualification || '',
            life_inspiration: profileData.life_inspiration || '',
            resume_path: profileData.resume_path || '',
            civic_impact_goals: profileData.civic_impact_goals || '',
            government_clearance: profileData.government_clearance || '',
            public_sector_interests: profileData.public_sector_interests || [],
            preferred_agencies: profileData.preferred_agencies || [],
            favorite_music: profileData.favorite_music || '',
            sporting_teams: profileData.sporting_teams || '',
            hobbies: profileData.hobbies || '',
            volunteer_work: profileData.volunteer_work || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setMessage({ type: 'error', text: 'Failed to load profile data' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, arrayName: string) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      // @ts-expect-error - Dynamic key access on state object
      const currentArray = prev[arrayName] as string[];
      if (checked) {
        return { ...prev, [arrayName]: [...currentArray, value] };
      } else {
        return { ...prev, [arrayName]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      // Construct payload for API
      const payload = {
        dateOfBirth: formData.date_of_birth || null,
        gender: formData.gender || null,
        educationLevel: formData.education_level || null,
        profileData: {
          marital_status: formData.marital_status,
          children_details: formData.children_details,
          religion: formData.religion,
          location: formData.location,
          dream_job: formData.dream_job,
          dream_company: formData.dream_company,
          dream_qualification: formData.dream_qualification,
          life_inspiration: formData.life_inspiration,
          resume_path: formData.resume_path,
          civic_impact_goals: formData.civic_impact_goals,
          government_clearance: formData.government_clearance,
          public_sector_interests: formData.public_sector_interests,
          preferred_agencies: formData.preferred_agencies,
          favorite_music: formData.favorite_music,
          sporting_teams: formData.sporting_teams,
          hobbies: formData.hobbies,
          volunteer_work: formData.volunteer_work
        }
      };

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Optional: Redirect or scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 relative overflow-hidden font-sans">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-linear-to-b from-rose-50/50 to-transparent pointer-events-none"></div>
      <div className="absolute top-20 right-0 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-40 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-lg shadow-rose-100/50 border border-rose-100 transform -rotate-3">
                <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-rose-600 via-purple-600 to-blue-600 tracking-tight drop-shadow-sm">
                  Edit Profile
                </h1>
                <p className="text-slate-600 mt-1 text-lg font-medium">Update your personal information and preferences to stand out.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard"
               className="inline-flex items-center px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-bold hover:border-rose-200 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm hover:shadow-md group">
                <svg className="w-5 h-5 mr-2 text-slate-400 group-hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
            </Link>
            <Link href="/social/feed"
               className="inline-flex items-center px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-bold hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm hover:shadow-md group">
                <svg className="w-5 h-5 mr-2 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Social Networking
            </Link>
          </div>
        </div>

        {message && (
          <div className={`mb-8 p-4 rounded-2xl border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} flex items-center gap-3`}>
            {message.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            <span className="font-bold">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Personal Details Section (Rose Theme) */}
            <div className="bg-rose-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-rose-500 overflow-hidden hover:shadow-2xl hover:shadow-rose-100/50 transition-all duration-300">
                <div className="p-6 sm:p-8 border-b border-rose-200 bg-linear-to-r from-rose-100/50 via-white/50 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/30 transform rotate-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Personal Details</h2>
                    </div>
                </div>
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2 flex items-center gap-6 mb-2 p-4 bg-white/50 rounded-2xl border border-rose-100">
                        <div className="shrink-0 relative group">
                            <div className="h-24 w-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-200">
                                {/* Placeholder for avatar */}
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Profile Photo</label>
                            <input type="file" name="avatar" accept="image/*"
                                   className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-rose-100 file:text-rose-700 hover:file:bg-rose-200 transition-all cursor-pointer bg-white rounded-xl border border-slate-200" />
                            <p className="text-xs text-slate-500 mt-2">Recommended: Square image, JPG or PNG (Max 10MB)</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Date of Birth</label>
                        <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Gender</label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 p-3 border">
                            <option value="">Select Gender...</option>
                            {['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'].map(g => (
                                <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Marital Status</label>
                        <select name="marital_status" value={formData.marital_status} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 p-3 border">
                            <option value="">Select Status...</option>
                            {['Single', 'Married', 'Divorced', 'Widowed', 'In a Relationship'].map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Children Details</label>
                        <select name="children_details" value={formData.children_details} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 p-3 border">
                            <option value="">Select Option...</option>
                            {['No Children', '1 Child', '2 Children', '3 Children', '4 Children', '5+ Children', 'Prefer not to say'].map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Religion</label>
                        <select name="religion" value={formData.religion} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 p-3 border">
                            <option value="">Select Religion...</option>
                            {['Christianity', 'Islam', 'Hinduism', 'Buddhism', 'Judaism', 'Sikhism', 'No Religion', 'Prefer not to say'].map(religion => (
                                <option key={religion} value={religion}>{religion}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Location</label>
                        <div className="relative">
                            <select name="location" value={formData.location} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 p-3 border pl-10">
                                <option value="">Select Location...</option>
                                <optgroup label="Australia">
                                    {['Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA', 'Canberra, ACT', 'Hobart, TAS', 'Darwin, NT'].map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="International">
                                    {['Auckland, NZ', 'London, UK', 'New York, USA', 'Singapore', 'Tokyo, Japan', 'Remote', 'Other'].map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </optgroup>
                            </select>
                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Career & Aspirations (Violet Theme) */}
            <div className="bg-violet-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-violet-500 overflow-hidden hover:shadow-2xl hover:shadow-violet-100/50 transition-all duration-300">
                <div className="p-6 sm:p-8 border-b border-violet-200 bg-linear-to-r from-violet-100/50 via-white/50 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-600/30 transform -rotate-2">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Career & Aspirations</h2>
                    </div>
                </div>
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Dream Job</label>
                        <input type="text" name="dream_job" value={formData.dream_job} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Dream Company</label>
                        <input type="text" name="dream_company" value={formData.dream_company} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Goal Qualification</label>
                        <input type="text" name="dream_qualification" value={formData.dream_qualification} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Current Education Level</label>
                        <select name="education_level" value={formData.education_level} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800 p-3 border">
                            <option value="">Select Level...</option>
                            {['High School', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Other'].map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Life Inspiration / Quote</label>
                        <textarea name="life_inspiration" rows={2} value={formData.life_inspiration} onChange={handleInputChange}
                                  className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800 p-3 border"
                                  placeholder="What drives you?"></textarea>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Resume / CV</label>
                        <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-xl bg-white hover:bg-white hover:border-violet-300 transition-all">
                            <input type="file" name="resume" accept=".pdf,.doc,.docx" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 transition-all cursor-pointer" />
                            {formData.resume_path && (
                                <span className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-bold">
                                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    Uploaded
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 ml-1">Supported formats: PDF, DOC, DOCX (Max 5MB)</p>
                    </div>
                </div>
            </div>

            {/* Public Sector & Civic Impact (Blue Theme) */}
            <div className="bg-blue-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-blue-500 overflow-hidden hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-300">
                <div className="p-6 sm:p-8 border-b border-blue-200 bg-linear-to-r from-blue-100/50 via-white/50 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/30 transform rotate-1">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Public Sector & Civic Impact</h2>
                    </div>
                </div>
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Civic Impact Goals</label>
                        <textarea name="civic_impact_goals" rows={2} value={formData.civic_impact_goals} onChange={handleInputChange}
                                  className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 p-3 border"
                                  placeholder="How do you want to contribute to your community or country?"></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Government Clearance Level</label>
                        <select name="government_clearance" value={formData.government_clearance} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 p-3 border">
                            <option value="">None / Not Applicable</option>
                            {['Baseline', 'NV1 (Negative Vetting 1)', 'NV2 (Negative Vetting 2)', 'PV (Positive Vetting)'].map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Areas of Interest</label>
                        <div className="flex flex-wrap gap-3 p-4 border border-slate-200 rounded-xl bg-white">
                            {['Policy Development', 'Digital Transformation', 'Healthcare', 'Education', 'Social Services', 'Defense & Security', 'Environment', 'Infrastructure', 'Legal & Justice'].map(interest => (
                                <label key={interest} className="cursor-pointer relative group">
                                    <input type="checkbox" name="public_sector_interests" value={interest} checked={formData.public_sector_interests.includes(interest)} onChange={(e) => handleCheckboxChange(e, 'public_sector_interests')}
                                           className="peer sr-only" />
                                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-white text-slate-600 border border-slate-200 transition-all shadow-sm peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 peer-checked:shadow-md peer-checked:shadow-blue-500/30 hover:bg-slate-50 peer-checked:hover:bg-blue-700 group-hover:scale-105">
                                        {interest}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Agencies to Follow</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2 custom-scrollbar">
                            {mockAgencies.map(agency => (
                                <label key={agency.id} className="relative flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-100 hover:border-blue-300 group">
                                    <input type="checkbox" name="preferred_agencies" value={agency.id} checked={formData.preferred_agencies.includes(agency.id)} onChange={(e) => handleCheckboxChange(e, 'preferred_agencies')}
                                           className="peer sr-only" />

                                    {/* Selection Indicator */}
                                    <div className="absolute inset-0 border-2 border-transparent rounded-2xl peer-checked:border-blue-500 pointer-events-none transition-all"></div>
                                    <div className="absolute top-3 right-3 opacity-0 peer-checked:opacity-100 text-blue-600 transition-all transform scale-50 peer-checked:scale-100 bg-blue-50 rounded-full p-0.5">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                    </div>

                                    {agency.hero_image_url ? (
                                        <img src={agency.hero_image_url} alt="" className="w-12 h-12 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-50 to-blue-100 flex items-center justify-center text-lg font-bold text-blue-600 shadow-sm group-hover:scale-105 transition-transform">{agency.name.substring(0, 1)}</div>
                                    )}
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors pr-6">{agency.name}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 ml-1">Select agencies you are interested in working with or following.</p>
                    </div>
                </div>
            </div>

            {/* Interests & Hobbies (Emerald Theme) */}
            <div className="bg-emerald-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-emerald-500 overflow-hidden hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-300">
                <div className="p-6 sm:p-8 border-b border-emerald-200 bg-linear-to-r from-emerald-100/50 via-white/50 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/30 transform -rotate-1">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Interests & Hobbies</h2>
                    </div>
                </div>
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Favorite Music / Artists</label>
                        <input type="text" name="favorite_music" value={formData.favorite_music} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Sporting Teams</label>
                        <input type="text" name="sporting_teams" value={formData.sporting_teams} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Hobbies</label>
                        <input type="text" name="hobbies" value={formData.hobbies} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Volunteer Work</label>
                        <input type="text" name="volunteer_work" value={formData.volunteer_work} onChange={handleInputChange}
                               className="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800 p-3 border" />
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6">
                <button 
                    type="submit" 
                    disabled={isSaving}
                    className={`inline-flex items-center px-8 py-4 bg-linear-to-r from-rose-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transform hover:-translate-y-1 transition-all duration-300 text-lg ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isSaving ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Save Changes
                        </>
                    )}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
}
