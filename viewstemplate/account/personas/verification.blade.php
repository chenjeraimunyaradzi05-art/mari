@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-8">
                    <h2 class="mb-2">Verification Center</h2>
                    <p class="text-muted mb-0">Submit documents for {{ $profile->display_name }} and track reviewer updates.</p>
                </div>
                <div class="col-lg-4 text-lg-end mt-3 mt-lg-0">
                    <span class="badge bg-gradient rounded-pill px-3 py-2" style="background: linear-gradient(120deg,#ec4899,#a855f7);">
                        Persona handle: {{ '@'.$profile->handle }}
                    </span>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-30 mb-100">
        <div class="container">
            <livewire:account.personas.verification-wizard :profile="$profile" />
        </div>
    </section>
@endsection
