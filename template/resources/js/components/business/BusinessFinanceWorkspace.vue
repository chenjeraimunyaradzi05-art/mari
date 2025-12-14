<template>
    <div class="space-y-10" data-testid="business-finance-workspace">
        <section class="rounded-3xl bg-gradient-to-r from-violet-600 via-rose-500 to-amber-400 p-8 text-white shadow-xl shadow-violet-900/20">
            <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <p class="text-xs uppercase tracking-[0.4em] text-white/70">Athena sole-trader finance</p>
                    <h1 class="mt-4 text-3xl font-semibold tracking-tight">{{ heroTitle }}</h1>
                    <p class="mt-2 text-sm text-white/80">Track your cashbook, calm your categories, and invite Athena to gently co-pilot.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
                        :disabled="state.exportStatus.loading"
                        @click="queueExport('csv')"
                    >
                        <i class="fas" :class="state.exportStatus.loading && state.exportStatus.format === 'csv' ? 'fa-spinner fa-spin' : 'fa-file-csv'"></i>
                        CSV Export
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
                        :disabled="state.exportStatus.loading"
                        @click="queueExport('pdf')"
                    >
                        <i class="fas" :class="state.exportStatus.loading && state.exportStatus.format === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'"></i>
                        PDF Export
                    </button>
                    <a
                        v-if="aiEntryUrl"
                        :href="aiEntryUrl"
                        target="_blank"
                        rel="noopener"
                        class="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
                    >
                        <i class="fas fa-robot"></i>
                        Open AI workspace
                    </a>
                </div>
            </div>
            <p v-if="state.exportStatus.message" class="mt-4 text-sm text-white">{{ state.exportStatus.message }}</p>
            <div v-if="exportJobs.length" class="mt-6 grid gap-4 lg:grid-cols-2">
                <article
                    v-for="exportJob in exportJobs"
                    :key="exportJob.jobId"
                    class="rounded-2xl border border-white/40 bg-white/10 p-4 text-sm text-white backdrop-blur"
                >
                    <div class="flex items-center justify-between font-semibold">
                        <p>{{ (exportJob.format || 'pdf').toUpperCase() }} export</p>
                        <span :class="exportJob.status === 'ready' ? 'text-emerald-200' : 'text-amber-100'">
                            {{ exportJob.status === 'ready' ? 'Ready' : 'Processing' }}
                        </span>
                    </div>
                    <p class="mt-1 text-xs text-white/80">Queued {{ formatTimestamp(exportJob.queuedAt) }}</p>
                    <p v-if="exportJob.readyAt" class="text-xs text-white/70">Ready {{ formatTimestamp(exportJob.readyAt) }}</p>
                    <a
                        v-if="exportJob.downloadUrl"
                        :href="exportJob.downloadUrl"
                        target="_blank"
                        rel="noopener"
                        class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white underline decoration-white/40"
                    >
                        <i class="fas fa-arrow-down"></i>
                        Download export
                    </a>
                    <p v-else class="mt-3 text-xs text-white/80">We'll refresh as soon as it's available.</p>
                </article>
            </div>
        </section>

        <div v-if="state.loading" class="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <p class="text-sm font-medium text-slate-600">Loading your finance workspace…</p>
        </div>

        <template v-else>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Income</p>
                    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ formatCurrency(state.summary?.totals?.income) }}</p>
                    <p class="text-xs text-slate-500">Current filter window.</p>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Expenses</p>
                    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ formatCurrency(state.summary?.totals?.expenses) }}</p>
                    <p class="text-xs text-slate-500">Includes tax-deductible lines.</p>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Net</p>
                    <p class="mt-2 text-3xl font-semibold" :class="state.summary?.totals?.net >= 0 ? 'text-emerald-600' : 'text-rose-600'">{{ formatCurrency(state.summary?.totals?.net) }}</p>
                    <p class="text-xs text-slate-500">Income minus expenses.</p>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Runway</p>
                    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ state.summary?.totals?.runway_weeks ?? 0 }} weeks</p>
                    <p class="text-xs text-slate-500">Approx. burn rate.</p>
                </div>
            </div>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Cashflow timeline</h2>
                        <p class="text-sm text-slate-500">Weekly cadence of inflows and outflows.</p>
                    </div>
                    <div class="flex flex-wrap gap-3 text-sm text-slate-600">
                        <label class="flex items-center gap-2">
                            From
                            <input type="date" v-model="state.filters.from" class="rounded-2xl border border-slate-200 px-3 py-1" />
                        </label>
                        <label class="flex items-center gap-2">
                            To
                            <input type="date" v-model="state.filters.to" class="rounded-2xl border border-slate-200 px-3 py-1" />
                        </label>
                    </div>
                </div>
                <canvas ref="cashflowCanvas" class="mt-6 h-64 w-full"></canvas>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Cashbook entries</h2>
                        <p class="text-sm text-slate-500">Filter, select, and nudge with Athena.</p>
                    </div>
                    <div class="flex flex-wrap gap-3 text-sm text-slate-600">
                        <select v-model="state.filters.entry_type" class="rounded-2xl border border-slate-200 px-3 py-2">
                            <option value="all">All types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                        <input type="search" v-model="state.filters.search" placeholder="Search description" class="rounded-2xl border border-slate-200 px-3 py-2" />
                        <input type="text" v-model="state.filters.category" placeholder="Category" class="rounded-2xl border border-slate-200 px-3 py-2" />
                    </div>
                </div>

                <div v-if="hasSelection" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                    <p>{{ selectedEntryIds.length }} entry{{ selectedEntryIds.length === 1 ? '' : 'ies' }} selected.</p>
                    <div class="flex flex-wrap gap-3">
                        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-violet-300 px-3 py-1 font-semibold" :disabled="state.aiStatus.loading" @click="requestAiSuggestions">
                            <i class="fas" :class="state.aiStatus.loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
                            Ask Athena
                        </button>
                        <button type="button" class="text-xs font-semibold text-violet-700" @click="clearSelection">Clear selection</button>
                    </div>
                </div>

                <div class="mt-6 overflow-x-auto">
                    <table class="min-w-full divide-y divide-slate-100 text-sm">
                        <thead>
                            <tr class="text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                                <th class="px-3 py-2">Select</th>
                                <th class="px-3 py-2">Date</th>
                                <th class="px-3 py-2">Type</th>
                                <th class="px-3 py-2">Category</th>
                                <th class="px-3 py-2">Description</th>
                                <th class="px-3 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr v-for="entry in state.entries" :key="entry.id" class="hover:bg-slate-50">
                                <td class="px-3 py-2">
                                    <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-violet-600" :value="entry.id" :checked="selectedEntryIds.includes(entry.id)" @change="toggleSelection(entry.id)" />
                                </td>
                                <td class="px-3 py-2">{{ entry.date }}</td>
                                <td class="px-3 py-2 font-semibold" :class="entry.entry_type === 'income' ? 'text-emerald-600' : 'text-rose-600'">{{ entry.entry_type }}</td>
                                <td class="px-3 py-2">{{ entry.category || '—' }}</td>
                                <td class="px-3 py-2 text-slate-700">{{ entry.description || '—' }}</td>
                                <td class="px-3 py-2 text-right font-semibold">{{ formatCurrency(entry.amount) }}</td>
                            </tr>
                            <tr v-if="!state.entries.length">
                                <td colspan="6" class="px-3 py-6 text-center text-sm text-slate-500">No entries match the current filters.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-if="state.pagination.meta" class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                    <p>Page {{ state.pagination.meta.current_page }} of {{ state.pagination.meta.last_page }}</p>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="rounded-full border border-slate-200 px-3 py-1"
                            :disabled="!(state.pagination.links && state.pagination.links.prev)"
                            @click="changePage(state.pagination.meta.current_page - 1)"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            class="rounded-full border border-slate-200 px-3 py-1"
                            :disabled="!(state.pagination.links && state.pagination.links.next)"
                            @click="changePage(state.pagination.meta.current_page + 1)"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>

            <section class="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h2 class="text-xl font-semibold text-slate-900">Add entry</h2>
                    <p class="text-sm text-slate-500">Quickly capture money moments.</p>
                    <form class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" @submit.prevent="handleEntrySubmit">
                        <label class="text-sm font-semibold text-slate-700">
                            Date
                            <input type="date" v-model="state.entryForm.date" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required />
                        </label>
                        <label class="text-sm font-semibold text-slate-700">
                            Type
                            <select v-model="state.entryForm.entry_type" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>
                        </label>
                        <label class="text-sm font-semibold text-slate-700">
                            Category
                            <input type="text" v-model="state.entryForm.category" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Consulting" />
                        </label>
                        <label class="text-sm font-semibold text-slate-700">
                            Description
                            <input type="text" v-model="state.entryForm.description" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Optional detail" />
                        </label>
                        <label class="text-sm font-semibold text-slate-700">
                            Amount
                            <input type="number" step="0.01" min="0" v-model.number="state.entryForm.amount" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required />
                        </label>
                        <label class="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" v-model="state.entryForm.is_tax_deductible" class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                            Tax deductible
                        </label>
                        <div class="md:col-span-2">
                            <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-60" :disabled="state.submittingEntry">
                                <i class="fas" :class="state.submittingEntry ? 'fa-spinner fa-spin' : 'fa-plus'"></i>
                                {{ state.submittingEntry ? 'Adding…' : 'Add entry' }}
                            </button>
                            <p v-if="state.entryError" class="mt-2 text-sm text-rose-600">{{ state.entryError }}</p>
                        </div>
                    </form>
                </div>

                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h2 class="text-xl font-semibold text-slate-900">AI helper</h2>
                    <p class="text-sm text-slate-500">Latest contexts from Athena.</p>
                    <ul class="mt-4 space-y-3 text-sm text-slate-600">
                        <li v-for="(context, index) in aiContexts" :key="`context-${index}`" class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p class="font-semibold text-slate-800">{{ context.headline || 'Context payload' }}</p>
                            <p class="text-xs text-slate-500">{{ context.generated_at || 'Recently shared' }}</p>
                        </li>
                        <li v-if="!aiContexts.length" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">Athena will surface contexts once you ask for suggestions.</li>
                    </ul>
                    <p v-if="state.aiStatus.message" class="mt-4 text-sm text-emerald-600">{{ state.aiStatus.message }}</p>
                    <p v-if="state.aiStatus.error" class="mt-2 text-sm text-rose-600">{{ state.aiStatus.error }}</p>
                </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-xl font-semibold text-slate-900">Recent budgets</h2>
                        <p class="text-sm text-slate-500">Latest planned periods to contrast against actuals.</p>
                    </div>
                    <p class="text-sm text-slate-500">{{ state.budgets.length }} loaded</p>
                </div>
                <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <article v-for="budget in state.budgets" :key="budget.id" class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-400">{{ budget.period_start }} → {{ budget.period_end }}</p>
                        <p class="mt-2 text-base font-semibold text-slate-900">{{ budget.title || 'Working budget' }}</p>
                        <p class="text-sm text-slate-500">{{ budget.lines.length }} lines</p>
                    </article>
                    <article v-if="!state.budgets.length" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">No budgets yet. Add one in the export-ready plan.</article>
                </div>
            </section>
        </template>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import axios from 'axios';
