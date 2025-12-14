@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Menu Builder</h1>
        </div>

        <div class="section-body">
            <div class="col-12">
                <div class="card">

                    <div class="card-body p-0">
                        @if(isset($menus) && is_iterable($menus))
                            <div class="menu-preview">
                                <ul class="menu-preview-list">
                                    @foreach($menus as $m)
                                        <li>{{ $m->label ?? $m->name ?? 'Menu item' }}</li>
                                    @endforeach
                                </ul>
                            </div>
                        @else
                            {{-- Menu rendering not available in this environment --}}
                        @endif
                    </div>

                </div>
            </div>
        </div>
    </section>

@endsection

@push('scripts')
    @if (isset($menuScripts) && is_string($menuScripts))
        {!! $menuScripts !!}
    @endif
@endpush
