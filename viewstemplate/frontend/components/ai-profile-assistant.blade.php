{{-- AI Profile Completion Assistant --}}
@php
    $candidate = auth()->user()->candidate;
    $profileScore = $candidate?->profile_score ?? 0;
    $completionItems = [];

    // Only show if candidate exists
    if ($candidate) {
        // Check what's missing
        if (!$candidate->profile_video_path) {
            $completionItems[] = [
                'icon' => 'video',
                'title' => 'Add Professional Video',
                'description' => '+20% to profile score',
                'priority' => 'high',
                'action' => route('member.profile.index') . '#pills-video-tab',
                'points' => 20
            ];
        }

        if (!$candidate->personality_video_path) {
            $completionItems[] = [
                'icon' => 'heart',
                'title' => 'Add Personality Video',
                'description' => '+15% to profile score',
                'priority' => 'high',
                'action' => route('member.profile.index') . '#pills-video-tab',
                'points' => 15
            ];
        }

        if ($candidate->skills && $candidate->skills->count() < 5) {
            $completionItems[] = [
                'icon' => 'star',
                'title' => 'Add 5+ Skills',
                'description' => '+10% to profile score',
                'priority' => 'medium',
                'action' => route('member.profile.index') . '#pills-profile-tab',
                'points' => 10
            ];
        }

        if ($candidate->experiences && $candidate->experiences->count() < 1) {
            $completionItems[] = [
                'icon' => 'briefcase',
                'title' => 'Add Work Experience',
                'description' => '+15% to profile score',
                'priority' => 'medium',
                'action' => route('member.profile.index') . '#pills-experience-tab',
                'points' => 15
            ];
        }

        if (!$candidate->cv_path) {
        $completionItems[] = [
            'icon' => 'file-pdf',
            'title' => 'Upload Your CV',
            'description' => '+10% to profile score',
            'priority' => 'high',
            'action' => route('member.resume-parser.index'),
            'points' => 10
        ];
    }

    if (!$candidate->bio || strlen($candidate->bio) < 100) {
        $completionItems[] = [
            'icon' => 'align-left',
            'title' => 'Complete Your Bio',
            'description' => '+5% to profile score',
            'priority' => 'low',
            'action' => route('member.profile.index') . '#pills-profile-tab',
            'points' => 5
        ];
    }
    }

    $potentialScore = $profileScore + collect($completionItems)->sum('points');
@endphp

@if(count($completionItems) > 0)
<div class="ai-profile-assistant card border-0 shadow-sm" style="border-left: 4px solid #E91E8C !important;">
    <div class="card-body p-4">
        <!-- Header -->
        <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="d-flex align-items-center">
                <div class="me-3" style="width: 45px; height: 45px; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-chart-line" style="color: white;"></i>
                </div>
                <div>
                    <h5 class="mb-0" style="color: #05264E;">Profile Strength</h5>
                    <small class="text-muted">Complete your profile to increase visibility</small>
                </div>
            </div>
            <div class="text-end">
                <h3 class="mb-0" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    {{ $profileScore }}%
                </h3>
                <small class="text-muted">Current Score</small>
            </div>
        </div>

        <!-- Progress Bar -->
        <div class="mb-4">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span style="font-size: 13px; color: #666;">Your Progress</span>
                <span style="font-size: 13px; font-weight: 600; color: #E91E8C;">
                    Potential: {{ min($potentialScore, 100) }}%
                </span>
            </div>
            <div class="progress" style="height: 12px; border-radius: 10px; background: #F0F0F0;">
                <div class="progress-bar" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); width: {{ $profileScore }}%; transition: width 0.6s ease;"></div>
                <div class="progress-bar progress-bar-striped" style="background: linear-gradient(135deg, rgba(233, 30, 140, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%); width: {{ min($potentialScore - $profileScore, 100 - $profileScore) }}%; transition: width 0.6s ease;"></div>
            </div>
        </div>

        <!-- AI Suggestions -->
        <div class="ai-suggestions">
            <h6 class="mb-3" style="color: #05264E;">
                <i class="fas fa-lightbulb me-2" style="color: #E91E8C;"></i>
                AI-Recommended Actions ({{ count($completionItems) }})
            </h6>

            <div class="suggestions-list">
                @foreach($completionItems as $index => $item)
                <div class="suggestion-item mb-3 p-3"
                     style="background: {{ $item['priority'] === 'high' ? '#FFF5F8' : ($item['priority'] === 'medium' ? '#F5F3FF' : '#F0F9FF') }};
                            border-radius: 10px;
                            border-left: 3px solid {{ $item['priority'] === 'high' ? '#E91E8C' : ($item['priority'] === 'medium' ? '#8B5CF6' : '#3B82F6') }};
                            transition: all 0.3s ease;"
                     onmouseover="this.style.transform='translateX(5px)'; this.style.boxShadow='0 3px 10px rgba(0,0,0,0.1)'"
                     onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none'">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center flex-grow-1">
                            <div class="me-3" style="width: 35px; height: 35px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-{{ $item['icon'] }}" style="color: {{ $item['priority'] === 'high' ? '#E91E8C' : ($item['priority'] === 'medium' ? '#8B5CF6' : '#3B82F6') }};"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-1">
                                    <strong style="font-size: 14px; color: #05264E;">{{ $item['title'] }}</strong>
                                    <span class="badge ms-2" style="background: {{ $item['priority'] === 'high' ? '#E91E8C' : ($item['priority'] === 'medium' ? '#8B5CF6' : '#3B82F6') }}; font-size: 10px;">
                                        +{{ $item['points'] }}%
                                    </span>
                                </div>
                                <p class="mb-0 text-muted" style="font-size: 12px;">{{ $item['description'] }}</p>
                            </div>
                        </div>
                        <a href="{{ $item['action'] }}"
                           class="btn btn-sm ms-3"
                           style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; font-size: 12px; white-space: nowrap;">
                            Complete <i class="fas fa-arrow-right ms-1"></i>
                        </a>
                    </div>
                </div>
                @endforeach
            </div>
        </div>

        <!-- Footer Tips -->
        <div class="mt-4 p-3" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%); border-radius: 10px;">
            <div class="d-flex align-items-center">
                <i class="fas fa-info-circle me-2" style="color: #8B5CF6;"></i>
                <small class="text-muted mb-0">
                    <strong>Pro Tip:</strong> Profiles above 80% get 5x more job matches and 3x more interview invites!
                </small>
            </div>
        </div>
    </div>
</div>
@endif



