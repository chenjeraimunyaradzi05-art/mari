@extends('layouts.app')

@section('title', 'My Personal Dashboard')

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
</style>
@endpush

@section('content')
<div class="min-h-screen bg-gradient-to-br from-teal-50 via-white to-rose-50 font-sans pb-20">
    <!-- Hero Section -->
    <div class="relative pt-6 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div class="absolute top-0 right-0 w-96 h-96 bg-rose-100 rounded-full blur-3xl opacity-30 -mr-20 -mt-20"></div>
            <div class="absolute bottom-0 left-0 w-96 h-96 bg-teal-100 rounded-full blur-3xl opacity-30 -ml-20 -mb-20"></div>
        </div>

        <div class="max-w-7xl mx-auto relative z-10">
            <div class="flex flex-col md:flex-row items-center justify-between gap-8">
                <div class="text-center md:text-left">
                    <h1 class="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">
                        Good morning, <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-rose-600">{{ $user->name }}</span>.
                    </h1>
                </div>

                <div class="relative group">
                    <div class="absolute -inset-1 bg-gradient-to-r from-teal-400 to-rose-400 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div class="relative w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-white shadow-xl">
                        <img src="{{ $user->avatar_url }}" alt="{{ $user->name }}" class="w-full h-full rounded-full object-cover">
                        <a href="{{ route('member.profile.edit') }}" class="absolute bottom-2 right-2 bg-slate-900 text-white p-2.5 rounded-full shadow-lg hover:bg-slate-800 transition-transform hover:scale-110">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

            <!-- Left Sidebar -->
            <div class="lg:col-span-4 space-y-6">
                <!-- Quick Actions -->
                <div class="glass-card rounded-3xl p-6">
                    <div class="space-y-3">
                        <a href="{{ route('social.feed.index') }}" class="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-teal-100/50 border border-teal-100 hover:shadow-md transition-all group">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-white rounded-xl text-teal-600 shadow-sm group-hover:scale-110 transition-transform">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                                <span class="font-bold text-teal-900">Social Feed</span>
                            </div>
                            <svg class="w-5 h-5 text-teal-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </a>

                        <button onclick="copyProfileLink()" class="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all group">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-slate-50 rounded-xl text-slate-600 group-hover:text-rose-600 transition-colors">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                </div>
                                <span class="font-semibold text-slate-700">Share Profile</span>
                            </div>
                        </button>
                    </div>
                </div>

                <!-- Personal Details -->
                <div class="glass-card rounded-3xl p-8">
                    <h3 class="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <span class="text-xl">👤</span> Personal Details
                    </h3>
                    <div class="space-y-4">
                        @foreach([
                            'Location' => $profile->location,
                            'Education' => $profile->education_level,
                            'Marital Status' => $profile->marital_status,
                            'Children' => $profile->children_details,
                            'Religion' => $profile->religion
                        ] as $label => $value)
                        <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                            <span class="text-sm text-slate-500 font-medium">{{ $label }}</span>
                            <span class="text-sm font-semibold text-slate-800 text-right">{{ $value ?? '—' }}</span>
                        </div>
                        @endforeach
                    </div>
                </div>

                <!-- Resume Card -->
                <div class="glass-card rounded-3xl p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-24 h-24 bg-rose-100 rounded-full blur-2xl -mr-8 -mt-8 opacity-50 group-hover:opacity-80 transition-opacity"></div>
                    <h3 class="text-lg font-bold text-slate-900 mb-4 relative z-10">Professional Resume</h3>

                    @if($profile->resume_path)
                        <div class="flex items-center gap-4 p-4 bg-white/60 rounded-2xl border border-white/50 mb-4">
                            <div class="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-slate-900 truncate">Current Resume</p>
                                <p class="text-xs text-slate-500">PDF Document</p>
                            </div>
                        </div>
                        <a href="{{ Storage::url($profile->resume_path) }}" target="_blank" class="block w-full py-3 text-center bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg">
                            View Document
                        </a>
                    @else
                        <div class="text-center py-8">
                            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            </div>
                            <p class="text-slate-500 text-sm mb-4">Upload your resume to get discovered</p>
                            <a href="{{ route('member.profile.edit') }}" class="inline-block px-6 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:border-rose-300 hover:text-rose-600 transition-colors">
                                Upload Now
                            </a>
                        </div>
                    @endif
                </div>
            </div>

            <!-- Main Content -->
            <div class="lg:col-span-8 space-y-8">

                <!-- Aspirations Banner -->
                <div class="relative rounded-3xl overflow-hidden shadow-2xl">
                    <div class="absolute inset-0 bg-gradient-to-r from-rose-600 to-teal-600"></div>
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div class="relative p-8 md:p-10 text-white">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                            <div>
                                <p class="text-rose-100 font-bold tracking-wider uppercase text-xs mb-2">My North Star</p>
                                <h2 class="text-3xl font-bold mb-4">{{ $profile->dream_job ?? 'Future Leader' }}</h2>
                                <div class="flex flex-wrap gap-3">
                                    @if($profile->dream_company)
                                    <span class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-sm font-medium border border-white/30">
                                        @ {{ $profile->dream_company }}
                                    </span>
                                    @endif
                                    @if($profile->dream_qualification)
                                    <span class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-sm font-medium border border-white/30">
                                        🎓 {{ $profile->dream_qualification }}
                                    </span>
                                    @endif
                                </div>
                            </div>
                            @if($profile->life_inspiration)
                            <div class="md:max-w-xs text-right">
                                <p class="text-lg italic font-serif text-rose-50">"{{ $profile->life_inspiration }}"</p>
                            </div>
                            @endif
                        </div>
                    </div>
                </div>

                <!-- Interests Grid -->
                <div class="glass-card rounded-3xl p-8">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-xl font-bold text-slate-900">Passions & Interests</h3>
                        <a href="{{ route('member.profile.edit') }}" class="text-sm font-bold text-teal-600 hover:text-teal-700">Edit</a>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        @foreach([
                            '🎵 Favorite Music' => $profile->favorite_music,
                            '🎨 Hobbies' => $profile->hobbies,
                            '🏆 Sporting Teams' => $profile->sporting_teams,
                            '🌲 Outdoor Leisure' => $profile->outdoor_leisure
                        ] as $title => $data)
                        <div>
                            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{{ $title }}</h4>
                            @if($data)
                                <div class="flex flex-wrap gap-2">
                                    @foreach(explode(',', $data) as $item)
                                        <span class="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-100">{{ trim($item) }}</span>
                                    @endforeach
                                </div>
                            @else
                                <p class="text-sm text-slate-400 italic">Not added yet</p>
                            @endif
                        </div>
                        @endforeach
                    </div>
                </div>

                <!-- Media Gallery -->
                <div class="glass-card rounded-3xl p-8">
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h3 class="text-xl font-bold text-slate-900">My Gallery</h3>
                            <p class="text-sm text-slate-500 mt-1">Share your moments with the community</p>
                        </div>
                        <button onclick="document.getElementById('media-upload-modal').classList.remove('hidden')" class="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg">
                            Add Media
                        </button>
                    </div>

                    @if($media->count() > 0)
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            @foreach($media as $item)
                                <div class="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 cursor-pointer">
                                    @if($item->media_type === 'video')
                                        <video src="{{ Storage::url($item->file_path) }}" class="w-full h-full object-cover"></video>
                                        <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                            <div class="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
                                                <svg class="w-5 h-5 text-slate-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                            </div>
                                        </div>
                                    @else
                                        <img src="{{ Storage::url($item->file_path) }}" alt="{{ $item->caption }}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                                    @endif

                                    @if($item->caption)
                                        <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <p class="text-white text-xs font-medium truncate">{{ $item->caption }}</p>
                                        </div>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                            <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <p class="text-slate-500 font-medium">Your gallery is empty</p>
                            <p class="text-slate-400 text-sm">Upload photos or videos to showcase your journey</p>
                        </div>
                    @endif
                </div>

            </div>
        </div>
    </div>

</div>

<!-- Upload Modal -->
<div id="media-upload-modal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onclick="document.getElementById('media-upload-modal').classList.add('hidden')"></div>

    <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div class="relative transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 sm:mx-0 sm:h-10 sm:w-10">
                            <svg class="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                            <h3 class="text-lg font-bold leading-6 text-slate-900" id="modal-title">Upload Media</h3>
                            <div class="mt-4">
                                <form action="{{ route('member.media.upload') }}" method="POST" enctype="multipart/form-data" class="space-y-4">
                                    @csrf

                                    <div class="group relative border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-teal-500 transition-colors">
                                        <input type="file" name="file" accept="image/*,video/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required>
                                        <div class="space-y-2">
                                            <svg class="mx-auto h-10 w-10 text-slate-400 group-hover:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p class="text-sm text-slate-600 font-medium">Click to upload or drag and drop</p>
                                            <p class="text-xs text-slate-400">PNG, JPG, MP4 up to 50MB</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label class="block text-sm font-bold text-slate-700 mb-1">Caption</label>
                                        <input type="text" name="caption" class="w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500" placeholder="Write a caption...">
                                    </div>

                                    <div>
                                        <label class="block text-sm font-bold text-slate-700 mb-1">Privacy</label>
                                        <select name="privacy_level" class="w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                                            <option value="public">Public</option>
                                            <option value="friends">Friends Only</option>
                                            <option value="recruiters">Recruiters Only</option>
                                            <option value="private">Private</option>
                                        </select>
                                    </div>

                                    <div class="mt-6 flex justify-end gap-3">
                                        <button type="button" onclick="document.getElementById('media-upload-modal').classList.add('hidden')" class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50">Cancel</button>
                                        <button type="submit" class="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg">Upload</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    function copyProfileLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            // You could add a toast notification here
            alert('Profile link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }
</script>
@endpush
