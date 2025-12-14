@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-10">
                <div class="text-center mb-30">
                    <h2 style="color: #E91E8C;">{{ $cv->title }}</h2>
                    <p class="text-muted">Preview of your resume</p>
                    <div class="d-flex justify-content-center gap-2 mt-20">
                        <a href="{{ route('member.cv-builder.edit', $cv->slug) }}" class="btn btn-sm btn-outline-primary" style="border-color: #E91E8C; color: #E91E8C;">
                            <i class="fas fa-edit me-1"></i>Edit
                        </a>
                        <a href="{{ route('member.cv-builder.download', $cv->slug) }}" class="btn btn-sm" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; border: none;">
                            <i class="fas fa-download me-1"></i>Download PDF
                        </a>
                        @if($cv->is_public)
                            <a href="{{ route('cv.share', $cv->share_token) }}" target="_blank" class="btn btn-sm btn-outline-secondary">
                                <i class="fas fa-share-alt me-1"></i>Public Link
                            </a>
                        @endif
                    </div>
                </div>

                {{-- CV Preview (same as share view but without social bar) --}}
                <div class="card shadow-sm">
                    <div class="card-header text-center" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; padding: 40px;">
                        <h3 class="mb-15">{{ $cv->candidate->user->name }}</h3>
                        <p class="mb-20 opacity-90">{{ $cv->professional_summary }}</p>
                        <div class="d-flex justify-content-center gap-3 flex-wrap">
                            @if($cv->email)
                                <span><i class="fas fa-envelope me-2"></i>{{ $cv->email }}</span>
                            @endif
                            @if($cv->phone)
                                <span><i class="fas fa-phone me-2"></i>{{ $cv->phone }}</span>
                            @endif
                            @if($cv->location)
                                <span><i class="fas fa-map-marker-alt me-2"></i>{{ $cv->location }}</span>
                            @endif
                        </div>
                    </div>

                    <div class="card-body p-4">
                        {{-- Work Experience --}}
                        @if(!empty($cv->work_experience) && count($cv->work_experience) > 0)
                        <div class="mb-30">
                            <h5 style="color: #E91E8C; border-bottom: 2px solid #E91E8C; padding-bottom: 10px;">
                                <i class="fas fa-briefcase me-2"></i>Work Experience
                            </h5>
                            @foreach($cv->work_experience as $exp)
                                <div class="mt-20">
                                    <h6>{{ $exp['position'] ?? 'Position' }}</h6>
                                    <p class="text-muted mb-10">
                                        {{ $exp['company'] ?? 'Company' }} |
                                        {{ $exp['start_date'] ?? '' }} - {{ $exp['end_date'] ?? 'Present' }}
                                    </p>
                                    @if(!empty($exp['description']))
                                        <p>{{ $exp['description'] }}</p>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                        @endif

                        {{-- Education --}}
                        @if(!empty($cv->education) && count($cv->education) > 0)
                        <div class="mb-30">
                            <h5 style="color: #E91E8C; border-bottom: 2px solid #E91E8C; padding-bottom: 10px;">
                                <i class="fas fa-graduation-cap me-2"></i>Education
                            </h5>
                            @foreach($cv->education as $edu)
                                <div class="mt-20">
                                    <h6>{{ $edu['degree'] ?? 'Degree' }}</h6>
                                    <p class="text-muted">{{ $edu['institution'] ?? 'Institution' }} | {{ $edu['year'] ?? '' }}</p>
                                </div>
                            @endforeach
                        </div>
                        @endif

                        {{-- Skills --}}
                        @if(!empty($cv->all_skills) && count($cv->all_skills) > 0)
                        <div class="mb-30">
                            <h5 style="color: #E91E8C; border-bottom: 2px solid #E91E8C; padding-bottom: 10px;">
                                <i class="fas fa-cogs me-2"></i>Skills
                            </h5>
                            <div class="mt-20">
                                @foreach($cv->all_skills as $skill)
                                    <span class="badge me-5 mb-10" style="background: linear-gradient(135deg, rgba(233, 30, 140, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid #E91E8C; color: #E91E8C; font-size: 14px;">
                                        {{ $skill }}
                                    </span>
                                @endforeach
                            </div>
                        </div>
                        @endif
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection
