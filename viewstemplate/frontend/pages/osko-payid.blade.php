@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="card">
                    <div class="card-header bg-success text-light">
                        <h3>Pay with OSKO PayID</h3>
                    </div>
                    <div class="card-body">
                        <p>Use the following PayID to complete your payment:</p>
                        <div class="payid-box mb-3">
                            <strong>{{ config('gatewaySettings.osko_payid') }}</strong>
                        </div>
                        <p>After payment, please upload your receipt for verification.</p>
                        <form action="{{ route('company.osko-payid.upload') }}" method="POST" enctype="multipart/form-data">
                            @csrf
                            <div class="form-group mb-3">
                                <input type="file" name="receipt" class="form-control" required>
                            </div>
                            <button type="submit" class="btn btn-success">Upload Receipt</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection
