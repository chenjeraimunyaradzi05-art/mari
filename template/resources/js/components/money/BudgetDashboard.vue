<template>
    <div class="space-y-8" data-testid="money-budget-workspace">
        <section class="rounded-3xl bg-gradient-to-r from-rose-500 via-violet-500 to-indigo-600 p-8 text-white shadow-xl shadow-rose-900/30">
            <p class="text-xs uppercase tracking-[0.4em] text-white/70">Athena money workspace</p>
            <div class="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 class="text-3xl font-semibold tracking-tight">{{ heroTitle }}</h1>
                    <p class="mt-2 text-sm text-white/80">Budget calmly, track debt, and align your money choices with how you want to feel.</p>
                </div>
                <div class="inline-flex items-center gap-2 rounded-full bg-white/15 p-1 text-sm font-semibold">
                    <button
                        type="button"
                        class="rounded-full px-4 py-2 transition"
                        :class="state.scope === 'personal' ? 'bg-white text-rose-600 shadow' : 'text-white/70 hover:text-white'"
                        @click="switchScope('personal')"
                    >
                        Personal
                    </button>
                    <button
                        type="button"
                        class="rounded-full px-4 py-2 transition"
                        :class="state.scope === 'business' ? 'bg-white text-rose-600 shadow' : 'text-white/70 hover:text-white'"
                        @click="switchScope('business')"
                    >
                        Business / Sole trader
                    </button>
                </div>
            </div>
        </section>

        <div v-if="state.loading" class="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <p class="text-sm font-medium text-slate-600">Loading your {{ state.scope }} budget…</p>
        </div>

        <template v-else>
            <div v-if="state.message" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {{ state.message }}
            </div>
            <div v-if="state.error" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {{ state.error }}
            </div>
            <div v-if="hasValidationErrors" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p class="font-semibold">Please review the highlighted fields.</p>
                <ul v-if="state.validation.general.length" class="mt-2 list-disc space-y-1 pl-5">
                    <li v-for="(error, index) in state.validation.general" :key="`general-error-${index}`">{{ error }}</li>
                </ul>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Income planned</p>
                    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ formatCurrency(totals.income) }}</p>
                    <p class="text-xs text-slate-500">Per month across {{ incomeCount }} lines.</p>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Expenses planned</p>
                    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ formatCurrency(totals.expense) }}</p>
                    <p class="text-xs text-slate-500">{{ expenseCount }} categories tracked.</p>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Monthly net</p>
                    <p class="mt-2 text-3xl font-semibold" :class="totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                        {{ formatCurrency(totals.net) }}
                    </p>
                    <p class="text-xs text-slate-500">Income minus expenses.</p>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Debt balance</p>
                    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ formatCurrency(totals.debtBalance) }}</p>
                    <p class="text-xs text-slate-500">Min. payments ≈ {{ formatCurrency(totals.debtPayments) }}/mo</p>
                </div>
            </div>

            <CashflowTimeline
                title="Cashflow timeline"
                description="Projected inflows and outflows for the next 12 months based on your current plan."
                :series="cashflowSeries"
                :currency="currencyCode"
            />

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Budget settings</h2>
                        <p class="text-sm text-slate-500">Give this scope a name, currency, and gentle notes for future you.</p>
                    </div>
                </div>
                <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label class="block text-sm font-semibold text-slate-700">
                        Budget label
                        <input type="text" v-model="state.form.label" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 focus:border-rose-400 focus:ring-rose-400" placeholder="eg. Calm personal runway" />
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Currency
                        <input type="text" v-model="state.form.currency" maxlength="8" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 uppercase focus:border-rose-400 focus:ring-rose-400" />
                    </label>
                </div>
                <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label class="block text-sm font-semibold text-slate-700">
                        Savings goal (monthly)
                        <input type="number" min="0" v-model.number="state.form.savings_goal_monthly" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 focus:border-rose-400 focus:ring-rose-400" placeholder="5000" />
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Notes for Athena
                        <input type="text" v-model="state.form.notes" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 focus:border-rose-400 focus:ring-rose-400" placeholder="Remind me to review super top-ups quarterly." />
                    </label>
                </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Budget lines</h2>
                        <p class="text-sm text-slate-500">Blend income and expenses — Athena keeps the tone gentle.</p>
                    </div>
                    <div class="flex gap-3">
                        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300" @click="addItem('income')">
                            <i class="fas fa-plus"></i>
                            Add income line
                        </button>
                        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300" @click="addItem('expense')">
                            <i class="fas fa-plus"></i>
                            Add expense line
                        </button>
                    </div>
                </div>
                <div class="mt-6 space-y-4">
                    <div v-if="!state.form.items.length" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        No lines yet. Add income or expense rows to start mapping your month.
                    </div>
                    <div v-for="(item, index) in state.form.items" :key="`item-${index}`" class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Type
                                <select v-model="item.type" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                </select>
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Category
                                <input type="text" v-model="item.category" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="eg. Consulting" />
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-2">
                                Description
                                <input type="text" v-model="item.description" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Optional detail" />
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Amount
                                <input type="number" min="0" v-model.number="item.amount" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Frequency
                                <select v-model="item.frequency" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                                    <option v-for="option in frequencies" :key="option.value" :value="option.value">{{ option.label }}</option>
                                </select>
                            </label>
                            <div class="flex items-end justify-end md:col-span-1">
                                <button type="button" class="text-sm font-semibold text-rose-600" @click="removeItem(index)">
                                    Remove
                                </button>
                            </div>
                        </div>
                        <p v-if="state.validation.items[index]" class="mt-2 text-xs text-rose-600">{{ state.validation.items[index] }}</p>
                    </div>
                </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Debts & repayments</h2>
                        <p class="text-sm text-slate-500">Track balances, calm interest context, and the kindest minimum payment you can manage.</p>
                    </div>
                    <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300" @click="addDebt()">
                        <i class="fas fa-plus"></i>
                        Add debt line
                    </button>
                </div>
                <div class="mt-6 space-y-4">
                    <div v-if="!state.form.debts.length" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        Add personal or business debts to keep repayments compassionate and visible.
                    </div>
                    <div v-for="(debt, index) in state.form.debts" :key="`debt-${index}`" class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-2">
                                Name
                                <input type="text" v-model="debt.name" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="eg. NAB business loan" />
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Balance
                                <input type="number" min="0" v-model.number="debt.balance" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Rate %
                                <input type="number" step="0.1" min="0" v-model.number="debt.interest_rate" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 md:col-span-1">
                                Min payment
                                <input type="number" min="0" v-model.number="debt.min_payment" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                            <div class="flex items-end justify-end md:col-span-1">
                                <button type="button" class="text-sm font-semibold text-rose-600" @click="removeDebt(index)">
                                    Remove
                                </button>
                            </div>
                        </div>
                        <p v-if="state.validation.debts[index]" class="mt-2 text-xs text-rose-600">{{ state.validation.debts[index] }}</p>
                    </div>
                </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
                    <div class="flex flex-col gap-4">
                        <div>
                            <h2 class="text-xl font-semibold text-slate-900">Invite Athena to co-pilot</h2>
                            <p class="text-sm text-slate-500">{{ aiReflectionCopy }}</p>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300" @click="launchAiPrompt('budget', aiPrompts.budget)">
                                <i class="fas fa-moon"></i>
                                Ask about this budget
                            </button>
                            <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300" @click="launchAiPrompt('debt', aiPrompts.debt)">
                                <i class="fas fa-seedling"></i>
                                Talk through debts
                            </button>
                            <a :href="aiEntryUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700">
                                <i class="fas fa-arrow-up-right-from-square"></i>
                                Open full AI workspace
                            </a>
                        </div>
                    </div>
                    <div class="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                        <div class="flex flex-col gap-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">AI concierge</p>
                                    <h3 class="text-base font-semibold text-slate-900">Budget reflection</h3>
                                    <p class="text-xs text-slate-500">Snapshot excludes names. Educational only.</p>
                                </div>
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    :disabled="aiAdvice.loading || !canRequestAdvice"
                                    @click="requestBudgetAdvice"
                                >
                                    <i class="fas" :class="aiAdvice.loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
                                    <span>{{ aiAdvice.loading ? 'Reviewing…' : 'Refresh advice' }}</span>
                                </button>
                            </div>
                            <p v-if="!canRequestAdvice" class="text-xs text-slate-500">Add at least one income, expense, or debt line to unlock calm insights.</p>
                            <p v-if="aiAdvice.error" class="text-sm text-rose-600">{{ aiAdvice.error }}</p>
                            <div v-else-if="aiAdvice.headline" class="space-y-3">
                                <p class="text-base font-semibold text-slate-900">{{ aiAdvice.headline }}</p>
                                <div v-if="aiAdvice.insights.length">
                                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Insights</p>
                                    <ul class="mt-2 space-y-2 text-sm text-slate-700">
                                        <li v-for="(insight, index) in aiAdvice.insights" :key="`insight-${index}`" class="flex items-start gap-2">
                                            <span class="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                            <span>{{ insight }}</span>
                                        </li>
                                    </ul>
                                </div>
                                <div v-if="aiAdvice.nudges.length">
                                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Gentle nudges</p>
                                    <ul class="mt-2 space-y-2 text-sm text-slate-700">
                                        <li v-for="(nudge, index) in aiAdvice.nudges" :key="`nudge-${index}`" class="flex items-start gap-2">
                                            <span class="mt-1 h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                                            <span>{{ nudge }}</span>
                                        </li>
                                    </ul>
                                </div>
                                <div v-if="aiAdvice.watch.length">
                                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Watch</p>
                                    <ul class="mt-2 space-y-2 text-sm text-slate-700">
                                        <li v-for="(flag, index) in aiAdvice.watch" :key="`watch-${index}`" class="flex items-start gap-2">
                                            <span class="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                                            <span>{{ flag }}</span>
                                        </li>
                                    </ul>
                                </div>
                                <div v-if="aiAdvice.why.length" class="rounded-2xl border border-slate-200 bg-white/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Why you're seeing this</p>
                                    <ul class="mt-2 space-y-3">
                                        <li v-for="(whyItem, index) in aiAdvice.why" :key="`why-${index}`" class="text-sm text-slate-700">
                                            <p class="font-semibold text-slate-900">{{ whyItem.label || 'Insight' }}</p>
                                            <p v-if="whyItem.detail" class="text-xs text-slate-500">{{ whyItem.detail }}</p>
                                            <p v-if="whyItem.reason" class="mt-1 text-sm text-slate-600">{{ whyItem.reason }}</p>
                                        </li>
                                    </ul>
                                </div>
                                <p v-if="aiAdvice.disclaimer" class="text-xs text-slate-500">{{ aiAdvice.disclaimer }}</p>
                                <p v-if="adviceIsStale" class="text-xs text-amber-600">Budget changed since the last snapshot — refresh for an updated reflection.</p>
                            </div>
                            <p v-else class="text-sm text-slate-600">Athena can review this snapshot the moment you tap refresh.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Bank feed inbox</h2>
                        <p class="text-sm text-slate-500">Review synced transactions, lean on Athena’s category hints, and stage bulk actions before you commit.</p>
                        <p v-if="bankFeed.accounts.length" class="text-xs text-slate-400">
                            {{ bankFeed.accounts.length }} linked {{ bankFeed.accounts.length === 1 ? 'account' : 'accounts' }}
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.loading || bankFeed.bulkLoading"
                            @click="refreshBankFeed"
                        >
                            <i class="fas" :class="bankFeed.loading ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"></i>
                            <span>{{ bankFeed.loading ? 'Refreshing…' : 'Refresh feed' }}</span>
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.importDialog.loading"
                            @click="openImportDialog"
                        >
                            <i class="fas" :class="bankFeed.importDialog.loading ? 'fa-spinner fa-spin' : 'fa-file-import'"></i>
                            <span>{{ bankFeed.importDialog.loading ? 'Uploading…' : 'Import CSV' }}</span>
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.contextDrawer.loading"
                            @click="openContextDrawer"
                        >
                            <i class="fas fa-clock-rotate-left"></i>
                            <span>Recent contexts</span>
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.aiContextLoading"
                            @click="launchBankFeedAi()"
                        >
                            <i class="fas" :class="bankFeed.aiContextLoading ? 'fa-spinner fa-spin' : 'fa-robot'"></i>
                            <span>Ask Athena about this view</span>
                        </button>
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <label class="block text-sm font-semibold text-slate-700">
                        Account
                        <select v-model="bankFeed.accountId" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                            <option value="all">All accounts</option>
                            <option v-for="account in bankFeed.accounts" :key="`account-${account.id}`" :value="String(account.id)">
                                {{ account.account_name }} • {{ account.institution || 'Linked account' }}
                            </option>
                        </select>
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Status
                        <select v-model="bankFeed.filters.status" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                            <option v-for="option in bankStatusOptions" :key="`status-${option.value}`" :value="option.value">
                                {{ option.label }}
                            </option>
                        </select>
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Search
                        <input
                            type="search"
                            v-model="bankFeed.filters.search"
                            placeholder="Description or reference"
                            class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                        />
                    </label>
                    <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                        <input type="checkbox" v-model="bankFeed.filters.flagged" class="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                        Flagged only
                    </label>
                </div>

                <div v-if="bankFeed.message" class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {{ bankFeed.message }}
                </div>
                <div v-if="bankFeed.error" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {{ bankFeed.error }}
                </div>

                <div v-if="anyBankSelection" class="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
                    <p>
                        <span class="font-semibold">{{ selectionCount }}</span>
                        transaction{{ selectionCount === 1 ? '' : 's' }} selected.
                    </p>
                    <div class="flex flex-wrap gap-3">
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.aiContextLoading"
                            @click="launchBankFeedAi(true)"
                        >
                            <i class="fas" :class="bankFeed.aiContextLoading ? 'fa-spinner fa-spin' : 'fa-robot'"></i>
                            Ask Athena
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.bulkLoading"
                            @click="performBulkAction('apply_ai_suggestion')"
                        >
                            <i class="fas fa-wand-magic-sparkles"></i>
                            Apply AI category
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.bulkLoading"
                            @click="openCategoryDialog"
                        >
                            <i class="fas fa-tags"></i>
                            Set category…
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.bulkLoading"
                            @click="performBulkAction('mark_matched')"
                        >
                            <i class="fas fa-check-double"></i>
                            Mark matched
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.bulkLoading"
                            @click="performBulkAction('mark_excluded')"
                        >
                            <i class="fas fa-circle-minus"></i>
                            Exclude
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.bulkLoading"
                            @click="performBulkAction('flag')"
                        >
                            <i class="fas fa-flag"></i>
                            Flag
                        </button>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.bulkLoading"
                            @click="performBulkAction('unflag')"
                        >
                            <i class="fas fa-flag-checkered"></i>
                            Clear flag
                        </button>
                    </div>
                </div>

                <div class="mt-6">
                    <div v-if="bankFeed.loading || bankFeed.accountsLoading" class="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-500">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p class="mt-2 font-medium">Loading transactions…</p>
                    </div>
                    <div v-else-if="!bankHasTransactions" class="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        <p class="font-semibold text-slate-700">No transactions to review yet.</p>
                        <p class="mt-1">Connect a bank feed or import a CSV to start categorising activity.</p>
                    </div>
                    <div v-else class="space-y-4">
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-slate-200 text-sm">
                                <thead class="bg-slate-50/60 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                    <tr>
                                        <th class="px-3 py-3 text-left">
                                            <input type="checkbox" class="h-4 w-4 rounded border-slate-300" :checked="allVisibleSelected" @change="toggleSelectAllVisible" />
                                        </th>
                                        <th class="px-3 py-3 text-left">Date</th>
                                        <th class="px-3 py-3 text-left">Details</th>
                                        <th class="px-3 py-3 text-left">Account</th>
                                        <th class="px-3 py-3 text-left">AI suggestions</th>
                                        <th class="px-3 py-3 text-right">Amount</th>
                                        <th class="px-3 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    <tr v-for="transaction in bankFeed.transactions" :key="`transaction-${transaction.id}`" class="odd:bg-slate-50/40">
                                        <td class="px-3 py-4">
                                            <input type="checkbox" class="h-4 w-4 rounded border-slate-300" :checked="bankFeed.selection.includes(transaction.id)" @change="toggleTransactionSelection(transaction.id)" />
                                        </td>
                                        <td class="px-3 py-4 text-sm text-slate-600">{{ formatDisplayDate(transaction.posted_at) }}</td>
                                        <td class="px-3 py-4">
                                            <p class="text-sm font-semibold text-slate-900">{{ transaction.description }}</p>
                                            <p v-if="transaction.reference" class="text-xs text-slate-500">{{ transaction.reference }}</p>
                                        </td>
                                        <td class="px-3 py-4">
                                            <p class="text-sm text-slate-900">{{ transaction.account?.account_name || 'Any account' }}</p>
                                            <p class="text-xs text-slate-500">{{ transaction.account?.institution || 'Linked feed' }}</p>
                                        </td>
                                        <td class="px-3 py-4">
                                            <p v-if="transaction.category_key" class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                {{ transaction.category_key }}
                                            </p>
                                            <div v-else-if="normaliseSuggestions(transaction).length" class="flex flex-wrap gap-2">
                                                <span v-for="(suggestion, index) in normaliseSuggestions(transaction)" :key="`suggestion-${transaction.id}-${index}`" class="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                                                    {{ describeSuggestion(suggestion) }}
                                                </span>
                                            </div>
                                            <p v-else class="text-xs text-slate-500">Awaiting AI suggestion</p>
                                        </td>
                                        <td class="px-3 py-4 text-right text-sm font-semibold" :class="transaction.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'">
                                            {{ formatCurrency(Math.abs(transaction.amount ?? 0)) }}
                                        </td>
                                        <td class="px-3 py-4 text-right">
                                            <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" :class="bankStatusBadgeClass(transaction.status)">
                                                {{ bankStatusLabel(transaction.status) }}
                                            </span>
                                            <span v-if="transaction.is_flagged" class="ml-2 text-xs text-amber-600">
                                                <i class="fas fa-flag"></i>
                                            </span>
                                            <p
                                                v-if="transaction.ai_last_context_at"
                                                class="mt-2 text-[11px] uppercase tracking-[0.25em] text-slate-400"
                                                :title="formatAbsoluteDateTime(transaction.ai_last_context_at)"
                                            >
                                                AI reviewed {{ formatRelativeTime(transaction.ai_last_context_at) }}
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                            <p>
                                Showing
                                <span class="font-semibold text-slate-900">{{ bankPagination.from }}–{{ bankPagination.to }}</span>
                                of {{ bankPagination.total }}
                            </p>
                            <div class="flex items-center gap-2">
                                <button type="button" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60" :disabled="bankPagination.current_page <= 1 || bankFeed.loading" @click="handlePageChange(bankPagination.current_page - 1)">
                                    Previous
                                </button>
                                <span class="text-xs text-slate-500">Page {{ bankPagination.current_page }} / {{ bankPagination.last_page }}</span>
                                <button type="button" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60" :disabled="bankPagination.current_page >= bankPagination.last_page || bankFeed.loading" @click="handlePageChange(bankPagination.current_page + 1)">
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div class="flex justify-end">
                <button type="button" class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60" :disabled="state.saving || hasValidationErrors" @click="saveBudget">
                    <i class="fas" :class="state.saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>
                    <span>{{ state.saving ? 'Saving…' : 'Save budget & debts' }}</span>
                </button>
            </div>
        </template>
    </div>

    <transition name="fade">
        <div
            v-if="bankFeed.contextDrawer.open"
            class="fixed inset-0 z-40 flex items-stretch"
            @keydown.esc.window="closeContextDrawer"
        >
            <div class="flex-1 bg-slate-900/40" @click="closeContextDrawer"></div>
            <div class="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
                <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Athena history</p>
                        <h3 class="text-lg font-semibold text-slate-900">Recent AI contexts</h3>
                    </div>
                    <div class="flex items-center gap-3">
                        <button
                            type="button"
                            class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="bankFeed.contextDrawer.loading"
                            @click="refreshContextDrawer"
                        >
                            <i class="fas" :class="bankFeed.contextDrawer.loading ? 'fa-spinner fa-spin' : 'fa-rotate'"></i>
                            Refresh
                        </button>
                        <button type="button" class="text-slate-400 transition hover:text-slate-600" @click="closeContextDrawer">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="flex-1 overflow-y-auto px-6 py-5">
                    <div v-if="bankFeed.contextDrawer.loading" class="py-10 text-center text-sm text-slate-500">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p class="mt-2 font-semibold">Loading recent contexts…</p>
                    </div>
                    <div v-else-if="bankFeed.contextDrawer.error" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                        <p class="font-semibold">Unable to load contexts</p>
                        <p class="mt-1">{{ bankFeed.contextDrawer.error }}</p>
                        <button
                            type="button"
                            class="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300"
                            @click="loadRecentContexts({ page: 1, append: false, force: true })"
                        >
                            <i class="fas fa-rotate"></i>
                            Retry
                        </button>
                    </div>
                    <div v-else-if="!bankFeed.contexts.length" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        <p class="font-semibold text-slate-700">No AI sessions yet.</p>
                        <p class="mt-1">Launch “Ask Athena” from the bank feed to build a history.</p>
                    </div>
                    <div v-else class="space-y-4">
                        <article v-for="context in bankFeed.contexts" :key="context.token" class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p class="text-xs uppercase tracking-[0.4em] text-slate-400">
                                        {{ context.created_at ? 'Generated ' + (formatRelativeTime(context.created_at) || formatAbsoluteDateTime(context.created_at)) : 'Context snapshot' }}
                                    </p>
                                    <p class="mt-1 text-sm font-semibold text-slate-900">{{ describeContextFilters(context.filters) }}</p>
                                    <p class="text-xs text-slate-500">
                                        Previewing {{ selectionPreviewCount(context) }} of {{ context.selection_total }} transaction{{ context.selection_total === 1 ? '' : 's' }}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    :disabled="!context.context_payload"
                                    @click="relaunchSavedContext(context)"
                                >
                                    <i class="fas fa-robot"></i>
                                    Reopen in AI
                                </button>
                            </div>
                            <ul v-if="contextPreviewItems(context).length" class="mt-4 space-y-3">
                                <li
                                    v-for="preview in contextPreviewItems(context)"
                                    :key="`${context.token}-${preview.id ?? preview.description ?? preview.posted_at}`"
                                    class="rounded-xl border border-slate-100 bg-white px-3 py-2"
                                >
                                    <div class="flex items-center justify-between gap-3">
                                        <div>
                                            <p class="text-sm font-semibold text-slate-900">{{ preview.description || 'Transaction' }}</p>
                                            <p class="text-xs text-slate-500">
                                                {{ preview.posted_at_display || formatDisplayDate(preview.posted_at) || 'No date' }}
                                            </p>
                                        </div>
                                        <span class="text-xs font-semibold" :class="preview.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'">
                                            {{ formatCurrency(Math.abs(preview.amount ?? 0)) }}
                                        </span>
                                    </div>
                                </li>
                            </ul>
                            <p v-if="remainingPreviewCount(context) > 0" class="mt-3 text-xs text-slate-500">
                                + {{ remainingPreviewCount(context) }} more transaction{{ remainingPreviewCount(context) === 1 ? '' : 's' }} captured in this context.
                            </p>
                        </article>
                        <div v-if="hasMoreContexts" class="pt-2 text-center">
                            <button
                                type="button"
                                class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="bankFeed.contextDrawer.loadingMore"
                                @click="loadOlderContexts"
                            >
                                <i class="fas" :class="bankFeed.contextDrawer.loadingMore ? 'fa-spinner fa-spin' : 'fa-clock-rotate-left'"></i>
                                {{ bankFeed.contextDrawer.loadingMore ? 'Fetching history…' : 'Load older contexts' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>

    <transition name="fade">
        <div v-if="bankFeed.categoryDialog.open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
            <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-slate-900">Apply a category</h3>
                        <p class="text-sm text-slate-500">This override marks all selected transactions as matched.</p>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeCategoryDialog">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mt-4 space-y-4">
                    <label class="block text-sm font-semibold text-slate-700">
                        Category key
                        <input
                            type="text"
                            v-model="bankFeed.categoryDialog.category"
                            class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-rose-400 focus:ring-rose-400"
                            placeholder="eg. software"
                        />
                    </label>
                    <p v-if="bankFeed.categoryDialog.error" class="text-sm text-rose-600">{{ bankFeed.categoryDialog.error }}</p>
                </div>
                <div class="mt-6 flex justify-end gap-3">
                    <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" @click="closeCategoryDialog">
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
                        :disabled="bankFeed.bulkLoading"
                        @click="submitCategoryDialog"
                    >
                        <i class="fas" :class="bankFeed.bulkLoading ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                        Apply
                    </button>
                </div>
            </div>
        </div>
    </transition>

    <transition name="fade">
        <div v-if="bankFeed.importDialog.open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
            <div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-slate-900">Import transactions CSV</h3>
                        <p class="text-sm text-slate-500">Upload a CSV export to backfill your bank feed without waiting on syncs.</p>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeImportDialog">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mt-4 space-y-4">
                    <label class="block text-sm font-semibold text-slate-700">
                        CSV file
                        <input
                            type="file"
                            :key="bankFeed.importDialog.resetKey"
                            accept=".csv,text/csv"
                            class="mt-2 w-full rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-sm"
                            @change="handleImportFileChange"
                        />
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Target account
                        <select v-model="bankFeed.importDialog.accountId" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                            <option value="auto">Auto detect from CSV / create if missing</option>
                            <option v-for="account in bankFeed.accounts" :key="`import-account-${account.id}`" :value="String(account.id)">
                                {{ account.account_name }} • {{ account.institution || 'Linked account' }}
                            </option>
                        </select>
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Default status
                        <select v-model="bankFeed.importDialog.defaultStatus" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                            <option value="pending">Pending review</option>
                            <option value="matched">Matched</option>
                            <option value="excluded">Excluded</option>
                        </select>
                    </label>
                    <p v-if="bankFeed.importDialog.error" class="text-sm text-rose-600">{{ bankFeed.importDialog.error }}</p>
                    <div v-if="bankFeed.importDialog.success" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        <p class="font-semibold">{{ bankFeed.importDialog.success }}</p>
                        <dl v-if="bankFeed.importDialog.stats" class="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Created</dt>
                                <dd class="text-base font-semibold text-slate-900">{{ bankFeed.importDialog.stats.created }}</dd>
                            </div>
                            <div>
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Updated</dt>
                                <dd class="text-base font-semibold text-slate-900">{{ bankFeed.importDialog.stats.updated }}</dd>
                            </div>
                            <div>
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Unchanged</dt>
                                <dd class="text-base font-semibold text-slate-900">{{ bankFeed.importDialog.stats.unchanged }}</dd>
                            </div>
                            <div>
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Skipped</dt>
                                <dd class="text-base font-semibold text-slate-900">{{ bankFeed.importDialog.stats.skipped }}</dd>
                            </div>
                        </dl>
                    </div>
                    <div v-if="bankFeed.importDialog.warnings.length" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p class="font-semibold">Warnings</p>
                        <ul class="mt-2 list-disc space-y-1 pl-5">
                            <li v-for="(warning, index) in bankFeed.importDialog.warnings" :key="`import-warning-${index}`">{{ warning }}</li>
                        </ul>
                    </div>
                </div>
                <div class="mt-6 flex justify-end gap-3">
                    <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" :disabled="bankFeed.importDialog.loading" @click="closeImportDialog">
                        {{ bankFeed.importDialog.success ? 'Close' : 'Cancel' }}
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
                        :disabled="bankFeed.importDialog.loading"
                        @click="submitImportDialog"
                    >
                        <i class="fas" :class="bankFeed.importDialog.loading ? 'fa-spinner fa-spin' : 'fa-file-import'"></i>
                        <span>{{ bankFeed.importDialog.loading ? 'Importing…' : 'Import CSV' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue';
import axios from 'axios';
import CashflowTimeline from './CashflowTimeline.vue';

const props = defineProps({
    user: {
        type: Object,
        required: true,
    },
    ai: {
        type: Object,
        default: () => ({
            entryUrl: '/ai',
            contexts: {},
        }),
    },
});

const projectionMonths = 12;

const frequencies = [
    { value: 'week', label: 'Weekly' },
    { value: 'fortnight', label: 'Fortnightly' },
    { value: 'month', label: 'Monthly' },
    { value: 'year', label: 'Yearly' },
    { value: 'once', label: 'Once-off' },
];

const createDefaultForm = () => ({
    label: '',
    currency: 'AUD',
    savings_goal_monthly: null,
    notes: '',
    items: [],
    debts: [],
});

const state = reactive({
    scope: 'personal',
    loading: true,
    saving: false,
    message: '',
    error: '',
    form: createDefaultForm(),
    validation: {
        general: [],
        items: {},
        debts: {},
    },
});

const aiAdvice = reactive({
    loading: false,
    error: '',
    headline: '',
    insights: [],
    nudges: [],
    watch: [],
    why: [],
    disclaimer: '',
    lastSnapshot: '',
});

const bankFeed = reactive({
    accountsLoading: false,
    loading: false,
    bulkLoading: false,
    aiContextLoading: false,
    message: '',
    error: '',
    accounts: [],
    accountId: 'all',
    transactions: [],
    meta: null,
    contexts: [],
    contextsLoaded: false,
    contextsMeta: null,
    filters: {
        status: 'pending',
        flagged: false,
        search: '',
    },
    selection: [],
    categoryDialog: {
        open: false,
        category: '',
        error: '',
    },
    contextDrawer: {
        open: false,
        loading: false,
        loadingMore: false,
        error: '',
        trackedOpen: false,
        surface: 'money_budget',
    },
    importDialog: {
        open: false,
        accountId: 'auto',
        defaultStatus: 'pending',
        file: null,
        loading: false,
        error: '',
        success: '',
        warnings: [],
        stats: null,
        resetKey: 0,
    },
});

const heroTitle = computed(() => {
    const pronouns = props.user?.pronouns ? ` (${props.user.pronouns})` : '';
    return `${props.user?.name ?? 'Athena member'}${pronouns}`;
});

const currencyCode = computed(() => state.form.currency?.toUpperCase() || 'AUD');
const aiEntryUrl = computed(() => props.ai?.entryUrl || '/ai');
const aiContexts = computed(() => props.ai?.contexts ?? {});
const hasValidationErrors = computed(() =>
    state.validation.general.length > 0
        || Object.keys(state.validation.items).length > 0
        || Object.keys(state.validation.debts).length > 0,
);

const bankStatusOptions = [
    { value: 'pending', label: 'Pending review' },
    { value: 'matched', label: 'Matched' },
    { value: 'excluded', label: 'Excluded' },
    { value: 'all', label: 'All statuses' },
];

const bankStatusPresentation = {
    pending: {
        label: 'Pending review',
        classes: 'border border-amber-200 bg-amber-50 text-amber-700',
    },
    matched: {
        label: 'Matched',
        classes: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    excluded: {
        label: 'Excluded',
        classes: 'border border-slate-200 bg-slate-50 text-slate-600',
    },
};

const selectionCount = computed(() => bankFeed.selection.length);
const anyBankSelection = computed(() => selectionCount.value > 0);
const allVisibleSelected = computed(() =>
    bankFeed.transactions.length > 0
        && bankFeed.transactions.every((transaction) => bankFeed.selection.includes(transaction.id)),
);
const bankHasTransactions = computed(() => bankFeed.transactions.length > 0);
const bankPagination = computed(() => bankFeed.meta ?? {
    current_page: 1,
    last_page: 1,
    from: bankFeed.transactions.length ? 1 : 0,
    to: bankFeed.transactions.length,
    total: bankFeed.transactions.length,
});

const hasMoreContexts = computed(() => {
    const meta = bankFeed.contextsMeta;

    if (!meta) {
        return false;
    }

    return (meta.current_page ?? 1) < (meta.last_page ?? 1);
});

const totals = computed(() => {
    const income = state.form.items
        .filter((item) => item.type === 'income')
        .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const expense = state.form.items
        .filter((item) => item.type === 'expense')
        .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const debtBalance = state.form.debts.reduce((sum, debt) => sum + toNumber(debt.balance), 0);
    const debtPayments = state.form.debts.reduce((sum, debt) => sum + toNumber(debt.min_payment), 0);

    return {
        income,
        expense,
        net: income - expense,
        debtBalance,
        debtPayments,
    };
});

const cashflowSeries = computed(() => buildCashflowSeries());

const incomeCount = computed(() => state.form.items.filter((item) => item.type === 'income').length);
const expenseCount = computed(() => state.form.items.filter((item) => item.type === 'expense').length);
const latestSnapshot = computed(() => buildSnapshotForAi());
const canRequestAdvice = computed(() => {
    const totalsValue = totals.value;
    const hasNotes = Boolean(state.form.notes && state.form.notes.trim().length > 0);

    return state.form.items.length > 0
        || state.form.debts.length > 0
        || totalsValue.income > 0
        || totalsValue.expense > 0
        || hasNotes;
});
const adviceIsStale = computed(() => Boolean(aiAdvice.headline) && aiAdvice.lastSnapshot !== latestSnapshot.value);

const switchScope = (scope) => {
    if (state.scope === scope || state.saving) {
        return;
    }

    state.scope = scope;
    resetAiAdvice();
    loadBudget();
};

const resetValidation = () => {
    state.validation.general = [];
    state.validation.items = {};
    state.validation.debts = {};
};

const validateForm = () => {
    resetValidation();

    if (state.form.currency && !/^[A-Za-z]{3,8}$/i.test(state.form.currency.trim())) {
        state.validation.general.push('Currency should be 3–8 letters (e.g. AUD, USD).');
    }

    if (state.form.label && state.form.label.length > 255) {
        state.validation.general.push('Budget label is a little long. Keep it under 255 characters.');
    }

    state.form.items.forEach((item, index) => {
        const issues = [];
        if (!item.type) {
            issues.push('Choose income or expense.');
        }
        if (!item.frequency) {
            issues.push('Select a frequency.');
        }
        if (toNumber(item.amount) <= 0) {
            issues.push('Amount should be greater than zero.');
        }
        if (issues.length) {
            state.validation.items[index] = issues.join(' ');
        }
    });

    state.form.debts.forEach((debt, index) => {
        const issues = [];
        const hasAnyValue = [debt.name, debt.balance, debt.interest_rate, debt.min_payment].some((value) => value !== null && value !== '' && value !== undefined);

        if (!hasAnyValue) {
            return;
        }

        if (!debt.name) {
            issues.push('Give this debt a name.');
        }
        if (toNumber(debt.balance) <= 0) {
            issues.push('Balance should be above zero.');
        }
        if (issues.length) {
            state.validation.debts[index] = issues.join(' ');
        }
    });

    return state.validation.general.length > 0
        || Object.keys(state.validation.items).length > 0
        || Object.keys(state.validation.debts).length > 0;
};

const loadBudget = async () => {
    state.loading = true;
    state.error = '';
    state.message = '';

    try {
        const { data } = await axios.get('/api/v1/money/budget', {
            params: { scope: state.scope },
        });

        const budget = data.budget ?? {};
        const debts = data.debts ?? [];

        state.form = {
            ...createDefaultForm(),
            label: budget.label ?? '',
            currency: budget.currency ?? 'AUD',
            savings_goal_monthly: budget.savings_goal_monthly ?? null,
            notes: budget.notes ?? '',
            items: (budget.items ?? []).map((item) => mapItem(item)),
            debts: debts.map((debt) => mapDebt(debt)),
        };

        resetValidation();
    } catch (error) {
        state.error = extractError(error) ?? 'Unable to load your budget right now.';
        state.form = {
            ...createDefaultForm(),
            currency: state.scope === 'business' ? 'AUD' : state.form.currency ?? 'AUD',
        };

        resetValidation();
    } finally {
        state.loading = false;
    }
};

const loadBankAccounts = async () => {
    bankFeed.accountsLoading = true;
    bankFeed.error = '';

    try {
        const { data } = await axios.get('/api/v1/money/bank-accounts');
        const accounts = data?.data ?? data?.accounts ?? [];
        bankFeed.accounts = accounts;

        if (accounts.length === 0) {
            bankFeed.accountId = 'all';
        } else if (bankFeed.accountId !== 'all') {
            const stillExists = accounts.some((account) => String(account.id) === String(bankFeed.accountId));
            if (!stillExists) {
                bankFeed.accountId = 'all';
            }
        }
    } catch (error) {
        bankFeed.error = extractError(error) ?? 'Unable to load your bank accounts right now.';
        bankFeed.accounts = [];
        bankFeed.accountId = 'all';
    } finally {
        bankFeed.accountsLoading = false;
    }
};

const buildTransactionParams = (page = 1) => {
    const params = {
        page,
        per_page: 25,
    };

    if (bankFeed.accountId && bankFeed.accountId !== 'all') {
        params.account_id = Number(bankFeed.accountId);
    }

    const statusFilter = bankFeed.filters.status;
    if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
    }

    if (bankFeed.filters.flagged) {
        params.flagged = 1;
    }

    const searchTerm = bankFeed.filters.search?.trim();
    if (searchTerm) {
        params.search = searchTerm;
    }

    return params;
};

const buildBankFeedAiFilters = () => {
    const filters = {
        status: bankFeed.filters.status,
        flagged: bankFeed.filters.flagged,
    };

    if (bankFeed.accountId && bankFeed.accountId !== 'all') {
        filters.account_id = Number(bankFeed.accountId);
    }

    const searchTerm = bankFeed.filters.search?.trim();
    if (searchTerm) {
        filters.search = searchTerm;
    }

    return filters;
};

const loadTransactions = async (page = 1) => {
    bankFeed.loading = true;
    bankFeed.error = '';

    try {
        const params = buildTransactionParams(page);
        const { data } = await axios.get('/api/v1/money/bank-transactions', { params });
        bankFeed.transactions = data?.data ?? [];
        bankFeed.meta = data?.meta ?? null;
        bankFeed.selection = [];
    } catch (error) {
        bankFeed.error = extractError(error) ?? 'Unable to load your transactions right now.';
        bankFeed.transactions = [];
        bankFeed.meta = null;
    } finally {
        bankFeed.loading = false;
    }
};

const loadRecentContexts = async ({
    page = 1,
    append = false,
    force = false,
    trackOpen = false,
} = {}) => {
    if (page === 1 && bankFeed.contextDrawer.loading) {
        return;
    }

    if (page > 1 && bankFeed.contextDrawer.loadingMore) {
        return;
    }

    if (!force && page === 1 && bankFeed.contextsLoaded && !trackOpen) {
        return;
    }

    if (page === 1) {
        bankFeed.contextDrawer.loading = true;
    } else {
        bankFeed.contextDrawer.loadingMore = true;
    }

    bankFeed.contextDrawer.error = '';

    try {
        const params = {
            page,
            per_page: 10,
        };

        if (trackOpen) {
            params.track_open = 1;
        }

        if (bankFeed.contextDrawer.surface) {
            params.surface = bankFeed.contextDrawer.surface;
        }

        const { data } = await axios.get('/api/v1/money/bank-transactions/ai-contexts', { params });
        const contexts = Array.isArray(data?.data) ? data.data : [];
        bankFeed.contextsMeta = data?.meta ?? null;
        bankFeed.contextsLoaded = true;

        bankFeed.contexts = append ? [...bankFeed.contexts, ...contexts] : contexts;
    } catch (error) {
        bankFeed.contextDrawer.error = extractError(error) ?? 'Unable to load recent contexts right now.';

        if (!append) {
            bankFeed.contexts = [];
            bankFeed.contextsMeta = null;
        }
    } finally {
        if (page === 1) {
            bankFeed.contextDrawer.loading = false;
        } else {
            bankFeed.contextDrawer.loadingMore = false;
        }
    }
};

const openContextDrawer = async () => {
    bankFeed.contextDrawer.open = true;

    const shouldTrack = !bankFeed.contextDrawer.trackedOpen;

    if (!bankFeed.contextsLoaded || shouldTrack) {
        await loadRecentContexts({ page: 1, append: false, force: true, trackOpen: shouldTrack });

        if (shouldTrack) {
            bankFeed.contextDrawer.trackedOpen = true;
        }
    }
};

const closeContextDrawer = () => {
    bankFeed.contextDrawer.open = false;
};

const refreshContextDrawer = () => {
    loadRecentContexts({ page: 1, append: false, force: true });
};

const loadOlderContexts = async () => {
    if (!hasMoreContexts.value) {
        return;
    }

    const nextPage = (bankFeed.contextsMeta?.current_page ?? 1) + 1;
    await loadRecentContexts({ page: nextPage, append: true });
};

const relaunchSavedContext = (context) => {
    if (!context || !context.context_payload) {
        return;
    }

    const prompt = context.prompt || 'Help me review these transactions with care.';
    launchAiPrompt('bankFeed', prompt, context.context_payload);
};

const contextPreviewItems = (context) => {
    if (!context || !Array.isArray(context.selection_preview)) {
        return [];
    }

    return context.selection_preview.slice(0, 3);
};

const selectionPreviewCount = (context) => (Array.isArray(context?.selection_preview) ? context.selection_preview.length : 0);

const remainingPreviewCount = (context) => {
    const previewCount = selectionPreviewCount(context);
    const total = Number(context?.selection_total ?? 0);

    return Math.max(total - previewCount, 0);
};

const refreshBankFeed = () => {
    if (bankFeed.loading) {
        return;
    }

    const currentPage = bankFeed.meta?.current_page ?? 1;
    loadTransactions(currentPage);
};

const handlePageChange = (page) => {
    if (bankFeed.loading) {
        return;
    }

    const lastPage = bankFeed.meta?.last_page ?? 1;
    const targetPage = Math.min(Math.max(page, 1), lastPage);
    loadTransactions(targetPage);
};

const toggleTransactionSelection = (transactionId) => {
    const index = bankFeed.selection.indexOf(transactionId);

    if (index >= 0) {
        bankFeed.selection.splice(index, 1);
    } else {
        bankFeed.selection.push(transactionId);
    }
};

const toggleSelectAllVisible = () => {
    if (allVisibleSelected.value) {
        bankFeed.selection = [];
        return;
    }

    bankFeed.selection = bankFeed.transactions.map((transaction) => transaction.id);
};

const performBulkAction = async (action, category = null) => {
    if (!anyBankSelection.value || bankFeed.bulkLoading) {
        return;
    }

    if (action === 'set_category' && (!category || !category.trim())) {
        bankFeed.categoryDialog.error = 'Add a category before applying.';
        return;
    }

    bankFeed.bulkLoading = true;
    bankFeed.error = '';
    bankFeed.message = '';

    try {
        const payload = {
            action,
            transaction_ids: [...bankFeed.selection],
        };

        if (action === 'set_category' && category) {
            payload.category_key = category;
        }

        const { data } = await axios.post('/api/v1/money/bank-transactions/bulk', payload);

        bankFeed.message = data?.message ?? 'Bulk action applied.';
        if (typeof data?.skipped === 'number' && data.skipped > 0) {
            bankFeed.message += ` (${data.skipped} skipped)`;
        }

        bankFeed.selection = [];
        const currentPage = bankPagination.value?.current_page ?? 1;
        await loadTransactions(currentPage);
    } catch (error) {
        bankFeed.error = extractError(error) ?? 'Unable to apply that bulk action right now.';
    } finally {
        bankFeed.bulkLoading = false;
    }
};

const launchBankFeedAi = async (requireSelection = false) => {
    if (requireSelection && !anyBankSelection.value) {
        return;
    }

    if (bankFeed.aiContextLoading) {
        return;
    }

    bankFeed.error = '';

    const payload = {
        transaction_ids: [...bankFeed.selection],
        filters: buildBankFeedAiFilters(),
        surface: bankFeed.contextDrawer.surface,
    };

    try {
        bankFeed.aiContextLoading = true;
        const { data } = await axios.post('/api/v1/money/bank-transactions/ai-context', payload);

        const prompt = data?.prompt || 'Help me categorise these transactions with care.';
        const contextPayload = data?.context_payload || null;

        launchAiPrompt('bankFeed', prompt, contextPayload);

        if (bankFeed.contextsLoaded) {
            await loadRecentContexts({ page: 1, append: false, force: true });
        }
    } catch (error) {
        bankFeed.error = extractError(error) ?? 'Unable to prepare the AI context right now.';
    } finally {
        bankFeed.aiContextLoading = false;
    }
};

const openCategoryDialog = () => {
    bankFeed.categoryDialog.open = true;
    bankFeed.categoryDialog.error = '';
    bankFeed.categoryDialog.category = '';
};

const closeCategoryDialog = () => {
    bankFeed.categoryDialog.open = false;
    bankFeed.categoryDialog.error = '';
    bankFeed.categoryDialog.category = '';
};

const submitCategoryDialog = async () => {
    const categoryValue = bankFeed.categoryDialog.category?.trim();

    if (!categoryValue) {
        bankFeed.categoryDialog.error = 'Add a category key before applying.';
        return;
    }

    bankFeed.categoryDialog.error = '';
    await performBulkAction('set_category', categoryValue);
    closeCategoryDialog();
};

const openImportDialog = () => {
    bankFeed.importDialog.open = true;
    bankFeed.importDialog.error = '';
    bankFeed.importDialog.success = '';
    bankFeed.importDialog.warnings = [];
    bankFeed.importDialog.stats = null;
    bankFeed.importDialog.loading = false;
    bankFeed.importDialog.file = null;
    bankFeed.importDialog.resetKey += 1;
    bankFeed.importDialog.accountId = bankFeed.accountId !== 'all' ? String(bankFeed.accountId) : 'auto';
    bankFeed.importDialog.defaultStatus = bankFeed.filters.status && bankFeed.filters.status !== 'all'
        ? bankFeed.filters.status
        : 'pending';
};

const closeImportDialog = () => {
    bankFeed.importDialog.open = false;
    bankFeed.importDialog.error = '';
    bankFeed.importDialog.success = '';
    bankFeed.importDialog.warnings = [];
    bankFeed.importDialog.stats = null;
    bankFeed.importDialog.loading = false;
    bankFeed.importDialog.file = null;
    bankFeed.importDialog.resetKey += 1;
};

const handleImportFileChange = (event) => {
    const file = event?.target?.files?.[0] ?? null;
    bankFeed.importDialog.file = file || null;
};

const submitImportDialog = async () => {
    if (bankFeed.importDialog.loading) {
        return;
    }

    if (!bankFeed.importDialog.file) {
        bankFeed.importDialog.error = 'Choose a CSV file before importing.';
        return;
    }

    bankFeed.importDialog.error = '';
    bankFeed.importDialog.success = '';
    bankFeed.importDialog.warnings = [];
    bankFeed.importDialog.stats = null;
    bankFeed.importDialog.loading = true;

    const formData = new FormData();
    formData.append('csv', bankFeed.importDialog.file);

    const selectedAccount = bankFeed.importDialog.accountId;
    if (selectedAccount && selectedAccount !== 'auto') {
        const numericId = Number(selectedAccount);
        if (!Number.isNaN(numericId)) {
            formData.append('account_id', numericId);
        }
    }

    const defaultStatus = bankFeed.importDialog.defaultStatus || 'pending';
    formData.append('default_status', defaultStatus);

    try {
        const { data } = await axios.post('/api/v1/money/bank-transactions/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        bankFeed.importDialog.success = data?.message ?? 'Import complete.';
        bankFeed.importDialog.stats = data?.stats ?? null;
        bankFeed.importDialog.warnings = Array.isArray(data?.warnings) ? data.warnings : [];
        bankFeed.importDialog.file = null;
        bankFeed.importDialog.resetKey += 1;
        bankFeed.message = data?.message ?? 'Import complete.';

        await loadBankAccounts();
        const currentPage = bankFeed.meta?.current_page ?? 1;
        await loadTransactions(currentPage);
    } catch (error) {
        bankFeed.importDialog.error = extractError(error) ?? 'Unable to import that CSV right now.';
    } finally {
        bankFeed.importDialog.loading = false;
    }
};

const saveBudget = async () => {
    state.error = '';
    state.message = '';

    const hasErrors = validateForm();

    if (hasErrors) {
        state.error = 'Please review the highlighted fields before saving.';
        return;
    }

    state.saving = true;

    try {
        const preparedItems = state.form.items
            .filter((item) => item.type && toNumber(item.amount) > 0)
            .map((item) => ({
                id: item.id ?? null,
                type: item.type,
                category: item.category || null,
                description: item.description || null,
                amount: Math.round(toNumber(item.amount)),
                frequency: item.frequency,
            }));

        const preparedDebts = state.form.debts
            .filter((debt) => debt.name && toNumber(debt.balance) > 0)
            .map((debt) => ({
                id: debt.id ?? null,
                name: debt.name,
                balance: Math.round(toNumber(debt.balance)),
                interest_rate: nullableFloat(debt.interest_rate),
                min_payment: nullableNumber(debt.min_payment),
            }));

        const payload = {
            scope: state.scope,
            label: state.form.label || null,
            currency: state.form.currency || 'AUD',
            savings_goal_monthly: nullableNumber(state.form.savings_goal_monthly),
            notes: state.form.notes || null,
            items: preparedItems,
            debts: preparedDebts,
        };

        const { data } = await axios.post('/api/v1/money/budget', payload);
        state.message = data.message ?? 'Budget saved.';

        state.form = {
            ...state.form,
            label: data.budget?.label ?? payload.label ?? '',
            currency: data.budget?.currency ?? payload.currency,
            savings_goal_monthly: data.budget?.savings_goal_monthly ?? payload.savings_goal_monthly,
            notes: data.budget?.notes ?? payload.notes ?? '',
            items: (data.budget?.items ?? payload.items ?? []).map((item) => mapItem(item)),
            debts: (data.debts ?? payload.debts ?? []).map((debt) => mapDebt(debt)),
        };
    } catch (error) {
        state.error = extractError(error) ?? 'Unable to save your budget right now.';
    } finally {
        state.saving = false;
    }
};

const addItem = (type = 'expense') => {
    state.form.items.push({
        id: null,
        type,
        category: '',
        description: '',
        amount: 0,
        frequency: 'month',
    });

    resetValidation();
};

const removeItem = (index) => {
    state.form.items.splice(index, 1);

    resetValidation();
};

const addDebt = () => {
    state.form.debts.push({
        id: null,
        name: '',
        balance: 0,
        interest_rate: null,
        min_payment: null,
    });

    resetValidation();
};

const removeDebt = (index) => {
    state.form.debts.splice(index, 1);

    resetValidation();
};

const requestBudgetAdvice = async () => {
    aiAdvice.error = '';

    if (!canRequestAdvice.value) {
        aiAdvice.error = 'Add at least one line or note before asking Athena to review.';
        return;
    }

    aiAdvice.loading = true;

    try {
        const snapshot = latestSnapshot.value;
        const { data } = await axios.post('/ai/concierge/money-budget', {
            scope: state.scope,
            snapshot,
        });

        aiAdvice.headline = data.headline ?? '';
        aiAdvice.insights = Array.isArray(data.insights) ? data.insights : [];
        aiAdvice.nudges = Array.isArray(data.nudges) ? data.nudges : [];
        aiAdvice.watch = Array.isArray(data.watch) ? data.watch : [];
        aiAdvice.why = normaliseWhyEntries(data.why);
        aiAdvice.disclaimer = data.disclaimer ?? '';
        aiAdvice.lastSnapshot = snapshot;
    } catch (error) {
        aiAdvice.error = extractError(error) ?? 'Athena could not review this snapshot right now.';
    } finally {
        aiAdvice.loading = false;
    }
};

const formatCurrency = (value) => {
    const formatter = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: currencyCode.value,
        maximumFractionDigits: 0,
    });

    return formatter.format(value || 0);
};

const mapItem = (item) => ({
    id: item?.id ?? null,
    type: item?.type ?? 'income',
    category: item?.category ?? '',
    description: item?.description ?? '',
    amount: toNumber(item?.amount ?? 0),
    frequency: item?.frequency ?? 'month',
});

const mapDebt = (debt) => ({
    id: debt?.id ?? null,
    name: debt?.name ?? '',
    balance: toNumber(debt?.balance ?? 0),
    interest_rate: debt?.interest_rate ?? null,
    min_payment: debt?.min_payment ?? null,
});

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const nullableNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Math.round(Number(value));
    return Number.isNaN(parsed) ? null : parsed;
};

const nullableFloat = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const extractError = (error) => {
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }

    if (error?.message) {
        return error.message;
    }

    return null;
};

const describeContextFilters = (filters = {}) => {
    const preparedFilters = filters || {};
    const parts = [];

    parts.push(resolveAccountLabel(preparedFilters.account_id));

    const status = preparedFilters.status && preparedFilters.status !== 'all'
        ? `${bankStatusLabel(preparedFilters.status)} only`
        : 'Any status';
    parts.push(status);

    if (preparedFilters.flagged) {
        parts.push('Flagged only');
    }

    if (preparedFilters.search) {
        parts.push(`Search “${preparedFilters.search}”`);
    }

    return parts.filter(Boolean).join(' • ');
};

const resolveAccountLabel = (accountId) => {
    if (!accountId) {
        return 'All accounts';
    }

    const match = bankFeed.accounts.find((account) => Number(account.id) === Number(accountId));

    if (match) {
        return `${match.account_name} • ${match.institution || 'Linked account'}`;
    }

    return 'Filtered account';
};

const getAiContext = (key) => aiContexts.value?.[key]?.context ?? null;

const aiPrompts = computed(() => {
    const net = totals.value.net;
    const debtBalance = totals.value.debtBalance;

    return {
        budget: net < 0
            ? 'Help me reshape my expenses without shame.'
            : 'Show me ideas to allocate my surplus intentionally.',
        debt: debtBalance > 0
            ? 'Walk me through compassionate ways to tackle my debt.'
            : 'Help me plan ahead so I avoid future debt stress.',
    };
});

const aiReflectionCopy = computed(() => {
    if (totals.value.net < 0) {
        return 'You’re currently spending a little more than you bring in. Athena can help you brainstorm gentle adjustments.';
    }

    if (totals.value.debtBalance > 0) {
        return 'Your debt tracker is active — invite Athena to unpack repayment options without judgement.';
    }

    return 'Everything looks steady. Feel free to ask Athena for accountability ideas or celebratory guardrails when you’re ready.';
});

const launchAiPrompt = (contextKey, prompt, payload = null) => {
    const baseUrl = aiEntryUrl.value || '/ai';

    try {
        const url = new URL(baseUrl, window.location.origin);
        const context = contextKey ? getAiContext(contextKey) : null;

        if (context) {
            url.searchParams.set('context', context);
        }

        if (prompt) {
            url.searchParams.set('prompt', prompt);
        }

        if (payload) {
            url.searchParams.set('context_payload', payload);
        }

        const opened = window.open(url.toString(), '_blank', 'noopener');

        if (!opened) {
            window.location.href = url.toString();
        }
    } catch {
        window.location.href = baseUrl;
    }
};

let bankFeedReady = false;
let searchDebounceHandle = null;

const bootstrapBankFeed = async () => {
    await loadBankAccounts();
    await loadTransactions();
    bankFeedReady = true;
};

watch(
    () => [bankFeed.accountId, bankFeed.filters.status, bankFeed.filters.flagged],
    () => {
        if (!bankFeedReady) {
            return;
        }

        bankFeed.message = '';
        bankFeed.error = '';
        closeCategoryDialog();
        loadTransactions();
    },
);

watch(
    () => bankFeed.filters.search,
    () => {
        if (!bankFeedReady) {
            return;
        }

        if (searchDebounceHandle) {
            clearTimeout(searchDebounceHandle);
        }

        bankFeed.message = '';
        bankFeed.error = '';
        searchDebounceHandle = setTimeout(() => {
            loadTransactions();
        }, 400);
    },
);

onMounted(() => {
    loadBudget();
    bootstrapBankFeed();
});

function resetAiAdvice() {
    aiAdvice.loading = false;
    aiAdvice.error = '';
    aiAdvice.headline = '';
    aiAdvice.insights = [];
    aiAdvice.nudges = [];
    aiAdvice.watch = [];
    aiAdvice.why = [];
    aiAdvice.disclaimer = '';
    aiAdvice.lastSnapshot = '';
}

function buildSnapshotForAi() {
    const totalsValue = totals.value;
    const lines = [];

    lines.push(`Scope: ${state.scope}`);
    lines.push(`Currency: ${currencyCode.value}`);
    lines.push(`Total monthly income (approx): ${Math.round(totalsValue.income)}`);
    lines.push(`Total monthly expenses (approx): ${Math.round(totalsValue.expense)}`);
    lines.push(`Net monthly position (approx): ${Math.round(totalsValue.net)}`);

    if (state.form.savings_goal_monthly !== null && state.form.savings_goal_monthly !== undefined && state.form.savings_goal_monthly !== '') {
        lines.push(`Savings goal (monthly): ${Math.round(toNumber(state.form.savings_goal_monthly))}`);
    }

    if (totalsValue.debtBalance > 0 || totalsValue.debtPayments > 0) {
        lines.push(`Debts (balance ≈ ${Math.round(totalsValue.debtBalance)} | min payments ≈ ${Math.round(totalsValue.debtPayments)})`);
    }

    const incomeLines = state.form.items.filter((item) => item.type === 'income' && toNumber(item.amount) > 0);
    const expenseLines = state.form.items.filter((item) => item.type === 'expense' && toNumber(item.amount) > 0);
    const debtLines = state.form.debts.filter((debt) => toNumber(debt.balance) > 0 || toNumber(debt.min_payment) > 0);

    if (incomeLines.length) {
        lines.push('\nIncome breakdown:');
        incomeLines.forEach((item) => {
            lines.push(describeBudgetLine(item));
        });
    }

    if (expenseLines.length) {
        lines.push('\nExpense breakdown:');
        expenseLines.forEach((item) => {
            lines.push(describeBudgetLine(item));
        });
    }

    if (debtLines.length) {
        lines.push('\nDebts:');
        debtLines.forEach((debt) => {
            lines.push(describeDebtLine(debt));
        });
    }

    const notes = sanitiseNotes(state.form.notes);
    if (notes) {
        lines.push('\nMember notes (opt-in):');
        lines.push(notes);
    }

    return lines.join('\n');
}

function describeBudgetLine(item) {
    const amount = toNumber(item.amount);
    const frequency = item.frequency || 'month';
    const monthlyApprox = Math.round(monthlyFromFrequency(amount, frequency));
    const label = item.category || (item.type === 'income' ? 'Income line' : 'Expense line');
    const descriptor = item.description ? ` – ${item.description}` : '';

    return ` - ${label}${descriptor}: ${Math.round(amount)} per ${frequency} (~${monthlyApprox} per month)`;
}

function describeDebtLine(debt) {
    const name = debt.name || 'Debt';
    const parts = [`balance ${Math.round(toNumber(debt.balance))}`];

    if (debt.interest_rate !== null && debt.interest_rate !== undefined && debt.interest_rate !== '') {
        parts.push(`rate ${Number(debt.interest_rate)}%`);
    }

    if (toNumber(debt.min_payment) > 0) {
        parts.push(`payment ${Math.round(toNumber(debt.min_payment))} per month`);
    }

    return ` - ${name}: ${parts.join(', ')}`;
}

function sanitiseNotes(note) {
    if (!note || typeof note !== 'string') {
        return '';
    }

    return note
        .replace(/https?:\/\/\S+/gi, '[link]')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 360);
}

