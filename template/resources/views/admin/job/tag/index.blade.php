@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Tags</h1>
        </div>

        <div class="section-body">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h4>All Tags</h4>
                        <div class="card-header-form">
                            <form action="{{ route('admin.tags.index') }}" method="GET">
                                <div class="input-group">
                                    <input type="text" class="form-control" placeholder="Search" name="search" value="{{ request('search') }}">
                                    <div class="input-group-btn">
                                        <button type="submit" style="height: 40px;" class="btn btn-primary"><i class="fas fa-search"></i></button>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <a href="{{ route('admin.tags.create') }}" class="btn btn-primary"> <i class="fas fa-plus-circle"></i> Create new</a>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <tr>
                                    <th>Name</th>
                                    <th>slug</th>
                                    <th style="width: 10%">Action</th>
                                </tr>
                            <tbody>
                                @forelse ($tags as $tag)
                                    <tr>
                                        <td>
                                            @if(is_object($tag))
                                                {{ $tag->name }}
                                            @elseif(is_array($tag))
                                                {{ $tag['name'] ?? ($tag['label'] ?? '—') }}
                                            @else
                                                {{ $tag }}
                                            @endif
                                        </td>
                                        <td>
                                            @if(is_object($tag))
                                                {{ $tag->slug }}
                                            @elseif(is_array($tag))
                                                {{ $tag['slug'] ?? (\Illuminate\Support\Str::slug($tag['name'] ?? ($tag['label'] ?? ''))) }}
                                            @else
                                                {{ \Illuminate\Support\Str::slug($tag) }}
                                            @endif
                                        </td>
                                        <td>
                                            @php
                                                $tagId = is_object($tag) ? ($tag->id ?? null) : (is_array($tag) ? ($tag['id'] ?? null) : null);
                                            @endphp
                                            @if($tagId)
                                                <a href="{{ route('admin.tags.edit', $tagId) }}" class="btn-sm btn btn-primary"><i class="fas fa-edit"></i></a>
                                                <form method="POST" action="{{ route('admin.tags.destroy', $tagId) }}" class="d-inline">
                                                @csrf
                                                @method('DELETE')
                                                <button type="submit" class="btn-sm btn btn-danger delete-item"><i class="fas fa-trash-alt"></i></button>
                                            </form>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="3" class="text-center">No result found!</td>
                                    </tr>
                                @endforelse

                            </tbody>

                            </table>
                        </div>
                    </div>
                    <div class="card-footer text-right">
                        <nav class="d-inline-block">
                            @if (is_object($tags) && method_exists($tags, 'hasPages') && $tags->hasPages())
                                {{ $tags->withQueryString()->links() }}
                            @endif
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    </section>

@endsection
