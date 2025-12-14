@extends('frontend.layouts.master')

@section('title', 'Page Not Found')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Page Not Found</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li>404 Not Found</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-100 mb-100">
        <div class="container">
            <div class="row">
                <div class="col-lg-12 text-center">
                    <div class="error-content">
                        <h1 class="mb-20 text-brand-1">404</h1>
                        <h3 class="mb-20">Page Not Found</h3>
                        <p class="font-lg color-text-paragraph mb-30">
                            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                        </p>
                        <div class="mt-30">
                            <a class="btn btn-default btn-shadow hover-up" href="{{ url('/') }}">Back to Homepage</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
