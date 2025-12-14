@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Profile Completion Assistant</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li>Profile Completion</li>
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
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h3 class="mt-0 mb-0 color-brand-1">Profile Completion Assistant</h3>
                            <span class="badge" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); font-size: 18px; padding: 10px 20px;">
                                {{ $completion['level'] }}
                            </span>
                        </div>

                        <!-- AI Assistant Banner -->
                        <div class="alert alert-info mb-4" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border: none; color: white; border-radius: 15px;">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-robot fa-3x me-3"></i>
                                <div>
                                    <h5 class="mb-1" style="color: white;">AI-Powered Profile Assistant</h5>
                                    <p class="mb-0">Complete your profile to unlock personalized job recommendations and increase your visibility to employers by up to 40%!</p>
                                </div>
                            </div>
                        </div>

                        <!-- Profile Completion Progress -->
                        <div class="card mb-4" style="border: 2px solid #E91E8C; border-radius: 15px;">
                            <div class="card-body text-center p-5">
                                <h4 class="mb-4" style="color: #E91E8C;">Your Profile is {{ $completion['percentage'] }}% Complete</h4>

                                <!-- Progress Circle -->
                                <div class="position-relative d-inline-block mb-4">
                                    <svg width="200" height="200" style="transform: rotate(-90deg);">
                                        <circle cx="100" cy="100" r="90" fill="none" stroke="#F5F3FF" stroke-width="12"/>
                                        <circle cx="100" cy="100" r="90" fill="none" stroke="url(#gradient)" stroke-width="12"
                                                stroke-dasharray="{{ 2 * 3.14159 * 90 }}"
                                                stroke-dashoffset="{{ 2 * 3.14159 * 90 * (1 - $completion['percentage'] / 100) }}"
                                                stroke-linecap="round"
                                                style="transition: stroke-dashoffset 1s ease;"/>
                                        <defs>
                                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" style="stop-color:#E91E8C;stop-opacity:1" />
                                                <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div class="position-absolute top-50 start-50 translate-middle">
                                        <div style="font-size: 48px; font-weight: bold; color: #E91E8C;">{{ $completion['percentage'] }}%</div>
                                        <div style="color: #8B5CF6; font-weight: 600;">Complete</div>
                                    </div>
                                </div>

                                <p class="text-muted mb-3">{{ $completion['complete_sections'] }} of {{ $completion['total_sections'] }} sections completed</p>

                                @if($completion['percentage'] >= 100)
                                    <div class="alert alert-success mt-3">
                                        <i class="fas fa-trophy me-2"></i>
                                        <strong>Congratulations!</strong> Your profile is complete! You now have access to all premium features.
                                    </div>
                                @endif
                            </div>
                        </div>

                        <!-- Completion Benefits -->
                        <div class="card mb-4" style="border-radius: 15px;">
                            <div class="card-header" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; border-radius: 15px 15px 0 0;">
                                <h5 class="mb-0"><i class="fas fa-gift me-2"></i>Unlock Rewards as You Progress</h5>
                            </div>
                            <div class="card-body">
                                <div class="timeline">
                                    @foreach($benefits as $benefit)
                                        @php
                                            $achieved = $completion['percentage'] >= $benefit['threshold'];
                                            $bgColor = $achieved ? 'background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;' : 'background: #F5F3FF; color: #666;';
                                        @endphp
                                        <div class="timeline-item mb-3">
                                            <div class="d-flex align-items-center">
                                                <div class="rounded-circle p-3 me-3" style="{{ $bgColor }} width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
                                                    <i class="{{ $benefit['icon'] }} fa-lg"></i>
                                                </div>
                                                <div class="flex-grow-1">
                                                    <div class="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <h6 class="mb-1" style="color: {{ $achieved ? '#E91E8C' : '#666' }};">{{ $benefit['title'] }}</h6>
                                                            <p class="mb-0 small text-muted">{{ $benefit['description'] }}</p>
                                                        </div>
                                                        <div class="text-end">
                                                            <span class="badge {{ $achieved ? 'bg-success' : 'bg-secondary' }}">
                                                                {{ $benefit['threshold'] }}%
                                                            </span>
                                                            @if($achieved)
                                                                <div class="small text-success mt-1">
                                                                    <i class="fas fa-check-circle"></i> Unlocked
                                                                </div>
                                                            @endif
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </div>

                        <!-- Profile Sections -->
                        <div class="row mb-4">
                            @foreach($completion['sections'] as $section)
                                @php
                                    $sectionComplete = $section['is_complete'];
                                    $borderColor = $sectionComplete ? '#10B981' : '#E91E8C';
                                    $bgColor = $sectionComplete ? '#D1FAE5' : '#FEE2E2';
                                @endphp
                                <div class="col-md-6 mb-3">
                                    <div class="card h-100" style="border: 2px solid {{ $borderColor }}; border-radius: 15px;">
                                        <div class="card-body">
                                            <div class="d-flex align-items-start">
                                                <div class="rounded-circle p-3 me-3" style="background: {{ $bgColor }}; color: {{ $borderColor }};">
                                                    <i class="{{ $section['icon'] }} fa-lg"></i>
                                                </div>
                                                <div class="flex-grow-1">
                                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                                        <h6 class="mb-0">{{ $section['title'] }}</h6>
                                                        @if($sectionComplete)
                                                            <span class="badge bg-success">
                                                                <i class="fas fa-check-circle"></i> Complete
                                                            </span>
                                                        @else
                                                            <span class="badge" style="background: #E91E8C;">
                                                                {{ $section['weight'] }}% Weight
                                                            </span>
                                                        @endif
                                                    </div>
                                                    <p class="small text-muted mb-2">{{ $section['description'] }}</p>

                                                    @if(!$sectionComplete)
                                                        <a href="{{ $section['action_url'] }}" class="btn btn-sm btn-outline-primary">
                                                            <i class="fas fa-edit me-1"></i>Complete Now
                                                        </a>
                                                    @endif
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <!-- AI Suggestions -->
                        @if(count($suggestions) > 0)
                            <div class="card" style="border-radius: 15px;">
                                <div class="card-header" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; border-radius: 15px 15px 0 0;">
                                    <h5 class="mb-0"><i class="fas fa-lightbulb me-2"></i>AI-Powered Suggestions</h5>
                                </div>
                                <div class="card-body">
                                    <div class="list-group list-group-flush">
                                        @foreach($suggestions as $index => $suggestion)
                                            <div class="list-group-item border-0 {{ $index > 0 ? 'border-top' : '' }} px-0">
                                                <div class="d-flex align-items-start">
                                                    <div class="rounded-circle p-2 me-3" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                                        {{ $index + 1 }}
                                                    </div>
                                                    <div class="flex-grow-1">
                                                        <div class="d-flex justify-content-between align-items-start">
                                                            <div>
                                                                <h6 class="mb-1" style="color: #E91E8C;">{{ $suggestion['title'] }}</h6>
                                                                <p class="mb-2 text-muted">{{ $suggestion['description'] }}</p>

                                                                @if($suggestion['type'] === 'skill_suggestions')
                                                                    <button class="btn btn-sm btn-outline-primary" onclick="loadSkillSuggestions()">
                                                                        <i class="fas fa-magic me-1"></i>Get AI Skill Suggestions
                                                                    </button>
                                                                @elseif($suggestion['type'] === 'bio_suggestions')
                                                                    <button class="btn btn-sm btn-outline-primary" onclick="loadBioSuggestions()">
                                                                        <i class="fas fa-magic me-1"></i>Generate AI Bio
                                                                    </button>
                                                                @else
                                                                    <a href="{{ $suggestion['action_url'] }}" class="btn btn-sm btn-outline-primary">
                                                                        <i class="fas fa-arrow-right me-1"></i>Complete This
                                                                    </a>
                                                                @endif
                                                            </div>
                                                            <span class="badge" style="background: {{ $suggestion['priority_color'] }};">
                                                                Priority: {{ ucfirst($suggestion['priority']) }}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                </div>
                            </div>
                        @endif

                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Skill Suggestions Modal -->
    <div class="modal fade" id="skillSuggestionsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content" style="border-radius: 15px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; border-radius: 15px 15px 0 0;">
                    <h5 class="modal-title"><i class="fas fa-magic me-2"></i>AI Skill Suggestions</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div id="skillSuggestionsContent">
                        <div class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-2 text-muted">AI is analyzing your profile...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Bio Suggestions Modal -->
    <div class="modal fade" id="bioSuggestionsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content" style="border-radius: 15px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; border-radius: 15px 15px 0 0;">
                    <h5 class="modal-title"><i class="fas fa-magic me-2"></i>AI Bio Suggestions</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div id="bioSuggestionsContent">
                        <div class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-2 text-muted">AI is generating personalized bio suggestions...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    @push('scripts')
    <script>
        function loadSkillSuggestions() {
            const modal = new bootstrap.Modal(document.getElementById('skillSuggestionsModal'));
            modal.show();

            fetch('{{ route("member.profile-completion.suggest-skills") }}')
                .then(response => response.json())
                .then(data => {
                    const content = document.getElementById('skillSuggestionsContent');
                    if (data.skills && data.skills.length > 0) {
                        let html = '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>Based on your experience, we suggest adding these skills:</div>';
                        html += '<div class="row">';
                        data.skills.forEach(skill => {
                            html += `
                                <div class="col-md-6 mb-2">
                                    <div class="d-flex align-items-center p-3" style="background: #F5F3FF; border-radius: 10px;">
                                        <i class="fas fa-plus-circle me-2" style="color: #E91E8C;"></i>
                                        <strong>${skill}</strong>
                                    </div>
                                </div>
                            `;
                        });
                        html += '</div>';
                        html += '<div class="mt-3 text-center"><a href="{{ route("member.profile.index") }}#skills" class="btn btn-primary">Add Skills to Profile</a></div>';
                        content.innerHTML = html;
                    } else {
                        content.innerHTML = '<div class="alert alert-warning">No suggestions available. Complete your work experience first!</div>';
                    }
                })
                .catch(error => {
                    document.getElementById('skillSuggestionsContent').innerHTML = '<div class="alert alert-danger">Error loading suggestions</div>';
                });
        }

        function loadBioSuggestions() {
            const modal = new bootstrap.Modal(document.getElementById('bioSuggestionsModal'));
            modal.show();

            fetch('{{ route("member.profile-completion.suggest-bio") }}')
                .then(response => response.json())
                .then(data => {
                    const content = document.getElementById('bioSuggestionsContent');
                    if (data.suggestions && data.suggestions.length > 0) {
                        let html = '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>Choose a bio template and customize it:</div>';
                        data.suggestions.forEach((suggestion, index) => {
                            html += `
                                <div class="card mb-3" style="border: 2px solid #E91E8C; border-radius: 10px;">
                                    <div class="card-body">
                                        <h6 style="color: #8B5CF6;"><i class="fas fa-star me-2"></i>${suggestion.title}</h6>
                                        <p class="text-muted mb-3">${suggestion.content}</p>
                                        <button class="btn btn-sm btn-outline-primary" onclick="copyBio('${suggestion.content.replace(/'/g, "\\'")}')">
                                            <i class="fas fa-copy me-1"></i>Copy This Bio
                                        </button>
                                    </div>
                                </div>
                            `;
                        });
                        html += '<div class="text-center"><a href="{{ route("member.profile.index") }}#bio" class="btn btn-primary">Edit Bio in Profile</a></div>';
                        content.innerHTML = html;
                    } else {
                        content.innerHTML = '<div class="alert alert-warning">Complete your basic info and experience first to get personalized bio suggestions!</div>';
                    }
                })
                .catch(error => {
                    document.getElementById('bioSuggestionsContent').innerHTML = '<div class="alert alert-danger">Error loading suggestions</div>';
                });
        }

        function copyBio(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Bio copied to clipboard! Paste it in your profile.');
            });
        }
    </script>
    @endpush
@endsection
