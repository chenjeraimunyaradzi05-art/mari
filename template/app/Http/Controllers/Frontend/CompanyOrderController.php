<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Support\EmployerAccessGate;
use Illuminate\Http\Request;
use Illuminate\View\View;
use LaravelDaily\Invoices\Invoice;
use LaravelDaily\Invoices\Classes\Buyer;
use LaravelDaily\Invoices\Classes\InvoiceItem;
use LaravelDaily\Invoices\Classes\Party;

final class CompanyOrderController extends Controller
{
    function index() : View|\Illuminate\Http\RedirectResponse {
        $company = auth()->user()->company;
        if (!$company) {
            // Redirect to company profile completion page or show a friendly message
            return redirect()->route('company.profile')->with('error', 'Please complete your company profile to view orders.');
        }
        EmployerAccessGate::resolveCompanyId();
        $orders = Order::where('company_id', $company->id)->paginate(20);
        return view('frontend.company-dashboard.order.index', compact('orders'));
    }

    function show(string $id) : View {
        $order = Order::findOrFail($id);
        EmployerAccessGate::ensureOrderAccess($order);
        return view('frontend.company-dashboard.order.show', compact('order'));
    }

    function invoice(string $id): \Illuminate\Http\Response {
        $order = Order::findOrFail($id);
        EmployerAccessGate::ensureOrderAccess($order);

        $customer = new Buyer([
            'name'          => $order->company->name,
            'custom_fields' => [
                'email' => $order->company->email,
                'transaction' => $order->transaction_id,
                'payment method' => $order->payment_provider,
            ],
        ]);

        $seller = new Party([
            'name'          => config('settings.site_name'),
            'phone'         => config('settings.site_phone'),
            'custom_fields' => [
                'email' => config('settings.site_email')
            ],
        ]);

        $item = InvoiceItem::make($order->package_name.' Plan')->pricePerUnit($order->amount);

        $invoice = Invoice::make()
            ->series($order->order_id)
            ->currencyCode($order->paid_in_currency)
            ->currencySymbol($order->paid_in_currency)
            ->buyer($customer)
            ->seller($seller)
            ->status('paid')
            ->payUntilDays(0)
            ->addItem($item);

        return $invoice->download();
    }
}

