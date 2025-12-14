@extends('frontend.layouts.master')

@section('title', 'TurboTax Projection')

@section('contents')
    <div class="bg-gray-50 min-h-screen py-8">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-8">
                <h1 class="text-2xl font-bold">TurboTax (POC) — Tax Projection</h1>
                <p class="text-sm text-gray-600">Run a simple tax projection using the TurboTax integration gateway (POC)</p>
            </div>

            <div class="bg-white shadow rounded p-6 mb-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <strong>Connected</strong>
                        <div class="text-lg">Not connected (POC)</div>
                    </div>
                    <div>
                        <a href="#" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700" id="connect-btn">Connect TurboTax</a>
                    </div>
                </div>

                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-700">Sample tax context (editable)</label>
                    <textarea id="tax-context" rows="6" class="mt-2 w-full border rounded p-2">{{ json_encode($taxContext, JSON_PRETTY_PRINT) }}</textarea>
                    <div class="mt-3 flex items-center justify-between">
                        <button id="run-projection" class="btn btn-primary">Run Projection</button>
                        <span id="status" class="text-sm text-gray-500">Ready</span>
                    </div>
                </div>

                <div id="result" class="mt-4 hidden bg-gray-50 border rounded p-3"></div>
            </div>

            <div class="text-sm text-gray-600">
                This is a POC page — real production flows need OAuth, explicit consent, secure token storage, and an Intuit sandbox configuration.
            </div>
        </div>
    </div>

    <script>
        document.getElementById('run-projection').addEventListener('click', async function (e) {
            e.preventDefault();
            const status = document.getElementById('status');
            const result = document.getElementById('result');
            const body = document.getElementById('tax-context').value;

            status.textContent = 'Running…';
            result.classList.add('hidden');

            try {
                const payload = JSON.parse(body);
                const resp = await fetch('/api/v1/turbotax/projection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content') },
                    body: JSON.stringify({ tax_context: payload })
                });

                if (!resp.ok) throw new Error('Server error');
                const json = await resp.json();

                result.innerHTML = '<pre>' + JSON.stringify(json, null, 2) + '</pre>';
                result.classList.remove('hidden');
                status.textContent = 'Completed';
            } catch (err) {
                status.textContent = 'Error';
                result.innerHTML = '<div class="text-red-600">' + err.message + '</div>';
                result.classList.remove('hidden');
            }
        });

        // Connect flow placeholder — in POC this would open the microservice OAuth start
        document.getElementById('connect-btn').addEventListener('click', function (e) {
            e.preventDefault();
            alert('This would start the OAuth connect flow to Intuit (POC).');
        });
    </script>

@endsection
