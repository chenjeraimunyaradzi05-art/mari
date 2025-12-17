@extends('frontend.social.layout')

@section('social-content')
<div class="space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-orange-600 to-pink-600 rounded-xl p-8 text-white shadow-lg">
        <div class="flex items-center gap-4">
            <img src="{{ asset('default-uploads/logo.png') }}" alt="Logo" class="h-12 opacity-90">
            <div>
                <h1 class="text-3xl font-bold">Notifications</h1>
                <p class="text-orange-100 mt-1">Stay updated with AI-prioritized alerts</p>
            </div>
        </div>
    </div>

    <!-- Filter Tabs -->
    <div class="flex gap-2 overflow-x-auto pb-2">
        <button class="px-4 py-2 bg-orange-600 text-white rounded-full font-semibold whitespace-nowrap hover:bg-orange-700 transition">All</button>
        <button class="px-4 py-2 bg-white border-2 border-gray-200 rounded-full whitespace-nowrap hover:border-orange-300 transition">Connections</button>
        <button class="px-4 py-2 bg-white border-2 border-gray-200 rounded-full whitespace-nowrap hover:border-pink-300 transition">Messages</button>
        <button class="px-4 py-2 bg-white border-2 border-gray-200 rounded-full whitespace-nowrap hover:border-red-300 transition">Interactions</button>
    </div>

    <!-- Notifications List -->
    <div class="bg-white rounded-lg shadow-md overflow-hidden divide-y">
        <!-- Notification 1 -->
        <div class="p-4 hover:bg-blue-50 transition cursor-pointer border-l-4 border-blue-500">
            <div class="flex items-start gap-4">
                <img src="{{ asset('images/default-avatar.png') }}" alt="" class="w-12 h-12 rounded-full">
                <div class="flex-1">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="font-semibold text-gray-900">Sarah Johnson accepted your connection</h4>
                            <p class="text-sm text-gray-600 mt-1">Great! You now have 245 connections</p>
                        </div>
                        <span class="text-xs text-gray-500">2h ago</span>
                    </div>
                    <div class="mt-2 flex gap-2">
                        <button class="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition font-semibold">View Profile</button>
                        <button class="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">Dismiss</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Notification 2 -->
        <div class="p-4 hover:bg-purple-50 transition cursor-pointer border-l-4 border-purple-500">
            <div class="flex items-start gap-4">
                <img src="{{ asset('images/default-avatar.png') }}" alt="" class="w-12 h-12 rounded-full">
                <div class="flex-1">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="font-semibold text-gray-900">New message from Alex Chen</h4>
                            <p class="text-sm text-gray-600 mt-1">"Hey! Interested in collaborating on a project?"</p>
                        </div>
                        <span class="text-xs text-gray-500">1h ago</span>
                    </div>
                    <div class="mt-2 flex gap-2">
                        <button class="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition font-semibold">Reply</button>
                        <button class="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">Dismiss</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Notification 3 -->
        <div class="p-4 hover:bg-red-50 transition cursor-pointer border-l-4 border-red-500">
            <div class="flex items-start gap-4">
                <i class="fas fa-heart text-red-500 text-2xl mt-2"></i>
                <div class="flex-1">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="font-semibold text-gray-900">Your post got 50+ likes! 🎉</h4>
                            <p class="text-sm text-gray-600 mt-1">Keep creating great content to boost your engagement</p>
                        </div>
                        <span class="text-xs text-gray-500">3h ago</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Notification 4 - AI Alert -->
        <div class="p-4 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer border-l-4 border-indigo-500">
            <div class="flex items-start gap-4">
                <i class="fas fa-sparkles text-indigo-600 text-2xl mt-2"></i>
                <div class="flex-1">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="font-semibold text-gray-900">AI: Job Match Opportunity! 🎯</h4>
                            <p class="text-sm text-gray-600 mt-1">Found a job that's 89% match with your profile</p>
                        </div>
                        <span class="text-xs text-gray-500">5h ago</span>
                    </div>
                    <div class="mt-2 flex gap-2">
                        <button class="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-semibold">View Job</button>
                        <button class="text-sm px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-100 transition">Dismiss</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Smart Digest -->
    <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
        <h3 class="font-bold text-indigo-900 text-lg mb-3">
            <i class="fas fa-bell mr-2"></i>Weekly Digest Summary
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
                <p class="text-3xl font-bold text-indigo-600">15</p>
                <p class="text-sm text-indigo-800">New Connections</p>
            </div>
            <div>
                <p class="text-3xl font-bold text-purple-600">23</p>
                <p class="text-sm text-purple-800">Messages</p>
            </div>
            <div>
                <p class="text-3xl font-bold text-pink-600">142</p>
                <p class="text-sm text-pink-800">Interactions</p>
            </div>
            <div>
                <p class="text-3xl font-bold text-orange-600">8</p>
                <p class="text-sm text-orange-800">Group Updates</p>
            </div>
        </div>
    </div>
</div>
@endsection
