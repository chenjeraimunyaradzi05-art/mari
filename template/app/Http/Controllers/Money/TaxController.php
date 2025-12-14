<?php

namespace App\Http\Controllers\Money;

use App\Http\Controllers\Controller;
use App\Models\Receipt;
use App\Models\TaxAsset;
use App\Models\VehicleLogbook;
use App\Models\VehicleLogbookEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

final class TaxController extends Controller
{
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        $assets = $request->user()->taxAssets()->latest()->get();
        $receipts = $request->user()->receipts()->latest()->get();
        $logbooks = $request->user()->vehicleLogbooks()->with('entries')->get();

        return view('money.tax.index', compact('assets', 'receipts', 'logbooks'));
    }

    public function storeAsset(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'purchase_date' => 'required|date',
            'cost' => 'required|numeric',
            'depreciation_type' => 'required|in:prime_cost,diminishing_value',
            'depreciation_rate' => 'nullable|numeric',
        ]);

        $request->user()->taxAssets()->create($validated);

        return back()->with('success', 'Asset added successfully.');
    }

    public function storeReceipt(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'merchant_name' => 'required|string|max:255',
            'date' => 'required|date',
            'amount' => 'required|numeric',
            'image' => 'nullable|image|max:10240', // 10MB max
            'category' => 'nullable|string',
        ]);

        $path = null;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('receipts', 'public');
        }

        $request->user()->receipts()->create([
            'merchant_name' => $validated['merchant_name'],
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'category' => $validated['category'] ?? null,
            'image_path' => $path,
        ]);

        return back()->with('success', 'Receipt uploaded successfully.');
    }

    public function storeLogbook(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'vehicle_name' => 'required|string|max:255',
            'registration_number' => 'required|string|max:20',
        ]);

        $request->user()->vehicleLogbooks()->create($validated);

        return back()->with('success', 'Vehicle logbook created successfully.');
    }

    public function storeLogbookEntry(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'vehicle_logbook_id' => 'required|exists:vehicle_logbooks,id',
            'date' => 'required|date',
            'odometer_start' => 'required|integer',
            'odometer_end' => 'required|integer|gt:odometer_start',
            'purpose' => 'required|string',
        ]);

        $distance = $validated['odometer_end'] - $validated['odometer_start'];

        VehicleLogbookEntry::create([
            'vehicle_logbook_id' => $validated['vehicle_logbook_id'],
            'date' => $validated['date'],
            'odometer_start' => $validated['odometer_start'],
            'odometer_end' => $validated['odometer_end'],
            'distance' => $distance,
            'purpose' => $validated['purpose'],
        ]);

        return back()->with('success', 'Trip logged successfully.');
    }
}

