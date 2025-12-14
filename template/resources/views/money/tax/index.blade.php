<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Finance & Tax') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">

            <!-- Success Message -->
            @if (session('success'))
                <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                    <span class="block sm:inline">{{ session('success') }}</span>
                </div>
            @endif

            <!-- Assets Section -->
            <div class="p-4 sm:p-8 bg-white shadow sm:rounded-lg">
                <div class="max-w-xl">
                    <h3 class="text-lg font-medium text-gray-900">Tax Returnable Assets</h3>
                    <p class="mt-1 text-sm text-gray-600">Track assets for depreciation and tax purposes.</p>

                    <form method="POST" action="{{ route('finance.assets.store') }}" class="mt-6 space-y-6">
                        @csrf
                        <div>
                            <x-input-label for="asset_name" :value="__('Asset Name')" />
                            <x-text-input id="asset_name" name="name" type="text" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="purchase_date" :value="__('Purchase Date')" />
                            <x-text-input id="purchase_date" name="purchase_date" type="date" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="cost" :value="__('Cost ($)')" />
                            <x-text-input id="cost" name="cost" type="number" step="0.01" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="depreciation_type" :value="__('Depreciation Type')" />
                            <select id="depreciation_type" name="depreciation_type" class="mt-1 block w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm">
                                <option value="prime_cost">Prime Cost (Straight Line)</option>
                                <option value="diminishing_value">Diminishing Value</option>
                            </select>
                        </div>
                        <x-primary-button>{{ __('Add Asset') }}</x-primary-button>
                    </form>

                    <div class="mt-6">
                        <h4 class="font-medium text-gray-900">Your Assets</h4>
                        <ul class="mt-2 list-disc list-inside text-sm text-gray-600">
                            @forelse ($assets as $asset)
                                <li>{{ $asset->name }} - ${{ number_format($asset->cost, 2) }} ({{ $asset->purchase_date->format('d M Y') }})</li>
                            @empty
                                <li>No assets recorded yet.</li>
                            @endforelse
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Receipts Section -->
            <div class="p-4 sm:p-8 bg-white shadow sm:rounded-lg">
                <div class="max-w-xl">
                    <h3 class="text-lg font-medium text-gray-900">Receipts</h3>
                    <p class="mt-1 text-sm text-gray-600">Upload and track receipts for tax deductions.</p>

                    <form method="POST" action="{{ route('finance.receipts.store') }}" enctype="multipart/form-data" class="mt-6 space-y-6">
                        @csrf
                        <div>
                            <x-input-label for="merchant_name" :value="__('Merchant Name')" />
                            <x-text-input id="merchant_name" name="merchant_name" type="text" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="receipt_date" :value="__('Date')" />
                            <x-text-input id="receipt_date" name="date" type="date" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="amount" :value="__('Amount ($)')" />
                            <x-text-input id="amount" name="amount" type="number" step="0.01" class="mt-1 block w-full" required />
                        </div>
                        <div>
                            <x-input-label for="category" :value="__('Category')" />
                            <x-text-input id="category" name="category" type="text" class="mt-1 block w-full" placeholder="e.g. Office Supplies" />
                        </div>
                        <div>
                            <x-input-label for="image" :value="__('Receipt Image')" />
                            <input id="image" name="image" type="file" class="mt-1 block w-full text-sm text-gray-600" accept="image/*" />
                        </div>
                        <x-primary-button>{{ __('Upload Receipt') }}</x-primary-button>
                    </form>

                    <div class="mt-6">
                        <h4 class="font-medium text-gray-900">Recent Receipts</h4>
                        <ul class="mt-2 list-disc list-inside text-sm text-gray-600">
                            @forelse ($receipts as $receipt)
                                <li>{{ $receipt->merchant_name }} - ${{ number_format($receipt->amount, 2) }} ({{ $receipt->date->format('d M Y') }})</li>
                            @empty
                                <li>No receipts uploaded yet.</li>
                            @endforelse
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Vehicle Logbook Section -->
            <div class="p-4 sm:p-8 bg-white shadow sm:rounded-lg">
                <div class="max-w-xl">
                    <h3 class="text-lg font-medium text-gray-900">Vehicle Logbook</h3>
                    <p class="mt-1 text-sm text-gray-600">Track business trips for vehicle expenses.</p>

                    <!-- Create Logbook Form -->
                    @if($logbooks->isEmpty())
                        <form method="POST" action="{{ route('finance.logbook.store') }}" class="mt-6 space-y-6 border-b pb-6">
                            @csrf
                            <h4 class="font-medium text-gray-900">Register Vehicle</h4>
                            <div>
                                <x-input-label for="vehicle_name" :value="__('Vehicle Name')" />
                                <x-text-input id="vehicle_name" name="vehicle_name" type="text" class="mt-1 block w-full" placeholder="e.g. Toyota Camry" required />
                            </div>
                            <div>
                                <x-input-label for="registration_number" :value="__('Registration Number')" />
                                <x-text-input id="registration_number" name="registration_number" type="text" class="mt-1 block w-full" required />
                            </div>
                            <x-primary-button>{{ __('Register Vehicle') }}</x-primary-button>
                        </form>
                    @else
                        <!-- Log Trip Form -->
                        <form method="POST" action="{{ route('finance.logbook.entry.store') }}" class="mt-6 space-y-6">
                            @csrf
                            <div>
                                <x-input-label for="vehicle_logbook_id" :value="__('Select Vehicle')" />
                                <select id="vehicle_logbook_id" name="vehicle_logbook_id" class="mt-1 block w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm">
                                    @foreach($logbooks as $logbook)
                                        <option value="{{ $logbook->id }}">{{ $logbook->vehicle_name }} ({{ $logbook->registration_number }})</option>
                                    @endforeach
                                </select>
                            </div>
                            <div>
                                <x-input-label for="trip_date" :value="__('Date')" />
                                <x-text-input id="trip_date" name="date" type="date" class="mt-1 block w-full" required />
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <x-input-label for="odometer_start" :value="__('Odometer Start')" />
                                    <x-text-input id="odometer_start" name="odometer_start" type="number" class="mt-1 block w-full" required />
                                </div>
                                <div>
                                    <x-input-label for="odometer_end" :value="__('Odometer End')" />
                                    <x-text-input id="odometer_end" name="odometer_end" type="number" class="mt-1 block w-full" required />
                                </div>
                            </div>
                            <div>
                                <x-input-label for="purpose" :value="__('Purpose of Trip')" />
                                <x-text-input id="purpose" name="purpose" type="text" class="mt-1 block w-full" required />
                            </div>
                            <x-primary-button>{{ __('Log Trip') }}</x-primary-button>
                        </form>

                        <div class="mt-6">
                            <h4 class="font-medium text-gray-900">Recent Trips</h4>
                            <ul class="mt-2 list-disc list-inside text-sm text-gray-600">
                                @foreach($logbooks as $logbook)
                                    @foreach($logbook->entries->take(5) as $entry)
                                        <li>{{ $entry->date->format('d M') }}: {{ $entry->distance }}km - {{ $entry->purpose }} ({{ $logbook->vehicle_name }})</li>
                                    @endforeach
                                @endforeach
                            </ul>
                        </div>
                    @endif
                </div>
            </div>

        </div>
    </div>
</x-app-layout>
