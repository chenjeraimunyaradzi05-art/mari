@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="breacrumb-cover">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-12">
                    <h1 class="mb-20">Women-Only Community Policy</h1>
                    <ul class="breadcrumbs">
                        <li><a class="home-icon" href="{{ route('home') }}">Home</a></li>
                        <li>Policies</li>
                        <li>Women-Only</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section-box pt-50 pb-50 bg-light">
    <div class="container">
        <div class="row align-items-start g-5">
            <div class="col-lg-7">
                <p class="text-lg text-gray-700 mb-4">
                    WomenRise is intentionally designed as a women-only network. The policy below protects members from
                    harassment, data mining, or recruitment practices that conflict with our mission of economic security
                    for women and non-binary carers. Every verified agent, sponsor, and partner must agree to the same
                    expectations before accessing member pathways.
                </p>
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body p-4">
                        <h2 class="h5 text-rose-600 mb-3">Who can participate</h2>
                        <ul class="list-unstyled mb-0 text-gray-700">
                            <li class="mb-2">Women, non-binary, and gender diverse people who align with the mission.</li>
                            <li class="mb-2">Ally sponsors may collaborate only through pre-approved partnership briefs.</li>
                            <li class="mb-2">Agencies or recruiters must route opportunities through Athena moderation.</li>
                            <li>Any request for exceptions is reviewed by the WomenRise Trust & Safety team.</li>
                        </ul>
                    </div>
                </div>
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body p-4">
                        <h2 class="h5 text-rose-600 mb-3">Respect & privacy requirements</h2>
                        <ul class="list-unstyled mb-0 text-gray-700">
                            <li class="mb-2">Use inclusive language and correct pronouns in every interaction.</li>
                            <li class="mb-2">Do not export member data, scrape profiles, or approach talent outside Athena workflows.</li>
                            <li class="mb-2">Only share housing listings, jobs, or services that uphold our anti-discrimination rules.</li>
                            <li class="mb-2">Flag any breach through the safety inbox so we can intervene rapidly.</li>
                            <li>Repeated violations lead to removal from programs and sponsorship rosters.</li>
                        </ul>
                    </div>
                </div>
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body p-4">
                        <h2 class="h5 text-rose-600 mb-3">Verification promises</h2>
                        <ul class="list-unstyled mb-0 text-gray-700">
                            <li class="mb-2">Provide accurate licensing, identity, and insurance documentation.</li>
                            <li class="mb-2">Update us immediately if your license, employment status, or entity structure changes.</li>
                            <li class="mb-2">Honor the Athena badge—only promote placements you can personally support.</li>
                            <li>Accept our quality reviews, secret-shopper checks, and community feedback loops.</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body p-4">
                        <h3 class="h5 mb-3">Why we enforce this</h3>
                        <p class="text-gray-700 mb-3">Women rely on Athena to escape predatory fees, unsafe housing, and
                            biased hiring funnels. Enforcing a women-only space keeps focus on rebuilding wealth without
                            surveillance or extraction from competitor platforms.</p>
                        <p class="text-gray-700 mb-0">If you witness behaviour that contradicts this page, email
                            <a href="mailto:safety@athenaallies.com" class="text-rose-600">safety@athenaallies.com</a>
                            or use the in-product report button so we can intervene within 24 hours.</p>
                    </div>
                </div>
                <div class="card border-0 shadow-sm">
                    <div class="card-body p-4">
                        <h3 class="h5 mb-3">Key commitments</h3>
                        <ul class="list-unstyled text-gray-700 mb-4">
                            <li class="mb-2">Only women-forward placements, services, and listings.</li>
                            <li class="mb-2">Zero tolerance for harassment, doxxing, or intimidation.</li>
                            <li class="mb-2">Clear audit trail of every credential submitted.</li>
                            <li>Transparent exit criteria if expectations are breached.</li>
                        </ul>
                        <a class="btn btn-apply w-100" href="{{ route('contact.index') }}">Request clarification</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection
