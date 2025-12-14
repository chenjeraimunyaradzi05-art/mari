<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" name="viewport">
    <title>General Dashboard &mdash; Athena</title>

    <!-- General CSS Files (local -> CDN fallback) -->
    @if (file_exists(public_path('admin/assets/modules/bootstrap/css/bootstrap.min.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap/css/bootstrap.min.css') }}">
    @else
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
    @endif

    @if (file_exists(public_path('admin/assets/modules/fontawesome/css/all.min.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/modules/fontawesome/css/all.min.css') }}">
    @else
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    @endif

    <!-- CSS Libraries (local -> CDN fallback) -->
    @if (file_exists(public_path('admin/assets/modules/select2/dist/css/select2.min.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/modules/select2/dist/css/select2.min.css') }}">
    @else
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css">
    @endif

    @if (file_exists(public_path('admin/assets/css/bootstrap-iconpicker.min.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/css/bootstrap-iconpicker.min.css') }}">
    @endif

    @if (file_exists(public_path('admin/assets/modules/bootstrap-daterangepicker/daterangepicker.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap-daterangepicker/daterangepicker.css') }}">
    @else
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css" />
    @endif

    @if (file_exists(public_path('admin/assets/modules/bootstrap-tagsinput/dist/bootstrap-tagsinput.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap-tagsinput/dist/bootstrap-tagsinput.css') }}">
    @endif

    <!-- Template CSS -->
    @if (file_exists(public_path('admin/assets/css/style.min.css')))
        <link rel="stylesheet" href="{{ asset('admin/assets/css/style.min.css') }}">
        <link rel="stylesheet" href="{{ asset('admin/assets/css/components.min.css') }}">
    @else
        {{-- fallback to the compiled app CSS (Tailwind-based) to provide base styling when admin assets are absent --}}
        <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    @endif

    <!-- Feminine Theme Overrides (legacy) -->
    <link rel="stylesheet" href="{{ asset('admin/assets/css/feminine-overrides.css') }}?v={{ time() }}">

    {{-- Include compiled app CSS/JS via Vite (provides main CSS and JS for admin layout) --}}
    @if (class_exists('\\Illuminate\\Foundation\\Vite'))
        @vite(['resources/css/app.css', 'resources/js/app.js'])
        {{-- load the admin fallback styles too when present so the admin pages keep a consistent Athena UI even without legacy theme assets --}}
        @if (file_exists(public_path('css/admin-fallback.css')))
            <link rel="stylesheet" href="{{ asset('css/admin-fallback.css') }}">
        @endif
    @else
        {{-- Fallback: if Vite helper isn't available, include compiled CSS/JS by public assets path (optional) --}}
        <link rel="stylesheet" href="{{ asset('css/app.css') }}">
        {{-- Small, targeted fallback for admin-specific UI that reproduces key Athena patterns when admin assets are absent --}}
        @if (file_exists(public_path('css/admin-fallback.css')))
            <link rel="stylesheet" href="{{ asset('css/admin-fallback.css') }}">
        @endif
        <script src="{{ asset('js/app.js') }}" defer></script>
    @endif

    <style>
        /* Compact Header & Dashboard Optimizations */
        body {
            background: transparent; /* use Athena palette from fallback CSS */
        }

        /* navbar-bg rendered behind the header — visual background is provided by fallback.css */
        .navbar-bg {
            height: 82px !important;
            background: transparent !important;
            box-shadow: none !important;
        }

        /* main-navbar uses the Athena background provided by fallback.css; keep fixed positioning and spacing aligned */
        .main-navbar {
            background: transparent !important;
            height: 82px !important;
            min-height: 82px !important;
            left: 250px !important; /* Align with sidebar */
            width: calc(100% - 250px) !important;
            position: fixed !important;
            top: 0;
            padding: 0 28px !important;
            box-shadow: none !important;
            z-index: 901;
            display:flex;align-items:center;
        }

        /* Sidebar adjustments — fall back to theme-driven background (dark) */
        .main-sidebar {
            box-shadow: none !important;
            border-right: 1px solid rgba(255,255,255,0.03) !important;
            padding-top: 18px !important; /* smaller top padding */
            top: 0 !important;
            height: 100vh !important;
            position: fixed !important;
            z-index: 891;
            background: transparent !important;
        }

        .main-sidebar .sidebar-brand {
            margin-bottom: 20px;
            line-height: 82px;
            height: 82px;
            padding-left: 16px;
            padding-right: 16px;
        }

        /* Content area adjustments */
        .main-content {
            padding-top: 120px !important; /* 82px header + comfortable gap */
            padding-left: 280px !important;
            padding-right: 30px !important;
        }

        /* Navbar items styling */
        .navbar .nav-link {
            color: rgba(230,238,246,0.85) !important;
            height: 82px !important;
            line-height: 82px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            font-weight: 600;
        }

        .navbar .nav-link:hover {
            color: #E91E8C !important;
        }

        .navbar .nav-link.nav-link-user img {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        /* Hide the sidebar toggle on desktop since we fixed the layout */
        @media (min-width: 1024px) {
            .navbar .nav-link[data-toggle="sidebar"] {
                display: none !important;
            }
        }

        /* Mobile responsiveness */
        @media (max-width: 1024px) {
            .main-navbar {
                left: 0 !important;
                width: 100% !important;
            }
            .main-content {
                padding-left: 30px !important;
                padding-right: 30px !important;
            }
            .navbar .nav-link[data-toggle="sidebar"] {
                display: block !important;
            }
        }

        /* Right Sidebar Overrides */
        .main-sidebar.sidebar-right {
            left: auto;
            right: 0;
            border-right: none;
            border-left: 1px solid rgba(255,255,255,0.03);
            position: fixed;
            top: 82px; /* Start below header */
            width: 280px;
            height: calc(100% - 82px);
            background-color: transparent;
            z-index: 880;
            padding-top: 18px;
            overflow-y: auto;
        }

        /* Section Header Compact */
        .section-header {
            margin-bottom: 20px !important;
            padding: 15px 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border-radius: 0 !important;
        }

        .section-header h1 {
            font-size: 24px !important;
            color: #34395e;
        }

        @media (max-width: 1024px) {
            .main-sidebar.sidebar-right {
                display: none;
            }
            .main-content {
                padding-right: 30px !important;
            }
        }
    </style>

</head>

<body>
    <div id="app">
        <div class="main-wrapper main-wrapper-1">
            <div class="navbar-bg"></div>

            @include('admin.layouts.navbar')
            @include('admin.layouts.sidebar')

            <!-- Main Content -->
            <div class="main-content">
                @yield('contents')
            </div>

            @include('admin.layouts.right-sidebar')

            <footer class="main-footer">
                <div class="footer-left">
                    Copyright &copy; {{ date('Y') }} <div class="bullet"></div> Design By <a
                        href="#">Munyaradzi Chenjerai</a>
                </div>
                <div class="footer-right">

                </div>
            </footer>
        </div>
    </div>

    <!-- General JS Scripts (local -> CDN fallback) -->
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

    @if (file_exists(public_path('admin/assets/modules/nicescroll/jquery.nicescroll.min.js')))
        <script src="{{ asset('admin/assets/modules/nicescroll/jquery.nicescroll.min.js') }}"></script>
    @endif

    @if (file_exists(public_path('admin/assets/modules/moment.min.js')))
        <script src="{{ asset('admin/assets/modules/moment.min.js') }}"></script>
    @else
        <script src="https://cdn.jsdelivr.net/momentjs/latest/moment.min.js"></script>
    @endif

    @if (file_exists(public_path('admin/assets/js/stisla.js')))
        <script src="{{ asset('admin/assets/js/stisla.js') }}"></script>
    @endif

    <!-- JS Libraies -->
    <script src="{{ asset('admin/assets/modules/sweetalert/sweetalert.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/select2/dist/js/select2.full.min.js') }}"></script>
    <script src="{{ asset('admin/assets/js/bootstrap-iconpicker.bundle.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/bootstrap-daterangepicker/daterangepicker.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/bootstrap-tagsinput/dist/bootstrap-tagsinput.min.js') }}"></script>
    <script src="https://cdn.ckeditor.com/ckeditor5/40.2.0/classic/ckeditor.js"></script>

    <!-- Template JS File -->
    @if (file_exists(public_path('admin/assets/js/scripts.js')))
        <script src="{{ asset('admin/assets/js/scripts.js') }}"></script>
    @endif
    @if (file_exists(public_path('admin/assets/js/custom.js')))
        <script src="{{ asset('admin/assets/js/custom.js') }}"></script>
    @endif

    @stack('scripts')

    <script>
        ClassicEditor
        .create( document.querySelector( '#editor' ) )
        .catch( error => {
            console.error( error );
        } );

        $(".delete-item").on('click', function(e) {
            e.preventDefault();

            swal({
                    title: 'Are you sure?',
                    text: 'Once deleted, you will not be able to recover this data!',
                    icon: 'warning',
                    buttons: true,
                    dangerMode: true,
                })
                .then((willDelete) => {
                    if (willDelete) {
                        let url = $(this).attr('href') || $(this).data('href') || $(this).closest('form').attr('action')

                        $.ajax({
                            method: 'DELETE',
                            url: url,
                            data: {_token: "{{ csrf_token() }}"},
                            success: function(response) {
                                window.location.reload();
                            },
                            error: function(xhr, status, error) {
                                console.log(xhr);
                                swal(xhr.responseJSON.message, {
                                    icon: 'error',
                                });
                            }
                        })
                    }
                });
        });
        // Convert anchors inside admin pages into easily styled button-like links
        // This keeps navigation intact (anchors still navigate) while giving them
        // button appearance and accessible attributes.
        (function(){
            try{
                var sel = document.querySelectorAll('.main-content a, .athena-dashboard a, .main-sidebar a, .card a, .table a, .athena-grid a');
                sel.forEach(function(a){
                    if(!a.classList.contains('btn') && !a.classList.contains('link-btn')){
                        a.classList.add('link-btn');
                        a.setAttribute('role','button');
                        if(!a.hasAttribute('tabindex')) a.setAttribute('tabindex','0');
                    }
                });
            }catch(e){console && console.warn && console.warn('link-to-button conversion failed', e)}
        })();

        // Click-to-navigate for any element that is a button with data-href
        (function(){
            try{
                // Delegate clicks on any element that has data-href attribute
                document.addEventListener('click', function(e){
                    var el = e.target.closest('[data-href]');
                    if(!el) return;

                    // if it's inside a form (like the logout submit button is type=submit) ignore
                    if(el.tagName === 'BUTTON' && el.type === 'submit') return;

                    // don't handle regular anchor navigation here
                    if(el.tagName === 'A') return;

                    var href = el.getAttribute('data-href');
                    if(!href) return;

                    var target = el.getAttribute('data-target') || el.getAttribute('target');
                    if(target === '_blank'){
                        window.open(href, '_blank');
                    } else {
                        window.location.href = href;
                    }
                }, false);

                // keyboard support (Enter/Space) for clickable buttons
                document.addEventListener('keydown', function(e){
                    if(e.key !== 'Enter' && e.key !== ' ') return;
                    var el = e.target.closest('[data-href]');
                    if(!el) return;
                    // allow default behavior for inputs and submits
                    if(el.tagName === 'BUTTON' && el.type === 'submit') return;
                    e.preventDefault();
                    var href = el.getAttribute('data-href');
                    var target = el.getAttribute('data-target') || el.getAttribute('target');
                    if(target === '_blank'){
                        window.open(href, '_blank');
                    } else {
                        window.location.href = href;
                    }
                }, false);

            }catch(e){ console && console.warn && console.warn('button navigation handler failed', e) }
        })();
        })();
    </script>
</body>

</html>
