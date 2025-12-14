@extends('women.real-estate.layouts.console')

@section('console-content')
    <div class="wr-console-hero text-center sm:text-left">
        <span class="wr-console-pill self-center sm:self-start">WomenRise Owner Console</span>
        <h1 class="wr-console-headline">Refresh your listing journey</h1>
        <p class="wr-console-subtitle">
            Update visuals, collaborate with partners, and keep share-ready details aligned before you republish.
        </p>
    </div>

    @php($wizardListingId = $wizardListingId ?? null)

    <div class="wr-console-shell">
        @if ($wizardListingId)
            <div class="wr-console-card-shell">
                <div class="wr-console-card">
                    <livewire:women-real-estate.listings.wizard :listing-id="$wizardListingId" />
                </div>
            </div>
        @else
            <div class="wr-console-card-shell">
                <div class="wr-console-card space-y-6">
                    <div class="wr-console-alert warning">
                        <h2 class="text-lg font-semibold">Legacy editor fallback</h2>
                        <p class="mt-2 text-sm">This listing has not been migrated to the new WomenRise wizard yet. You can safely continue with the classic form below.</p>
                    </div>
                    <form action="{{ route('women.real-estate.listings.update', $listing) }}" method="post" enctype="multipart/form-data" class="space-y-8">
                        @method('PUT')
                        @include('women.real-estate.listings._form', [
                            'listing' => $listing,
                            'agentProfile' => $agentProfile ?? null,
                        ])
                    </form>
                </div>
            </div>
        @endif
    </div>
@endsection
