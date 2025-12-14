<div class="tab-pane fade" id="pills-video" role="tabpanel" aria-labelledby="pills-video-tab">

    <!-- Profile Completion Info -->
    <div class="alert" style="background: linear-gradient(135deg, #E91E8C15 0%, #8B5CF615 100%); border-left: 4px solid #E91E8C;">
        <div class="d-flex align-items-center">
            <div class="mr-3">
                <i class="fas fa-star fa-2x" style="color: #E91E8C;"></i>
            </div>
            <div>
                <h6 class="mb-1" style="color: #E91E8C;">Video Profile Worth 20% of Your Profile Score!</h6>
                <p class="mb-0 small text-muted">
                    Your video introduction showcases your personality and professionalism beyond what a CV can capture.
                    Companies value seeing the real you - it increases your match rate by up to 3x!
                </p>
            </div>
        </div>
    </div>

    <!-- Professional Video Section -->
    <div class="card mb-4" style="border-left: 4px solid #8B5CF6;">
        <div class="card-header bg-white">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-0" style="color: #8B5CF6;">
                        <i class="fas fa-video mr-2"></i>Professional Introduction Video
                    </h5>
                    <p class="text-muted small mb-0">Tell employers about your experience and career goals (Max 15 minutes)</p>
                </div>
                @if($candidate?->profile_video_url)
                    <span class="badge badge-success">
                        <i class="fas fa-check-circle mr-1"></i>Uploaded
                    </span>
                @endif
            </div>
        </div>
        <div class="card-body">
            <form id="profile-video-form" action="{{ route('member.profile.profile-video.upload') }}" method="POST" enctype="multipart/form-data">
                @csrf

                <!-- Current Video Preview -->
                @if($candidate?->profile_video_url)
                    <div class="current-video-preview mb-3">
                        <label class="font-sm color-text-mutted mb-10">Current Video</label>
                        <div class="video-container" style="position: relative; max-width: 600px;">
                            <video controls style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <source src="{{ asset($candidate->profile_video_url) }}" type="video/mp4">
                                Your browser does not support video playback.
                            </video>
                            @if($candidate->profile_video_analysis)
                                <div class="mt-2 p-3" style="background: #f8f9fa; border-radius: 8px;">
                                    <h6 style="color: #8B5CF6;">
                                        <i class="fas fa-robot mr-1"></i>AI Analysis Results
                                    </h6>
                                    <div class="row mt-2">
                                        <div class="col-md-4">
                                            <small class="text-muted">Communication</small>
                                            <div class="progress" style="height: 8px;">
                                                <div class="progress-bar" style="width: {{ $candidate->profile_video_analysis['communication_score'] }}%; background: #8B5CF6;"></div>
                                            </div>
                                            <small><strong>{{ $candidate->profile_video_analysis['communication_score'] }}%</strong></small>
                                        </div>
                                        <div class="col-md-4">
                                            <small class="text-muted">Professionalism</small>
                                            <div class="progress" style="height: 8px;">
                                                <div class="progress-bar" style="width: {{ $candidate->profile_video_analysis['professionalism_score'] }}%; background: #10B981;"></div>
                                            </div>
                                            <small><strong>{{ $candidate->profile_video_analysis['professionalism_score'] }}%</strong></small>
                                        </div>
                                        <div class="col-md-4">
                                            <small class="text-muted">Authenticity</small>
                                            <div class="progress" style="height: 8px;">
                                                <div class="progress-bar" style="width: {{ $candidate->profile_video_analysis['authenticity_score'] }}%; background: #E91E8C;"></div>
                                            </div>
                                            <small><strong>{{ $candidate->profile_video_analysis['authenticity_score'] }}%</strong></small>
                                        </div>
                                    </div>
                                    @if(isset($candidate->profile_video_analysis['key_strengths']))
                                        <div class="mt-2">
                                            <small class="text-muted">Key Strengths:</small>
                                            <div class="mt-1">
                                                @foreach(array_slice($candidate->profile_video_analysis['key_strengths'], 0, 3) as $strength)
                                                    <span class="badge badge-light mr-1">
                                                        <i class="fas fa-check-circle text-success mr-1"></i>{{ $strength }}
                                                    </span>
                                                @endforeach
                                            </div>
                                        </div>
                                    @endif
                                </div>
                            @endif
                        </div>
                        <p class="mt-2 mb-0 small text-muted">
                            <i class="fas fa-clock mr-1"></i>Uploaded {{ $candidate->profile_video_uploaded_at ? $candidate->profile_video_uploaded_at->diffForHumans() : 'recently' }}
                        </p>
                    </div>
                @endif

                <!-- Upload New Video -->
                <div class="upload-section">
                    <label class="font-sm color-text-mutted mb-10">
                        {{ $candidate?->profile_video_url ? 'Replace Video' : 'Upload Video' }}
                    </label>

                    <!-- Drag & Drop Zone -->
                    <div class="video-dropzone" id="profile-video-dropzone">
                        <div class="dropzone-content">
                            <i class="fas fa-cloud-upload-alt fa-3x mb-3" style="color: #8B5CF6;"></i>
                            <h6>Drag & Drop your video here</h6>
                            <p class="text-muted small mb-3">or click to browse files</p>
                            <button type="button" class="btn btn-outline-primary" onclick="document.getElementById('profile-video-input').click()">
                                <i class="fas fa-folder-open mr-2"></i>Choose File
                            </button>
                            <input type="file" id="profile-video-input" name="profile_video" accept="video/*" style="display: none;">
                            <p class="mt-3 mb-0 small text-muted">
                                <i class="fas fa-info-circle mr-1"></i>
                                Max 15 minutes • MP4, MOV, AVI • Up to 500MB
                            </p>
                        </div>
                        <div class="dropzone-uploading" style="display: none;">
                            <div class="spinner-border text-primary mb-3" role="status"></div>
                            <h6>Uploading video...</h6>
                            <div class="progress mt-3" style="height: 8px; width: 80%; margin: 0 auto;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated"
                                     style="width: 0%; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);"></div>
                            </div>
                            <p class="mt-2 mb-0 text-muted"><span id="profile-upload-progress">0</span>%</p>
                        </div>
                        <div class="dropzone-preview" style="display: none;">
                            <i class="fas fa-check-circle fa-3x mb-3 text-success"></i>
                            <h6 id="profile-video-name"></h6>
                            <p class="text-muted small" id="profile-video-size"></p>
                            <button type="button" class="btn btn-sm btn-danger mt-2" onclick="clearProfileVideo()">
                                <i class="fas fa-times mr-1"></i>Remove
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tips Section -->
                <div class="mt-3 p-3" style="background: #f8f9fa; border-radius: 8px; border-left: 3px solid #8B5CF6;">
                    <h6 class="mb-2"><i class="fas fa-lightbulb mr-1" style="color: #F59E0B;"></i>Video Tips</h6>
                    <ul class="mb-0 small text-muted" style="padding-left: 20px;">
                        <li>Record in a quiet, well-lit space</li>
                        <li>Dress professionally as you would for an interview</li>
                        <li>Introduce yourself, your experience, and what you're looking for</li>
                        <li>Speak clearly and confidently - be yourself!</li>
                        <li>Keep it concise: 5-10 minutes is ideal</li>
                    </ul>
                </div>

                <div class="box-button mt-15">
                    <button type="submit" class="btn btn-apply-big font-md font-bold" style="background: #8B5CF6; border: none;">
                        <i class="fas fa-upload mr-2"></i>Upload & Analyze
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Personality Video Section -->
    <div class="card mb-4" style="border-left: 4px solid #E91E8C;">
        <div class="card-header bg-white">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-0" style="color: #E91E8C;">
                        <i class="fas fa-smile mr-2"></i>Personality Showcase Video
                    </h5>
                    <p class="text-muted small mb-0">Show your personality, hobbies, and what makes you unique (Max 15 minutes)</p>
                </div>
                @if($candidate?->personality_video_url)
                    <span class="badge badge-success">
                        <i class="fas fa-check-circle mr-1"></i>Uploaded
                    </span>
                @endif
            </div>
        </div>
        <div class="card-body">
            <form id="personality-video-form" action="{{ route('member.profile.personality-video.upload') }}" method="POST" enctype="multipart/form-data">
                @csrf

                <!-- Current Video Preview -->
                @if($candidate?->personality_video_url)
                    <div class="current-video-preview mb-3">
                        <label class="font-sm color-text-mutted mb-10">Current Video</label>
                        <div class="video-container" style="position: relative; max-width: 600px;">
                            <video controls style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <source src="{{ asset($candidate->personality_video_url) }}" type="video/mp4">
                                Your browser does not support video playback.
                            </video>
                            @if($candidate->personality_video_analysis)
                                <div class="mt-2 p-3" style="background: #f8f9fa; border-radius: 8px;">
                                    <h6 style="color: #E91E8C;">
                                        <i class="fas fa-robot mr-1"></i>AI Personality Insights
                                    </h6>
                                    @if(isset($candidate->personality_video_analysis['personality_traits']))
                                        <div class="row mt-2">
                                            @foreach(array_slice($candidate->personality_video_analysis['personality_traits'], 0, 3) as $trait => $score)
                                                <div class="col-md-4">
                                                    <small class="text-muted">{{ ucfirst($trait) }}</small>
                                                    <div class="progress" style="height: 8px;">
                                                        <div class="progress-bar" style="width: {{ $score }}%; background: #E91E8C;"></div>
                                                    </div>
                                                    <small><strong>{{ $score }}%</strong></small>
                                                </div>
                                            @endforeach
                                        </div>
                                    @endif
                                    @if(isset($candidate->personality_video_analysis['hobbies']))
                                        <div class="mt-2">
                                            <small class="text-muted">Interests & Hobbies:</small>
                                            <div class="mt-1">
                                                @foreach(array_slice($candidate->personality_video_analysis['hobbies'], 0, 5) as $hobby)
                                                    <span class="badge badge-light mr-1">
                                                        <i class="fas fa-heart text-danger mr-1"></i>{{ $hobby }}
                                                    </span>
                                                @endforeach
                                            </div>
                                        </div>
                                    @endif
                                </div>
                            @endif
                        </div>
                        <p class="mt-2 mb-0 small text-muted">
                            <i class="fas fa-clock mr-1"></i>Uploaded {{ $candidate->personality_video_uploaded_at ? $candidate->personality_video_uploaded_at->diffForHumans() : 'recently' }}
                        </p>
                    </div>
                @endif

                <!-- Upload New Video -->
                <div class="upload-section">
                    <label class="font-sm color-text-mutted mb-10">
                        {{ $candidate?->personality_video_url ? 'Replace Video' : 'Upload Video' }}
                    </label>

                    <!-- Drag & Drop Zone -->
                    <div class="video-dropzone" id="personality-video-dropzone">
                        <div class="dropzone-content">
                            <i class="fas fa-cloud-upload-alt fa-3x mb-3" style="color: #E91E8C;"></i>
                            <h6>Drag & Drop your video here</h6>
                            <p class="text-muted small mb-3">or click to browse files</p>
                            <button type="button" class="btn btn-outline-danger" onclick="document.getElementById('personality-video-input').click()">
                                <i class="fas fa-folder-open mr-2"></i>Choose File
                            </button>
                            <input type="file" id="personality-video-input" name="personality_video" accept="video/*" style="display: none;">
                            <p class="mt-3 mb-0 small text-muted">
                                <i class="fas fa-info-circle mr-1"></i>
                                Max 15 minutes • MP4, MOV, AVI • Up to 500MB
                            </p>
                        </div>
                        <div class="dropzone-uploading" style="display: none;">
                            <div class="spinner-border text-danger mb-3" role="status"></div>
                            <h6>Uploading video...</h6>
                            <div class="progress mt-3" style="height: 8px; width: 80%; margin: 0 auto;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated"
                                     style="width: 0%; background: #E91E8C;"></div>
                            </div>
                            <p class="mt-2 mb-0 text-muted"><span id="personality-upload-progress">0</span>%</p>
                        </div>
                        <div class="dropzone-preview" style="display: none;">
                            <i class="fas fa-check-circle fa-3x mb-3 text-success"></i>
                            <h6 id="personality-video-name"></h6>
                            <p class="text-muted small" id="personality-video-size"></p>
                            <button type="button" class="btn btn-sm btn-danger mt-2" onclick="clearPersonalityVideo()">
                                <i class="fas fa-times mr-1"></i>Remove
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tips Section -->
                <div class="mt-3 p-3" style="background: #f8f9fa; border-radius: 8px; border-left: 3px solid #E91E8C;">
                    <h6 class="mb-2"><i class="fas fa-lightbulb mr-1" style="color: #F59E0B;"></i>Video Ideas</h6>
                    <ul class="mb-0 small text-muted" style="padding-left: 20px;">
                        <li>Share your hobbies, interests, and what you love doing</li>
                        <li>Talk about your favorite music, TV shows, or foods</li>
                        <li>Show what work-life balance means to you</li>
                        <li>Be authentic - let your personality shine!</li>
                        <li>Help employers see the real you beyond the resume</li>
                    </ul>
                </div>

                <div class="box-button mt-15">
                    <button type="submit" class="btn btn-apply-big font-md font-bold" style="background: #E91E8C; border: none;">
                        <i class="fas fa-upload mr-2"></i>Upload & Analyze
                    </button>
                </div>
            </form>
        </div>
    </div>

