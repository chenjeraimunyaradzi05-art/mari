@extends('admin.layouts.master')

@section('contents')
<style>
    /* Custom Entertainment Dashboard Styles */
    .entertainment-stats-card {
        border: none;
        border-radius: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        transition: transform 0.3s ease;
        overflow: hidden;
        position: relative;
        background: #fff;
    }
    .entertainment-stats-card:hover {
        transform: translateY(-5px);
    }
    .entertainment-stats-card .card-body {
        padding: 25px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .stats-icon-wrapper {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
    }
    .stats-content h3 {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 5px;
        color: #333;
    }
    .stats-content p {
        margin: 0;
        color: #888;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 1px;
    }

    /* Content Grid Styles */
    .content-card {
        border: none;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0,0,0,0.05);
        transition: all 0.3s ease;
        background: #fff;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .content-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 15px 30px rgba(0,0,0,0.1);
    }
    .content-thumbnail {
        position: relative;
        padding-top: 56.25%; /* 16:9 Aspect Ratio */
        background-color: #f0f2f5;
        overflow: hidden;
    }
    .content-thumbnail img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s ease;
    }
    .content-card:hover .content-thumbnail img {
        transform: scale(1.05);
    }
    .content-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }
    .content-card:hover .content-overlay {
        opacity: 1;
    }
    .content-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        z-index: 2;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .content-details {
        padding: 20px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
    .content-title {
        font-size: 16px;
        font-weight: 700;
        color: #333;
        margin-bottom: 8px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .content-meta {
        font-size: 12px;
        color: #999;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .content-desc {
        font-size: 13px;
        color: #666;
        line-height: 1.6;
        margin-bottom: 15px;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        flex-grow: 1;
    }
    .content-footer {
        border-top: 1px solid #f0f0f0;
        padding-top: 15px;
        margin-top: auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .status-dot {
        height: 8px;
        width: 8px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 5px;
    }

    /* Theme Colors */
    .bg-soft-primary { background: rgba(103, 119, 239, 0.1); color: #6777ef; }
    .bg-soft-danger { background: rgba(252, 84, 75, 0.1); color: #fc544b; }
    .bg-soft-warning { background: rgba(255, 164, 38, 0.1); color: #ffa426; }
    .bg-soft-success { background: rgba(71, 195, 99, 0.1); color: #47c363; }

    .badge-movie { background: #6777ef; color: #fff; }
    .badge-video { background: #fc544b; color: #fff; }
    .badge-edu { background: #47c363; color: #fff; }
    .badge-doc { background: #ffa426; color: #fff; }

    .btn-action {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        color: #333;
        transition: all 0.2s;
    }
    .btn-action:hover {
        background: #6777ef;
        color: #fff;
    }
    .btn-action.delete:hover {
        background: #fc544b;
    }
</style>

<section class="section">
    <div class="section-header border-0 bg-transparent px-0 pb-4">
        <div class="d-flex justify-content-between align-items-center w-100">
            <div>
                <h1 class="mb-2" style="font-size: 24px; color: #333;">Entertainment Hub</h1>
                <p class="text-muted mb-0">Manage your streaming content, movies, and educational videos.</p>
            </div>
            <div>
                <a href="{{ route('admin.entertainment.create') }}" class="btn btn-primary btn-lg px-4 shadow-sm rounded-pill">
                    <i class="fas fa-cloud-upload-alt mr-2"></i> Upload Content
                </a>
            </div>
        </div>
    </div>

    <!-- Modern Stats Row -->
    <div class="row mb-5">
        <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
            <div class="entertainment-stats-card">
                <div class="card-body">
                    <div class="stats-content">
                        <h3>{{ $totalContent }}</h3>
                        <p>Total Assets</p>
                    </div>
                    <div class="stats-icon-wrapper bg-soft-primary">
                        <i class="fas fa-photo-video"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
            <div class="entertainment-stats-card">
                <div class="card-body">
                    <div class="stats-content">
                        <h3>{{ $shortVideos }}</h3>
                        <p>Shorts</p>
                    </div>
                    <div class="stats-icon-wrapper bg-soft-danger">
                        <i class="fab fa-youtube"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
            <div class="entertainment-stats-card">
                <div class="card-body">
                    <div class="stats-content">
                        <h3>{{ $movies }}</h3>
                        <p>Movies</p>
                    </div>
                    <div class="stats-icon-wrapper bg-soft-warning">
                        <i class="fas fa-film"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12 mb-4">
            <div class="entertainment-stats-card">
                <div class="card-body">
                    <div class="stats-content">
                        <h3>{{ $educational }}</h3>
                        <p>Learning</p>
                    </div>
                    <div class="stats-icon-wrapper bg-soft-success">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="section-body">
        @if(session('success'))
            <div class="alert alert-success alert-dismissible show fade mb-4 border-0 shadow-sm">
                <div class="alert-body">
                    <button class="close" data-dismiss="alert">
                        <span>&times;</span>
                    </button>
                    <i class="fas fa-check-circle mr-2"></i> {{ session('success') }}
                </div>
            </div>
        @endif

        @if(session('error'))
            <div class="alert alert-danger alert-dismissible show fade mb-4 border-0 shadow-sm">
                <div class="alert-body">
                    <button class="close" data-dismiss="alert">
                        <span>&times;</span>
                    </button>
                    <i class="fas fa-exclamation-circle mr-2"></i> {{ session('error') }}
                </div>
            </div>
        @endif

        <!-- Content Grid -->
        <div class="row">
            @forelse($posts as $post)
                <div class="col-12 col-md-6 col-lg-4 col-xl-3 mb-4">
                    <div class="content-card">
                        <div class="content-thumbnail">
                            @php
                                $badgeClass = 'badge-primary';
                                if($post->post_type == 'movie') $badgeClass = 'badge-movie';
                                elseif($post->post_type == 'short_video') $badgeClass = 'badge-video';
                                elseif($post->post_type == 'educational') $badgeClass = 'badge-edu';
                                elseif($post->post_type == 'documentary') $badgeClass = 'badge-doc';
                            @endphp
                            <span class="content-badge {{ $badgeClass }}">
                                {{ ucfirst(str_replace('_', ' ', $post->post_type)) }}
                            </span>

                            @if($post->media->first() && $post->media->first()->thumbnail_path)
                                <img src="{{ asset($post->media->first()->thumbnail_path) }}" alt="{{ $post->caption }}">
                            @else
                                <div class="d-flex align-items-center justify-content-center h-100 w-100 bg-light text-muted">
                                    <i class="fas fa-video fa-3x"></i>
                                </div>
                            @endif

                            <div class="content-overlay">
                                <a href="{{ route('admin.entertainment.edit', $post->id) }}" class="btn-action" title="Edit">
                                    <i class="fas fa-pen"></i>
                                </a>
                                <form action="{{ route('admin.entertainment.destroy', $post->id) }}" method="POST" class="d-inline" onsubmit="return confirm('Delete this content?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="btn-action delete" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div class="content-details">
                            <h4 class="content-title" title="{{ $post->caption }}">{{ $post->caption }}</h4>
                            <div class="content-meta">
                                <span><i class="far fa-calendar-alt mr-1"></i> {{ $post->created_at->format('M d, Y') }}</span>
                                @if(isset($post->meta['duration']))
                                    <span><i class="far fa-clock mr-1"></i> {{ gmdate("i:s", $post->meta['duration']) }}</span>
                                @endif
                            </div>
                            <p class="content-desc">
                                {{ $post->content ?? 'No description provided.' }}
                            </p>

                            <div class="content-footer">
                                <div class="status">
                                    @if($post->moderation_status === 'approved')
                                        <span class="text-success font-weight-bold" style="font-size: 12px;">
                                            <span class="status-dot bg-success"></span> Published
                                        </span>
                                    @else
                                        <span class="text-warning font-weight-bold" style="font-size: 12px;">
                                            <span class="status-dot bg-warning"></span> {{ ucfirst($post->moderation_status) }}
                                        </span>
                                    @endif
                                </div>
                                <div class="shares">
                                    <!-- Placeholder for share count if available -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="card border-0 shadow-sm py-5">
                        <div class="card-body text-center">
                            <div class="mb-3">
                                <i class="fas fa-film fa-4x text-muted opacity-50"></i>
                            </div>
                            <h4>No Content Found</h4>
                            <p class="text-muted">Get started by uploading your first video or movie.</p>
                            <a href="{{ route('admin.entertainment.create') }}" class="btn btn-primary mt-3">
                                <i class="fas fa-plus mr-2"></i> Upload Content
                            </a>
                        </div>
                    </div>
                </div>
            @endforelse
        </div>

        <div class="mt-4 d-flex justify-content-center">
            {{ $posts->links() }}
        </div>
    </div>
</section>
@endsection

