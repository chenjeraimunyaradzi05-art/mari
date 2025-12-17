@extends('frontend.layouts.master')
@section('contents')

<section class="section-box mt-75">
    <div class="container">
        <h2 class="mb-20" style="color:#d50060;font-weight:bold;">Activity Feed</h2>
        <div class="row">
            @foreach ($posts as $post)
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5>User: {{ $post->user_id }}</h5>
                            <p>{{ $post->content }}</p>
                            @if ($post->media)
                                <img src="{{ asset('storage/' . $post->media) }}" class="img-fluid mb-2" />
                            @endif
                            <span class="badge bg-success">{{ $post->type }}</span>
                            <span class="badge bg-info">{{ $post->visibility }}</span>
                            <form method="POST" action="{{ route('posts.destroy', $post->id) }}">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger mt-2">Delete</button>
                            </form>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </div>
</section>
@endsection