import Chart from 'chart.js/auto';

const props = defineProps({
    user: {
        type: Object,
        required: true,
    },
    ai: {
        type: Object,
        default: () => ({ contexts: [], entryUrl: null }),
    },
});

const state = reactive({
    loading: true,
    cashbook: null,
    summary: {
        totals: { income: 0, expenses: 0, net: 0, runway_weeks: 0 },
        series: { cashflow: [], category_breakdown: [] },
    },
    entries: [],
    pagination: {
        meta: null,
        links: null,
    },
    budgets: [],
    filters: {
        entry_type: 'all',
        search: '',
        category: '',
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
    },
    entryForm: {
        date: new Date().toISOString().slice(0, 10),
        entry_type: 'expense',
        category: '',
        description: '',
        amount: '',
        is_tax_deductible: true,
    },
    submittingEntry: false,
    entryError: null,
    exportStatus: {
        loading: false,
        format: null,
        message: null,
    },
    aiStatus: {
        loading: false,
        message: null,
        error: null,
    },
});

const selectedEntryIds = ref([]);
const exportJobs = ref([]);
const cashflowCanvas = ref(null);
let cashflowChart;
let filterTimeout;
const exportPollers = new Map();

const aiContexts = computed(() => props.ai?.contexts ?? []);
const aiEntryUrl = computed(() => props.ai?.entryUrl ?? null);
const heroTitle = computed(() => state.cashbook?.name ?? `${props.user?.name ?? 'Athena member'}'s business`);
const selectedEntryIdsValue = computed(() => selectedEntryIds.value);
const hasSelection = computed(() => selectedEntryIdsValue.value.length > 0);

