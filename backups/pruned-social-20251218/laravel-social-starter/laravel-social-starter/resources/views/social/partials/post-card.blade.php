@php
  $author = $post->author;
@endphp
<article class="card">
  <header class="card-h">
    <img class="avatar" src="{{ $author->avatar_path ? asset('storage/'.$author->avatar_path) : 'https://placehold.co/48x48' }}" alt="avatar">
    <div class="meta">
      <a class="handle" href="{{ route('profile.show', $author->handle) }}">{{ $author->display_name }}</a>
      <time class="time">{{ $post->created_at->diffForHumans() }}</time>
    </div>
  </header>

  @if ($post->media_type === 'image' && $post->media_path)
    <img class="media" src="{{ asset('storage/'.$post->media_path) }}" alt="post media">
  @elseif ($post->media_type === 'video' && $post->media_path)
    <video class="media" src="{{ asset('storage/'.$post->media_path) }}" autoplay muted loop playsinline controls></video>
  @endif

  <div class="card-b">
    @if($post->ai_caption)
      <p class="caption">{{ $post->ai_caption }}</p>
    @endif
    @if($post->body)
      <p class="body">{{ $post->body }}</p>
    @endif
    @if($post->ai_tags)
      <p class="tags">
        @foreach($post->ai_tags as $tag) <span class="tag">#{{ $tag }}</span> @endforeach
      </p>
    @endif
  </div>

  <footer class="card-f">
    <form class="react" method="post" action="{{ route('reaction.store',$post) }}">
      @csrf
      <button name="type" value="like" class="icon">👍</button>
      <button name="type" value="heart" class="icon">💖</button>
      <button name="type" value="support" class="icon">🙌</button>
      <span class="count">{{ $post->reactions->count() }}</span>
    </form>
    <details class="comments">
      <summary>Comments ({{ $post->comments->count() }})</summary>
      <ul>
        @foreach($post->comments as $c)
          <li>
            <strong>{{ $c->user->name }}</strong> {{ $c->body }}
            <time>{{ $c->created_at->diffForHumans() }}</time>
          </li>
        @endforeach
      </ul>
      <form method="post" action="{{ route('comment.store',$post) }}">
        @csrf
        <input type="text" name="body" placeholder="Add a comment…" required maxlength="1000">
      </form>
    </details>
  </footer>
</article>
