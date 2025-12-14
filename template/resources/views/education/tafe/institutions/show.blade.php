@extends('frontend.layouts.master')

@php use Illuminate\Support\Str; @endphp

@section('contents')


<div class="container py-5">
    <div class="institution-hero mb-4">
        <div class="row align-items-center g-3">
            <div class="col-lg-8">
                <p class="text-uppercase text-muted small mb-1">{{ strtoupper($institution->institution_type) }} partner</p>
                <h1 class="fw-bold mb-2">{{ $institution->name }}</h1>
                <p class="lead mb-2">{{ $institution->tagline ?? 'Future-forward pathways for women.' }}</p>
                <p class="text-muted mb-0">{{ $institution->summary }}</p>
            </div>
            <div class="col-lg-4 text-lg-end">
                @if($institution->website_url)
                    <a href="{{ $institution->website_url }}" target="_blank" class="btn btn-lg" style="background: linear-gradient(120deg,#ec4899,#a855f7); color:#fff; border:none; border-radius: 16px;">Visit site</a>
                @endif
            </div>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-lg-8">
            <h4 class="fw-semibold mb-3">Programs</h4>
            <div class="row g-3">
                @forelse($programs as $program)
                    <div class="col-md-6">
                        <div class="program-chip">
                            <p class="text-uppercase text-muted small mb-1">{{ strtoupper(str_replace('_',' ', $program->credential_level)) }}</p>
                            <h5>{{ $program->title }}</h5>
                            <p class="text-muted small">{{ Str::limit($program->summary, 100) }}</p>
                            <a href="{{ route('education.tafe.programs.show', $program) }}" class="stretched-link text-decoration-none">View program →</a>
                        </div>
                    </div>
                @empty
                    <div class="col-12">
                        <p class="text-muted mb-0">No published programs yet.</p>
                    </div>
                @endforelse
            </div>
        </div>
        <div class="col-lg-4">
            <h4 class="fw-semibold mb-3">Social stories</h4>
            <div class="row g-3">
                @forelse($socialPosts as $post)
                    <div class="col-12">
                        <a href="{{ route('social.posts.show', $post) }}" class="text-decoration-none">
                            <div class="social-card" style="background-image: url('{{ optional($post->media->first())->url }}');">
                                <div class="social-card__body">
                                    <p class="small mb-1">{{ $post->profile->display_name ?? '@'.$post->profile->username }}</p>
                                    <p class="mb-0">{{ Str::limit($post->caption, 80) }}</p>
                                </div>
                            </div>
                        </a>
                    </div>
                @empty
                    <div class="col-12">
                        <p class="text-muted mb-0">No social posts yet.</p>
                    </div>
                @endforelse
            </div>
        </div>
    </div>
</div>
@endsection

