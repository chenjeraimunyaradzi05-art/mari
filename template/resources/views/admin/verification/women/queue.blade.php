@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Women Verification Queue</h1>
            <div class="section-header-button">
                <button type="button"  href="{{ route('admin.women.verification.regulator-report') }}" class="btn btn-outline-secondary">
                    <i class="fas fa-file-export"></i> Regulator Report
                </button>
            </div>
            <div class="section-header-breadcrumb">
                <div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
                <div class="breadcrumb-item">Women Verification</div>
                <div class="breadcrumb-item active">Queue</div>
            </div>
        </div>

        <div class="section-body">
            <div class="row">
                <div class="col-12">
                    <livewire:admin.women-verification.queue-table />
                </div>
            </div>
        </div>
    </section>
@endsection