function normaliseWhyEntries(entries) {
    if (!entries) {
        return [];
    }

    const list = Array.isArray(entries) ? entries : [entries];

    return list
        .map((entry) => {
            if (!entry) {
                return null;
            }

            if (typeof entry === 'string') {
                const text = entry.trim();
                if (!text) {
                    return null;
                }
                return {
                    label: text,
                    detail: null,
                    reason: text,
                };
            }

            if (typeof entry !== 'object') {
                return null;
            }

            const label = ((entry.label ?? entry.title ?? '')).toString().trim();
            const detail = ((entry.detail ?? entry.value ?? '')).toString().trim();
            const reason = ((entry.reason ?? entry.explanation ?? '')).toString().trim();

            if (!label && !reason && !detail) {
                return null;
            }

            return {
                label: label || 'Insight',
                detail: detail || null,
                reason: reason || null,
            };
        })
        .filter(Boolean)
        .slice(0, 3);
}

function normaliseSuggestions(transaction) {
    if (!transaction || !Array.isArray(transaction.ai_suggestions)) {
        return [];
    }

    return transaction.ai_suggestions
        .map((suggestion) => {
            if (!suggestion) {
                return null;
            }

            if (typeof suggestion === 'string') {
                return { label: suggestion, confidence: null };
            }

            if (typeof suggestion === 'object') {
                const label = suggestion.label ?? suggestion.category ?? suggestion.tag ?? 'Suggestion';
                let confidence = null;

                if (typeof suggestion.confidence === 'number') {
                    const normalised = Math.min(Math.max(suggestion.confidence, 0), 1);
                    confidence = Math.round(normalised * 100);
                }

                return { label, confidence };
            }

            return null;
        })
        .filter(Boolean);
}

