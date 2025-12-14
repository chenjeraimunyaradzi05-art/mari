<template>
    <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm" v-bind="$attrs">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h2 class="text-xl font-semibold text-slate-900">{{ title }}</h2>
                <p class="text-sm text-slate-500">{{ description }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Net projection</p>
                <p class="text-2xl font-semibold" :class="netSummary >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ formatCurrency(netSummary) }}
                </p>
                <p class="text-xs text-slate-500">Next {{ projectionLength }} months</p>
            </div>
        </div>
        <div class="mt-6">
            <canvas ref="canvasEl" class="h-64 w-full"></canvas>
        </div>
    </section>
</template>

<script setup>
import { Chart, registerables } from 'chart.js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

Chart.register(...registerables);

const props = defineProps({
    title: {
        type: String,
        default: 'Cashflow timeline',
    },
    description: {
        type: String,
        default: 'Live cash inflows and outflows projected forward.',
    },
    series: {
        type: Object,
        required: true,
    },
    currency: {
        type: String,
        default: 'AUD',
    },
});

const canvasEl = ref(null);
let chartInstance = null;

const projectionLength = computed(() => props.series.labels?.length ?? 0);
const netSummary = computed(() => (props.series.net ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0));

const formatCurrency = (value) => new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: props.currency || 'AUD',
    maximumFractionDigits: 0,
}).format(value || 0);

const getChartData = () => ({
    labels: props.series.labels ?? [],
    datasets: [
        {
            label: 'Income',
            borderColor: '#059669',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            data: props.series.income ?? [],
            tension: 0.35,
        },
        {
            label: 'Expenses',
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            fill: true,
            data: props.series.expense ?? [],
            tension: 0.35,
        },
        {
            label: 'Net cash',
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            fill: false,
            borderDash: [6, 6],
            data: props.series.net ?? [],
            tension: 0.35,
        },
    ],
});

const buildChart = () => {
    if (!canvasEl.value) {
        return;
    }

    const context = canvasEl.value.getContext('2d');
    chartInstance = new Chart(context, {
        type: 'line',
        data: getChartData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: (tooltipItem) => `${tooltipItem.dataset.label}: ${formatCurrency(tooltipItem.parsed.y)}`,
                    },
                },
            },
            scales: {
                y: {
                    ticks: {
                        callback(value) {
                            return formatCurrency(value);
                        },
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.2)',
                    },
                },
                x: {
                    grid: {
                        display: false,
                    },
                },
            },
        },
    });
};

const updateChart = () => {
    if (!chartInstance) {
        buildChart();
        return;
    }

    const data = getChartData();
    chartInstance.data.labels = data.labels;
    chartInstance.data.datasets.forEach((dataset, index) => {
        dataset.data = data.datasets[index]?.data ?? [];
    });
    chartInstance.update();
};

watch(
    () => props.series,
    () => updateChart(),
    { deep: true },
);

onMounted(() => {
    buildChart();
});

onBeforeUnmount(() => {
    if (chartInstance) {
        chartInstance.destroy();
    }
});
</script>
