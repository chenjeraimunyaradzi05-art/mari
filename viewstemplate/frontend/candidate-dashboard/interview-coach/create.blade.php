@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Start Practice Session</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li><a href="{{ route('member.interview-coach.index') }}">Interview Coach</a></li>
                            <li>Start Practice</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-120">
        <div class="container">
            <div class="row">

                @include('frontend.candidate-dashboard.sidebar')

                <div class="col-lg-9 col-md-8 col-sm-12 col-12 mb-50">
                    <div class="content-single">
                        <h3 class="mt-0 mb-15 color-brand-1">Setup Your Practice Session</h3>
                        <p class="text-muted mb-30">Choose your preferences and let our AI coach prepare the perfect practice session for you</p>

                        <form action="{{ route('member.interview-coach.store') }}" method="POST" id="sessionForm">
                            @csrf

                            <div class="row">
                                <!-- Session Type -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label"><i class="fas fa-clipboard-list me-2"></i>Session Type <span class="text-danger">*</span></label>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <input type="radio" name="session_type" id="quick_practice" value="quick_practice" class="btn-check" checked>
                                            <label class="btn btn-outline-primary w-100 text-start" for="quick_practice" style="height: auto; padding: 20px; border-width: 2px;">
                                                <div class="d-flex align-items-start">
                                                    <i class="fas fa-bolt fa-2x me-3" style="color: #F59E0B;"></i>
                                                    <div>
                                                        <h6 class="mb-1">Quick Practice</h6>
                                                        <small class="text-muted">5 questions • 15-20 minutes • Perfect for daily practice</small>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>

                                        <div class="col-md-6 mb-3">
                                            <input type="radio" name="session_type" id="full_mock" value="full_mock" class="btn-check">
                                            <label class="btn btn-outline-primary w-100 text-start" for="full_mock" style="height: auto; padding: 20px; border-width: 2px;">
                                                <div class="d-flex align-items-start">
                                                    <i class="fas fa-briefcase fa-2x me-3" style="color: #8B5CF6;"></i>
                                                    <div>
                                                        <h6 class="mb-1">Full Mock Interview</h6>
                                                        <small class="text-muted">10 questions • 40-50 minutes • Complete interview simulation</small>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>

                                        <div class="col-md-6 mb-3">
                                            <input type="radio" name="session_type" id="focused_topic" value="focused_topic" class="btn-check">
                                            <label class="btn btn-outline-primary w-100 text-start" for="focused_topic" style="height: auto; padding: 20px; border-width: 2px;">
                                                <div class="d-flex align-items-start">
                                                    <i class="fas fa-bullseye fa-2x me-3" style="color: #E91E8C;"></i>
                                                    <div>
                                                        <h6 class="mb-1">Focused Topic</h6>
                                                        <small class="text-muted">7 questions • 25-30 minutes • Master specific topics</small>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>

                                        <div class="col-md-6 mb-3">
                                            <input type="radio" name="session_type" id="custom" value="custom" class="btn-check">
                                            <label class="btn btn-outline-primary w-100 text-start" for="custom" style="height: auto; padding: 20px; border-width: 2px;">
                                                <div class="d-flex align-items-start">
                                                    <i class="fas fa-sliders-h fa-2x me-3" style="color: #10B981;"></i>
                                                    <div>
                                                        <h6 class="mb-1">Custom Session</h6>
                                                        <small class="text-muted">Choose your own • Flexible duration • Full customization</small>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- Difficulty Level -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label"><i class="fas fa-signal me-2"></i>Difficulty Level <span class="text-danger">*</span></label>
                                    <div class="row">
                                        <div class="col-6 col-md-3 mb-2">
                                            <input type="radio" name="difficulty" id="entry" value="entry" class="btn-check">
                                            <label class="btn btn-outline-success w-100" for="entry">
                                                <i class="fas fa-seedling d-block mb-2"></i>
                                                Entry Level
                                            </label>
                                        </div>
                                        <div class="col-6 col-md-3 mb-2">
                                            <input type="radio" name="difficulty" id="mid" value="mid" class="btn-check" checked>
                                            <label class="btn btn-outline-warning w-100" for="mid">
                                                <i class="fas fa-user d-block mb-2"></i>
                                                Mid-Level
                                            </label>
                                        </div>
                                        <div class="col-6 col-md-3 mb-2">
                                            <input type="radio" name="difficulty" id="senior" value="senior" class="btn-check">
                                            <label class="btn btn-outline-danger w-100" for="senior">
                                                <i class="fas fa-star d-block mb-2"></i>
                                                Senior
                                            </label>
                                        </div>
                                        <div class="col-6 col-md-3 mb-2">
                                            <input type="radio" name="difficulty" id="executive" value="executive" class="btn-check">
                                            <label class="btn btn-outline-primary w-100" for="executive">
                                                <i class="fas fa-crown d-block mb-2"></i>
                                                Executive
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- Custom Question Count (shown only for custom session) -->
                                <div class="col-lg-12 mb-4" id="customQuestionCount" style="display: none;">
                                    <label class="form-label"><i class="fas fa-hashtag me-2"></i>Number of Questions</label>
                                    <input type="number" name="question_count" class="form-control" min="1" max="20" value="5" placeholder="5">
                                    <small class="form-text text-muted">Choose between 1-20 questions</small>
                                </div>

                                <!-- Job Category (Optional) -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label"><i class="fas fa-folder me-2"></i>Job Category (Optional)</label>
                                    <select name="job_category_id" class="form-select">
                                        <option value="">All Categories</option>
                                        @foreach($categories as $category)
                                            <option value="{{ $category->id }}">{{ $category->name }}</option>
                                        @endforeach
                                    </select>
                                    <small class="form-text text-muted">Get questions specific to your field</small>
                                </div>

                                <!-- Job Role (Optional) -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label"><i class="fas fa-user-tag me-2"></i>Job Role (Optional)</label>
                                    <select name="job_role_id" class="form-select">
                                        <option value="">All Roles</option>
                                        @foreach($roles as $role)
                                            <option value="{{ $role->id }}">{{ $role->name }}</option>
                                        @endforeach
                                    </select>
                                    <small class="form-text text-muted">Target questions for your desired role</small>
                                </div>

                                <!-- Topics (Optional, shown for focused_topic) -->
                                <div class="col-lg-12 mb-4" id="topicsSection" style="display: none;">
                                    <label class="form-label"><i class="fas fa-tags me-2"></i>Focus Topics (Select one or more)</label>
                                    <div class="row">
                                        @foreach($topics as $topic)
                                            <div class="col-md-4 mb-2">
                                                <div class="form-check">
                                                    <input type="checkbox" name="topics[]" value="{{ $topic->id }}" class="form-check-input" id="topic_{{ $topic->id }}">
                                                    <label class="form-check-label" for="topic_{{ $topic->id }}">
                                                        <i class="{{ $topic->icon }} me-1" style="color: {{ $topic->color }};"></i>
                                                        {{ $topic->name }}
                                                    </label>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                </div>

                                <!-- Question Types (Optional) -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label"><i class="fas fa-list-check me-2"></i>Question Types (Optional)</label>
                                    <div class="row">
                                        <div class="col-md-4 col-6 mb-2">
                                            <div class="form-check">
                                                <input type="checkbox" name="question_types[]" value="behavioral" class="form-check-input" id="type_behavioral">
                                                <label class="form-check-label" for="type_behavioral">
                                                    <i class="fas fa-users me-1" style="color: #8B5CF6;"></i> Behavioral
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-md-4 col-6 mb-2">
                                            <div class="form-check">
                                                <input type="checkbox" name="question_types[]" value="technical" class="form-check-input" id="type_technical">
                                                <label class="form-check-label" for="type_technical">
                                                    <i class="fas fa-code me-1" style="color: #E91E8C;"></i> Technical
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-md-4 col-6 mb-2">
                                            <div class="form-check">
                                                <input type="checkbox" name="question_types[]" value="situational" class="form-check-input" id="type_situational">
                                                <label class="form-check-label" for="type_situational">
                                                    <i class="fas fa-lightbulb me-1" style="color: #F59E0B;"></i> Situational
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-md-4 col-6 mb-2">
                                            <div class="form-check">
                                                <input type="checkbox" name="question_types[]" value="competency" class="form-check-input" id="type_competency">
                                                <label class="form-check-label" for="type_competency">
                                                    <i class="fas fa-star me-1" style="color: #10B981;"></i> Competency
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-md-4 col-6 mb-2">
                                            <div class="form-check">
                                                <input type="checkbox" name="question_types[]" value="case_study" class="form-check-input" id="type_case">
                                                <label class="form-check-label" for="type_case">
                                                    <i class="fas fa-briefcase me-1" style="color: #3B82F6;"></i> Case Study
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <small class="form-text text-muted">Leave empty to include all types</small>
                                </div>

                                <!-- Info Box -->
                                <div class="col-lg-12 mb-4">
                                    <div class="alert alert-info" style="border-left: 4px solid #3B82F6; background: #EFF6FF;">
                                        <div class="d-flex align-items-start">
                                            <i class="fas fa-info-circle fa-2x me-3" style="color: #3B82F6;"></i>
                                            <div>
                                                <h6 style="color: #1E40AF;">How it works:</h6>
                                                <ul class="mb-0 small" style="color: #1E3A8A;">
                                                    <li>Answer each question in your own words</li>
                                                    <li>Our AI analyzes your responses in real-time</li>
                                                    <li>Get instant feedback with scores and improvement tips</li>
                                                    <li>Review detailed analytics after completing the session</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Submit Buttons -->
                                <div class="col-lg-12">
                                    <div class="d-flex gap-2">
                                        <button type="submit" class="btn btn-primary btn-lg">
                                            <i class="fas fa-play me-2"></i>Start Practice Session
                                        </button>
                                        <a href="{{ route('member.interview-coach.index') }}" class="btn btn-outline-secondary btn-lg">
                                            <i class="fas fa-times me-2"></i>Cancel
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </section>

    @push('scripts')
    <script>
        // Show/hide custom question count based on session type
        document.querySelectorAll('input[name="session_type"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const customSection = document.getElementById('customQuestionCount');
                const topicsSection = document.getElementById('topicsSection');

                if (this.value === 'custom') {
                    customSection.style.display = 'block';
                } else {
                    customSection.style.display = 'none';
                }

                if (this.value === 'focused_topic') {
                    topicsSection.style.display = 'block';
                } else {
                    topicsSection.style.display = 'none';
                }

                // Auto-set question count based on type
                const questionCountInput = document.querySelector('input[name="question_count"]');
                if (this.value === 'quick_practice') {
                    questionCountInput.value = 5;
                } else if (this.value === 'full_mock') {
                    questionCountInput.value = 10;
                } else if (this.value === 'focused_topic') {
                    questionCountInput.value = 7;
                }
            });
        });

        // Visual feedback for radio button selection
        document.querySelectorAll('.btn-check').forEach(input => {
            input.addEventListener('change', function() {
                // Remove active class from all labels in the same group
                const group = this.closest('.row');
                if (group) {
                    group.querySelectorAll('.btn').forEach(btn => {
                        btn.style.borderColor = '';
                        btn.style.background = '';
                    });
                }

                // Add active styling to selected label
                const label = this.nextElementSibling;
                if (label && this.checked) {
                    label.style.borderColor = '#E91E8C';
                    label.style.background = 'linear-gradient(135deg, #FEE2E2 0%, #F3E8FF 100%)';
                }
            });
        });

        // Initialize first selection
        document.querySelector('input[name="session_type"]:checked')?.dispatchEvent(new Event('change'));
        document.querySelector('input[name="difficulty"]:checked')?.dispatchEvent(new Event('change'));
    </script>
    @endpush
@endsection
