<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" name="viewport">
    <title>General Dashboard &mdash; Stisla</title>

    <!-- General CSS Files -->
    <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin/assets/modules/fontawesome/css/all.min.css') }}">

    <!-- CSS Libraries -->
    <link rel="stylesheet" href="{{ asset('admin/assets/modules/select2/dist/css/select2.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin/assets/css/bootstrap-iconpicker.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap-daterangepicker/daterangepicker.css') }}">
    <link rel="stylesheet" href="{{ asset('admin/assets/modules/bootstrap-tagsinput/dist/bootstrap-tagsinput.css') }}">

    <!-- Template CSS -->
    <link rel="stylesheet" href="{{ asset('admin/assets/css/style.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin/assets/css/components.min.css') }}">

    <!-- Feminine Theme Overrides -->
    <link rel="stylesheet" href="{{ asset('admin/assets/css/feminine-overrides.css') }}?v={{ time() }}">

    <style>
        /* Compact Header & Dashboard Optimizations */
        body {
            background-color: #f4f6f9;
        }

        .navbar-bg {
            height: 65px !important;
            background: #fff !important;
            box-shadow: 0 2px 15px rgba(0,0,0,0.05);
        }

        .main-navbar {
            background: #fff !important;
            height: 65px !important;
            min-height: 65px !important;
            left: 250px !important; /* Align with sidebar */
            width: calc(100% - 250px) !important;
            position: fixed !important;
            top: 0;
            padding: 0 30px !important;
            box-shadow: 0 2px 15px rgba(0,0,0,0.05);
            z-index: 890;
        }

        /* Sidebar adjustments */
        .main-sidebar {
            box-shadow: 0 4px 8px rgba(0,0,0,0.03);
            border-right: 1px solid #f0f0f0;
            padding-top: 20px !important; /* Remove huge top padding */
            top: 0 !important;
            height: 100vh !important;
            position: fixed !important;
            z-index: 891;
            background: #fff;
        }

        .main-sidebar .sidebar-brand {
            margin-bottom: 20px;
            line-height: 65px;
            height: 65px;
        }

        /* Content area adjustments */
        .main-content {
            padding-top: 95px !important; /* 65px header + 30px gap */
            padding-left: 280px !important;
            padding-right: 30px !important;
        }

        /* Navbar items styling */
        .navbar .nav-link {
            color: #6c757d !important;
            height: 65px !important;
            line-height: 65px !important;
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
            border-left: 1px solid #eee;
            position: fixed;
            top: 65px; /* Start below header */
            width: 280px;
            height: calc(100% - 65px);
            background-color: #fff;
            z-index: 880;
            padding-top: 20px;
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

    <!-- General JS Scripts -->
    <script src="{{ asset('admin/assets/modules/jquery.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/popper.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/tooltip.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/bootstrap/js/bootstrap.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/nicescroll/jquery.nicescroll.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/moment.min.js') }}"></script>
    <script src="{{ asset('admin/assets/js/stisla.js') }}"></script>

    <!-- JS Libraies -->
    <script src="{{ asset('admin/assets/modules/sweetalert/sweetalert.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/select2/dist/js/select2.full.min.js') }}"></script>
    <script src="{{ asset('admin/assets/js/bootstrap-iconpicker.bundle.min.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/bootstrap-daterangepicker/daterangepicker.js') }}"></script>
    <script src="{{ asset('admin/assets/modules/bootstrap-tagsinput/dist/bootstrap-tagsinput.min.js') }}"></script>
    <script src="https://cdn.ckeditor.com/ckeditor5/40.2.0/classic/ckeditor.js"></script>

    <!-- Template JS File -->
    <script src="{{ asset('admin/assets/js/scripts.js') }}"></script>
    <script src="{{ asset('admin/assets/js/custom.js') }}"></script>

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
                        let url = $(this).attr('href')

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
    </script>
</body>

</html>
