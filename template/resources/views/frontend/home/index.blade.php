@extends('frontend.layouts.master')



@section('contents')

@php
	$heroAds = $homepageSponsorSlots['hero-main'] ?? [];
	$pricingAds = $homepageSponsorSlots['pricing'] ?? [];
	$ctaAds = $homepageSponsorSlots['cta'] ?? [];
@endphp

<section class="section-box sponsor-hero mt-60 mb-60">
	<div class="container">
		<div class="row align-items-center g-5">
			<div class="col-lg-6">
				<span class="sponsor-hero__badge">Ethical sponsors fuel Athena</span>
				<h1 class="mt-20 mb-20">Dynamic placements keep community tools free</h1>
				<p class="font-lg color-text-paragraph-2 mb-30">
					Every carousel below is powered by live sponsor data. Banking allies, telcos, universities and wellbeing
					partners rotate through verified slots so members see helpful offers while Athena funds new features.
				</p>
				<div class="d-flex flex-wrap gap-3">
					<a href="{{ route('pricing.index') }}" class="btn btn-default btn-shadow">Partner with Athena</a>
					<a href="{{ route('business.network') }}" class="btn btn-border">View media kit</a>
				</div>
			</div>
			<div class="col-lg-6">
				@if (!empty($heroAds))
					<x-ad-slot :ads="$heroAds" position="hero-main" layout="stacked" />
				@endif
			</div>
		</div>
	</div>
</section>

@if (config('features.home.pillar_band'))
	<!-- Pillar Band Section Start -->
	@include('frontend.home.sections.pillar-band-section')
	<!-- Pillar Band Section End -->
@endif



<!-- AI Intuitive Section Start -->
@include('frontend.home.sections.ai-intuitive-section')
<!-- AI Intuitive Section End -->

<!-- AI Features Cards Section Start -->
@include('frontend.home.sections.ai-features-cards')
<!-- AI Features Cards Section End -->

@if (config('features.home.vertical_gateway'))
	<!-- Vertical Gateway Section Start -->
	@include('frontend.home.sections.vertical-gateway-section')
	<!-- Vertical Gateway Section End -->
@endif

@if (!empty($pricingAds) || !empty($ctaAds))
	<section class="section-box mt-120 mb-100">
		<div class="container sponsor-cta-grid">
			<div class="row g-4 align-items-stretch">
				@if (!empty($pricingAds))
					<div class="col-lg-5">
						<x-ad-slot :ads="$pricingAds" position="pricing" layout="banner" />
					</div>
				@endif
				@if (!empty($ctaAds))
					<div class="col-lg-7">
						<x-ad-slot :ads="$ctaAds" position="cta" layout="stacked" />
					</div>
				@endif
			</div>
		</div>
	</section>
@endif



@endsection