</div>



@push('scripts')
<script>
// Profile Video Dropzone Functionality
const profileDropzone = document.getElementById('profile-video-dropzone');
const profileInput = document.getElementById('profile-video-input');
const profileForm = document.getElementById('profile-video-form');

// Personality Video Dropzone Functionality
const personalityDropzone = document.getElementById('personality-video-dropzone');
const personalityInput = document.getElementById('personality-video-input');
const personalityForm = document.getElementById('personality-video-form');

// Profile Video Handlers
profileDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    profileDropzone.classList.add('dragover');
});

profileDropzone.addEventListener('dragleave', () => {
    profileDropzone.classList.remove('dragover');
});

profileDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    profileDropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) {
        profileInput.files = files;
        handleProfileVideoSelect(files[0]);
    }
});

profileDropzone.addEventListener('click', (e) => {
    if (!e.target.closest('button') && e.target.tagName !== 'INPUT') {
        profileInput.click();
    }
});

profileInput.addEventListener('change', function() {
    if (this.files.length) {
        handleProfileVideoSelect(this.files[0]);
    }
});

// Personality Video Handlers
personalityDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    personalityDropzone.classList.add('dragover');
});

personalityDropzone.addEventListener('dragleave', () => {
    personalityDropzone.classList.remove('dragover');
});

personalityDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    personalityDropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) {
        personalityInput.files = files;
        handlePersonalityVideoSelect(files[0]);
    }
});

personalityDropzone.addEventListener('click', (e) => {
    if (!e.target.closest('button') && e.target.tagName !== 'INPUT') {
        personalityInput.click();
    }
});

personalityInput.addEventListener('change', function() {
    if (this.files.length) {
        handlePersonalityVideoSelect(this.files[0]);
    }
});

function handleProfileVideoSelect(file) {
    // Validate file
    if (!file.type.startsWith('video/')) {
        alert('Please select a valid video file');
        return;
    }

    // Check file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
        alert('File size must be less than 500MB');
        return;
    }

    // Show preview
    const content = profileDropzone.querySelector('.dropzone-content');
    const preview = profileDropzone.querySelector('.dropzone-preview');

    content.style.display = 'none';
    preview.style.display = 'block';

    document.getElementById('profile-video-name').textContent = file.name;
    document.getElementById('profile-video-size').textContent = formatFileSize(file.size);
}

function handlePersonalityVideoSelect(file) {
    // Validate file
    if (!file.type.startsWith('video/')) {
        alert('Please select a valid video file');
        return;
    }

    // Check file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
        alert('File size must be less than 500MB');
        return;
    }

    // Show preview
    const content = personalityDropzone.querySelector('.dropzone-content');
    const preview = personalityDropzone.querySelector('.dropzone-preview');

    content.style.display = 'none';
    preview.style.display = 'block';

    document.getElementById('personality-video-name').textContent = file.name;
    document.getElementById('personality-video-size').textContent = formatFileSize(file.size);
}