const formatCurrency = (value) => {
    const formatter = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: state.cashbook?.currency ?? 'AUD',
    });

    return formatter.format(value ?? 0);
};

const formatTimestamp = (value) => {
    if (!value) {
        return 'Pending';
    }

    try {
        return new Intl.DateTimeFormat('en-AU', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value));
    } catch (error) {
        console.error(error);
        return value;
    }
};

const toggleSelection = (entryId) => {
    if (selectedEntryIds.value.includes(entryId)) {
        selectedEntryIds.value = selectedEntryIds.value.filter((id) => id !== entryId);
    } else {
        selectedEntryIds.value = [...selectedEntryIds.value, entryId];
    }
};

const clearSelection = () => {
    selectedEntryIds.value = [];
};

const upsertExportJob = (jobId, payload = {}) => {
    const existingIndex = exportJobs.value.findIndex((job) => job.jobId === jobId);
    const base = existingIndex >= 0 ? exportJobs.value[existingIndex] : { jobId };
    const updated = { ...base, ...payload };

    if (existingIndex >= 0) {
        exportJobs.value.splice(existingIndex, 1, updated);
    } else {
        exportJobs.value = [updated, ...exportJobs.value];
    }
};

const stopExportPolling = (jobId) => {
    const poller = exportPollers.get(jobId);
    if (poller) {
        clearInterval(poller);
        exportPollers.delete(jobId);
    }
};