function describeSuggestion(suggestion) {
    if (!suggestion) {
        return 'AI suggestion';
    }

    if (suggestion.confidence === null || suggestion.confidence === undefined) {
        return suggestion.label;
    }

    return `${suggestion.label} (${suggestion.confidence}% match)`;
}

function bankStatusLabel(status) {
    return bankStatusPresentation[status]?.label ?? bankStatusPresentation.pending.label;
}

function bankStatusBadgeClass(status) {
    return bankStatusPresentation[status]?.classes ?? bankStatusPresentation.pending.classes;
}

function formatDisplayDate(value) {
    if (!value) {
        return '—';
    }

    try {
        return new Intl.DateTimeFormat('en-AU', {
            day: '2-digit',
            month: 'short',
        }).format(new Date(value));
    } catch (error) {
        return value;
    }
}

function formatAbsoluteDateTime(value) {
    if (!value) {
        return '';
    }

    try {
        return new Intl.DateTimeFormat('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
    } catch (error) {
        return value;
    }
}

function formatRelativeTime(value) {
    if (!value) {
        return '';
    }

    try {
        const target = new Date(value);
        const now = Date.now();
        const diffMs = now - target.getTime();

        if (!Number.isFinite(diffMs)) {
            return '';
        }

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diffMs < minute) {
            return 'just now';
        }

        if (diffMs < hour) {
            const minutes = Math.max(1, Math.round(diffMs / minute));
            return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
        }

        if (diffMs < day) {
            const hours = Math.max(1, Math.round(diffMs / hour));
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        }

        if (diffMs < day * 7) {
            const days = Math.max(1, Math.round(diffMs / day));
            return `${days} day${days === 1 ? '' : 's'} ago`;
        }

        return new Intl.DateTimeFormat('en-AU', {
            day: '2-digit',
            month: 'short',
        }).format(target);
    } catch (error) {
        return '';
    }
}

function buildCashflowSeries() {
    const labels = generateProjectionLabels(projectionMonths);
    let recurringIncome = 0;
    let recurringExpense = 0;
    let onceIncome = 0;
    let onceExpense = 0;

    state.form.items.forEach((item) => {
        const amount = toNumber(item.amount);

        if (amount <= 0) {
            return;
        }

        const isIncome = item.type === 'income';
        const frequency = (item.frequency || 'month').toLowerCase();

        if (frequency === 'once') {
            if (isIncome) {
                onceIncome += amount;
            } else {
                onceExpense += amount;
            }

            return;
        }

        const monthlyValue = monthlyFromFrequency(amount, frequency);

        if (isIncome) {
            recurringIncome += monthlyValue;
        } else {
            recurringExpense += monthlyValue;
        }
    });

    const debtPayments = state.form.debts.reduce((sum, debt) => sum + toNumber(debt.min_payment), 0);
    recurringExpense += debtPayments;

    const incomeSeries = [];
    const expenseSeries = [];
    const netSeries = [];

    labels.forEach((_, index) => {
        const incomeValue = recurringIncome + (index === 0 ? onceIncome : 0);
        const expenseValue = recurringExpense + (index === 0 ? onceExpense : 0);

        incomeSeries.push(roundCurrency(incomeValue));
        expenseSeries.push(roundCurrency(expenseValue));
        netSeries.push(roundCurrency(incomeValue - expenseValue));
    });

    return {
        labels,
        income: incomeSeries,
        expense: expenseSeries,
        net: netSeries,
    };
}

function monthlyFromFrequency(amount, frequency) {
    switch (frequency) {
        case 'week':
            return amount * (52 / 12);
        case 'fortnight':
            return amount * (26 / 12);
        case 'year':
            return amount / 12;
        case 'month':
        default:
            return amount;
    }
}

function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function generateProjectionLabels(months) {
    const formatter = new Intl.DateTimeFormat('en-AU', {
        month: 'short',
        year: 'numeric',
    });

    const today = new Date();

    return Array.from({ length: months }, (_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
        return formatter.format(date);
    });
}
</script>
