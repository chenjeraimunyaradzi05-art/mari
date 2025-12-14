@extends('frontend.layouts.master')

@section('title', __('Member Dashboard'))

@push('styles')
    <x-blade-bundle name="member-dashboard" />
    <style>
        .dashboard-gradient-text {
            background: linear-gradient(135deg, #ec4899 0%, #be185d 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .dashboard-card-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        /* 3D Icon Animations */
        .perspective-container {
            perspective: 1000px;
        }
        .icon-3d-wrapper {
            transform-style: preserve-3d;
            transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .group:hover .icon-3d-wrapper {
            transform: rotateY(180deg) scale(1.1);
        }
        .icon-3d-inner {
            backface-visibility: hidden;
        }
        .icon-3d-back {
            transform: rotateY(180deg);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: inherit;
            background: inherit;
        }
        /* Floating Animation */
        @keyframes float-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
        }
        .animate-float {
            animation: float-slow 4s ease-in-out infinite;
        }
    </style>
@endpush

@section('contents')
    <div class="min-h-screen bg-rose-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Header -->
            <header class="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <p class="text-sm font-bold text-pink-800 uppercase tracking-wider mb-1">{{ __('Dream pathways') }}</p>
                    <h1 class="text-4xl font-extrabold text-rose-950 tracking-tight">{{ __('Member dashboard') }}</h1>
                    <p class="mt-2 text-rose-900 font-medium">{{ __('Welcome back to your personal growth hub.') }}</p>
                </div>
                <a class="group inline-flex items-center px-6 py-3 border-2 border-rose-200 text-sm font-bold rounded-full shadow-md text-rose-900 bg-white hover:bg-rose-50 hover:border-rose-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all duration-200 transform hover:scale-105" href="{{ $wishlistUrl }}">
                    <span>{{ __('Open Dream Pathways workspace') }}</span>
                    <svg class="ml-2 -mr-1 h-5 w-5 text-rose-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </a>
            </header>

            @php
                $adPlacements = $adPlacements ?? [];
            @endphp

            <!-- Welcome Section -->
            @if (!empty($welcome))
                @php
                    $focus = $welcome['focus'] ?? [];
                    $cta = $focus['cta'] ?? null;
                @endphp

                <section class="relative bg-rose-50 rounded-3xl shadow-xl shadow-pink-200/50 border border-pink-100 overflow-hidden mb-10 transition-all duration-300 hover:shadow-2xl hover:shadow-pink-300/50" aria-labelledby="dashboard-welcome-heading">
                    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500"></div>
                    <div class="p-8 flex flex-col md:flex-row gap-10">
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="relative flex h-3 w-3">
                                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <p class="text-sm font-bold text-pink-800 uppercase tracking-wide">
                                    {{ $welcome['is_first_login'] ? __('Welcome aboard') : __('Personalised check-in') }}
                                </p>
                            </div>
                            <h2 class="text-3xl font-bold text-rose-950 mb-6" id="dashboard-welcome-heading">
                                {{ preg_replace('/\s*\(.*?\)/', '', $welcome['greeting']) }}
                            </h2>

                            <!-- User Photo Slider (Resized) -->
                            <div class="relative w-full aspect-[3/4] rounded-[2rem] overflow-hidden border-4 border-white shadow-xl ring-1 ring-pink-100 mt-6" id="dashboard-user-slider">
                                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80" class="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 opacity-100" alt="User photo">
                                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80" class="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 opacity-0" alt="User photo">
                                <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80" class="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 opacity-0" alt="User photo">

                                <!-- Overlay Gradient for text readability if needed, or just aesthetic -->
                                <div class="absolute inset-0 bg-gradient-to-t from-rose-900/20 to-transparent pointer-events-none z-10"></div>
                            </div>
                        </div>                        <div class="md:w-1/3 bg-gradient-to-br from-pink-100 to-rose-50 rounded-2xl p-6 border border-pink-200 shadow-inner">
                            <p class="text-xs font-bold text-pink-700 uppercase tracking-wider mb-3">{{ __('Focus area spotlight') }}</p>
                            <h3 class="text-xl font-bold text-rose-950 mb-2">{{ $focus['label'] ?? __('Athena focus') }}</h3>
                            @if (! empty($focus['summary']))
                                <p class="text-sm text-rose-800 mb-6">{{ $focus['summary'] }}</p>
                            @endif

                            <div class="flex items-center justify-between mt-auto pt-4 border-t border-pink-200">
                                @if (! empty($focus['stat']))
                                    <span class="text-3xl font-extrabold text-pink-700">{{ $focus['stat'] }}</span>
                                @endif

                                @if (! empty($cta))
                                    <a class="inline-flex items-center px-4 py-2 border border-transparent text-xs font-bold rounded-lg text-pink-800 bg-pink-200 hover:bg-pink-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors" href="{{ $cta['url'] }}">
                                        {{ $cta['label'] }}
                                    </a>
                                @endif
                            </div>
                        </div>
                    </div>
                </section>
            @endif

            <!-- Impact Stats & Quick Actions Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <!-- Impact Stats -->
                <div class="lg:col-span-2">
                    <h3 class="text-xl font-bold text-rose-950 mb-6 flex items-center gap-2">
                        <div class="p-2 bg-pink-100 rounded-lg">
                            <svg class="w-5 h-5 text-pink-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        {{ __('Your Impact') }}
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        <!-- Milestones -->
                        <div class="group perspective-container">
                            <div class="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-rose-100 hover:shadow-xl hover:border-pink-300 transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                <div class="icon-3d-wrapper w-12 h-12 mb-3 relative">
                                    <div class="icon-3d-inner w-full h-full bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div class="icon-3d-back bg-rose-500 rounded-xl text-white">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                </div>
                                <p class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">{{ __('Milestones') }}</p>
                                <p class="text-3xl font-extrabold text-rose-950 group-hover:scale-110 transition-transform duration-300">{{ number_format($impactStats['milestones_completed']) }}</p>
                            </div>
                        </div>

                        <!-- Active Pathways -->
                        <div class="group perspective-container">
                            <div class="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-rose-100 hover:shadow-xl hover:border-pink-300 transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-400 to-pink-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                <div class="icon-3d-wrapper w-12 h-12 mb-3 relative">
                                    <div class="icon-3d-inner w-full h-full bg-fuchsia-50 rounded-xl flex items-center justify-center text-fuchsia-500">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    </div>
                                    <div class="icon-3d-back bg-fuchsia-500 rounded-xl text-white">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    </div>
                                </div>
                                <p class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">{{ __('Active Pathways') }}</p>
                                <p class="text-3xl font-extrabold text-rose-950 group-hover:scale-110 transition-transform duration-300">{{ number_format($impactStats['pathways_active']) }}</p>
                            </div>
                        </div>

                        <!-- Grants Submitted -->
                        <div class="group perspective-container">
                            <div class="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-rose-100 hover:shadow-xl hover:border-pink-300 transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                <div class="icon-3d-wrapper w-12 h-12 mb-3 relative">
                                    <div class="icon-3d-inner w-full h-full bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div class="icon-3d-back bg-emerald-500 rounded-xl text-white">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                </div>
                                <p class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">{{ __('Grants Submitted') }}</p>
                                <p class="text-3xl font-extrabold text-rose-950 group-hover:scale-110 transition-transform duration-300">{{ number_format($impactStats['grants_submitted']) }}</p>
                            </div>
                        </div>

                        <!-- Impact Score -->
                        <div class="group perspective-container">
                            <div class="bg-gradient-to-br from-rose-100 to-pink-50 p-6 rounded-2xl shadow-sm border border-rose-200 hover:shadow-xl hover:border-pink-400 transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div class="absolute -top-10 -right-10 w-24 h-24 bg-white/30 rounded-full blur-xl animate-pulse"></div>
                                <div class="icon-3d-wrapper w-12 h-12 mb-3 relative animate-float">
                                    <div class="icon-3d-inner w-full h-full bg-white rounded-full flex items-center justify-center text-pink-600 shadow-md">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <div class="icon-3d-back bg-pink-600 rounded-full text-white shadow-md">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                </div>
                                <p class="text-xs font-bold text-pink-700 uppercase tracking-wider mb-1">{{ __('Impact Score') }}</p>
                                <p class="text-3xl font-extrabold text-pink-800 group-hover:scale-110 transition-transform duration-300">{{ number_format($impactStats['impact_score']) }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div>
                    <h3 class="text-xl font-bold text-rose-950 mb-6 flex items-center gap-2">
                        <div class="p-2 bg-pink-100 rounded-lg">
                            <svg class="w-5 h-5 text-pink-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        {{ __('Quick Actions') }}
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        @foreach($quickActions as $action)
                            <a href="{{ $action['url'] }}" class="group perspective-container block h-full">
                                <div class="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 hover:border-pink-300 hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center h-full relative overflow-hidden">
                                    <div class="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                    <div class="icon-3d-wrapper w-12 h-12 mb-3 relative z-10">
                                        <div class="icon-3d-inner w-full h-full bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm group-hover:bg-white">
                                            <!-- Heroicons (simplified) -->
                                            @if($action['icon'] === 'user-circle')
                                                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            @elseif($action['icon'] === 'currency-dollar')
                                                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            @elseif($action['icon'] === 'map')
                                                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                            @elseif($action['icon'] === 'heart')
                                                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                            @endif
                                        </div>
                                        <div class="icon-3d-back bg-rose-500 rounded-2xl text-white shadow-sm">
                                            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold text-rose-900 group-hover:text-pink-700 transition-colors z-10">{{ $action['label'] }}</span>
                                </div>
                            </a>
                        @endforeach
                    </div>
                </div>
            </div>

            <!-- Opportunity Radar -->
            @if(isset($radarEntries) && $radarEntries->isNotEmpty())
                <section class="mb-12">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <p class="text-sm font-bold text-pink-700 uppercase tracking-wide mb-1">{{ __('AI Intelligence') }}</p>
                            <h2 class="text-2xl font-bold text-rose-950">{{ __('Opportunity Radar') }}</h2>
                            <p class="text-rose-700 mt-1">{{ __('Top matches based on your profile and urgency.') }}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        @foreach($radarEntries as $entry)
                            <article class="dashboard-card-hover bg-rose-50 rounded-2xl shadow-sm border border-rose-200 overflow-hidden flex flex-col h-full transition-all duration-300">
                                <div class="p-6 flex-grow">
                                    <div class="flex justify-between items-start mb-4">
                                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-800 border border-pink-200">
                                            {{ $entry->score }}% Match
                                        </span>
                                        @if($entry->urgency_level > 50)
                                            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                                                Urgent
                                            </span>
                                        @endif
                                    </div>
                                    <h3 class="text-xl font-bold text-rose-950 mb-2 leading-tight">{{ $entry->title }}</h3>
                                    <p class="text-sm font-medium text-rose-700 mb-4">{{ $entry->subtitle }}</p>
                                    <p class="text-sm text-rose-800 mb-6 line-clamp-3 leading-relaxed">{{ $entry->summary }}</p>

                                    @if($entry->fit_reasons)
                                        <div class="bg-rose-100 rounded-xl p-4 border border-rose-200">
                                            <p class="text-xs font-bold text-rose-500 uppercase tracking-wider mb-3">Why it fits:</p>
                                            <ul class="space-y-2">
                                                @foreach(array_slice($entry->fit_reasons, 0, 2) as $reason)
                                                    <li class="flex items-start text-xs text-rose-800 font-medium">
                                                        <svg class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                                        {{ $reason }}
                                                    </li>
                                                @endforeach
                                            </ul>
                                        </div>
                                    @endif
                                </div>
                                <div class="px-6 py-4 bg-rose-100 border-t border-rose-200">
                                    <a href="{{ $entry->action_url }}" class="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-pink-700 hover:bg-pink-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors shadow-md shadow-pink-300">
                                        View Opportunity
                                    </a>
                                </div>
                            </article>
                        @endforeach
                    </div>
                </section>
            @endif

            <!-- Active Pathways -->
            @if(isset($activePathways) && $activePathways->isNotEmpty())
                <section class="mb-12">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <p class="text-sm font-bold text-pink-700 uppercase tracking-wide mb-1">{{ __('My Journey') }}</p>
                            <h2 class="text-2xl font-bold text-rose-950">{{ __('Active Pathways') }}</h2>
                            <p class="text-rose-700 mt-1">{{ __('Track your progress towards your life goals.') }}</p>
                        </div>
                        <a class="text-sm font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1 transition-colors" href="{{ route('member.pathways.index') }}">
                            {{ __('View all pathways') }} <span aria-hidden="true">&rarr;</span>
                        </a>
                    </div>

                    <div class="grid grid-cols-1 gap-6">
                        @foreach($activePathways as $item)
                            <article class="bg-rose-50 rounded-2xl shadow-sm border border-rose-200 overflow-hidden hover:shadow-md transition-shadow">
                                <div class="p-8">
                                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                        <div>
                                            <h3 class="text-2xl font-bold text-rose-950 mb-2">{{ $item['pathway']->goal_title }}</h3>
                                            <p class="text-rose-700">{{ $item['pathway']->goal_description }}</p>
                                        </div>
                                        <span class="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 self-start md:self-center">
                                            {{ ucfirst($item['pathway']->status) }}
                                        </span>
                                    </div>

                                    <div class="mb-8">
                                        <div class="flex justify-between text-sm font-bold text-rose-800 mb-2">
                                            <span>Progress</span>
                                            <span>{{ $item['progress_percentage'] }}%</span>
                                        </div>
                                        <div class="w-full bg-rose-200 rounded-full h-3 overflow-hidden">
                                            <div class="bg-gradient-to-r from-fuchsia-500 to-pink-600 h-3 rounded-full transition-all duration-1000 ease-out shadow-sm" style="width: {{ $item['progress_percentage'] }}%"></div>
                                        </div>
                                    </div>

                                    @if($item['next_actions']->isNotEmpty())
                                        <div class="bg-rose-100 rounded-xl p-6 border border-rose-200">
                                            <p class="text-xs font-bold text-rose-500 uppercase tracking-wider mb-4">Next Actions</p>
                                            <ul class="space-y-4">
                                                @foreach($item['next_actions']->take(3) as $action)
                                                    <li class="flex items-start group">
                                                        <div class="flex-shrink-0 h-6 w-6 rounded-full border-2 border-rose-300 flex items-center justify-center mr-4 mt-0.5 group-hover:border-pink-600 transition-colors">
                                                            <span class="h-3 w-3 rounded-full bg-transparent group-hover:bg-pink-600 transition-colors"></span>
                                                        </div>
                                                        <span class="text-sm font-medium text-rose-800 group-hover:text-rose-950 transition-colors">{{ $action->title }}</span>
                                                    </li>
                                                @endforeach
                                            </ul>
                                        </div>
                                    @endif
                                </div>
                                <div class="px-8 py-5 bg-rose-100 border-t border-rose-200 flex justify-end">
                                    <a href="{{ route('member.pathways.show', $item['pathway']) }}" class="text-sm font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1 transition-colors">Continue Journey <span aria-hidden="true">&rarr;</span></a>
                                </div>
                            </article>
                        @endforeach
                    </div>
                </section>
            @endif

            <!-- Two Column Layout for Grants & Waitlists -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <!-- Grant Tracker -->
                <section class="flex flex-col h-full">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <p class="text-sm font-bold text-pink-700 uppercase tracking-wide mb-1">{{ __('Grant tracker') }}</p>
                            <h2 class="text-2xl font-bold text-rose-950">{{ __('Workspaces') }}</h2>
                        </div>
                        <a class="text-sm font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1 transition-colors" href="{{ $grantsUrl }}">{{ __('View all') }} <span aria-hidden="true">&rarr;</span></a>
                    </div>

                    @if (empty($grantCards))
                        <div class="bg-white/60 backdrop-blur-sm rounded-3xl shadow-sm border border-rose-100 p-10 text-center flex-grow flex flex-col items-center justify-center relative overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-b from-transparent to-rose-50/50"></div>

                            <div class="perspective-container mb-6 relative z-10">
                                <div class="icon-3d-wrapper w-20 h-20 animate-float">
                                    <div class="icon-3d-inner w-full h-full bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shadow-md border border-rose-200">
                                        <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div class="icon-3d-back bg-rose-500 rounded-2xl text-white shadow-md flex items-center justify-center">
                                        <span class="text-2xl font-bold">+</span>
                                    </div>
                                </div>
                            </div>

                            <h3 class="text-xl font-bold text-rose-950 mb-3 relative z-10">{{ __('No grant applications yet') }}</h3>
                            <p class="text-rose-700 mb-8 max-w-xs mx-auto relative z-10">{{ __('Use the Grants & Rebates finder to launch your first Athena workspace and keep documents organised.') }}</p>
                            <a class="relative z-10 inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-300/50 transition-all transform hover:-translate-y-1" href="{{ $grantsUrl }}">
                                {{ __('Browse grants') }}
                            </a>
                        </div>
                    @else
                        <div class="space-y-5">
                            @foreach ($grantCards as $card)
                                @php
                                    $status = $card['status'] ?? 'draft';
                                    $statusClasses = match ($status) {
                                        'submitted' => 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                        'draft' => 'bg-rose-100 text-rose-800 border-rose-200',
                                        default => 'bg-rose-100 text-rose-800 border-rose-200',
                                    };
                                @endphp
                                <article class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-rose-100 p-6 hover:shadow-md transition-all duration-200 hover:-translate-y-1 group">
                                    <div class="flex justify-between items-start mb-3">
                                        <span class="text-xs font-bold text-rose-500 uppercase tracking-wider">{{ $card['provider'] ?? __('Grant program') }}</span>
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border {{ $statusClasses }}">
                                            {{ ucfirst($status) }}
                                        </span>
                                    </div>
                                    <h3 class="text-lg font-bold text-rose-950 mb-3 group-hover:text-pink-700 transition-colors">{{ $card['program_name'] }}</h3>
                                    <div class="flex items-center text-sm text-rose-700 mb-5">
                                        <span class="mr-6 flex items-center gap-1.5">
                                            <svg class="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Docs: {{ number_format($card['documents']) }}
                                        </span>
                                        <span class="flex items-center gap-1.5">
                                            <svg class="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Deadline: {{ $card['closes_at'] ? $card['closes_at']->format('M d') : 'TBA' }}
                                        </span>
                                    </div>
                                    <a href="{{ $card['apply_url'] }}" class="text-sm font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1 transition-colors">Open workspace <span aria-hidden="true">&rarr;</span></a>
                                </article>
                            @endforeach
                        </div>
                    @endif
                </section>

                <!-- Waitlists -->
                <section class="flex flex-col h-full">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <p class="text-sm font-bold text-pink-700 uppercase tracking-wide mb-1">{{ __('Waitlists') }}</p>
                            <h2 class="text-2xl font-bold text-rose-950">{{ __('Opportunities') }}</h2>
                        </div>
                        <a class="text-sm font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1 transition-colors" href="{{ $wishlistUrl }}">{{ __('Manage') }} <span aria-hidden="true">&rarr;</span></a>
                    </div>

                    @if (empty($highlightCards))
                        <div class="bg-white/60 backdrop-blur-sm rounded-3xl shadow-sm border border-rose-100 p-10 text-center flex-grow flex flex-col items-center justify-center relative overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-b from-transparent to-fuchsia-50/50"></div>

                            <div class="perspective-container mb-6 relative z-10">
                                <div class="icon-3d-wrapper w-20 h-20 animate-float" style="animation-delay: 1s;">
                                    <div class="icon-3d-inner w-full h-full bg-fuchsia-100 rounded-full flex items-center justify-center text-fuchsia-500 shadow-md border border-fuchsia-200">
                                        <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    </div>
                                    <div class="icon-3d-back bg-fuchsia-500 rounded-full text-white shadow-md flex items-center justify-center">
                                        <span class="text-2xl font-bold">★</span>
                                    </div>
                                </div>
                            </div>

                            <h3 class="text-xl font-bold text-rose-950 mb-3 relative z-10">{{ __('Your waitlist is calm') }}</h3>
                            <p class="text-rose-700 mb-8 max-w-xs mx-auto relative z-10">{{ __('Add pathways for jobs, trades, or study and we will summarise them here.') }}</p>
                            <a class="relative z-10 inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white bg-fuchsia-600 hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-300/50 transition-all transform hover:-translate-y-1" href="{{ $wishlistUrl }}">
                                {{ __('Capture a new dream') }}
                            </a>
                        </div>
                    @else
                        <div class="space-y-5">
                            @foreach ($highlightCards as $card)
                                <article class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-rose-100 p-6 hover:shadow-md transition-all duration-200 hover:-translate-y-1 group">
                                    <div class="flex justify-between items-start mb-3">
                                        <span class="text-xs font-bold text-rose-500 uppercase tracking-wider">{{ $card['type_label'] }}</span>
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            {{ ucfirst($card['status']) }}
                                        </span>
                                    </div>
                                    <h3 class="text-lg font-bold text-rose-950 mb-2 group-hover:text-pink-700 transition-colors">{{ $card['title'] }}</h3>
                                    <p class="text-sm text-rose-700 mb-4">{{ $card['summary'] }}</p>
                                    <div class="flex items-center justify-between text-sm text-rose-600 pt-4 border-t border-rose-100">
                                        <span class="flex items-center gap-1.5">
                                            <svg class="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            {{ $card['location'] }}
                                        </span>
                                        <span class="font-medium text-pink-700">{{ number_format($card['match_count']) }} matches</span>
                                    </div>
                                </article>
                            @endforeach
                        </div>
                    @endif
                </section>
            </div>

            <!-- Charter Section -->
            <section class="bg-rose-50 rounded-3xl shadow-xl border border-rose-200 overflow-hidden mb-12 relative">
                <div class="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-pink-100 rounded-full blur-3xl opacity-50"></div>
                <div class="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-fuchsia-100 rounded-full blur-3xl opacity-50"></div>

                <div class="relative p-10 md:p-16">
                    <div class="max-w-3xl mx-auto text-center mb-16">
                        <h2 class="text-3xl md:text-4xl font-extrabold text-rose-950 mb-6 tracking-tight">{{ __('How Athena shows up for members') }}</h2>
                        <p class="text-rose-700 text-lg md:text-xl max-w-2xl mx-auto">{{ __('Grounding principles straight from the community charter.') }}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
                        @foreach ($charterHighlights as $item)
                            <article class="text-center group">
                                <div class="h-16 w-16 mx-auto bg-rose-100 rounded-2xl flex items-center justify-center mb-6 text-pink-600 font-bold text-xl border border-rose-200 group-hover:border-pink-400 group-hover:bg-rose-200 transition-all duration-300 shadow-sm">
                                    {{ $loop->iteration }}
                                </div>
                                <h3 class="text-xl font-bold mb-3 text-rose-950 group-hover:text-pink-700 transition-colors">{{ $item['title'] }}</h3>
                                <p class="text-rose-700 text-sm leading-relaxed">{{ $item['copy'] }}</p>
                            </article>
                        @endforeach
                    </div>
                </div>
            </section>

            <!-- Viral Loops -->
            @feature('growth.viral_loops')
            <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-white to-pink-50 border border-pink-200 shadow-lg p-8 md:p-10">
                <!-- Decorative background elements -->
                <div class="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
                <div class="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-gradient-to-tr from-fuchsia-400 to-purple-400 rounded-full blur-3xl opacity-10 pointer-events-none"></div>

                <div class="relative flex flex-col md:flex-row items-center justify-between gap-10">
                    <!-- Text Content -->
                    <div class="flex-1 text-center md:text-left">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 border border-pink-200 text-pink-700 text-xs font-bold uppercase tracking-wider mb-4">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                            {{ __('Referral Rewards') }}
                        </div>
                        <h2 class="text-3xl font-extrabold text-rose-950 mb-3">{{ __('Pass it on.') }}</h2>
                        <p class="text-lg text-rose-700 mb-8 max-w-xl">{{ __('Know someone who needs clarity? Gift them an Athena invite and unlock exclusive community badges for yourself.') }}</p>

                        <div class="flex flex-wrap justify-center md:justify-start gap-3">
                            <a href="mailto:?subject=Join me on Athena&body=I've been using Athena to plan my future. Check it out: {{ $referralLink }}" class="inline-flex items-center px-5 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm text-sm font-bold group">
                                <svg class="w-5 h-5 mr-2 text-rose-400 group-hover:text-rose-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                {{ __('Send via Email') }}
                            </a>
                            <a href="https://wa.me/?text=Check%20out%20Athena:%20{{ urlencode($referralLink) }}" target="_blank" class="inline-flex items-center px-5 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm text-sm font-bold group">
                                <svg class="w-5 h-5 mr-2 text-emerald-500 group-hover:text-emerald-600 transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                {{ __('WhatsApp') }}
                            </a>
                        </div>
                    </div>

                    <!-- The "Ticket" -->
                    <div class="w-full md:w-auto">
                        <div class="bg-white p-1.5 rounded-2xl border-2 border-dashed border-pink-200 shadow-sm transform rotate-1 hover:rotate-0 transition-transform duration-300">
                            <div class="bg-rose-50 rounded-xl p-6 md:p-8 border border-rose-100 text-center min-w-[280px]">
                                <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">🎁</div>
                                <p class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4">{{ __('Your Unique Invite Link') }}</p>

                                <div class="relative group cursor-pointer" onclick="navigator.clipboard.writeText('{{ $referralLink }}'); document.getElementById('copy-feedback').classList.remove('hidden'); setTimeout(() => document.getElementById('copy-feedback').classList.add('hidden'), 2000);">
                                    <div class="bg-white p-3 rounded-xl border border-pink-200 shadow-inner flex items-center justify-center gap-2 hover:border-pink-400 transition-colors">
                                        <code class="text-sm font-mono text-pink-600 font-bold truncate max-w-[200px]">{{ $referralLink }}</code>
                                        <svg class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div id="copy-feedback" class="hidden absolute -top-8 left-1/2 transform -translate-x-1/2 bg-rose-950 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                                        {{ __('Copied!') }}
                                    </div>
                                </div>

                                <p class="text-xs text-rose-400 mt-4">{{ __('Valid for unlimited invites') }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            @endfeature
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const sliderContainer = document.getElementById('dashboard-user-slider');
            if (!sliderContainer) return;

            const images = sliderContainer.querySelectorAll('img');
            if (images.length === 0) return;

            let currentIndex = 0;

            setInterval(() => {
                // Fade out current
                images[currentIndex].classList.remove('opacity-100');
                images[currentIndex].classList.add('opacity-0');

                // Move to next
                currentIndex = (currentIndex + 1) % images.length;

                // Fade in next
                images[currentIndex].classList.remove('opacity-0');
                images[currentIndex].classList.add('opacity-100');
            }, 10000);
        });
    </script>
@endpush
