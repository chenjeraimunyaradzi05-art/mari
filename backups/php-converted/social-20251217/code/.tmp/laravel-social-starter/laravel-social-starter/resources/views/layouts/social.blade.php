<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ $title ?? 'Social' }}</title>
  <link rel="stylesheet" href="{{ vite_asset('resources/css/social.css') }}">
  @vite(['resources/css/social.css','resources/js/social.js'])
</head>
<body class="bg-rose-25 text-midnight-900">
  <nav class="nav shadow-sm">
    <a href="{{ route('feed') }}" class="brand">mUse</a>
    <div class="spacer"></div>
    <a href="{{ route('post.create') }}" class="btn btn-primary">Compose</a>
  </nav>
  <main class="container">
    @if(session('ok')) <div class="alert ok">{{ session('ok') }}</div> @endif
    {{ $slot ?? '' }}
    @yield('content')
  </main>
</body>
</html>
