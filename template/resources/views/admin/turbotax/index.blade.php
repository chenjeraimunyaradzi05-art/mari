@extends('admin.layouts.master')

@section('title', 'TurboTax (POC)')

@section('contents')
    <div class="container px-4 py-6">
        <h1 class="mb-4">TurboTax Integration — Admin POC</h1>

        <div class="card mb-4 p-4">
            <div class="flex items-center justify-between">
                <div>
                    <strong>Connected users</strong>
                    <div class="text-2xl">{{ $stats['connected_users'] }}</div>
                </div>
                <div>
                    <strong>Active tokens</strong>
                    <div class="text-2xl">{{ $stats['active_tokens'] }}</div>
                </div>
            </div>
        </div>

        <div class="card p-4 mb-4">
            <h3 class="mb-2">Run a projection</h3>
            <p class="text-sm text-gray-600 mb-3">Paste a JSON TaxContext (simple POC mapping) or use the example payload and click Run Projection.</p>

            @if ($errors->any())
                <div class="alert alert-danger mb-3">
                    {{ $errors->first() }}
                </div>
            @endif

            <form method="post" action="{{ route('admin.turbotax.runProjection') }}">
                @csrf
                <textarea name="tax_context" class="w-full border rounded p-2 mb-3" rows="8" placeholder='{"income_sources": [{"type":"w2","amount":1000}] }'></textarea>
                <div>
                    <button class="btn btn-primary">Run Projection</button>
                </div>
            </form>

            @if(session('projection'))
                <div class="mt-4 border rounded p-3 bg-white">
                    <h4>Projection Result</h4>
                    <pre>{{ json_encode(session('projection'), JSON_PRETTY_PRINT) }}</pre>
                </div>

                <div class="mt-2 border rounded p-3 bg-gray-50">
                    <h5>Sent Payload</h5>
                    <pre>{{ json_encode(session('payload'), JSON_PRETTY_PRINT) }}</pre>
                </div>
            @endif
        </div>

        <div class="card p-4 text-sm text-gray-600">
            <strong>Notes</strong>
            <p class="mt-2">This page is a lightweight Proof-of-Concept area so operations and results are mocked using the IntegrationGateway POC. Production integration requires secure token management, audited operations, and a partner sandbox configuration.</p>
        </div>
    </div>
@endsection
