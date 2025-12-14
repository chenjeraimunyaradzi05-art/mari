@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Edit Organization Page</h1>
            <div class="section-header-button">
                <a href="{{ route('admin.organization-pages.invites', $page->id) }}" class="btn btn-outline-primary">
                    <i class="fas fa-paper-plane"></i> Invite log
                </a>
            </div>
        </div>

        <div class="section-body">
            <form action="{{ route('admin.organization-pages.update', $page->id) }}" method="POST" enctype="multipart/form-data">
                @csrf
                @method('PUT')
                @include('admin.org-pages._form')
                <div class="row mt-4">
                    <div class="col-12 text-right">
                        <button type="submit" class="btn btn-primary">Update Page</button>
                    </div>
                </div>
            </form>
        </div>
    </section>
@endsection
