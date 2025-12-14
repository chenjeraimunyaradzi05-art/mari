@php
    use App\Enums\OrganizationPageType;

    $status = old('profile_status', $page->profile_status ?? 'draft');
    $verification = old('verification_status', $page->verification_status ?? 'unverified');
    $highlightsValue = old('highlights', isset($page) ? implode("\n", $page->highlights ?? []) : '');
    $policiesValue = old('policies', isset($page) ? implode("\n", $page->policies ?? []) : '');
    $selectedType = old('type', $page->type?->value ?? 'employer');
@endphp

<div class="row">
    <div class="col-md-8">
        <div class="card">
            <div class="card-body">
                <div class="form-group">
                    <label>Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" name="name" value="{{ old('name', $page->name ?? '') }}" required>
                    <x-input-error :messages="$errors->get('name')" class="mt-1" />
                </div>
                <div class="form-group">
                    <label>Slug</label>
                    <input type="text" class="form-control" name="slug" value="{{ old('slug', $page->slug ?? '') }}">
                    <small class="form-text text-muted">Leave blank to auto-generate from the name.</small>
                    <x-input-error :messages="$errors->get('slug')" class="mt-1" />
                </div>
                <div class="form-group">
                    <label>Tagline</label>
                    <input type="text" class="form-control" name="tagline" value="{{ old('tagline', $page->tagline ?? '') }}">
                </div>
                <div class="form-group">
                    <label>About</label>
                    <textarea class="form-control" name="about" rows="5">{{ old('about', $page->about ?? '') }}</textarea>
                </div>
                <div class="form-group">
                    <label>Mission</label>
                    <textarea class="form-control" name="mission" rows="4">{{ old('mission', $page->mission ?? '') }}</textarea>
                </div>
                <div class="form-group">
                    <label>Highlights (one per line)</label>
                    <textarea class="form-control" name="highlights" rows="4">{{ $highlightsValue }}</textarea>
                </div>
                <div class="form-group">
                    <label>Policies & Commitments (one per line)</label>
                    <textarea class="form-control" name="policies" rows="4">{{ $policiesValue }}</textarea>
                </div>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card">
            <div class="card-body">
                <div class="form-group">
                    <label>Company</label>
                    <select class="form-control" name="company_id">
                        <option value="">— Select company —</option>
                        @foreach($companies as $id => $name)
                            <option value="{{ $id }}" @selected(old('company_id', $page->company_id ?? '') == $id)>{{ $name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="form-group">
                    <label>Type <span class="text-danger">*</span></label>
                    <select class="form-control" name="type" required>
                        @foreach(OrganizationPageType::cases() as $typeOption)
                            <option value="{{ $typeOption->value }}" @selected($selectedType === $typeOption->value)>
                                {{ $typeOption->label() }}
                            </option>
                        @endforeach
                    </select>
                    <x-input-error :messages="$errors->get('type')" class="mt-1" />
                </div>
                <div class="form-group">
                    <label>Verification Status</label>
                    <select class="form-control" name="verification_status">
                        @foreach(['unverified','pending','verified'] as $option)
                            <option value="{{ $option }}" @selected($verification === $option)>{{ ucfirst($option) }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="form-group">
                    <label>Profile Status</label>
                    <select class="form-control" name="profile_status">
                        @foreach(['draft','published','archived'] as $option)
                            <option value="{{ $option }}" @selected($status === $option)>{{ ucfirst($option) }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="form-group">
                    <label>Website URL</label>
                    <input type="url" class="form-control" name="website_url" value="{{ old('website_url', $page->website_url ?? '') }}">
                </div>
                <div class="form-group">
                    <label>Contact email</label>
                    <input type="email" class="form-control" name="contact_email" value="{{ old('contact_email', $page->contact_email ?? '') }}">
                </div>
                <div class="form-group">
                    <label>Contact phone</label>
                    <input type="text" class="form-control" name="contact_phone" value="{{ old('contact_phone', $page->contact_phone ?? '') }}">
                </div>
                <div class="form-group">
                    <label>Hero CTA label</label>
                    <input type="text" class="form-control" name="hero_cta_label" value="{{ old('hero_cta_label', $page->hero_cta_label ?? '') }}">
                </div>
                <div class="form-group">
                    <label>Hero CTA URL</label>
                    <input type="url" class="form-control" name="hero_cta_url" value="{{ old('hero_cta_url', $page->hero_cta_url ?? '') }}">
                </div>
                <div class="form-group">
                    <label>Hero media</label>
                    <input type="file" class="form-control" name="hero_media" accept="video/*,image/*">
                    <div class="mt-2">
                        <select class="form-control" name="hero_media_type">
                            <option value="image" @selected(old('hero_media_type', 'image') === 'image')>Image</option>
                            <option value="video" @selected(old('hero_media_type', 'image') === 'video')>Video</option>
                        </select>
                    </div>
                    <small class="form-text text-muted">Uploads use the media pipeline (max {{ number_format(config('org.max_upload_size', 524288) / 1024) }} MB).</small>
                    <x-input-error :messages="$errors->get('hero_media')" class="mt-1" />
                    <x-input-error :messages="$errors->get('hero_media_type')" class="mt-1" />
                </div>
                @if(isset($page) && $page->coverMedia)
                    <div class="form-group">
                        <label>Current hero</label>
                        <div class="mb-2">
                            @if($page->coverMedia->type === 'video')
                                <video class="w-100" controls poster="{{ $page->coverMedia->thumbnail_url }}">
                                    <source src="{{ $page->coverMedia->url }}" type="video/mp4">
                                </video>
                            @else
                                <img src="{{ $page->coverMedia->url }}" class="img-fluid" alt="Cover media">
                            @endif
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="1" id="remove-cover" name="remove_cover">
                            <label class="form-check-label" for="remove-cover">Remove hero media</label>
                        </div>
                    </div>
                @endif
            </div>
        </div>
    </div>
</div>
