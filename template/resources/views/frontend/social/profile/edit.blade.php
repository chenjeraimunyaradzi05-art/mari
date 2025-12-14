@extends('frontend.social.layout')

@section('social-content')
<form
    action="{{ route('social.profiles.update', $profile->username ?? 'me') }}"
    method="POST"
    enctype="multipart/form-data"
    class="space-y-8"
>
    @csrf
    @method('PUT')

    <section class="rounded-3xl border border-indigo-100 bg-white/95 p-8 shadow-xl shadow-indigo-100/60">
        <header class="mb-6 flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-semibold text-slate-900">Edit social profile</h1>
                <p class="mt-1 text-sm text-slate-500">Refresh your public story so the right supporters can find you.</p>
            </div>
            <a href="{{ route('social.profiles.show', $profile->username) }}" class="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                View profile
            </a>
        </header>

        @if($errors->any())
            <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                <p class="font-semibold">Please fix the highlighted fields:</p>
                <ul class="mt-2 list-disc pl-5">
                    @foreach($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        @php
            $memberLabel = member_label();
        @endphp

        <div class="grid gap-8 md:grid-cols-2">
                                    @case('candidate') {{ $memberLabel }} @break
                                    @default {{ $label }}
                                @endswitch</option>
                    <input
                        id="display_name"
                        name="display_name"
                        type="text"
                        value="{{ old('display_name', $profile->display_name ?? $profile->user?->name) }}"
                        required
                        maxlength="80"
                        class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                </div>

                <div>
                    <label for="username" class="block text-sm font-semibold text-slate-700">Handle</label>
                    <div class="mt-2 flex rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200">
                        <span class="inline-flex items-center rounded-l-2xl bg-slate-50 px-3 text-sm text-slate-500">@</span>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value="{{ old('username', $profile->username) }}"
                            required
                            maxlength="50"
                            pattern="[A-Za-z0-9_.-]+"
                            class="flex-1 rounded-r-2xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none"
                        >
                    </div>
                    <p class="mt-1 text-xs text-slate-500">Use letters, numbers, dashes, underscores, or dots.</p>
                </div>

                <div>
                    <label for="bio" class="block text-sm font-semibold text-slate-700">Bio</label>
                    <textarea
                        id="bio"
                        name="bio"
                        rows="5"
                        maxlength="2800"
                        class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >{{ old('bio', $profile->bio) }}</textarea>
                    <p class="mt-1 text-xs text-slate-500">Share what fuels your mission. This appears on your public dashboard.</p>
                </div>

                <div>
                    <label for="website" class="block text-sm font-semibold text-slate-700">Website</label>
                    <input
                        id="website"
                        name="website"
                        type="url"
                        value="{{ old('website', $profile->website) }}"
                        maxlength="200"
                        class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="https://"
                    >
                </div>

                <div>
                    <label for="profile_type" class="block text-sm font-semibold text-slate-700">Profile type</label>
                    <select
                        id="profile_type"
                        name="profile_type"
                        class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                        @php
                            $type = old('profile_type', $profile->profile_type ?? 'candidate');
                            $options = [
                                'candidate' => $memberLabel,
                                'company' => 'Company',
                                'mentor' => 'Mentor',
                                'ally' => 'Ally',
                                'supporter' => 'Supporter',
                            ];
                        @endphp
                        @foreach($options as $value => $label)
                            <option value="{{ $value }}" @selected($value === $type)>{{ $label }}</option>
                        @endforeach
                    </select>
                </div>

                <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        name="is_private"
                        value="1"
                        class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        @checked(old('is_private', $profile->is_private))
                    >
                    <span>Make my profile private (only approved followers can view posts)</span>
                </label>
            </div>

            <div class="space-y-6">
                <div class="rounded-3xl border border-slate-200 bg-slate-50/80 p-6">
                    <h2 class="text-sm font-semibold text-slate-700">Profile media</h2>
                    <p class="mt-1 text-xs text-slate-500">Refresh your avatar or cover imagery to match your brand.</p>

                    <div class="mt-4 grid gap-4">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Avatar</p>
                            <div class="mt-2 flex items-center gap-4">
                                <img src="{{ $profile->avatar_url }}" alt="Current avatar" class="h-16 w-16 rounded-2xl object-cover">
                                <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
                                    <i class="fas fa-upload"></i>
                                    <span>Upload</span>
                                    <input type="file" name="avatar" accept="image/*" class="hidden">
                                </label>
                            </div>
                            <p class="mt-1 text-xs text-slate-400">Square images 512×512px work best. Max 4MB.</p>
                        </div>

                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Cover photo</p>
                            <div class="mt-2 space-y-3">
                                <div class="h-28 overflow-hidden rounded-3xl border border-slate-200">
                                    <img src="{{ $profile->cover_url }}" alt="Current cover" class="h-full w-full object-cover">
                                </div>
                                <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
                                    <i class="fas fa-upload"></i>
                                    <span>Upload</span>
                                    <input type="file" name="cover_photo" accept="image/*" class="hidden">
                                </label>
                                <p class="text-xs text-slate-400">Use a wide image (1600×600px recommended). Max 8MB.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm shadow-rose-100/40">
                    <h2 class="text-sm font-semibold text-rose-600">Spotlight links</h2>
                    <p class="mt-1 text-xs text-rose-500">Point to portfolios, fundraising campaigns, or signature content.</p>
                    <div class="mt-4 space-y-4">
                        @foreach($linkSlots as $index => $link)
                            <div class="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                                <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Link {{ $index + 1 }}</div>
                                <div class="grid gap-3">
                                    <div>
                                        <label class="block text-xs font-semibold text-rose-500">Label</label>
                                        <input
                                            type="text"
                                            name="social_links[{{ $index }}][label]"
                                            value="{{ old("social_links.$index.label", $link['label']) }}"
                                            maxlength="40"
                                            class="mt-1 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                                            placeholder="e.g. Portfolio"
                                        >
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-rose-500">URL</label>
                                        <input
                                            type="url"
                                            name="social_links[{{ $index }}][url]"
                                            value="{{ old("social_links.$index.url", $link['url']) }}"
                                            maxlength="255"
                                            class="mt-1 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                                            placeholder="https://"
                                        >
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
            </div>
        </div>
    </section>

    <div class="flex items-center justify-end gap-3">
        <a href="{{ route('social.profiles.show', $profile->username) }}" class="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400">Cancel</a>
        <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700">
            <i class="fas fa-save"></i>
            Save changes
        </button>
    </div>
</form>
@endsection
