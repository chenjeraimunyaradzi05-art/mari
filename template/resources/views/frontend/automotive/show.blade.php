@extends('frontend.layouts.master')

@section('title', $listing->title)

@section('contents')
<div class="bg-white min-h-screen py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
            <!-- Image Gallery -->
            <div class="flex flex-col">
                <div class="w-full aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden sm:aspect-w-2 sm:aspect-h-3">
                    @if($listing->images && count($listing->images) > 0)
                        <img src="{{ $listing->images[0] }}" alt="{{ $listing->title }}" class="w-full h-full object-center object-cover">
                    @else
                        <div class="flex items-center justify-center h-96 text-gray-400">No Image Available</div>
                    @endif
                </div>
            </div>

            <!-- Product Info -->
            <div class="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
                <h1 class="text-3xl font-extrabold tracking-tight text-gray-900">{{ $listing->title }}</h1>

                <div class="mt-3">
                    <h2 class="sr-only">Product information</h2>
                    <p class="text-3xl text-gray-900">{{ $listing->formatted_price }}</p>
                </div>

                <div class="mt-6">
                    <h3 class="sr-only">Description</h3>
                    <div class="text-base text-gray-700 space-y-6">
                        <p>{{ $listing->description }}</p>
                    </div>
                </div>

                <div class="mt-8 border-t border-gray-200 pt-8">
                    <h3 class="text-sm font-medium text-gray-900">Key Specs</h3>
                    <dl class="mt-4 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                        <div class="sm:col-span-1">
                            <dt class="text-sm font-medium text-gray-500">Odometer</dt>
                            <dd class="mt-1 text-sm text-gray-900">{{ number_format($listing->odometer_km) }} km</dd>
                        </div>
                        <div class="sm:col-span-1">
                            <dt class="text-sm font-medium text-gray-500">Transmission</dt>
                            <dd class="mt-1 text-sm text-gray-900">{{ $listing->transmission }}</dd>
                        </div>
                        <div class="sm:col-span-1">
                            <dt class="text-sm font-medium text-gray-500">Fuel Type</dt>
                            <dd class="mt-1 text-sm text-gray-900">{{ $listing->fuel_type }}</dd>
                        </div>
                        <div class="sm:col-span-1">
                            <dt class="text-sm font-medium text-gray-500">Body Type</dt>
                            <dd class="mt-1 text-sm text-gray-900">{{ $listing->type }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="mt-8 border-t border-gray-200 pt-8">
                    <h3 class="text-sm font-medium text-gray-900">Dealer Info</h3>
                    <div class="mt-4">
                        <p class="text-lg font-bold text-gray-900">{{ $listing->dealer->name }}</p>
                        <p class="text-gray-500">{{ $listing->dealer->address }}</p>
                        <div class="mt-4">
                            <a href="mailto:{{ $listing->dealer->contact_email }}" class="w-full bg-indigo-600 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                Contact Dealer
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