const clearAllExportPollers = () => {
    exportPollers.forEach((intervalId) => clearInterval(intervalId));
    exportPollers.clear();
};

const fetchExportStatus = async (jobId) => {
    try {
        const { data } = await axios.get(`/api/v1/business/exports/${jobId}`);
        upsertExportJob(jobId, {
            status: data.status,
            format: data.format,
            filters: data.filters,
            queuedAt: data.queued_at,
            readyAt: data.ready_at,
            expiresAt: data.expires_at,
            downloadUrl: data.download_url,
        });

        if (data.status === 'ready') {
            state.exportStatus.message = `Export ready. Download before ${formatTimestamp(data.expires_at)}.`;
            stopExportPolling(jobId);
        } else {
            state.exportStatus.message = 'Export is processing…';
        }
    } catch (error) {
        if (error.response?.status === 404) {
            stopExportPolling(jobId);
            return;
        }

        state.exportStatus.message = error.response?.data?.message ?? 'Unable to fetch export status.';
        stopExportPolling(jobId);
    }
};

const startExportPolling = (jobId) => {
    stopExportPolling(jobId);
    const intervalId = setInterval(() => fetchExportStatus(jobId), 4000);
    exportPollers.set(jobId, intervalId);
    fetchExportStatus(jobId);
};

const fetchCashbook = async () => {
    const { data } = await axios.get('/api/v1/business/cashbook');
    state.cashbook = data.cashbook;
};

const fetchSummary = async () => {
    const params = {
        cashbook_id: state.cashbook?.id,
        from: state.filters.from,
        to: state.filters.to,
    };

    const { data } = await axios.get('/api/v1/business/entries/summary', { params });
    state.summary = data;
};

const fetchEntries = async (page = 1) => {
    const params = {
        cashbook_id: state.cashbook?.id,
        per_page: 15,
        page,
    };

    if (state.filters.entry_type !== 'all') {
        params.entry_type = state.filters.entry_type;
    }

    if (state.filters.category) {
        params.category = state.filters.category;
    }

    if (state.filters.search) {
        params.search = state.filters.search;
    }

    if (state.filters.from) {
        params.from = state.filters.from;
    }

    if (state.filters.to) {
        params.to = state.filters.to;
    }

    const { data } = await axios.get('/api/v1/business/entries', { params });
    state.entries = data.data ?? [];
    state.pagination = {
        meta: data.meta ?? null,
        links: data.links ?? null,
    };
    clearSelection();
};

const fetchBudgets = async () => {
    const params = {
        cashbook_id: state.cashbook?.id,
    };

    const { data } = await axios.get('/api/v1/business/budgets', { params });
    state.budgets = data.budgets ?? [];
};

const loadWorkspace = async () => {
    try {
        state.loading = true;
        await fetchCashbook();
        await Promise.all([fetchSummary(), fetchEntries(), fetchBudgets()]);
    } catch (error) {
        console.error(error);
    } finally {
        state.loading = false;
    }
};

