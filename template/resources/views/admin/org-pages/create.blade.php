@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Create Organization Page</h1>
        </div>

        <div class="section-body">
            <form action="{{ route('admin.organization-pages.store') }}" method="POST" enctype="multipart/form-data">
                @csrf
                @include('admin.org-pages._form')
                <div class="row mt-4">
                    <div class="col-12 text-right">
                        <button type="submit" class="btn btn-primary">Create Page</button>
                    </div>
                </div>
            </form>
        </div>
    </section>
@endsection
