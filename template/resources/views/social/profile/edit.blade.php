@extends('frontend.social.layout')

@section('title', 'Edit Profile')

@section('social-content')
@php
    $memberLabel = member_label();
    $profileTypeOptions = [
        'candidate' => $memberLabel,
        'company' => 'Company',
        'mentor' => 'Mentor',
        'ally' => 'Ally',
        'supporter' => 'Supporter',
    ];
@endphp
<div class="container py-5">
    <header class="mb-5">
        <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
            <div>
                <p class="text-uppercase text-muted small fw-semibold mb-1" style="letter-spacing: 0.3em;">Profile settings</p>
                <h1 class="h3 fw-bold mb-1">Refresh {{ $profile->display_name ?? '@'.$profile->username }}'s public story</h1>
                <p class="text-muted mb-0">Update imagery, copy, and spotlight links so the right partners know what you're building.</p>
            </div>
            <a href="{{ route('social.profiles.show', $profile->username) }}" class="btn btn-outline-secondary rounded-pill px-4">
                <i class="fas fa-external-link-alt me-2"></i>View live profile
            </a>
        </div>
    </header>

    @if(session('success'))
        <div class="alert alert-success rounded-4 border-0 shadow-sm mb-4">
            <div class="d-flex align-items-center gap-2">
                <i class="fas fa-check-circle"></i>
                <span>{{ session('success') }}</span>
            </div>
        </div>
    @endif

    @if($errors->any())
        <div class="alert alert-danger rounded-4 border-0 shadow-sm mb-4">
            <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fas fa-circle-exclamation"></i>
                <strong>Please fix the highlighted fields</strong>
            </div>
            <ul class="mb-0 ps-3">
                @foreach($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form action="{{ route('social.profiles.update', $profile->username ?? 'me') }}" method="POST" enctype="multipart/form-data" class="vstack gap-4">
        @csrf
        @method('PUT')

        <div class="row g-4 align-items-start">
            <div class="col-lg-7">
                <section class="rounded-4 border border-light-subtle bg-white shadow-sm p-4 h-100">
                    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                        <div>
                            <p class="text-uppercase text-muted small fw-semibold mb-1" style="letter-spacing:0.2em;">Brand kit</p>
                            <h2 class="h5 mb-0">Cover, avatar, and spotlight video</h2>
                        </div>
                        <span class="badge rounded-pill text-bg-light text-muted">Max 8MB images · 150MB video</span>
                    </div>

                    <div class="row g-4">
                        <div class="col-12">
                            <div class="rounded-4 border p-3" style="background:#f5f0ff;border-color:#d7ccff;">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <p class="text-uppercase text-muted small fw-semibold mb-1">Cover photo</p>
                                        <h3 class="h6 mb-0">Wide banner for your feed hero</h3>
                                    </div>
                                    <label class="btn btn-sm btn-outline-primary rounded-pill px-3">
                                        <i class="fas fa-cloud-upload-alt me-2"></i>Select file
                                        <input type="file" name="cover_photo" accept="image/*" class="d-none" data-cover-input>
                                    </label>
                                </div>
                                <div class="ratio ratio-21x9 rounded-4 overflow-hidden border" style="background:#120c2c;">
                                    <img src="{{ $profile->cover_url }}" alt="Cover preview" class="w-100 h-100" style="object-fit:cover;" data-cover-preview>
                                </div>
                                <small class="text-muted d-block mt-2">Recommended 1600×600px. We'll resize automatically when processing is available.</small>
                                @error('cover_photo')
                                    <div class="text-danger small mt-1">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div class="rounded-4 border p-3 h-100" style="background:#fff5f8;border-color:#f8cddc;">
                                <p class="text-uppercase text-muted small fw-semibold mb-2">Avatar</p>
                                <div class="d-flex align-items-center gap-3">
                                    <img src="{{ $profile->avatar_url }}" alt="Avatar preview" class="rounded-4 border w-100" style="max-width:120px; height:120px; object-fit:cover;" data-avatar-preview>
                                    <div class="flex-grow-1">
                                        <label class="btn btn-outline-danger rounded-pill w-100">
                                            <i class="fas fa-camera me-2"></i>Upload
                                            <input type="file" name="avatar" accept="image/*" class="d-none" data-avatar-input>
                                        </label>
                                        <small class="text-muted d-block mt-2">Square images (512×512px) look crisp in the feed.</small>
                                        @error('avatar')
                                            <div class="text-danger small mt-1">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div class="rounded-4 border p-3 h-100" id="profile-video-card" style="background:#f4f0ff;border-color:#d7c6ff;">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <p class="text-uppercase text-muted small fw-semibold mb-0">Spotlight video</p>
                                    <span class="badge text-bg-light text-muted">MP4 / WebM</span>
                                </div>
                                <div class="ratio ratio-16x9 rounded-3 overflow-hidden border position-relative bg-dark">
                                    <video class="w-100 h-100" controls playsinline preload="metadata" data-profile-video-preview @if(!$profile->profile_video_url) hidden @endif poster="{{ $profile->profile_video_poster_url ?? $profile->cover_url }}" src="{{ $profile->profile_video_url }}">
                                        Your browser does not support the video tag.
                                    </video>
                                    <div class="d-flex flex-column justify-content-center align-items-center text-center text-white-50 h-100" data-profile-video-placeholder @if($profile->profile_video_url) hidden @endif>
                                        <i class="fas fa-play-circle fa-2x mb-2"></i>
                                        <p class="mb-0">Drop in a 2-minute intro reel.</p>
                                    </div>
                                </div>
                                <div class="d-flex flex-wrap gap-2 mt-3">
                                    <label class="btn btn-outline-dark rounded-pill flex-grow-1">
                                        <i class="fas fa-upload me-2"></i>Upload video
                                        <input type="file" name="profile_video" accept="video/mp4,video/webm,video/quicktime" class="d-none" data-profile-video-input>
                                    </label>
                                    @if($profile->profile_video_url)
                                        <label class="btn btn-outline-danger rounded-pill flex-grow-1">
                                            <input type="checkbox" name="remove_profile_video" value="1" class="d-none" data-remove-profile-video>
                                            <span><i class="fas fa-trash me-2"></i>Remove</span>
                                        </label>
                                    @else
                                        <span class="btn btn-outline-secondary rounded-pill flex-grow-1 disabled">
                                            <i class="fas fa-trash me-2"></i>Remove
                                        </span>
                                    @endif
                                </div>
                                <small class="text-muted d-block mt-2">Ideal under 2 minutes / 150MB. We'll generate a soft gradient poster for you.</small>
                                @error('profile_video')
                                    <div class="text-danger small mt-1">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            <div class="col-lg-5">
                <section class="rounded-4 border border-light-subtle bg-white shadow-sm p-4 mb-4 position-relative overflow-hidden">
                    <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                        <div>
                            <p class="text-uppercase text-muted small fw-semibold mb-1" style="letter-spacing:0.2em;">Identity shell</p>
                            <h2 class="h5 mb-1">Shape how Athena introduces you in feeds</h2>
                            <p class="text-muted small mb-0">Names, handles, and profile type power search previews, intros, and AI summaries.</p>
                        </div>
                        <span class="badge rounded-pill text-bg-light text-muted">
                            <i class="fas fa-signal me-1"></i>
                            Live in profile header
                        </span>
                    </div>

                    <div class="vstack gap-3">
                        <div class="row g-3">
                            <div class="col-12">
                                <label for="display_name" class="form-label fw-semibold mb-1">Display name</label>
                                <div class="rounded-4 border px-3 py-2 bg-body-tertiary">
                                    <input
                                        type="text"
                                        id="display_name"
                                        name="display_name"
                                        value="{{ old('display_name', $profile->display_name ?? $profile->user?->name) }}"
                                        maxlength="80"
                                        class="form-control border-0 bg-transparent p-0"
                                        required
                                    >
                                </div>
                                <small class="text-muted">What shows up on hero cards, mentions, and invites.</small>
                                @error('display_name')
                                    <div class="text-danger small mt-1">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-12">
                                <label for="username" class="form-label fw-semibold mb-1">Username</label>
                                <div class="rounded-4 border px-3 py-2 bg-body">
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="text-muted">@</span>
                                        <input
                                            type="text"
                                            id="username"
                                            name="username"
                                            value="{{ old('username', $profile->username) }}"
                                            maxlength="50"
                                            pattern="[A-Za-z0-9_.-]+"
                                            class="form-control border-0 bg-transparent p-0"
                                            required
                                        >
                                    </div>
                                </div>
                                <small class="text-muted">Letters, numbers, dashes, underscores, or dots only.</small>
                                @error('username')
                                    <div class="text-danger small mt-1">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-12">
                                <label for="website" class="form-label fw-semibold mb-1">Website / flagship drop</label>
                                <div class="rounded-4 border px-3 py-2 bg-body">
                                    <input
                                        type="url"
                                        id="website"
                                        name="website"
                                        value="{{ old('website', $profile->website) }}"
                                        maxlength="200"
                                        class="form-control border-0 bg-transparent p-0"
                                        placeholder="https://yourstudio.com/impact"
                                    >
                                </div>
                                <small class="text-muted">Drop your deck, Notion hub, or site landing.</small>
                                @error('website')
                                    <div class="text-danger small mt-1">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-12">
                                <label for="profile_type" class="form-label fw-semibold mb-1">Profile type</label>
                                <div class="rounded-4 border px-3 py-2 bg-body-tertiary">
                                    @php $type = old('profile_type', $profile->profile_type ?? 'candidate'); @endphp
                                    <select id="profile_type" name="profile_type" class="form-select border-0 bg-transparent p-0">
                                        @foreach($profileTypeOptions as $value => $label)
                                            <option value="{{ $value }}" @selected($type === $value)>{{ $label }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <small class="text-muted">Tells Athena which programs and prompts to surface.</small>
                            </div>
                        </div>

                        <div class="rounded-4 border px-3 py-3 bg-body-secondary d-flex align-items-start gap-3">
                            <div class="flex-grow-1">
                                <p class="fw-semibold mb-1">Privacy mode</p>
                                <p class="text-muted small mb-0">Toggle when you only want trusted followers to see posts.</p>
                            </div>
                            <div class="form-check form-switch m-0">
                                <input class="form-check-input" type="checkbox" id="is_private" name="is_private" value="1" @checked(old('is_private', $profile->is_private))>
                            </div>
                        </div>
                        <label class="form-check-label text-muted small" for="is_private">Private account (only approved followers can see posts)</label>
                    </div>
                </section>

                <section class="rounded-4 border border-light-subtle bg-white shadow-sm p-4">
                    <p class="text-uppercase text-muted small fw-semibold mb-2" style="letter-spacing:0.2em;">Bio</p>
                    <textarea name="bio" rows="6" maxlength="2800" class="form-control rounded-3" placeholder="Share what fuels your mission." data-bio-input>{{ old('bio', $profile->bio) }}</textarea>
                    <small class="text-muted d-block mt-2">Appears on your profile header and search cards.</small>
                    @error('bio')
                        <div class="text-danger small mt-1">{{ $message }}</div>
                    @enderror
                </section>
            </div>
        </div>

        <section class="rounded-4 border border-light-subtle bg-white shadow-sm p-4 mt-4">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <p class="text-uppercase text-muted small fw-semibold mb-1" style="letter-spacing:0.2em;">Spotlight links</p>
                    <h2 class="h5 mb-1">Drop proof points the network can act on</h2>
                    <p class="text-muted small mb-0">Think live decks, traction dashboards, application forms, or press wins.</p>
                </div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="badge text-bg-light text-muted">
                        <i class="fas fa-link me-1"></i>Up to 3 links
                    </span>
                    <span class="badge bg-body-secondary text-muted">Drag to reorder soon</span>
                </div>
            </div>
            @php
                $linkHints = [
                    'Point people to a live deck or overview page.',
                    'Share traction, press, or community wins.',
                    'Collect interest via a form or waitlist.',
                ];
                $linkIcons = ['fa-star', 'fa-chart-line', 'fa-door-open'];
            @endphp
            <div class="row g-3">
                @foreach($linkSlots as $index => $link)
                    <div class="col-md-4">
                        <article class="h-100 rounded-4 border p-3 bg-body-tertiary" style="border-style:dashed;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <p class="text-uppercase text-muted small fw-semibold mb-0">Link {{ $index + 1 }}</p>
                                    <small class="text-muted">{{ $linkHints[$index] ?? 'Surface your strongest proof point.' }}</small>
                                </div>
                                <span class="badge rounded-pill bg-white text-muted border">
                                    <i class="fas {{ $linkIcons[$index] ?? 'fa-paperclip' }}"></i>
                                </span>
                            </div>
                            <div class="mb-2">
                                <label class="form-label text-muted small">Label</label>
                                <input
                                    type="text"
                                    name="social_links[{{ $index }}][label]"
                                    value="{{ old("social_links.$index.label", $link['label']) }}"
                                    maxlength="40"
                                    class="form-control rounded-3"
                                    placeholder="Portfolio"
                                >
                            </div>
                            <div>
                                <label class="form-label text-muted small">URL</label>
                                <input
                                    type="url"
                                    name="social_links[{{ $index }}][url]"
                                    value="{{ old("social_links.$index.url", $link['url']) }}"
                                    maxlength="255"
                                    class="form-control rounded-3"
                                    placeholder="https://"
                                >
                            </div>
                        </article>
                    </div>
                @endforeach
            </div>
        </section>

        <div class="d-flex flex-column flex-md-row justify-content-end gap-3 mt-4">
            <a href="{{ route('social.profiles.show', $profile->username) }}" class="btn btn-outline-secondary rounded-pill px-4">Cancel</a>
            <button type="submit" class="btn btn-primary rounded-pill px-4">
                <i class="fas fa-save me-2"></i>Save changes
            </button>
        </div>
    </form>
</div>
@endsection

@push('scripts')
<script>
(function () {
    'use strict';

    const bindImagePreview = (inputSelector, previewSelector) => {
        const input = document.querySelector(inputSelector);
        const preview = document.querySelector(previewSelector);

        if (!input || !preview) {
            return;
        }

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = event => {
                if (event.target?.result) {
                    preview.src = event.target.result;
                }
            };
            reader.readAsDataURL(file);
        });
    };

    bindImagePreview('[data-avatar-input]', '[data-avatar-preview]');
    bindImagePreview('[data-cover-input]', '[data-cover-preview]');

    const videoInput = document.querySelector('[data-profile-video-input]');
    const videoPreview = document.querySelector('[data-profile-video-preview]');
    const videoPlaceholder = document.querySelector('[data-profile-video-placeholder]');
    const removeCheckbox = document.querySelector('[data-remove-profile-video]');

    if (videoInput && videoPreview) {
        videoInput.addEventListener('change', () => {
            const file = videoInput.files?.[0];
            if (!file) {
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            videoPreview.removeAttribute('hidden');
            videoPreview.src = objectUrl;
            videoPreview.load();

            if (videoPlaceholder) {
                videoPlaceholder.hidden = true;
            }

            if (removeCheckbox) {
                removeCheckbox.checked = false;
            }

            videoPreview.addEventListener('loadeddata', () => URL.revokeObjectURL(objectUrl), { once: true });
        });
    }

    if (removeCheckbox && videoPlaceholder && videoPreview) {
        removeCheckbox.addEventListener('change', () => {
            const isRemoving = removeCheckbox.checked;
            if (isRemoving) {
                videoPreview.hidden = true;
                if (videoPlaceholder) {
                    videoPlaceholder.hidden = false;
                }
            }
        });
    }
})();
</script>
@endpush
