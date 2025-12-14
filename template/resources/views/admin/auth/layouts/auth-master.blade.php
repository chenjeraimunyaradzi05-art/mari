<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" name="viewport">
  <title>Login &mdash; Athena</title>


  <!-- General CSS Files (local -> CDN fallback) -->
  @if (file_exists(public_path('admin/assets/modules/bootstrap/css/bootstrap.min.css')))
    <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap/css/bootstrap.min.css') }}">
  @else
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
  @endif

  <!-- Template CSS -->
  @if (file_exists(public_path('admin/assets/css/style.min.css')))
    <link rel="stylesheet" href="{{ asset('admin/assets/css/style.min.css') }}">
  @else
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    @if (file_exists(public_path('css/admin-fallback.css')))
      <link rel="stylesheet" href="{{ asset('css/admin-fallback.css') }}">
    @endif
  @endif

  {{-- Vite-built app styles + scripts (admin auth pages) --}}
  @if (class_exists('\\Illuminate\\Foundation\\Vite'))
    @vite(['resources/css/app.css', 'resources/js/app.js'])
  @else
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    <script src="{{ asset('js/app.js') }}" defer></script>
  @endif

</head>

<body>
  <div id="app">
    @yield('contents')
  </div>

  <!-- General JS Scripts -->
  @if (file_exists(public_path('admin/assets/modules/jquery.min.js')))
    <script src="{{ asset('admin/assets/modules/jquery.min.js') }}"></script>
  @else
    <script src="https://code.jquery.com/jquery-3.6.0.min.js" crossorigin="anonymous"></script>
  @endif

  @if (file_exists(public_path('admin/assets/modules/popper.js')))
    <script src="{{ asset('admin/assets/modules/popper.js') }}"></script>
  @else
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" crossorigin="anonymous"></script>
  @endif

  @if (file_exists(public_path('admin/assets/modules/bootstrap/js/bootstrap.min.js')))
    <script src="{{ asset('admin/assets/modules/bootstrap/js/bootstrap.min.js') }}"></script>
  @else
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.min.js" crossorigin="anonymous"></script>
  @endif

  <script>
    // Convert simple anchors on auth pages into button-like links for consistent admin look
    (function(){
      try{
        var sel = document.querySelectorAll('body a');
        sel.forEach(function(a){
          if(!a.classList.contains('btn') && !a.classList.contains('link-btn')){
            a.classList.add('link-btn');
            a.setAttribute('role','button');
            if(!a.hasAttribute('tabindex')) a.setAttribute('tabindex','0');
          }
        });
      }catch(e){console && console.warn && console.warn('auth link conversion failed', e)}
    })();
  </script>

</body>
</html>
