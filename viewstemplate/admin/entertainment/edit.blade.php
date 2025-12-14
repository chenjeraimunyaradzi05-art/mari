@extends('admin.layouts.master')

@section('contents')
<section class="section">
    <div class="section-header">
        <div class="section-header-back">
            <a href="{{ route('admin.entertainment.index') }}" class="btn btn-icon"><i class="fas fa-arrow-left"></i></a>
        </div>
        <h1>Edit Entertainment Content</h1>
    </div>

    <div class="section-body">
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h4>Edit Content</h4>
                    </div>
                    <div class="card-body">
                        <form action="{{ route('admin.entertainment.update', $post->id) }}" method="POST" enctype="multipart/form-data">
                            @csrf
                            @method('PUT')

                            <div class="form-group">
                                <label>Title</label>
                                <input type="text" class="form-control @error('title') is-invalid @enderror" name="title" value="{{ old('title', $post->caption) }}" required>
                                @error('title')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>

                            <div class="form-group">
                                <label>Description</label>
                                <textarea class="form-control @error('description') is-invalid @enderror" name="description" rows="4">{{ old('description', $post->content) }}</textarea>
                                @error('description')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>

                            <div class="form-group">
                                <label>Content Type</label>
                                <select class="form-control @error('type') is-invalid @enderror" name="type" id="contentTypeSelect" required>
                                    <option value="movie" {{ old('type', $post->post_type) == 'movie' ? 'selected' : '' }}>Movie</option>
                                    <option value="short_video" {{ old('type', $post->post_type) == 'short_video' ? 'selected' : '' }}>Short Video</option>
                                    <option value="documentary" {{ old('type', $post->post_type) == 'documentary' ? 'selected' : '' }}>Documentary</option>
                                    <option value="educational" {{ old('type', $post->post_type) == 'educational' ? 'selected' : '' }}>Educational</option>
                                    <option value="success_story" {{ old('type', $post->post_type) == 'success_story' ? 'selected' : '' }}>Success Story</option>
                                </select>
                                @error('type')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>

                            <!-- Dynamic Metadata Fields -->
                            <div id="metadataFields">
                                <div class="form-group" id="directorField" style="display: none;">
                                    <label>Director</label>
                                    <input type="text" class="form-control" name="director" value="{{ old('director', $post->getMeta('director')) }}">
                                </div>

                                <div class="form-group" id="castField" style="display: none;">
                                    <label>Cast (Comma separated)</label>
                                    <input type="text" class="form-control" name="cast" value="{{ old('cast', $post->getMeta('cast')) }}">
                                </div>

                                <div class="form-group" id="musicTrackField" style="display: none;">
                                    <label>Music Track / Audio Credit</label>
                                    <input type="text" class="form-control" name="music_track" value="{{ old('music_track', $post->getMeta('music_track')) }}">
                                </div>

                                <div class="form-group" id="difficultyField" style="display: none;">
                                    <label>Difficulty Level</label>
                                    <select class="form-control" name="difficulty_level">
                                        <option value="">Select Level</option>
                                        <option value="beginner" {{ old('difficulty_level', $post->getMeta('difficulty_level')) == 'beginner' ? 'selected' : '' }}>Beginner</option>
                                        <option value="intermediate" {{ old('difficulty_level', $post->getMeta('difficulty_level')) == 'intermediate' ? 'selected' : '' }}>Intermediate</option>
                                        <option value="advanced" {{ old('difficulty_level', $post->getMeta('difficulty_level')) == 'advanced' ? 'selected' : '' }}>Advanced</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label>Duration (Seconds - Optional override)</label>
                                    <input type="number" class="form-control" name="duration" value="{{ old('duration', $post->getMeta('duration')) }}" min="1">
                                    <small class="form-text text-muted">If left blank, we'll try to detect it from the video file.</small>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label>Video File</label>
                                        @if($post->media->first() && $post->media->first()->file_path)
                                            <div class="mb-2">
                                                <video width="320" height="240" controls>
                                                    <source src="{{ asset($post->media->first()->file_path) }}" type="{{ $post->media->first()->mime_type }}">
                                                    Your browser does not support the video tag.
                                                </video>
                                            </div>
                                        @endif
                                        <input type="file" class="form-control @error('video_file') is-invalid @enderror" name="video_file" accept="video/*">
                                        <small class="form-text text-muted">Leave empty to keep current video. Supported formats: MP4, MOV, AVI. Max size: 100MB.</small>
                                        @error('video_file')
                                            <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label>Thumbnail Image</label>
                                        @if($post->media->first() && $post->media->first()->thumbnail_path)
                                            <div class="mb-2">
                                                <img src="{{ asset($post->media->first()->thumbnail_path) }}" alt="Current Thumbnail" class="img-fluid rounded" style="max-height: 150px;">
                                            </div>
                                        @endif
                                        <input type="file" class="form-control @error('thumbnail_file') is-invalid @enderror" name="thumbnail_file" accept="image/*">
                                        <small class="form-text text-muted">Leave empty to keep current thumbnail. Supported formats: JPG, PNG. Max size: 5MB.</small>
                                        @error('thumbnail_file')
                                            <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="d-block">Share to Social Media (Reshare)</label>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="checkbox" id="share_facebook" name="share_to[]" value="facebook">
                                    <label class="form-check-label" for="share_facebook">Facebook</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="checkbox" id="share_twitter" name="share_to[]" value="twitter">
                                    <label class="form-check-label" for="share_twitter">Twitter / X</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="checkbox" id="share_linkedin" name="share_to[]" value="linkedin">
                                    <label class="form-check-label" for="share_linkedin">LinkedIn</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="checkbox" id="share_instagram" name="share_to[]" value="instagram">
                                    <label class="form-check-label" for="share_instagram">Instagram</label>
                                </div>
                                <small class="form-text text-muted d-block mt-2">
                                    Select to share/reshare this content to your connected social accounts.
                                </small>
                            </div>

                            <div class="form-group text-right">
                                <button type="submit" class="btn btn-primary">Update Content</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', function() {
        const typeSelect = document.getElementById('contentTypeSelect');
        const directorField = document.getElementById('directorField');
        const castField = document.getElementById('castField');
        const musicTrackField = document.getElementById('musicTrackField');
        const difficultyField = document.getElementById('difficultyField');

        function updateFields() {
            const type = typeSelect.value;

            // Reset all
            directorField.style.display = 'none';
            castField.style.display = 'none';
            musicTrackField.style.display = 'none';
            difficultyField.style.display = 'none';

            if (type === 'movie') {
                directorField.style.display = 'block';
                castField.style.display = 'block';
            } else if (type === 'documentary') {
                directorField.style.display = 'block';
            } else if (type === 'short_video') {
                musicTrackField.style.display = 'block';
            } else if (type === 'educational') {
                difficultyField.style.display = 'block';
            }
        }

        typeSelect.addEventListener('change', updateFields);

        // Initial run
        updateFields();
    });
</script>
@endpush