function clearProfileVideo() {
    profileInput.value = '';
    const content = profileDropzone.querySelector('.dropzone-content');
    const preview = profileDropzone.querySelector('.dropzone-preview');
    content.style.display = 'block';
    preview.style.display = 'none';
}

function clearPersonalityVideo() {
    personalityInput.value = '';
    const content = personalityDropzone.querySelector('.dropzone-content');
    const preview = personalityDropzone.querySelector('.dropzone-preview');
    content.style.display = 'block';
    preview.style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Form submission with progress
profileForm.addEventListener('submit', function(e) {
    if (!profileInput.files.length) return;

    const content = profileDropzone.querySelector('.dropzone-content');
    const uploading = profileDropzone.querySelector('.dropzone-uploading');
    const preview = profileDropzone.querySelector('.dropzone-preview');

    content.style.display = 'none';
    preview.style.display = 'none';
    uploading.style.display = 'block';

    // Simulate progress (replace with actual AJAX upload if needed)
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        uploading.querySelector('.progress-bar').style.width = progress + '%';
        document.getElementById('profile-upload-progress').textContent = progress;
        if (progress >= 90) clearInterval(interval);
    }, 500);
});

personalityForm.addEventListener('submit', function(e) {
    if (!personalityInput.files.length) return;

    const content = personalityDropzone.querySelector('.dropzone-content');
    const uploading = personalityDropzone.querySelector('.dropzone-uploading');
    const preview = personalityDropzone.querySelector('.dropzone-preview');

    content.style.display = 'none';
    preview.style.display = 'none';
    uploading.style.display = 'block';

    // Simulate progress (replace with actual AJAX upload if needed)
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        uploading.querySelector('.progress-bar').style.width = progress + '%';
        document.getElementById('personality-upload-progress').textContent = progress;
        if (progress >= 90) clearInterval(interval);
    }, 500);
});
</script>
@endpush

