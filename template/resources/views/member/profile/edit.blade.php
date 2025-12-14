@extends('frontend.layouts.master')

@section('title', 'Edit Profile')

@section('content')
<div class="min-h-screen bg-slate-50 py-12 relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-rose-50/50 to-transparent pointer-events-none"></div>
    <div class="absolute top-20 right-0 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute top-40 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none"></div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <!-- Header -->
        <div class="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
                <div class="flex items-center gap-4">
                    <div class="p-3 bg-white rounded-2xl shadow-lg shadow-rose-100/50 border border-rose-100 transform -rotate-3">
                        <svg class="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 tracking-tight drop-shadow-sm">
                            Edit Profile
                        </h1>
                        <p class="text-slate-600 mt-1 text-lg font-medium">Update your personal information and preferences to stand out.</p>
                    </div>
                </div>
            </div>
            <a href="{{ route('member.personal.dashboard') }}"
               class="inline-flex items-center px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-bold hover:border-rose-200 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm hover:shadow-md group">
                <svg class="w-5 h-5 mr-2 text-slate-400 group-hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
            </a>
            <a href="{{ route('social.feed.index') }}"
               class="inline-flex items-center px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-bold hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm hover:shadow-md group">
                <svg class="w-5 h-5 mr-2 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Social Networking
            </a>
        </div>

        <form action="{{ route('member.profile.update') }}" method="POST" enctype="multipart/form-data" class="space-y-8">
            @csrf

            <!-- Personal Details Section (Rose Theme) -->
            <div class="bg-rose-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-rose-500 overflow-hidden hover:shadow-2xl hover:shadow-rose-100/50 transition-all duration-300">
                <div class="p-6 sm:p-8 border-b border-rose-200 bg-gradient-to-r from-rose-100/50 via-white/50 to-transparent">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/30 transform rotate-3">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-800">Personal Details</h2>
                    </div>
                </div>
                <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div class="md:col-span-2 flex items-center gap-6 mb-2 p-4 bg-white/50 rounded-2xl border border-rose-100">
                        <div class="shrink-0 relative group">
                            <img class="h-24 w-24 object-cover rounded-full border-4 border-white shadow-md group-hover:scale-105 transition-transform duration-300"
                                 src="{{ $user->avatar_url }}"
                                 alt="Current profile photo" />
                            <div class="absolute inset-0 rounded-full border-4 border-white shadow-inner pointer-events-none"></div>
                        </div>
                        <div class="flex-1">
                            <label class="block text-sm font-bold text-slate-700 mb-2">Profile Photo</label>
                            <input type="file" name="avatar" accept="image/*"
                                   class="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-rose-100 file:text-rose-700 hover:file:bg-rose-200 transition-all cursor-pointer bg-white rounded-xl border border-slate-200">
                            <p class="text-xs text-slate-500 mt-2">Recommended: Square image, JPG or PNG (Max 10MB)</p>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Date of Birth</label>
                        <input type="date" name="date_of_birth" value="{{ old('date_of_birth', optional($profile->date_of_birth)->format('Y-m-d')) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Marital Status</label>
                        <select name="marital_status" class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800">
                            <option value="">Select Status...</option>
                            @foreach(['Single', 'Married', 'Divorced', 'Widowed', 'In a Relationship'] as $status)
                                <option value="{{ $status }}" {{ old('marital_status', $profile->marital_status) == $status ? 'selected' : '' }}>{{ $status }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-bold text-slate-700 mb-2">Children Details</label>
                        <select name="children_details" class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800">
                            <option value="">Select Option...</option>
                            @foreach(['No Children', '1 Child', '2 Children', '3 Children', '4 Children', '5+ Children', 'Prefer not to say'] as $option)
                                <option value="{{ $option }}" {{ old('children_details', $profile->children_details) == $option ? 'selected' : '' }}>{{ $option }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Religion</label>
                        <select name="religion" class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800">
                            <option value="">Select Religion...</option>
                            @foreach(['Christianity', 'Islam', 'Hinduism', 'Buddhism', 'Judaism', 'Sikhism', 'No Religion', 'Prefer not to say'] as $religion)
                                <option value="{{ $religion }}" {{ old('religion', $profile->religion) == $religion ? 'selected' : '' }}>{{ $religion }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Location</label>
                        <div class="relative">
                            <select name="location" class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium text-slate-800 pl-16">
                                <option value="">Select Location...</option>
                                <optgroup label="Australia">
                                    @foreach(['Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA', 'Canberra, ACT', 'Hobart, TAS', 'Darwin, NT'] as $loc)
                                        <option value="{{ $loc }}" {{ old('location', $profile->location) == $loc ? 'selected' : '' }}>{{ $loc }}</option>
                                    @endforeach
                                </optgroup>
                                <optgroup label="International">
                                    @foreach(['Auckland, NZ', 'London, UK', 'New York, USA', 'Singapore', 'Tokyo, Japan', 'Remote', 'Other'] as $loc)
                                        <option value="{{ $loc }}" {{ old('location', $profile->location) == $loc ? 'selected' : '' }}>{{ $loc }}</option>
                                    @endforeach
                                </optgroup>
                            </select>
                            <svg class="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Career & Aspirations (Violet Theme) -->
            <div class="bg-violet-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-violet-500 overflow-hidden hover:shadow-2xl hover:shadow-violet-100/50 transition-all duration-300">
                <div class="p-6 sm:p-8 border-b border-violet-200 bg-gradient-to-r from-violet-100/50 via-white/50 to-transparent">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-600/30 transform -rotate-2">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-800">Career & Aspirations</h2>
                    </div>
                </div>
                <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Dream Job</label>
                        <input type="text" name="dream_job" value="{{ old('dream_job', $profile->dream_job) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Dream Company</label>
                        <input type="text" name="dream_company" value="{{ old('dream_company', $profile->dream_company) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Goal Qualification</label>
                        <input type="text" name="dream_qualification" value="{{ old('dream_qualification', $profile->dream_qualification) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Current Education Level</label>
                        <select name="education_level" class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800">
                            <option value="">Select Level...</option>
                            @foreach(['High School', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Other'] as $level)
                                <option value="{{ $level }}" {{ old('education_level', $profile->education_level) == $level ? 'selected' : '' }}>{{ $level }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-bold text-slate-700 mb-2">Life Inspiration / Quote</label>
                        <textarea name="life_inspiration" rows="2"
                                  class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium text-slate-800"
                                  placeholder="What drives you?">{{ old('life_inspiration', $profile->life_inspiration) }}</textarea>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-bold text-slate-700 mb-2">Resume / CV</label>
                        <div class="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-xl bg-white hover:bg-white hover:border-violet-300 transition-all">
                            <input type="file" name="resume" accept=".pdf,.doc,.docx" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 transition-all cursor-pointer">
                            @if($profile->resume_path)
                                <span class="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-bold">
                                    <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                    Uploaded
                                </span>
                            @endif
                        </div>
                        <p class="text-xs text-slate-500 mt-2 ml-1">Supported formats: PDF, DOC, DOCX (Max 5MB)</p>
                    </div>
                </div>
            </div>

            <!-- Public Sector & Civic Impact (Blue Theme) -->
            <div class="bg-blue-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-blue-500 overflow-hidden hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-300">
                <div class="p-6 sm:p-8 border-b border-blue-200 bg-gradient-to-r from-blue-100/50 via-white/50 to-transparent">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/30 transform rotate-1">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-800">Public Sector & Civic Impact</h2>
                    </div>
                </div>
                <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-bold text-slate-700 mb-2">Civic Impact Goals</label>
                        <textarea name="civic_impact_goals" rows="2"
                                  class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800"
                                  placeholder="How do you want to contribute to your community or country?">{{ old('civic_impact_goals', $profile->civic_impact_goals) }}</textarea>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Government Clearance Level</label>
                        <select name="government_clearance" class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800">
                            <option value="">None / Not Applicable</option>
                            @foreach(['Baseline', 'NV1 (Negative Vetting 1)', 'NV2 (Negative Vetting 2)', 'PV (Positive Vetting)'] as $level)
                                <option value="{{ $level }}" {{ old('government_clearance', $profile->government_clearance) == $level ? 'selected' : '' }}>{{ $level }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Areas of Interest</label>
                        <div class="flex flex-wrap gap-3 p-4 border border-slate-200 rounded-xl bg-white">
                            @foreach(['Policy Development', 'Digital Transformation', 'Healthcare', 'Education', 'Social Services', 'Defense & Security', 'Environment', 'Infrastructure', 'Legal & Justice'] as $interest)
                                <label class="cursor-pointer relative group">
                                    <input type="checkbox" name="public_sector_interests[]" value="{{ $interest }}" {{ in_array($interest, $profile->public_sector_interests ?? []) ? 'checked' : '' }}
                                           class="peer sr-only">
                                    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-white text-slate-600 border border-slate-200 transition-all shadow-sm peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 peer-checked:shadow-md peer-checked:shadow-blue-500/30 hover:bg-slate-50 peer-checked:hover:bg-blue-700 group-hover:scale-105">
                                        {{ $interest }}
                                    </span>
                                </label>
                            @endforeach
                        </div>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-bold text-slate-700 mb-2">Preferred Agencies to Follow</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2 custom-scrollbar">
                            @foreach($agencies as $agency)
                                <label class="relative flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-100 hover:border-blue-300 group">
                                    <input type="checkbox" name="preferred_agencies[]" value="{{ $agency->id }}" {{ in_array($agency->id, $profile->preferred_agencies ?? []) ? 'checked' : '' }}
                                           class="peer sr-only">

                                    <!-- Selection Indicator -->
                                    <div class="absolute inset-0 border-2 border-transparent rounded-2xl peer-checked:border-blue-500 pointer-events-none transition-all"></div>
                                    <div class="absolute top-3 right-3 opacity-0 peer-checked:opacity-100 text-blue-600 transition-all transform scale-50 peer-checked:scale-100 bg-blue-50 rounded-full p-0.5">
                                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                                    </div>

                                    @if($agency->hero_image_url)
                                        <img src="{{ $agency->hero_image_url }}" alt="" class="w-12 h-12 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform">
                                    @else
                                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-lg font-bold text-blue-600 shadow-sm group-hover:scale-105 transition-transform">{{ substr($agency->name, 0, 1) }}</div>
                                    @endif
                                    <span class="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors pr-6">{{ $agency->name }}</span>
                                </label>
                            @endforeach
                        </div>
                        <p class="text-xs text-slate-500 mt-2 ml-1">Select agencies you are interested in working with or following.</p>
                    </div>
                </div>
            </div>

            <!-- Interests & Hobbies (Emerald Theme) -->
            <div class="bg-emerald-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-emerald-500 overflow-hidden hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-300">
                <div class="p-6 sm:p-8 border-b border-emerald-200 bg-gradient-to-r from-emerald-100/50 via-white/50 to-transparent">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/30 transform -rotate-1">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-800">Interests & Hobbies</h2>
                    </div>
                </div>
                <div class="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Favorite Music / Artists</label>
                        <input type="text" name="favorite_music" value="{{ old('favorite_music', $profile->favorite_music) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Sporting Teams</label>
                        <input type="text" name="sporting_teams" value="{{ old('sporting_teams', $profile->sporting_teams) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Outdoor Leisure Activities</label>
                        <input type="text" name="outdoor_leisure" value="{{ old('outdoor_leisure', $profile->outdoor_leisure) }}"
                               class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800">
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Hobbies</label>
                        <textarea name="hobbies" rows="1"
                                  class="w-full rounded-xl border-slate-200 bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-slate-800">{{ old('hobbies', $profile->hobbies) }}</textarea>
                    </div>
                </div>
            </div>

            <!-- Privacy Settings (Slate Theme) -->
            <div class="bg-slate-50 rounded-3xl shadow-xl shadow-slate-200/60 border-t-4 border-slate-500 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300">
                <div class="p-6 sm:p-8 border-b border-slate-200 bg-gradient-to-r from-slate-100/50 via-white/50 to-transparent">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-slate-700 text-white rounded-2xl shadow-lg shadow-slate-700/30">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-800">Privacy Settings</h2>
                    </div>
                </div>
                <div class="p-6 sm:p-8">
                    <p class="text-slate-500 mb-6 font-medium">Control who can see specific parts of your profile.</p>

                    @php
                        $privacy = $profile->privacy_settings ?? [];
                        $fields = [
                            'resume' => 'Resume Visibility',
                            'contact_info' => 'Contact Information',
                            'family_details' => 'Family Details',
                            'aspirations' => 'Career Aspirations'
                        ];
                    @endphp

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        @foreach($fields as $key => $label)
                            <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100">
                                <span class="text-sm font-bold text-slate-700">{{ $label }}</span>
                                <select name="privacy_settings[{{ $key }}]" class="text-sm rounded-lg border-slate-200 focus:border-slate-500 focus:ring-slate-500 font-medium text-slate-600">
                                    <option value="public" {{ ($privacy[$key] ?? 'public') == 'public' ? 'selected' : '' }}>Public</option>
                                    <option value="friends" {{ ($privacy[$key] ?? '') == 'friends' ? 'selected' : '' }}>Friends Only</option>
                                    <option value="recruiters" {{ ($privacy[$key] ?? '') == 'recruiters' ? 'selected' : '' }}>Recruiters Only</option>
                                    <option value="private" {{ ($privacy[$key] ?? '') == 'private' ? 'selected' : '' }}>Private</option>
                                </select>
                            </div>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-4 pt-6 pb-12">
                <a href="{{ route('member.personal.dashboard') }}" class="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 hover:text-slate-800 transition-all">
                    Cancel
                </a>
                <button type="submit" class="px-10 py-4 bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/30 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Save Changes
                </button>
            </div>
        </form>
    </div>
</div>
@endsection
