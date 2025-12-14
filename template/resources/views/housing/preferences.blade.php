@extends('layouts.app')

@section('title', 'Housing Preferences')

@push('styles')
<style>
    .glass-card {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.6);
    }
    .glass-card:hover {
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
    }
    .form-checkbox:checked {
        background-color: #0d9488; /* Teal 600 */
        border-color: #0d9488;
    }
    .form-radio:checked {
        background-color: #be185d; /* Rose 700 */
        border-color: #be185d;
    }
    .range-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: #4f46e5; /* Indigo 600 */
        cursor: pointer;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
</style>
@endpush

@section('content')
<div class="min-h-screen bg-gradient-to-br from-teal-50 via-white to-rose-50 py-6 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
    <!-- Animated Background Blobs -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div class="absolute top-0 right-0 w-96 h-96 bg-rose-100 rounded-full blur-3xl opacity-40 -mr-20 -mt-20 animate-pulse"></div>
        <div class="absolute bottom-0 left-0 w-96 h-96 bg-teal-100 rounded-full blur-3xl opacity-40 -ml-20 -mb-20 animate-pulse" style="animation-delay: 2s;"></div>
    </div>

    <div class="max-w-5xl mx-auto relative z-10">
        <!-- Header -->
        <div class="mb-12">
            <div class="flex flex-col md:flex-row items-center justify-between gap-8">
                <div class="text-center md:text-left">
                    <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">
                        Good morning, <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-rose-600">{{ auth()->user()->name }}</span>.
                    </h1>
                </div>

                <div class="relative group">
                    <div class="absolute -inset-1 bg-gradient-to-r from-teal-400 to-rose-400 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div class="relative w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-white shadow-xl">
                        <img src="{{ auth()->user()->avatar_url }}" alt="{{ auth()->user()->name }}" class="w-full h-full rounded-full object-cover">
                        <a href="{{ route('member.profile.edit') }}" class="absolute bottom-2 right-2 bg-slate-900 text-white p-2.5 rounded-full shadow-lg hover:bg-slate-800 transition-transform hover:scale-110">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <form action="{{ route('housing.preferences.store') }}" method="POST" class="space-y-8">
            @csrf

            <!-- Section 1: Intent & Budget -->
            <div class="glass-card rounded-3xl p-8 relative overflow-hidden group transition-all duration-300">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div class="flex items-center gap-3 mb-8">
                    <div class="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-800">Intent & Budget</h2>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <!-- Buying Intent -->
                    <div class="space-y-4">
                        <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider">I am looking to</label>
                        <div class="grid grid-cols-3 gap-4">
                            <label class="cursor-pointer group/item relative">
                                <input type="radio" name="intent" value="buy" class="peer sr-only" checked>
                                <div class="flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 border-slate-200 bg-white text-slate-500 peer-checked:border-teal-500 peer-checked:bg-teal-50 peer-checked:text-teal-700 transition-all duration-300 hover:border-teal-200 hover:shadow-md transform peer-checked:scale-105">
                                    <svg class="w-8 h-8 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    <span class="font-bold text-sm uppercase tracking-wider">Buy</span>
                                </div>
                                <div class="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 text-teal-600 transition-all transform scale-50 peer-checked:scale-100">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            </label>

                            <label class="cursor-pointer group/item relative">
                                <input type="radio" name="intent" value="rent" class="peer sr-only">
                                <div class="flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 border-slate-200 bg-white text-slate-500 peer-checked:border-teal-500 peer-checked:bg-teal-50 peer-checked:text-teal-700 transition-all duration-300 hover:border-teal-200 hover:shadow-md transform peer-checked:scale-105">
                                    <svg class="w-8 h-8 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span class="font-bold text-sm uppercase tracking-wider">Rent</span>
                                </div>
                                <div class="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 text-teal-600 transition-all transform scale-50 peer-checked:scale-100">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            </label>

                            <label class="cursor-pointer group/item relative">
                                <input type="radio" name="intent" value="share" class="peer sr-only">
                                <div class="flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 border-slate-200 bg-white text-slate-500 peer-checked:border-teal-500 peer-checked:bg-teal-50 peer-checked:text-teal-700 transition-all duration-300 hover:border-teal-200 hover:shadow-md transform peer-checked:scale-105">
                                    <svg class="w-8 h-8 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span class="font-bold text-sm uppercase tracking-wider">Share</span>
                                </div>
                                <div class="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 text-teal-600 transition-all transform scale-50 peer-checked:scale-100">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Price Range -->
                    <div class="space-y-4">
                        <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider">Budget Range</label>
                        <div class="flex items-center gap-4">
                            <div class="relative flex-1 group/input">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium group-focus-within/input:text-teal-500 transition-colors">$</span>
                                <input type="number" placeholder="Min" class="w-full pl-8 pr-4 py-3.5 rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500 bg-slate-50 transition-all hover:bg-white">
                            </div>
                            <span class="text-slate-400 font-bold">to</span>
                            <div class="relative flex-1 group/input">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium group-focus-within/input:text-teal-500 transition-colors">$</span>
                                <input type="number" placeholder="Max" class="w-full pl-8 pr-4 py-3.5 rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500 bg-slate-50 transition-all hover:bg-white">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 2: Location & Lifestyle -->
            <div class="glass-card rounded-3xl p-8 relative overflow-hidden group transition-all duration-300">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div class="flex items-center gap-3 mb-8">
                    <div class="p-2.5 bg-rose-50 rounded-xl text-rose-600 shadow-sm">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-800">Location & Lifestyle</h2>
                </div>

                <div class="space-y-8">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Preferred Locations</label>
                        <div class="relative group/input">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-rose-500 transition-colors">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </span>
                            <input type="text" placeholder="Enter suburbs, postcodes, or regions..." class="w-full pl-14 pr-4 py-3.5 rounded-xl border-slate-200 focus:border-rose-500 focus:ring-rose-500 bg-slate-50 transition-all hover:bg-white">
                        </div>
                        <p class="text-sm text-slate-500 mt-2 font-medium">Separate multiple locations with commas.</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                            <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">Commute Tolerance</label>
                            <div class="space-y-6 px-2">
                                <div class="flex justify-between text-sm text-slate-600 font-bold">
                                    <span>&lt; 15 mins</span>
                                    <span>30 mins</span>
                                    <span>45 mins</span>
                                    <span>60+ mins</span>
                                </div>
                                <div class="relative">
                                    <input type="range" min="15" max="60" step="15" class="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer range-slider accent-rose-600 z-10 relative">
                                    <div class="absolute top-1/2 left-0 w-full h-3 -translate-y-1/2 bg-gradient-to-r from-teal-400 via-indigo-400 to-rose-500 rounded-full opacity-30 pointer-events-none"></div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Lifestyle Priorities</label>
                            <div class="flex flex-wrap gap-2">
                                @php
                                    $lifestyleIcons = [
                                        'Public Transport' => '🚆',
                                        'Schools' => '🎓',
                                        'Parks' => '🌳',
                                        'Cafes' => '☕',
                                        'Beach' => '🏖️',
                                        'Nightlife' => '🍸',
                                        'Quiet Street' => '🤫'
                                    ];
                                @endphp
                                @foreach($lifestyleIcons as $tag => $icon)
                                <label class="cursor-pointer group/tag">
                                    <input type="checkbox" class="peer sr-only">
                                    <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold peer-checked:bg-gradient-to-r peer-checked:from-rose-500 peer-checked:to-pink-500 peer-checked:text-white peer-checked:border-transparent peer-checked:shadow-md transition-all hover:bg-slate-50 hover:border-rose-200 hover:shadow-sm transform peer-checked:scale-105">
                                        <span>{{ $icon }}</span>
                                        <span>{{ $tag }}</span>
                                    </span>
                                </label>
                                @endforeach
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 3: Property Details -->
            <div class="glass-card rounded-3xl p-8 relative overflow-hidden group transition-all duration-300">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div class="flex items-center gap-3 mb-8">
                    <div class="p-2.5 bg-blue-50 rounded-xl text-blue-600 shadow-sm">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-800">Property Details</h2>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Property Type</label>
                        <div class="grid grid-cols-2 gap-3">
                            @php
                                $propertyTypes = [
                                    'House' => 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
                                    'Apartment' => 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                                    'Townhouse' => 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z',
                                    'Villa' => 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
                                    'Land' => 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7'
                                ];
                            @endphp
                            @foreach($propertyTypes as $type => $path)
                            <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-blue-200 hover:shadow-lg cursor-pointer transition-all group/type overflow-hidden">
                                <input type="checkbox" class="peer sr-only">
                                <div class="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                                <div class="absolute top-3 right-3 opacity-0 peer-checked:opacity-100 text-blue-600 transition-all transform scale-50 peer-checked:scale-100">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <svg class="w-8 h-8 text-slate-400 mb-2 group-hover/type:text-blue-500 peer-checked:text-blue-600 transition-colors relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="{{ $path }}" />
                                </svg>
                                <span class="text-sm font-bold text-slate-600 group-hover/type:text-blue-700 peer-checked:text-blue-800 relative z-10">{{ $type }}</span>
                                <div class="absolute inset-0 border-2 border-blue-500 rounded-2xl opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"></div>
                            </label>
                            @endforeach
                        </div>
                    </div>

                    <div class="space-y-8">
                        <div>
                            <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Bedrooms</label>
                            <div class="flex gap-2">
                                @foreach(['Studio', '1', '2', '3', '4', '5+'] as $bed)
                                <label class="cursor-pointer flex-1">
                                    <input type="radio" name="bedrooms" class="peer sr-only">
                                    <div class="text-center py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600 peer-checked:text-white peer-checked:border-transparent peer-checked:shadow-md transition-all font-bold hover:bg-slate-50 hover:border-blue-300 shadow-sm transform peer-checked:scale-105">
                                        {{ $bed }}
                                    </div>
                                </label>
                                @endforeach
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Bathrooms</label>
                            <div class="flex gap-2">
                                @foreach(['1', '2', '3+'] as $bath)
                                <label class="cursor-pointer flex-1">
                                    <input type="radio" name="bathrooms" class="peer sr-only">
                                    <div class="text-center py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600 peer-checked:text-white peer-checked:border-transparent peer-checked:shadow-md transition-all font-bold hover:bg-slate-50 hover:border-blue-300 shadow-sm transform peer-checked:scale-105">
                                        {{ $bath }}
                                    </div>
                                </label>
                                @endforeach
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Car Spaces</label>
                            <div class="flex gap-2">
                                @foreach(['0', '1', '2+'] as $car)
                                <label class="cursor-pointer flex-1">
                                    <input type="radio" name="cars" class="peer sr-only">
                                    <div class="text-center py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600 peer-checked:text-white peer-checked:border-transparent peer-checked:shadow-md transition-all font-bold hover:bg-slate-50 hover:border-blue-300 shadow-sm transform peer-checked:scale-105">
                                        {{ $car }}
                                    </div>
                                </label>
                                @endforeach
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">Must-Have Features</label>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        @php
                            $features = [
                                'Air Conditioning' => '❄️',
                                'Balcony' => '☀️',
                                'Dishwasher' => '🍽️',
                                'Built-in Robes' => '👗',
                                'Courtyard' => '🌿',
                                'Floorboards' => '🪵',
                                'Gym' => '🏋️‍♀️',
                                'Pool' => '🏊‍♀️',
                                'Study' => '📚',
                                'Wheelchair Access' => '♿',
                                'Solar Panels' => '⚡',
                                'EV Charging' => '🔋'
                            ];
                        @endphp
                        @foreach($features as $feature => $icon)
                        <label class="cursor-pointer group/feature">
                            <input type="checkbox" class="peer sr-only">
                            <div class="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 peer-checked:text-white peer-checked:border-transparent peer-checked:shadow-md transition-all hover:bg-slate-50 hover:border-blue-200 hover:shadow-sm h-full transform peer-checked:scale-105">
                                <span class="text-lg">{{ $icon }}</span>
                                <span>{{ $feature }}</span>
                            </div>
                        </label>
                        @endforeach
                    </div>
                </div>
            </div>

            <!-- Action Bar -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-200/60">
                <p class="text-sm text-slate-400 font-medium italic">
                    Last updated: Never
                </p>
                <div class="flex gap-4 w-full sm:w-auto">
                    <button type="button" class="flex-1 sm:flex-none px-8 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-400 transition-all">
                        Reset
                    </button>
                    <button type="submit" class="flex-1 sm:flex-none px-10 py-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold shadow-lg hover:shadow-xl hover:from-slate-800 hover:to-slate-700 transform hover:-translate-y-0.5 transition-all">
                        Save Preferences
                    </button>
                </div>
            </div>
        </form>
    </div>
</div>
@endsection
