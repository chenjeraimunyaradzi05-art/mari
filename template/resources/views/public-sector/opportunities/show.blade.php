@extends('frontend.layouts.master')



@section('contents')
<div class="opportunity-hero">
    <div class="container">
        <p class="text-uppercase text-muted fw-semibold mb-1">{{ $opportunity->agency?->name }}</p>
        <h1 class="fw-bold" style="color:#2f1f33;">{{ $opportunity->title }}</h1>
        <p class="lead text-muted mb-0">{{ $opportunity->impact_statement ?? $opportunity->summary }}</p>
    </div>
</div>

<div class="py-5" style="background:#fdf7ff;">
    <div class="container">
        <div class="row g-4">
            <div class="col-lg-8">
                <article class="opportunity-card mb-4">
                    <h2 class="h4 fw-bold">Opportunity details</h2>
                    <ul class="list-unstyled row row-cols-2 g-3 mt-2">
                        <li class="col"><strong>Location:</strong> <span class="text-muted">{{ $opportunity->location }}</span></li>
                        <li class="col"><strong>Work style:</strong> <span class="text-muted">{{ $opportunity->work_arrangement ?? 'Hybrid' }}</span></li>
                        <li class="col"><strong>Salary band:</strong> <span class="text-muted">{{ $opportunity->salary_band ?? 'Negotiable' }}</span></li>
                        <li class="col"><strong>Closes:</strong> <span class="text-muted">{{ $opportunity->closes_at?->format('j M Y') ?? 'Rolling intake' }}</span></li>
                    </ul>
                    <p class="mt-3 text-muted">{{ $opportunity->summary }}</p>
                    @if($opportunity->program)
                        <div class="mt-4 p-3 rounded-4" style="background:rgba(168,85,247,0.08);">
                            <p class="text-uppercase small text-muted mb-1">Program</p>
                            <h3 class="h5 mb-1">{{ $opportunity->program->title }}</h3>
                            <p class="mb-0">{{ $opportunity->program->summary }}</p>
                        </div>
                    @endif
                    <div class="mt-4">
                        <p class="text-uppercase small text-muted mb-2">Tags</p>
                        <div class="d-flex flex-wrap gap-2">
                            @foreach(collect($opportunity->tags)->take(6) as $tag)
                                <span class="badge rounded-pill text-bg-light">#{{ \Illuminate\Support\Str::slug($tag, '-') }}</span>
                            @endforeach
                        </div>
                    </div>
                </article>

                <section class="opportunity-card">
                    <h2 class="h5 fw-bold">Related social moments</h2>
                    <div class="related-posts mt-3">
                        @forelse($relatedPosts as $post)
                            <article>
                                <p class="text-uppercase small text-muted mb-1">{{ $post->profile?->display_name }}</p>
                                <p class="mb-2">{{ \Illuminate\Support\Str::limit($post->caption, 140) }}</p>
                                <a href="{{ route('social.posts.show', $post) }}" class="fw-semibold">Open post <i class="fas fa-arrow-right"></i></a>
                            </article>
                        @empty
                            <p class="text-muted mb-0">No public sector posts tagged just yet—start sharing from the feed.</p>
                        @endforelse
                    </div>
                </section>
            </div>
            <div class="col-lg-4">
                <div class="ai-panel mb-4">
                    <p class="text-uppercase small mb-1 text-white-50">AI signal</p>
                    <h3 class="h4 fw-bold">{{ $aiSummary['tagline'] ?? 'Lead a national civic mission.' }}</h3>
                    <p class="mb-3">{{ $aiSummary['call_to_action'] ?? 'Share your intent now so the agency concierge can fast-track you.' }}</p>
                    <p class="small text-white-50 mb-2">{{ $aiSummary['momentum'] ?? 'Closes soon' }}</p>
                    <div>
                        @foreach($aiSummary['hashtags'] ?? [] as $tag)
                            <span class="tag">{{ $tag }}</span>
                        @endforeach
                    </div>
                </div>
                <div class="opportunity-card interest-form">
                    <h3 class="h5 fw-bold">Signal your interest</h3>
                    <form action="{{ route('public-sector.opportunities.interest.store', $opportunity) }}" method="POST">
                        @csrf
                        <div class="mb-3">
                            <label class="form-label" for="motivation">Motivation</label>
                            <textarea class="form-control" id="motivation" name="motivation" rows="3" placeholder="Share your impact thesis or procurement wins."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Preferred channels</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="channels[]" value="briefing" id="channel-briefing">
                                <label class="form-check-label" for="channel-briefing">Briefing call</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="channels[]" value="lab-invite" id="channel-lab">
                                <label class="form-check-label" for="channel-lab">Lab invite</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="channels[]" value="mentor-sync" id="channel-mentor">
                                <label class="form-check-label" for="channel-mentor">Mentor sync</label>
                            </div>
                        </div>
                        <button class="btn btn-primary w-100" type="submit" style="background:#a855f7;border-color:#a855f7;">Send intent</button>
                    </form>
                    @if(session('public_sector_interest_saved'))
                        <div class="alert alert-success mt-3 mb-0">Signal received. Our civic concierge will reply shortly.</div>
                    @endif
                </div>
                @if($opportunity->application_url)
                    <a class="btn btn-outline-primary w-100" href="{{ $opportunity->application_url }}" target="_blank" rel="noopener">Go to application</a>
                @endif
            </div>
        </div>
    </div>
</div>
@endsection

