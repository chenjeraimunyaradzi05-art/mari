@extends('layouts.social')

@section('content')
<section class="grid">
  @foreach ($posts as $post)
    @include('social.partials.post-card', ['post' => $post])
  @endforeach
</section>

{{ $posts->links() }}
@endsection
