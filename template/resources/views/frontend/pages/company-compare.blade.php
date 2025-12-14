@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="breacrumb-cover">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-12">
                    <h2 class="mb-20">Compare Companies</h2>
                    <ul class="breadcrumbs">
                        <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                        <li><a href="{{ route('companies.index') }}">Companies</a></li>
                        <li>Compare</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="table-responsive">
            <table class="table table-bordered table-striped">
                <thead>
                    <tr>
                        <th style="width: 20%;">Feature</th>
                        @foreach($companies as $company)
                            <th class="text-center">
                                <img src="{{ asset($company->logo) }}" alt="{{ $company->name }}" style="max-height: 50px; max-width: 100px; display: block; margin: 0 auto 10px;">
                                <a href="{{ route('companies.show', $company->slug) }}">{{ $company->name }}</a>
                            </th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th>Stock Price</th>
                        @foreach($companies as $company)
                            <td class="text-center">
                                @if($company->stock_price)
                                    <span class="font-bold text-primary">${{ number_format($company->stock_price, 2) }}</span>
                                    <br>
                                    @if($company->daily_change_percentage >= 0)
                                        <span class="text-success small" style="color: green;"><i class="fi-rr-arrow-up"></i> {{ number_format($company->daily_change_percentage, 2) }}%</span>
                                    @else
                                        <span class="text-danger small" style="color: red;"><i class="fi-rr-arrow-down"></i> {{ number_format(abs($company->daily_change_percentage), 2) }}%</span>
                                    @endif
                                @else
                                    N/A
                                @endif
                            </td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Market Cap</th>
                        @foreach($companies as $company)
                            <td class="text-center">
                                @if($company->market_cap)
                                    ${{ number_format($company->market_cap / 1000000, 2) }}M
                                @else
                                    N/A
                                @endif
                            </td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Industry</th>
                        @foreach($companies as $company)
                            <td class="text-center">{{ $company->industryType?->name ?? 'N/A' }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Location</th>
                        @foreach($companies as $company)
                            <td class="text-center">{{ formatLocation($company->companyCountry->name, $company->companyState->name) }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Team Size</th>
                        @foreach($companies as $company)
                            <td class="text-center">{{ $company->teamSize?->name ?? 'N/A' }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Establishment Date</th>
                        @foreach($companies as $company)
                            <td class="text-center">{{ $company->establishment_date ? \Carbon\Carbon::parse($company->establishment_date)->format('Y') : 'N/A' }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Open Jobs</th>
                        @foreach($companies as $company)
                            <td class="text-center">{{ $company->jobs_count }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th>Action</th>
                        @foreach($companies as $company)
                            <td class="text-center">
                                <a href="{{ route('companies.show', $company->slug) }}" class="btn btn-default btn-sm">View Profile</a>
                            </td>
                        @endforeach
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</section>
@endsection
