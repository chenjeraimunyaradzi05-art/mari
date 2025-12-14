@extends('frontend.layouts.master')

@section('title', __('Entertainment'))

@section('contents')
    <div id="entertainment-dashboard-root"
         data-user="{{ json_encode(auth()->user()) }}">
    </div>
@endsection
