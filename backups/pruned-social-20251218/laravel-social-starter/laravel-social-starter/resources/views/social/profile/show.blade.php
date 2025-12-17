@extends('layouts.social')

@section('content')
<section class="profile">
  <div class="banner" style="background-image:url('{{ $profile->banner_path ? asset('storage/'.$profile->banner_path) : 'https://placehold.co/1200x280' }}')"></div>
  <div class="profile-inner">
    <img class="avatar-lg" src="{{ $profile->avatar_path ? asset('storage/'.$profile->avatar_path) : 'https://placehold.co/96x96' }}" alt="avatar">
    <div class="info">
      <h1>{{ $profile->display_name }}</h1>
      <p class="handle">@{{ $profile->handle }} · <span class="type">{{ ucfirst($profile->type) }}</span></p>
      @if($profile->bio) <p class="bio">{{ $profile->bio }}</p> @endif
      <form method="post" action="{{ route('profile.follow',$profile->handle) }}">
        @csrf
        <button class="btn btn-primary">Follow</button>
      </form>
    </div>
  </div>
</section>

<section class="grid">
  @foreach ($posts as $post)
    @include('social.partials.post-card', ['post' => $post])
  @endforeach
</section>
{{ $posts->links() }}
@endsection
