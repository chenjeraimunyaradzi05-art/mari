@extends('frontend.social.layout')

@php
    $membersLabel = member_label('members');
@endphp

@section('social-content')
<div class="space-y-8">
    <div class="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-10 text-white shadow-xl">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm font-semibold uppercase tracking-wide">
                    <span>{{ $group->visibility === 'private' ? 'Private Group' : 'Public Group' }}</span>
                </div>
                <h1 class="mt-3 text-4xl font-extrabold">{{ $group->name }}</h1>
                <p class="mt-3 text-indigo-100 max-w-3xl">{{ $group->description ?? 'This group has not added a description yet.' }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                @if($group->created_by === auth()->id())
                    <a href="{{ route('member.social.groups.edit', $group) }}" class="px-5 py-3 rounded-lg bg-white/10 border border-white/30 font-semibold hover:bg-white/20 transition">Edit Group</a>
                @endif

                @if($isMember)
                    <button id="leave-group" type="button" class="px-5 py-3 rounded-lg bg-white text-purple-700 font-semibold shadow hover:shadow-lg transition">Leave Group</button>
                @else
                    <button id="join-group" type="button" class="px-5 py-3 rounded-lg bg-white text-purple-700 font-semibold shadow hover:shadow-lg transition">Join Group</button>
                @endif

                <a href="{{ route('member.social.groups') }}" class="px-5 py-3 rounded-lg bg-white/10 border border-white/30 font-semibold hover:bg-white/20 transition">Back to Groups</a>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
            <div class="bg-white rounded-2xl shadow-md p-6">
                <h2 class="text-xl font-semibold text-gray-900">About this Group</h2>
                <dl class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div class="flex items-center gap-3">
                        <div class="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                            <i class="fas fa-users"></i>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">{{ $membersLabel }}</dt>
                            <dd>{{ $group->members_count }}</dd>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="p-3 rounded-xl bg-pink-50 text-pink-600">
                            <i class="fas fa-bolt"></i>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Activity Score</dt>
                            <dd>{{ $group->activity_score }}%</dd>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="p-3 rounded-xl bg-purple-50 text-purple-600">
                            <i class="fas fa-user-shield"></i>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Created By</dt>
                            <dd>{{ optional($group->creator)->name ?? 'Unknown' }}</dd>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="p-3 rounded-xl bg-blue-50 text-blue-600">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Last Updated</dt>
                            <dd>{{ optional($group->updated_at)->diffForHumans() }}</dd>
                        </div>
                    </div>
                </dl>
            </div>

            <div class="bg-white rounded-2xl shadow-md p-6">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-semibold text-gray-900">Group Highlights</h2>
                    <span class="text-sm text-gray-500">Coming soon</span>
                </div>
                <p class="mt-3 text-gray-600">We are working on richer analytics and highlights for each group. Stay tuned for updates that showcase trending topics, engagement streaks, and curated member spotlights.</p>
            </div>
        </div>

        <div class="space-y-6">
            <div class="bg-white rounded-2xl shadow-md p-6">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-gray-900">{{ $membersLabel }}</h2>
                    <span class="text-sm text-gray-500">{{ $group->members_count }} total</span>
                </div>

                <div class="mt-4 space-y-4">
                    @forelse($group->members as $member)
                        <div class="flex items-center gap-3">
                            <img
                                src="{{ $member->user->avatar_url ?? $member->user->image ?? asset('images/default-avatar.png') }}"
                                alt="{{ $member->user->name }}"
                                class="h-10 w-10 rounded-full object-cover"
                            >
                            <div>
                                <p class="font-semibold text-gray-800">{{ $member->user->name }}</p>
                                <p class="text-sm text-gray-500 capitalize">{{ $member->role }}</p>
                            </div>
                        </div>
                    @empty
                        <p class="text-sm text-gray-500">No {{ strtolower($membersLabel) }} yet. Be the first to join!</p>
                    @endforelse
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-md p-6">
                <h2 class="text-lg font-semibold text-gray-900">Need more {{ strtolower($membersLabel) }}?</h2>
                <p class="mt-2 text-sm text-gray-600">Share your group with colleagues to kickstart the conversation.</p>
                <button id="share-group" type="button" class="mt-4 w-full px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow hover:shadow-lg transition">
                    Copy Invite Link
                </button>
                <p id="share-group-feedback" class="mt-2 text-xs text-gray-500 hidden">Link copied to clipboard!</p>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    const token = document.querySelector('meta[name="csrf-token"]').content;

    document.getElementById('join-group')?.addEventListener('click', async () => {
        const button = document.getElementById('join-group');
        button.setAttribute('disabled', 'disabled');
        try {
            const response = await fetch('{{ route('member.social.groups.join', $group) }}', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': token,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                window.location.reload();
                return;
            }

            const payload = await response.json();
            alert(payload.message ?? 'Unable to join this group right now.');
            button.removeAttribute('disabled');
        } catch (error) {
            console.error(error);
            alert('Something went wrong while trying to join the group.');
            button.removeAttribute('disabled');
        }
    });

    document.getElementById('leave-group')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to leave this group?')) {
            return;
        }

        const button = document.getElementById('leave-group');
        button.setAttribute('disabled', 'disabled');

        try {
            const response = await fetch('{{ route('member.social.groups.leave', $group) }}', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': token,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                window.location.href = '{{ route('member.social.groups') }}';
                return;
            }

            const payload = await response.json();
            alert(payload.message ?? 'Unable to leave this group right now.');
            button.removeAttribute('disabled');
        } catch (error) {
            console.error(error);
            alert('Something went wrong while trying to leave the group.');
            button.removeAttribute('disabled');
        }
    });

    document.getElementById('share-group')?.addEventListener('click', async () => {
        const link = '{{ route('member.social.groups.show', $group) }}';
        try {
            await navigator.clipboard.writeText(link);
            const feedback = document.getElementById('share-group-feedback');
            if (feedback) {
                feedback.classList.remove('hidden');
                setTimeout(() => feedback.classList.add('hidden'), 2500);
            }
        } catch (error) {
            console.error(error);
            alert('Copy failed. Try manually copying the URL.');
        }
    });
</script>
@endpush
