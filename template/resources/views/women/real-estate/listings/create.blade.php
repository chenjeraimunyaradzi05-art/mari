@extends('women.real-estate.layouts.console')

@section('console-content')
    <div class="wr-console-hero text-center sm:text-left">
        <span class="wr-console-pill self-center sm:self-start">WomenRise Owner Console</span>
        <h1 class="wr-console-headline">Launch a new women-first listing</h1>
        <p class="wr-console-subtitle">
            Use the guided wizard to capture listing essentials, upload immersive media, invite partners, and publish with confidence.
        </p>
    </div>

    <div class="wr-console-shell">
        <div class="wr-console-card-shell">
            <div class="wr-console-card">
                <livewire:women-real-estate.listings.wizard />
            </div>
        </div>
    </div>
@endsection
