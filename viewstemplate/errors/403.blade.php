@extends('frontend.layouts.master')

@section('title', 'Access Denied')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Access Denied</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li>403 Forbidden</li>
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
                        <h1 class="mb-20 text-danger">403</h1>
                        <h3 class="mb-20">Access Forbidden</h3>
                        <p class="font-lg color-text-paragraph mb-30">
                            {{ $exception->getMessage() ?: 'You do not have permission to access this page.' }}
                        </p>
                        <div class="mt-30">
                            <a class="btn btn-default btn-shadow hover-up" href="{{ url('/') }}">Back to Homepage</a>
                            @auth
                                <a class="btn btn-primary btn-shadow hover-up ml-20" href="{{ route('company.profile') }}">Update Profile</a>
                            @endauth
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
