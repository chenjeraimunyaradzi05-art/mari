<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Jobs\Money\ImportUserSubscriptionsJob;
use App\Models\BankTransaction;
use App\Models\BundleOffer;
use App\Models\Budget;
use App\Models\Debt;
use App\Models\User;
use App\Models\UserSubscription;
use App\Services\Money\BudgetSyncService;
use App\Services\Money\BundleConcierge\BundleConciergeService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use SplFileObject;
use Throwable;

final class FinancialWellnessController extends Controller
{
    public function budget(Request $request): View
    {
        $summary = [
            'income' => 18500,
            'expenses' => 14200,
            'net' => 4300,
            'net_trend' => 6.4,
            'savings_percent' => 68,
            'runway_weeks' => 22,
            'break_even_date' => Carbon::now()->addWeeks(3),
        ];

        $budget = [
            'type' => 'sole trader',
            'categories' => $this->budgetCategories(),
        ];

        return view('financial.budget-dashboard', [
            'summary' => $summary,
            'budget' => $budget,
            'transactions' => $this->transactionHistory(),
            'cashflow' => $this->cashflowSeries(),
        ]);
    }

    public function createBudget(Request $request): View
    {
        return $this->budget($request);
    }

    public function debt(): View
    {
        return view('financial.debt-consolidation', [
            'debts' => $this->defaultDebts(),
            'scenarios' => $this->debtScenarios($this->defaultDebts()),
        ]);
    }

    public function calculateDebt(Request $request): View
    {
        $debts = array_values($request->input('debts', $this->defaultDebts()));

        return view('financial.debt-consolidation', [
            'debts' => $debts,
            'scenarios' => $this->debtScenarios($debts),
        ]);
    }

    public function transactions(): View
    {
        return view('financial.transactions', [
            'accounts' => [
                ['value' => 'athena-main', 'label' => 'Athena Main (***123)'],
                ['value' => 'savings', 'label' => 'Savings Offset (***456)'],
                ['value' => 'sole-trader', 'label' => 'Sole Trader (***812)'],
            ],
            'activeAccount' => 'athena-main',
            'categories' => [
                ['value' => 'payroll', 'label' => 'Payroll'],
                ['value' => 'software', 'label' => 'Software'],
                ['value' => 'subscriptions', 'label' => 'Subscriptions'],
                ['value' => 'travel', 'label' => 'Travel'],
            ],
            'pendingTransactions' => $this->pendingTransactions(),
        ]);
    }

    public function exportBudgetCsv(Request $request): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $scope = $request->query('scope', 'personal');

        $snapshot = $this->buildBudgetSnapshot($user, $scope);

        $filename = sprintf('athena-budget-%s-%s.csv', $scope, now()->format('Ymd_His'));

