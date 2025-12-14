@extends('admin.layouts.master')

@section('title', 'Trust & Safety Control Room')

@section('contents')
<div class="card shadow-sm">
    <div class="card-body">
        <livewire:admin.trust-safety-dashboard />
    </div>
</div>
@endsection
