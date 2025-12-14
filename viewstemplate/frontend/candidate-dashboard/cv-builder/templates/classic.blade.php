<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{ $cv->candidate->user->name }} - Resume</title>
    
</head>
<body>
    {{-- Header --}}
    <div class="header">
        <h1>{{ $cv->candidate->user->name }}</h1>
        <p>{{ $cv->professional_summary }}</p>
        <div class="contact">
            @if($cv->email){{ $cv->email }} | @endif
            @if($cv->phone){{ $cv->phone }} | @endif
            @if($cv->location){{ $cv->location }}@endif
        </div>
    </div>

    {{-- Work Experience --}}
    @if(!empty($cv->work_experience) && count($cv->work_experience) > 0)
    <div class="section">
        <div class="section-title">WORK EXPERIENCE</div>
        @foreach($cv->work_experience as $exp)
            <div class="item">
                <div class="item-title">{{ $exp['position'] ?? 'Position' }}</div>
                <div class="item-meta">
                    {{ $exp['company'] ?? 'Company' }} | 
                    {{ $exp['start_date'] ?? '' }} - {{ $exp['end_date'] ?? 'Present' }}
                </div>
                @if(!empty($exp['description']))
                    <p>{{ $exp['description'] }}</p>
                @endif
            </div>
        @endforeach
    </div>
    @endif

    {{-- Education --}}
    @if(!empty($cv->education) && count($cv->education) > 0)
    <div class="section">
        <div class="section-title">EDUCATION</div>
        @foreach($cv->education as $edu)
            <div class="item">
                <div class="item-title">{{ $edu['degree'] ?? 'Degree' }}</div>
                <div class="item-meta">
                    {{ $edu['institution'] ?? 'Institution' }} | {{ $edu['year'] ?? '' }}
                </div>
            </div>
        @endforeach
    </div>
    @endif

    {{-- Skills --}}
    @if(!empty($cv->all_skills) && count($cv->all_skills) > 0)
    <div class="section">
        <div class="section-title">SKILLS</div>
        <div>
            @foreach($cv->all_skills as $skill)
                <span class="skill-badge">{{ $skill }}</span>
            @endforeach
        </div>
    </div>
    @endif

    {{-- Certifications --}}
    @if(!empty($cv->certifications) && count($cv->certifications) > 0)
    <div class="section">
        <div class="section-title">CERTIFICATIONS</div>
        @foreach($cv->certifications as $cert)
            <div class="item">
                <div class="item-title">{{ $cert['name'] ?? 'Certification' }}</div>
                <div class="item-meta">{{ $cert['issuer'] ?? '' }} | {{ $cert['year'] ?? '' }}</div>
            </div>
        @endforeach
    </div>
    @endif

    {{-- Projects --}}
    @if(!empty($cv->projects) && count($cv->projects) > 0)
    <div class="section">
        <div class="section-title">PROJECTS</div>
        @foreach($cv->projects as $project)
            <div class="item">
                <div class="item-title">{{ $project['name'] ?? 'Project' }}</div>
                @if(!empty($project['description']))
                    <p>{{ $project['description'] }}</p>
                @endif
            </div>
        @endforeach
    </div>
    @endif

    {{-- Languages --}}
    @if(!empty($cv->languages) && count($cv->languages) > 0)
    <div class="section">
        <div class="section-title">LANGUAGES</div>
        <div>
            @foreach($cv->languages as $lang)
                <span class="skill-badge">
                    {{ $lang['name'] ?? 'Language' }} - {{ $lang['proficiency'] ?? 'Fluent' }}
                </span>
            @endforeach
        </div>
    </div>
    @endif
</body>
</html>