        return response()->streamDownload(function () use ($snapshot) {
            $handle = fopen('php://output', 'wb');

            fputcsv($handle, [
                'section',
                'type',
                'category',
                'description',
                'amount',
                'frequency',
                'debt_name',
                'debt_balance',
                'debt_interest_rate',
                'debt_min_payment',
            ]);

            foreach ($snapshot['items'] as $item) {
                fputcsv($handle, [
                    'budget_line',
                    $item->type,
                    $item->category,
                    $item->description,
                    $this->formatExportNumber($item->amount),
                    $item->frequency,
                    '',
                    '',
                    '',
                    '',
                ]);
            }

            foreach ($snapshot['debts'] as $debt) {
                fputcsv($handle, [
                    'debt',
                    '',
                    '',
                    '',
                    '',
                    '',
                    $debt->name,
                    $this->formatExportNumber($debt->balance),
                    $debt->interest_rate,
                    $this->formatExportNumber($debt->min_payment),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function exportBudgetPdf(Request $request): \Illuminate\Http\Response
    {
        $user = $request->user();
        abort_unless($user, 403);

        $scope = $request->query('scope', 'personal');
        $snapshot = $this->buildBudgetSnapshot($user, $scope);

        $pdf = Pdf::loadView('financial.exports.budget-summary', [
            'user' => $user,
            'scope' => $scope,
            'snapshot' => $snapshot,
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        $filename = sprintf('athena-budget-%s-%s.pdf', $scope, now()->format('Ymd_His'));

        return $pdf->download($filename);
    }

    public function importBudgetCsv(Request $request, BudgetSyncService $budgetSync): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $data = $request->validate([
            'scope' => ['required', Rule::in(['personal', 'business'])],
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:4096'],
        ]);

        [$items, $debts] = $this->parseBudgetCsvRows($request->file('csv')->getRealPath());

        if (empty($items) && empty($debts)) {
            return back()->withErrors(['csv' => 'No budget or debt rows found in the uploaded file.'])->withInput();
        }

        $existingBudget = Budget::query()
            ->where('user_id', $user->id)
            ->where('scope', $data['scope'])
            ->first();

        $payload = [
            'scope' => $data['scope'],
            'label' => $existingBudget->label ?? 'Imported budget',
            'currency' => $existingBudget->currency ?? 'AUD',
            'savings_goal_monthly' => $existingBudget->savings_goal_monthly,
            'notes' => $existingBudget->notes,
            'items' => $items,
            'debts' => $debts,
        ];

        $budgetSync->sync($user, $payload);

        return back()->with('status', 'Budget CSV imported successfully.');
    }

    public function moneyInbox(Request $request, BundleConciergeService $bundleConciergeService): View
    {
        $user = $request->user();
        $subscriptions = $this->subscriptionLedger($user);
        $ledgerSummary = $this->ledgerInsights($subscriptions);
        $tradeoffs = $this->tradeoffSuggestions();
        $debts = $this->defaultDebts();
        $scenarios = $this->debtScenarios($debts);
        $latestImportStatus = $user ? Cache::get(ImportUserSubscriptionsJob::cacheKeyFor($user->id)) : null;

        $aiEntryRoute = config('app.platform.ai_entry_route', 'ai.concierge');
        $aiEntryUrl = Route::has($aiEntryRoute) ? route($aiEntryRoute) : url('/ai');
        $rewardsCard = $this->rewardsCardSnapshot($user);
        $this->rewardsDiscountCatalog();
        $this->rewardsCashbackTracker($rewardsCard);
        $this->rewardsPartnerIntakeBlueprint();
        $liveBundleOffer = $user
            ? $user->bundleOffers()->with('lineItems')->latest()->first()
            : null;

        $bundleOfferPayload = $liveBundleOffer
            ? $this->formatBundleOffer($liveBundleOffer)
            : $bundleConciergeService->preview(['currency' => 'AUD']);

        $bundleSeed = $this->bundleSeedPayload($subscriptions);

        $bundleConcierge = [
            'mode' => $liveBundleOffer ? 'live' : 'preview',
            'offer' => $bundleOfferPayload,
            'api' => [
                'create' => Route::has('api.v1.money.bundles.offers.store')
                    ? route('api.v1.money.bundles.offers.store')
                    : null,
                'list' => Route::has('api.v1.money.bundles.offers.index')
                    ? route('api.v1.money.bundles.offers.index')
                    : null,
            ],
        ];

        return view('financial.money-inbox', [
            'subscriptions' => $subscriptions,
            'ledgerSummary' => $ledgerSummary,
            'tradeoffs' => $tradeoffs,
            'debtPulse' => [
                'debts' => $debts,
                'scenarios' => $scenarios,
                'total_balance' => collect($debts)->sum(fn (array $debt) => (float) ($debt['balance'] ?? 0)),
                'min_payment_total' => collect($debts)->sum(fn (array $debt) => (float) ($debt['min_payment'] ?? 0)),
            ],
            'latestImportStatus' => $latestImportStatus,
            'aiEntryUrl' => $aiEntryUrl,
            'aiContexts' => [
                'subscriptions' => [
                    'context' => 'money-budgeting-education',
                    'title' => 'Calm subscription explainer',
                    'guardrails' => 'Educational only. Not financial advice or product recommendations.',
                ],
                'debt' => [
                    'context' => 'sole-trader-statements',
                    'title' => 'Debt consolidation explainer',
                    'guardrails' => 'Helps you reflect on trade-offs. Does not recommend lenders or products.',
                ],
            ],
            'aiConciergeSurface' => 'money_inbox',
            'bundleConcierge' => $bundleConcierge,
            'bundleConciergeSeed' => $bundleSeed,
        ]);
    }

    public function equipment(Request $request): View
    {
        $user = $request->user();
        abort_unless($user, 403);

        $loans = $this->equipmentLoans($user);
        $loanCollection = collect($loans);

        $loanSummary = [
            'total_balance' => (float) $loanCollection->sum(fn ($loan) => (float) ($loan['balance'] ?? 0)),
            'monthly_payment' => (float) $loanCollection->sum(fn ($loan) => (float) ($loan['min_payment'] ?? 0)),
            'avg_rate' => round((float) $loanCollection->avg(fn ($loan) => (float) ($loan['rate'] ?? 0)), 2),
            'active_facilities' => $loanCollection->count(),
        ];

        return view('finance.equipment', [
            'loanSummary' => $loanSummary,
            'loans' => $loans,
            'scenarios' => $this->debtScenarios($loans),
            'lenders' => $this->equipmentLenders(),
            'documents' => $this->equipmentDocumentChecklist(),
            'timeline' => $this->equipmentFundingTimeline(),
            'transactions' => $this->equipmentTransactions($user),
            'aiContext' => [
                'context' => 'business-legal-foundations',
                'title' => 'Equipment financing explainer',
                'guardrails' => 'Educational reflections only. Not financial or lending advice.',
            ],
        ]);
    }

    public function importSubscriptions(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $data = $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:4096'],
            'archive_missing' => ['nullable', 'boolean'],
        ]);
        $csvFile = $request->file('csv');
        $disk = config('money.subscription_import_disk', 'local');
        $storedPath = $csvFile->storeAs(
            sprintf('imports/subscriptions/%d', $user->id),
            now()->format('Ymd_His').'-'.Str::uuid().'.csv',
            $disk
        );

        $statusKey = ImportUserSubscriptionsJob::cacheKeyFor($user->id);
        $statusTtl = now()->addSeconds((int) config('money.subscription_import_status_ttl', 6 * 60 * 60));

        Cache::put($statusKey, [
            'status' => 'queued',
            'queued_at' => now(),
            'original_name' => $csvFile->getClientOriginalName(),
        ], $statusTtl);

        try {
            ImportUserSubscriptionsJob::dispatch(
                $user->id,
                $storedPath,
                (bool) ($data['archive_missing'] ?? false),
                $statusKey,
                $csvFile->getClientOriginalName(),
                $disk
            );
        } catch (Throwable $exception) {
            Log::warning('Subscription import job failed during synchronous dispatch', [
                'user_id' => $user->id,
                'message' => $exception->getMessage(),
            ]);
        }

        return back()->with(
            'status',
            'Import queued. We will process your CSV in the background and surface the latest status on this page.'
        );
    }

    public function importSubscriptionStatus(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $status = Cache::get(ImportUserSubscriptionsJob::cacheKeyFor($user->id));

        return response()->json([
            'status' => $status['status'] ?? null,
            'data' => $status,
        ]);
    }

    /**
     * @return (Budget|Collection|\Illuminate\Database\Eloquent\Collection|array|null)[]
     *
     * @psalm-return array{budget: Budget|null, items: Collection<never, never>|\Illuminate\Database\Eloquent\Collection<int, \App\Models\BudgetItem>, debts: \Illuminate\Database\Eloquent\Collection<int, Debt>, totals: array{income: mixed, expense: mixed, net: mixed, debt_balance: mixed, debt_payments: mixed}}
     */
    private function buildBudgetSnapshot(User $user, string $scope): array
    {
        $budget = Budget::with('items')
            ->where('user_id', $user->id)
            ->where('scope', $scope)
            ->first();

        $items = $budget?->items ?? collect();

        $debts = Debt::query()
            ->where('user_id', $user->id)
            ->where('scope', $scope)
            ->get();

        $income = $items->where('type', 'income')->sum('amount');
        $expense = $items->where('type', 'expense')->sum('amount');
        $debtBalance = $debts->sum('balance');
        $debtPayments = $debts->sum(fn (Debt $debt) => (int) ($debt->min_payment ?? 0));

        return [
            'budget' => $budget,
            'items' => $items,
            'debts' => $debts,
            'totals' => [
                'income' => $income,
                'expense' => $expense,
                'net' => $income - $expense,
                'debt_balance' => $debtBalance,
                'debt_payments' => $debtPayments,
            ],
        ];
    }

    private function formatExportNumber(?int $value): string
    {
        return number_format((float) ($value ?? 0), 2, '.', '');
    }

    /**
     * @return (float|int|mixed|null|string)[][][]
     *
     * @psalm-return list{list<array{amount: int, category: mixed|null|string, description: mixed|null|string, frequency: non-falsy-string, type: 'expense'|'income'}>, list<array{balance: int, interest_rate: float|null, min_payment: int|null, name: non-empty-string}>}
     */
    private function parseBudgetCsvRows(string $path): array
    {
        $file = new SplFileObject($path);
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);

        $headers = null;
        $items = [];
        $debts = [];

        foreach ($file as $row) {
            if ($row === false || $row === [null]) {
                continue;
            }

            if ($headers === null) {
                $headers = $this->normaliseCsvHeader($row);
                continue;
            }

            if ($this->rowIsEmpty($row)) {
                continue;
            }

            $assoc = [];
            foreach ($headers as $index => $column) {
                if ($column === null) {
                    continue;
                }
                $assoc[$column] = $row[$index] ?? null;
            }

            $type = strtolower(trim((string) ($assoc['type'] ?? '')));
            $amount = $this->parseNumeric($assoc['amount'] ?? null);
            $frequency = $this->parseBudgetFrequency($assoc['frequency'] ?? null);

            if ($type !== '' && $amount !== null && $frequency) {
                $items[] = [
                    'type' => in_array($type, ['income', 'expense'], true) ? $type : 'expense',
                    'category' => $assoc['category'] ?? null,
                    'description' => $assoc['description'] ?? null,
                    'amount' => $amount,
                    'frequency' => $frequency,
                ];
            }

            $debtName = trim((string) ($assoc['debt_name'] ?? ($assoc['name'] ?? '')));
            $debtBalance = $this->parseNumeric($assoc['debt_balance'] ?? $assoc['balance'] ?? null);

            if ($debtName !== '' && $debtBalance !== null) {
                $debts[] = [
                    'name' => $debtName,
                    'balance' => $debtBalance,
                    'interest_rate' => $this->parseFloat($assoc['debt_interest_rate'] ?? $assoc['interest_rate'] ?? null),
                    'min_payment' => $this->parseNumeric($assoc['debt_min_payment'] ?? $assoc['min_payment'] ?? null),
                ];
            }
        }

        return [$items, $debts];
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<null|string>
     */
    private function normaliseCsvHeader(array $row): array
    {
        $headers = [];
        foreach ($row as $index => $value) {
            $value = trim((string) $value);
            $headers[$index] = $value === '' ? null : Str::slug($value, '_');
        }

        return $headers;
    }

    private function rowIsEmpty(array $row): bool
    {
        foreach ($row as $value) {
            if (is_string($value) && trim($value) !== '') {
                return false;
            }

            if (!is_string($value) && $value !== null) {
                return false;
            }
        }

        return true;
    }

    private function parseBudgetFrequency(?string $value): string
    {
        $value = strtolower(trim((string) $value));
        $allowed = ['week', 'fortnight', 'month', 'year', 'once'];

        return in_array($value, $allowed, true) ? $value : 'month';
    }

    private function parseNumeric(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_numeric($value)) {
            return (int) round((float) $value);
        }

        $clean = preg_replace('/[^0-9.\-]/', '', (string) $value);

        return is_numeric($clean) ? (int) round((float) $clean) : null;
    }

    private function parseFloat(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $clean = preg_replace('/[^0-9.\-]/', '', (string) $value);

        return is_numeric($clean) ? (float) $clean : null;
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return array<int<0, 3>, array{name: string, frequency: 'monthly', planned_amount: int, actual_amount: int, variance: int}>
     */
    private function budgetCategories(): array
    {
        return collect([
            ['name' => 'Revenue', 'frequency' => 'monthly', 'planned_amount' => 12000, 'actual_amount' => 12650],
            ['name' => 'Subscriptions', 'frequency' => 'monthly', 'planned_amount' => 720, 'actual_amount' => 690],
            ['name' => 'People & Vendors', 'frequency' => 'monthly', 'planned_amount' => 6200, 'actual_amount' => 6100],
            ['name' => 'Savings & Super', 'frequency' => 'monthly', 'planned_amount' => 2500, 'actual_amount' => 2650],
        ])->map(function (array $category) {
            $category['variance'] = $category['actual_amount'] - $category['planned_amount'];

            return $category;
        })->all();
    }


    /**
     * @return ((mixed|null|string)[]|null)[]
     *
     * @psalm-return array<int, array{category: string, current_monthly_cost: mixed|null, current_provider: mixed|null}|null>
     */
    private function bundleSeedPayload(array $subscriptions): array
    {
        $map = [
            'phone' => 'phone',
            'mobile' => 'phone',
            'internet' => 'phone',
            'cloud' => 'entertainment',
            'entertainment' => 'entertainment',
            'streaming' => 'entertainment',
            'wellbeing' => 'health',
            'health' => 'health',
            'insurance' => 'health',
            'electricity' => 'electricity',
            'energy' => 'electricity',
            'fuel' => 'fuel',
            'transport' => 'fuel',
            'car' => 'car_insurance',
            'auto' => 'car_insurance',
            'mortgage' => 'mortgage',
            'housing' => 'mortgage',
        ];

        return collect($subscriptions)
            ->map(function (array $subscription) use ($map) {
                $rawCategory = strtolower((string) ($subscription['category'] ?? ''));
                $bundleCategory = $map[$rawCategory] ?? null;

                if (! $bundleCategory) {
                    return null;
                }

                return [
                    'category' => $bundleCategory,
                    'current_monthly_cost' => $subscription['monthly_cost'] ?? null,
                    'current_provider' => $subscription['provider'] ?? null,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
    /**
     * @psalm-return Collection<int<0, 2>, array{transaction_date: Carbon, description: 'Co-working studio'|'Platform subscription – Athena'|'Women in Tech Summit keynote', reference: 'INV-2043'|'MM-002'|'WTX-881', amount: -480|-129|3200, category: array{name: 'Income'|'Software'|'Workspace', type: 'expense'|'income'}}>
     */
    private function transactionHistory(): Collection
    {
        return collect([
            [
                'transaction_date' => Carbon::now()->subDays(1),
                'description' => 'Co-working studio',
                'reference' => 'INV-2043',
                'amount' => -480,
                'category' => ['name' => 'Workspace', 'type' => 'expense'],
            ],
            [
                'transaction_date' => Carbon::now()->subDays(2),
                'description' => 'Platform subscription – Athena',
                'reference' => 'MM-002',
                'amount' => -129,
                'category' => ['name' => 'Software', 'type' => 'expense'],
            ],
            [
                'transaction_date' => Carbon::now()->subDays(3),
                'description' => 'Women in Tech Summit keynote',
                'reference' => 'WTX-881',
                'amount' => 3200,
                'category' => ['name' => 'Income', 'type' => 'income'],
            ],
        ]);
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return array{labels: list{'Week 1', 'Week 2', 'Week 3', 'Week 4'}, income: list{4200, 6100, 5200, 5000}, expenses: list{3200, 3800, 3500, 3700}}
     */
    private function cashflowSeries(): array
    {
        return [
            'labels' => ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            'income' => [4200, 6100, 5200, 5000],
            'expenses' => [3200, 3800, 3500, 3700],
        ];
    }

    /**
     * @return (float|int|string)[][]
     *
     * @psalm-return list{array{name: 'NAB Business Loan', balance: 58000, rate: float, min_payment: 980}, array{name: 'Equipment Lease', balance: 12000, rate: float, min_payment: 420}, array{name: 'Credit Card', balance: 8500, rate: float, min_payment: 260}}
     */
    private function defaultDebts(): array
    {
        return [
            ['name' => 'NAB Business Loan', 'balance' => 58000, 'rate' => 8.2, 'min_payment' => 980],
            ['name' => 'Equipment Lease', 'balance' => 12000, 'rate' => 9.5, 'min_payment' => 420],
            ['name' => 'Credit Card', 'balance' => 8500, 'rate' => 18.5, 'min_payment' => 260],
        ];
    }

    /**
     * @return (float|int)[][]
     *
     * @psalm-return array<int<0, 1>, array{rate: float, term_months: 48|60, monthly_payment: float, total_paid: float, total_interest: float, savings_vs_current: float}>
     */
    private function debtScenarios(array $debts): array
    {
        $totalBalance = collect($debts)->sum(fn ($debt) => (float) ($debt['balance'] ?? 0));
        $currentPayment = 0;
        foreach ($debts as $debt) {
            $currentPayment += (float) ($debt['min_payment'] ?? 0);
        }
        $currentPayment = max($currentPayment, 1);

        $plans = [
            ['rate' => 7.4, 'term_months' => 60],
            ['rate' => 6.8, 'term_months' => 48],
        ];

        return collect($plans)->map(function (array $plan) use ($totalBalance, $currentPayment) {
            $monthlyPayment = $this->amortisedPayment($totalBalance, $plan['rate'], $plan['term_months']);
            $totalPaid = $monthlyPayment * $plan['term_months'];
            $totalInterest = $totalPaid - $totalBalance;
            $savings = ($currentPayment - $monthlyPayment) * $plan['term_months'];

            return [
                'rate' => $plan['rate'],
                'term_months' => $plan['term_months'],
                'monthly_payment' => round($monthlyPayment, 2),
                'total_paid' => round($totalPaid, 2),
                'total_interest' => round($totalInterest, 2),
                'savings_vs_current' => round($savings, 2),
            ];
        })->all();
    }

    private function amortisedPayment(float $balance, float $annualRatePercent, int $termMonths): float
    {
        if ($termMonths <= 0 || $balance <= 0) {
            return 0;
        }

        $monthlyRate = ($annualRatePercent / 100) / 12;

        if ($monthlyRate === 0.0) {
            return $balance / $termMonths;
        }

        $factor = pow(1 + $monthlyRate, $termMonths);

        return $balance * ($monthlyRate * $factor) / ($factor - 1);
    }

    /**
     * @return (Carbon|int|string)[][]
     *
     * @psalm-return list{array{date: Carbon, description: 'Canva Pro', reference: 'CC-9002', suggested_category: 'software', amount: -26, status: 'matched'}, array{date: Carbon, description: 'Stripe payout', reference: 'STP-8122', suggested_category: 'payroll', amount: 1480, status: 'pending'}, array{date: Carbon, description: 'Uber for Business', reference: 'UB-114', suggested_category: 'travel', amount: -42, status: 'pending'}}
     */
    private function pendingTransactions(): array
    {
        return [
            [
                'date' => Carbon::now()->subDays(1),
                'description' => 'Canva Pro',
                'reference' => 'CC-9002',
                'suggested_category' => 'software',
                'amount' => -26,
                'status' => 'matched',
            ],
            [
                'date' => Carbon::now()->subDays(2),
                'description' => 'Stripe payout',
                'reference' => 'STP-8122',
                'suggested_category' => 'payroll',
                'amount' => 1480,
                'status' => 'pending',
            ],
            [
                'date' => Carbon::now()->subDays(3),
                'description' => 'Uber for Business',
                'reference' => 'UB-114',
                'suggested_category' => 'travel',
                'amount' => -42,
                'status' => 'pending',
            ],
        ];
    }

    /**
     * Load ledger entries from the authenticated user or fall back to the demo set.
     */
    private function subscriptionLedger(?User $user = null): array
    {
        if (! $user) {
            return $this->defaultSubscriptionLedger();
        }

        $records = $user->subscriptions()
            ->where('is_active', true)
            ->orderByDesc('monthly_amount')
            ->limit(100)
            ->get();

        if ($records->isEmpty()) {
            return $user ? [] : $this->defaultSubscriptionLedger();
        }

        return $records
            ->map(fn (UserSubscription $subscription) => $this->mapSubscriptionRecord($subscription))
            ->all();
    }

    /**
     * @return (Carbon|array|bool|float|null|string)[]
     *
     * @psalm-return array{provider: string, service: string, category: string, monthly_cost: float, billing_cycle: string, next_renewal: Carbon|null, is_essential: bool, status: string, tags: array, notes: string}
     */
    private function mapSubscriptionRecord(UserSubscription $subscription): array
    {
        $meta = $subscription->meta ?? [];
        $provider = (string) ($meta['provider'] ?? Str::title(Str::of($subscription->label)->before(' ')->value() ?: 'Subscription'));
        $billingCycle = (string) Str::of($meta['billing_cycle'] ?? 'Monthly')->replace('_', ' ')->title()->value();
        $status = (string) Str::of($meta['status'] ?? ($subscription->is_active ? 'active' : 'paused'))->snake()->value();
        $notes = (string) ($meta['notes'] ?? 'Logged via Money Inbox.');
        $tags = $this->normaliseTags($meta['tags'] ?? [$subscription->category, $subscription->necessity_level], $subscription->category);

        return [
            'provider' => $provider,
            'service' => $subscription->label,
            'category' => $subscription->category,
            'monthly_cost' => (float) $subscription->monthly_amount,
            'billing_cycle' => $billingCycle,
            'next_renewal' => $this->parseRenewalDate($meta['next_renewal'] ?? null),
            'is_essential' => $subscription->necessity_level === 'need',
            'status' => $status,
            'tags' => $tags,
            'notes' => $notes,
        ];
    }

    /**
     * Ensure tag strings remain clean for pill rendering.
     *
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function normaliseTags(mixed $rawTags, string $fallback): array
    {
        $tags = collect(is_array($rawTags) ? $rawTags : [$rawTags])
            ->filter(fn ($tag) => is_string($tag) && trim($tag) !== '')
            ->map(fn ($tag) => Str::of($tag)->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_')->value())
            ->filter()
            ->unique()
            ->values();

        if ($tags->isEmpty()) {
            $tags = collect([$fallback]);
        }

        return $tags->all();
    }

    private function parseRenewalDate(mixed $value): ?Carbon
    {
        if ($value instanceof Carbon) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return (Carbon|bool|int|string|string[])[][]
     *
     * @psalm-return list{array{provider: 'Telstra', service: 'Mobile + roaming', category: 'phone', monthly_cost: 95, billing_cycle: 'Monthly', next_renewal: Carbon, is_essential: true, status: 'active', tags: list{'essential', 'phone'}, notes: 'Includes Asia roaming pack for travel clients.'}, array{provider: 'Optus NBN', service: 'Home internet', category: 'internet', monthly_cost: 79, billing_cycle: 'Monthly', next_renewal: Carbon, is_essential: true, status: 'active', tags: list{'essential', 'home'}, notes: '500 / 50 Mbps. Eligible for loyalty downgrade.'}, array{provider: 'Stan', service: 'Streaming bundle', category: 'entertainment', monthly_cost: 25, billing_cycle: 'Monthly', next_renewal: Carbon, is_essential: false, status: 'planning_to_cancel', tags: list{'luxury', 'household'}, notes: 'Downgrade reminder added for next cycle.'}, array{provider: 'Canva', service: 'Pro workspace', category: 'business', monthly_cost: 18, billing_cycle: 'Monthly', next_renewal: Carbon, is_essential: true, status: 'active', tags: list{'business'}, notes: 'Shared with design mentees.'}, array{provider: 'Apple', service: 'iCloud + Apple Music Family', category: 'cloud', monthly_cost: 32, billing_cycle: 'Monthly', next_renewal: Carbon, is_essential: false, status: 'active', tags: list{'family', 'nice_to_have'}, notes: 'Could shift photos to Google Workspace to save $12/mo.'}, array{provider: 'Anytime Fitness', service: '24/7 access', category: 'wellbeing', monthly_cost: 68, billing_cycle: 'Fortnightly', next_renewal: Carbon, is_essential: false, status: 'active', tags: list{'health'}, notes: 'Eligible for pause during regional travel.'}, array{provider: 'Notion', service: 'Team workspace', category: 'business', monthly_cost: 12, billing_cycle: 'Monthly', next_renewal: Carbon, is_essential: true, status: 'active', tags: list{'business', 'workflow'}, notes: 'Annual plan would save 18%.'}}
     */
    private function defaultSubscriptionLedger(): array
    {
        return [
            [
                'provider' => 'Telstra',
                'service' => 'Mobile + roaming',
                'category' => 'phone',
                'monthly_cost' => 95,
                'billing_cycle' => 'Monthly',
                'next_renewal' => Carbon::now()->addDays(12),
                'is_essential' => true,
                'status' => 'active',
                'tags' => ['essential', 'phone'],
                'notes' => 'Includes Asia roaming pack for travel clients.',
            ],
            [
                'provider' => 'Optus NBN',
                'service' => 'Home internet',
                'category' => 'internet',
                'monthly_cost' => 79,
                'billing_cycle' => 'Monthly',
                'next_renewal' => Carbon::now()->addDays(5),
                'is_essential' => true,
                'status' => 'active',
                'tags' => ['essential', 'home'],
                'notes' => '500 / 50 Mbps. Eligible for loyalty downgrade.',
            ],
            [
                'provider' => 'Stan',
                'service' => 'Streaming bundle',
                'category' => 'entertainment',
                'monthly_cost' => 25,
                'billing_cycle' => 'Monthly',
                'next_renewal' => Carbon::now()->addDays(2),
                'is_essential' => false,
                'status' => 'planning_to_cancel',
                'tags' => ['luxury', 'household'],
                'notes' => 'Downgrade reminder added for next cycle.',
            ],
            [
                'provider' => 'Canva',
                'service' => 'Pro workspace',
                'category' => 'business',
                'monthly_cost' => 18,
                'billing_cycle' => 'Monthly',
                'next_renewal' => Carbon::now()->addDays(9),
                'is_essential' => true,
                'status' => 'active',
                'tags' => ['business'],
                'notes' => 'Shared with design mentees.',
            ],
            [
                'provider' => 'Apple',
                'service' => 'iCloud + Apple Music Family',
                'category' => 'cloud',
                'monthly_cost' => 32,
                'billing_cycle' => 'Monthly',
                'next_renewal' => Carbon::now()->addDays(3),
                'is_essential' => false,
                'status' => 'active',
                'tags' => ['family', 'nice_to_have'],
                'notes' => 'Could shift photos to Google Workspace to save $12/mo.',
            ],
            [
                'provider' => 'Anytime Fitness',
                'service' => '24/7 access',
                'category' => 'wellbeing',
                'monthly_cost' => 68,
                'billing_cycle' => 'Fortnightly',
                'next_renewal' => Carbon::now()->addDays(7),
                'is_essential' => false,
                'status' => 'active',
                'tags' => ['health'],
                'notes' => 'Eligible for pause during regional travel.',
            ],
            [
                'provider' => 'Notion',
                'service' => 'Team workspace',
                'category' => 'business',
                'monthly_cost' => 12,
                'billing_cycle' => 'Monthly',
                'next_renewal' => Carbon::now()->addDays(27),
                'is_essential' => true,
                'status' => 'active',
                'tags' => ['business', 'workflow'],
                'notes' => 'Annual plan would save 18%.',
            ],
        ];
    }

    /**
     * @return (((mixed|string)[]|int|mixed)[]|mixed)[]
     *
     * @psalm-return array{monthly_total: mixed, annualised_total: mixed, essentials: array{count: int, total: mixed}, flexible: array{count: int, total: mixed}, upcoming: array<array{label: string, renewal: mixed, monthly_cost: mixed, status: mixed}>}
     */
    private function ledgerInsights(array $subscriptions): array
    {
        $ledger = collect($subscriptions);
        $monthlyTotal = $ledger->sum('monthly_cost');
        $essentials = $ledger->where('is_essential', true);
        $flexible = $ledger->where('is_essential', false);

        return [
            'monthly_total' => $monthlyTotal,
            'annualised_total' => $monthlyTotal * 12,
            'essentials' => [
                'count' => $essentials->count(),
                'total' => $essentials->sum('monthly_cost'),
            ],
            'flexible' => [
                'count' => $flexible->count(),
                'total' => $flexible->sum('monthly_cost'),
            ],
            'upcoming' => $ledger
                ->filter(fn (array $record) => ! empty($record['next_renewal']))
                ->sortBy('next_renewal')
                ->take(3)
                ->map(fn (array $record) => [
                    'label' => $record['provider'].' · '.$record['service'],
                    'renewal' => optional($record['next_renewal'])->format('d M'),
                    'monthly_cost' => $record['monthly_cost'],
                    'status' => $record['status'],
                ])
                ->all(),
        ];
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return list{array{title: 'Phone plan', scenario: 'Switch to SIM-only plan after contract ends.', current: 95, alternative: 55, annual_saving: 480, emotion: 'Keeps roaming for trips, trims add-ons you rarely use.'}, array{title: 'Streaming stack', scenario: 'Keep Netflix Premium, pause Stan & Disney+ until winter.', current: 60, alternative: 28, annual_saving: 384, emotion: 'No FOMO because key shows are on Netflix this quarter.'}, array{title: 'Wellbeing membership', scenario: 'Downgrade to class-pack while marathon training outdoors.', current: 68, alternative: 35, annual_saving: 396, emotion: 'Still supports the studio, frees budget for physio visits.'}}
     */
    private function tradeoffSuggestions(): array
    {
        return [
            [
                'title' => 'Phone plan',
                'scenario' => 'Switch to SIM-only plan after contract ends.',
                'current' => 95,
                'alternative' => 55,
                'annual_saving' => 480,
                'emotion' => 'Keeps roaming for trips, trims add-ons you rarely use.',
            ],
            [
                'title' => 'Streaming stack',
                'scenario' => 'Keep Netflix Premium, pause Stan & Disney+ until winter.',
                'current' => 60,
                'alternative' => 28,
                'annual_saving' => 384,
                'emotion' => 'No FOMO because key shows are on Netflix this quarter.',
            ],
            [
                'title' => 'Wellbeing membership',
                'scenario' => 'Downgrade to class-pack while marathon training outdoors.',
                'current' => 68,
                'alternative' => 35,
                'annual_saving' => 396,
                'emotion' => 'Still supports the studio, frees budget for physio visits.',
            ],
        ];
    }

    /**
     * @return (Carbon|float|int|string)[]
     *
     * @psalm-return array{holder: string, tier: 'plus'|'standard', status: 'active', card_number: string, points_balance: 1240, lifetime_points: 3860, redeemed_points: 2620, cashback_month: float, cashback_lifetime: float, updated_at: Carbon, renewal_at: Carbon}
     */
    private function rewardsCardSnapshot(?User $user): array
    {
        $cardSeed = $user ? hash('crc32', (string) $user->id.($user->email ?? 'athena')) : 'athena';
        $suffix = strtoupper(Str::substr($cardSeed, 0, 4) ?: 'ATHN');
        $cardNumber = sprintf('ATH-%06d-%s', $user?->id ?? 0, $suffix);

        return [
            'holder' => $user?->preferred_name ?? $user?->name ?? 'Athena member',
            'tier' => $user?->primary_role === 'mentor' ? 'plus' : 'standard',
            'status' => 'active',
            'card_number' => $cardNumber,
            'points_balance' => 1240,
            'lifetime_points' => 3860,
            'redeemed_points' => 2620,
            'cashback_month' => 42.80,
            'cashback_lifetime' => 384.65,
            'updated_at' => Carbon::now()->subMinutes(7),
            'renewal_at' => Carbon::now()->addMonths(11),
        ];
    }

    /**
     * @return (Carbon|string|string[])[][]
     *
     * @psalm-return list{array{partner: 'Everyday Grocer Collective', category: 'Groceries & essentials', offer: '3% cashback on baskets up to $350', how: 'Quote your Athena card ID at checkout or online.', valid_until: Carbon, tags: list{'card-only', 'budget'}, impact: 'Helps cover weekly staples without new credit lines.'}, array{partner: 'SheMoves Fitness & Wellness', category: 'Movement & wellbeing', offer: 'Free recovery class when booking 4x weekly sessions', how: 'Show Athena card in studio or mention during booking.', valid_until: Carbon, tags: list{'women-owned', 'health'}, impact: 'Rewards consistency while respecting rest days.'}, array{partner: 'Glow Lane Beauty Tech', category: 'Beauty & tech', offer: 'Bundle upgrade + 5% store credit on repairs', how: 'Enter your card number within the customer portal.', valid_until: Carbon, tags: list{'member-favorite'}, impact: 'Keeps self-care within a planned budget envelope.'}, array{partner: 'EmpowerFuel Convenience', category: 'Fuel & transport', offer: '2.5¢/L off plus hydration pack once a quarter', how: 'Scan the Athena QR sticker at the bowser.', valid_until: Carbon, tags: list{'commuter'}, impact: 'Small relief for regional travel or school runs.'}}
     */
    private function rewardsDiscountCatalog(): array
    {
        return [
            [
                'partner' => 'Everyday Grocer Collective',
                'category' => 'Groceries & essentials',
                'offer' => '3% cashback on baskets up to $350',
                'how' => 'Quote your Athena card ID at checkout or online.',
                'valid_until' => Carbon::now()->addWeeks(6),
                'tags' => ['card-only', 'budget'],
                'impact' => 'Helps cover weekly staples without new credit lines.',
            ],
            [
                'partner' => 'SheMoves Fitness & Wellness',
                'category' => 'Movement & wellbeing',
                'offer' => 'Free recovery class when booking 4x weekly sessions',
                'how' => 'Show Athena card in studio or mention during booking.',
                'valid_until' => Carbon::now()->addWeeks(10),
                'tags' => ['women-owned', 'health'],
                'impact' => 'Rewards consistency while respecting rest days.',
            ],
            [
                'partner' => 'Glow Lane Beauty Tech',
                'category' => 'Beauty & tech',
                'offer' => 'Bundle upgrade + 5% store credit on repairs',
                'how' => 'Enter your card number within the customer portal.',
                'valid_until' => Carbon::now()->addMonths(3),
                'tags' => ['member-favorite'],
                'impact' => 'Keeps self-care within a planned budget envelope.',
            ],
            [
                'partner' => 'EmpowerFuel Convenience',
                'category' => 'Fuel & transport',
                'offer' => '2.5¢/L off plus hydration pack once a quarter',
                'how' => 'Scan the Athena QR sticker at the bowser.',
                'valid_until' => Carbon::now()->addWeeks(8),
                'tags' => ['commuter'],
                'impact' => 'Small relief for regional travel or school runs.',
            ],
        ];
    }

    /**
     * @return ((Carbon|float|string)[][]|float|int|mixed)[]
     *
     * @psalm-return array{confirmed: float, pending: float, goal: 600, lifetime: float|mixed, events: list{array{label: 'Weekly groceries · Everyday Grocer Collective', amount: float, status: 'pending', expected: Carbon}, array{label: 'Nike Brissy Run Club pop-up', amount: float, status: 'confirmed', expected: Carbon}, array{label: 'Glow Lane device repair', amount: float, status: 'confirmed', expected: Carbon}}, categories: list{array{label: 'Groceries & home', amount: float}, array{label: 'Movement & health', amount: float}, array{label: 'Fuel & transport', amount: float}, array{label: 'Beauty & tech', amount: float}}}
     */
    private function rewardsCashbackTracker(array $cardSnapshot): array
    {
        $confirmed = 318.40;
        $pending = 58.70;
        $goal = 600;

        return [
            'confirmed' => $confirmed,
            'pending' => $pending,
            'goal' => $goal,
            'lifetime' => $cardSnapshot['cashback_lifetime'] ?? ($confirmed + $pending),
            'events' => [
                [
                    'label' => 'Weekly groceries · Everyday Grocer Collective',
                    'amount' => 8.90,
                    'status' => 'pending',
                    'expected' => Carbon::now()->addDays(3),
                ],
                [
                    'label' => 'Nike Brissy Run Club pop-up',
                    'amount' => 12.40,
                    'status' => 'confirmed',
                    'expected' => Carbon::now()->subDays(2),
                ],
                [
                    'label' => 'Glow Lane device repair',
                    'amount' => 21.30,
                    'status' => 'confirmed',
                    'expected' => Carbon::now()->subWeek(),
                ],
            ],
            'categories' => [
                ['label' => 'Groceries & home', 'amount' => 148.25],
                ['label' => 'Movement & health', 'amount' => 92.10],
                ['label' => 'Fuel & transport', 'amount' => 46.05],
                ['label' => 'Beauty & tech', 'amount' => 31.30],
            ],
        ];
    }

    /**
     * @return (string|string[][])[]
     *
     * @psalm-return array{endpoint: string, forms: array{women_owned: array{title: 'Women-owned business onboarding', subtitle: 'Studios, clinics, boutiques, regional service providers under $10m revenue.', subject: 'Athena Rewards · Women-owned partner submission', success_copy: 'Thanks for raising your hand. Partnerships replies within three business days.'}, enterprise: array{title: 'Enterprise & national partner intake', subtitle: 'Banks, utilities, telcos, supermarkets and national wellbeing brands.', subject: 'Athena Rewards · Enterprise partner enquiry', success_copy: 'Your enquiry is with our partnerships lead. Expect a calm reply shortly.'}}}
     */
    private function rewardsPartnerIntakeBlueprint(): array
    {
        return [
            'endpoint' => route('send-mail'),
            'forms' => [
                'women_owned' => [
                    'title' => 'Women-owned business onboarding',
                    'subtitle' => 'Studios, clinics, boutiques, regional service providers under $10m revenue.',
                    'subject' => 'Athena Rewards · Women-owned partner submission',
                    'success_copy' => 'Thanks for raising your hand. Partnerships replies within three business days.',
                ],
                'enterprise' => [
                    'title' => 'Enterprise & national partner intake',
                    'subtitle' => 'Banks, utilities, telcos, supermarkets and national wellbeing brands.',
                    'subject' => 'Athena Rewards · Enterprise partner enquiry',
                    'success_copy' => 'Your enquiry is with our partnerships lead. Expect a calm reply shortly.',
                ],
            ],
        ];
    }

    private function equipmentLoans(?User $user = null): array
    {
        if ($user) {
            $records = $user->debts()
                ->orderByDesc('balance')
                ->limit(6)
                ->get();

            if ($records->isNotEmpty()) {
                return $records->map(function (Debt $debt) {
                    return [
                        'name' => $debt->name ?? 'Equipment facility',
                        'balance' => (float) ($debt->balance ?? 0),
                        'rate' => (float) ($debt->interest_rate ?? 0),
                        'min_payment' => (float) ($debt->min_payment ?? 0),
                    ];
                })->all();
            }
        }

        return $this->defaultDebts();
    }

    /**
     * @return (string|string[])[][]
     *
     * @psalm-return list{array{name: 'First Nations Capital', range: '6.4% – 8.1%', ticket: 'Up to $150k per facility', sla: '48h pre-approval', focus: list{'Clean energy installs', 'Mobile workshops', 'Community-led depots'}}, array{name: 'Regional Women Builders Fund', range: '7.2% – 9.0%', ticket: 'Up to $220k blended finance', sla: '7 day credit memo', focus: list{'Cranes & lifts', 'Safety retrofits', 'Workforce training'}}, array{name: 'Supply Chain Mutual', range: 'Prime + 2.1%', ticket: 'Lines of credit up to $500k', sla: 'Same day drawdown', focus: list{'Inventory', 'Refits', 'Import equipment'}}}
     */
    private function equipmentLenders(): array
    {
        return [
            [
                'name' => 'First Nations Capital',
                'range' => '6.4% – 8.1%',
                'ticket' => 'Up to $150k per facility',
                'sla' => '48h pre-approval',
                'focus' => ['Clean energy installs', 'Mobile workshops', 'Community-led depots'],
            ],
            [
                'name' => 'Regional Women Builders Fund',
                'range' => '7.2% – 9.0%',
                'ticket' => 'Up to $220k blended finance',
                'sla' => '7 day credit memo',
                'focus' => ['Cranes & lifts', 'Safety retrofits', 'Workforce training'],
            ],
            [
                'name' => 'Supply Chain Mutual',
                'range' => 'Prime + 2.1%',
                'ticket' => 'Lines of credit up to $500k',
                'sla' => 'Same day drawdown',
                'focus' => ['Inventory', 'Refits', 'Import equipment'],
            ],
        ];
    }

    /**
     * @return (string|string[])[][]
     *
     * @psalm-return list{array{title: 'Financial snapshot', items: list{'12 months BAS or management reports', 'Aged payables & receivables summary', 'Current debt schedule with rates & residuals'}}, array{title: 'Equipment detail', items: list{'Signed supplier quotes with serial numbers', 'Insurance evidence or intent to bind cover', 'Refurbishment scope or bill of materials'}}, array{title: 'People & safety', items: list{'Updated SafeWork method statement', 'Apprentice supervision plan', 'Copy of current public liability certificate'}}}
     */
    private function equipmentDocumentChecklist(): array
    {
        return [
            [
                'title' => 'Financial snapshot',
                'items' => [
                    '12 months BAS or management reports',
                    'Aged payables & receivables summary',
                    'Current debt schedule with rates & residuals',
                ],
            ],
            [
                'title' => 'Equipment detail',
                'items' => [
                    'Signed supplier quotes with serial numbers',
                    'Insurance evidence or intent to bind cover',
                    'Refurbishment scope or bill of materials',
                ],
            ],
            [
                'title' => 'People & safety',
                'items' => [
                    'Updated SafeWork method statement',
                    'Apprentice supervision plan',
                    'Copy of current public liability certificate',
                ],
            ],
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{array{label: 'Week 0', title: 'Intake + doc upload', detail: 'Share supplier quotes, safety plan, and refreshed financials.'}, array{label: 'Week 1', title: 'Credit memo & term sheet', detail: 'Athena issues blended finance structure with options for grants.'}, array{label: 'Week 2', title: 'Due diligence', detail: 'Site call, asset valuation, and compliance checks for apprentices.'}, array{label: 'Week 3', title: 'Settlement & supplier payment', detail: 'Funds flow directly to suppliers with milestone monitoring enabled.'}}
     */
    private function equipmentFundingTimeline(): array
    {
        return [
            [
                'label' => 'Week 0',
                'title' => 'Intake + doc upload',
                'detail' => 'Share supplier quotes, safety plan, and refreshed financials.',
            ],
            [
                'label' => 'Week 1',
                'title' => 'Credit memo & term sheet',
                'detail' => 'Athena issues blended finance structure with options for grants.',
            ],
            [
                'label' => 'Week 2',
                'title' => 'Due diligence',
                'detail' => 'Site call, asset valuation, and compliance checks for apprentices.',
            ],
            [
                'label' => 'Week 3',
                'title' => 'Settlement & supplier payment',
                'detail' => 'Funds flow directly to suppliers with milestone monitoring enabled.',
            ],
        ];
    }

    /**
     * @return (float|int|string)[][]
     *
     * @psalm-return array<int, array{description: string, amount: float|int, posted_at: string, status: string}>
     */
    private function equipmentTransactions(?User $user = null): array
    {
        if ($user) {
            $records = $user->bankTransactions()
                ->latest('posted_at')
                ->limit(4)
                ->get();

            if ($records->isNotEmpty()) {
                return $records->map(function (BankTransaction $transaction) {
                    return [
                        'description' => $transaction->description,
                        'amount' => (float) $transaction->amount,
                        'posted_at' => optional($transaction->posted_at)->toDateString(),
                        'status' => $transaction->status,
                    ];
                })->all();
            }
        }

        return [
            [
                'description' => 'Milwaukee jobsite kits',
                'amount' => -12450,
                'posted_at' => Carbon::now()->subDays(2)->toDateString(),
                'status' => BankTransaction::STATUS_MATCHED,
            ],
            [
                'description' => 'Prefabricated framing deposit',
                'amount' => -27500,
                'posted_at' => Carbon::now()->subDays(4)->toDateString(),
                'status' => BankTransaction::STATUS_PENDING,
            ],
            [
                'description' => 'ATO instant asset write-off rebate',
                'amount' => 6800,
                'posted_at' => Carbon::now()->subDays(7)->toDateString(),
                'status' => BankTransaction::STATUS_MATCHED,
            ],
            [
                'description' => 'Hydraulic lift maintenance',
                'amount' => -4200,
                'posted_at' => Carbon::now()->subDays(9)->toDateString(),
                'status' => BankTransaction::STATUS_EXCLUDED,
            ],
        ];
    }

    /**
     * @return (((array|float|mixed|null|string)[]|mixed)[]|float|null|string)[]
     *
     * @psalm-return array{bundle_code: string, status: string, currency: string, baseline_monthly_cost: float, projected_monthly_cost: float, projected_savings_monthly: float, projected_savings_annual: float, confidence: float, recommendations: array, success_tracking: array, negotiation_script: null|string, line_items: array<int, array{category: string, label: mixed|string, current_provider: null|string, current_monthly_cost: float, suggested_provider: null|string, suggested_monthly_cost: float, projected_savings_monthly: float, metadata: array}>}
     */
    private function formatBundleOffer(BundleOffer $offer): array
    {
        $offer->loadMissing('lineItems');

        return [
            'bundle_code' => $offer->bundle_code,
            'status' => $offer->status,
            'currency' => $offer->currency,
            'baseline_monthly_cost' => (float) $offer->baseline_monthly_cost,
            'projected_monthly_cost' => (float) $offer->projected_monthly_cost,
            'projected_savings_monthly' => (float) $offer->projected_savings_monthly,
            'projected_savings_annual' => (float) $offer->projected_savings_annual,
            'confidence' => (float) $offer->confidence,
            'recommendations' => $offer->recommendations ?? [],
            'success_tracking' => $offer->success_tracking ?? [],
            'negotiation_script' => $offer->negotiation_script,
            'line_items' => $offer->lineItems->map(function ($item) {
                return [
                    'category' => $item->category,
                    'label' => $item->metadata['label'] ?? Str::title(str_replace('_', ' ', $item->category)),
                    'current_provider' => $item->current_provider,
                    'current_monthly_cost' => (float) $item->current_monthly_cost,
                    'suggested_provider' => $item->suggested_provider,
                    'suggested_monthly_cost' => (float) $item->suggested_monthly_cost,
                    'projected_savings_monthly' => (float) $item->projected_savings_monthly,
                    'metadata' => $item->metadata ?? [],
                ];
            })->all(),
        ];
    }
}