const handleEntrySubmit = async () => {
    try {
        state.submittingEntry = true;
        state.entryError = null;
        const payload = {
            ...state.entryForm,
            cashbook_id: state.cashbook?.id,
        };

        await axios.post('/api/v1/business/entries', payload);
        await Promise.all([fetchEntries(), fetchSummary()]);
        state.entryForm.description = '';
        state.entryForm.category = '';
        state.entryForm.amount = '';
    } catch (error) {
        state.entryError = error.response?.data?.message ?? 'Unable to add entry right now.';
    } finally {
        state.submittingEntry = false;
    }
};

const requestAiSuggestions = async () => {
    if (!selectedEntryIdsValue.value.length) {
        return;
    }

    try {
        state.aiStatus.loading = true;
        state.aiStatus.error = null;
        const { data } = await axios.post('/api/v1/business/ai/suggest', {
            entry_ids: selectedEntryIdsValue.value,
            context: {
                business_stage: 'sole_trader',
                entry_count: selectedEntryIdsValue.value.length,
            },
        });
        state.aiStatus.message = `Athena queued ${data.queued_entries} entries (job ${data.job_id}).`;
    } catch (error) {
        state.aiStatus.error = error.response?.data?.message ?? 'Unable to reach Athena right now.';
    } finally {
        state.aiStatus.loading = false;
    }
};

const queueExport = async (format) => {
    try {
        state.exportStatus.loading = true;
        state.exportStatus.format = format;
        state.exportStatus.message = null;
        const payload = {
            cashbook_id: state.cashbook?.id,
            from: state.filters.from,
            to: state.filters.to,
            format,
        };
        const { data } = await axios.post('/api/v1/business/exports', payload);
        const queuedAt = new Date().toISOString();
        upsertExportJob(data.job_id, {
            jobId: data.job_id,
            status: 'pending',
            format,
            filters: { from: state.filters.from, to: state.filters.to },
            queuedAt,
            downloadUrl: null,
        });
        startExportPolling(data.job_id);
        state.exportStatus.message = `Export queued. Tracking job ${data.job_id}…`;
    } catch (error) {
        state.exportStatus.message = error.response?.data?.message ?? 'Unable to queue export.';
    } finally {
        state.exportStatus.loading = false;
        state.exportStatus.format = null;
    }
};

const renderCashflowChart = () => {
    if (!cashflowCanvas.value) {
        return;
    }

    const series = state.summary?.series?.cashflow ?? [];
    if (!series.length) {
        if (cashflowChart) {
            cashflowChart.destroy();
            cashflowChart = null;
        }
        return;
    }

    const ctx = cashflowCanvas.value.getContext('2d');
    if (cashflowChart) {
        cashflowChart.destroy();
    }

    cashflowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: series.map((item) => item.label),
            datasets: [
                {
                    label: 'Income',
                    data: series.map((item) => item.income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    tension: 0.35,
                    fill: true,
                },
                {
                    label: 'Expenses',
                    data: series.map((item) => item.expenses),
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.15)',
                    tension: 0.35,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        callback: (value) => formatCurrency(value),
                    },
                },
            },
            plugins: {
                legend: {
                    display: true,
                },
            },
        },
    });
};

const changePage = (page) => {
    if (!state.pagination.meta) {
        return;
    }

    if (page < 1 || page > state.pagination.meta.last_page) {
        return;
    }

    fetchEntries(page);
};

watch(
    () => ({ entry_type: state.filters.entry_type, category: state.filters.category, search: state.filters.search }),
    () => {
        if (!state.cashbook) {
            return;
        }
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            fetchEntries();
        }, 350);
    },
    { deep: true }
);

watch(
    () => [state.filters.from, state.filters.to],
    () => {
        if (!state.cashbook) {
            return;
        }
        fetchSummary();
        fetchEntries();
    },
    { deep: true }
);

watch(
    () => state.summary?.series?.cashflow,
    () => {
        renderCashflowChart();
    },
    { deep: true }
);

onMounted(() => {
    loadWorkspace();
});

onBeforeUnmount(() => {
    if (cashflowChart) {
        cashflowChart.destroy();
    }

    clearTimeout(filterTimeout);
    clearAllExportPollers();
});
</script>
