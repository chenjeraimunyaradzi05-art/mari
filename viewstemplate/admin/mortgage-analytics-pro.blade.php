<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mortgage Analytics Dashboard - Premium</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
</head>
<body>
    <div class="container">
        <!-- HEADER -->
        <header>
            <div class="header-content">
                <h1><i class="fas fa-chart-line"></i> Mortgage Analytics</h1>
                <p>Real-time mortgage processing & performance metrics</p>
            </div>
            <div class="header-stats">
                <div class="header-stat">
                    <div class="header-stat-value" id="total-processed">0</div>
                    <div class="header-stat-label">Apps Processed</div>
                </div>
                <div class="header-stat">
                    <div class="header-stat-value" id="avg-score">--</div>
                    <div class="header-stat-label">Avg Score</div>
                </div>
                <div class="header-stat">
                    <div class="header-stat-value" id="success-rate">0%</div>
                    <div class="header-stat-label">Success Rate</div>
                </div>
            </div>
        </header>

        <!-- TABS -->
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('overview')">
                <i class="fas fa-home"></i> Overview
            </button>
            <button class="tab-btn" onclick="switchTab('kpis')">
                <i class="fas fa-tachometer-alt"></i> KPIs
            </button>
            <button class="tab-btn" onclick="switchTab('mortgages')">
                <i class="fas fa-home"></i> Mortgage Suite
            </button>
            <button class="tab-btn" onclick="switchTab('insights')">
                <i class="fas fa-lightbulb"></i> Insights
            </button>
            <button class="tab-btn" onclick="switchTab('promotions')">
                <i class="fas fa-star"></i> Offers
            </button>
        </div>

        <!-- OVERVIEW TAB -->
        <div id="overview" class="tab-content active">
            <!-- PRIMARY METRICS -->
            <div class="metrics-grid">
                <div class="metric-card primary">
                    <i class="fas fa-file-invoice-dollar metric-icon primary"></i>
                    <div class="metric-label">Total Loan Volume</div>
                    <div class="metric-value" id="metric-volume">$0</div>
                    <div class="metric-change">
                        <i class="fas fa-arrow-up"></i> +12.5% this month
                    </div>
                </div>

                <div class="metric-card success">
                    <i class="fas fa-check-circle metric-icon success"></i>
                    <div class="metric-label">Approval Rate</div>
                    <div class="metric-value" id="metric-approval">0%</div>
                    <div class="metric-change">
                        <i class="fas fa-arrow-up"></i> +3.2% vs last month
                    </div>
                </div>

                <div class="metric-card info">
                    <i class="fas fa-clock metric-icon info"></i>
                    <div class="metric-label">Avg Processing Time</div>
                    <div class="metric-value" id="metric-time">12ms</div>
                    <div class="metric-change">
                        <i class="fas fa-arrow-down"></i> -8.5% faster
                    </div>
                </div>

                <div class="metric-card warning">
                    <i class="fas fa-exclamation-triangle metric-icon warning"></i>
                    <div class="metric-label">Average Debt-to-Income</div>
                    <div class="metric-value" id="metric-dti">32%</div>
                    <div class="metric-comparison">Healthy range (< 43%)</div>
                </div>
            </div>

            <!-- SECONDARY METRICS -->
            <div class="metrics-grid">
                <div class="metric-card primary">
                    <i class="fas fa-percentage metric-icon primary"></i>
                    <div class="metric-label">Avg LTV Ratio</div>
                    <div class="metric-value" id="metric-ltv">65%</div>
                    <div class="metric-change">Good lending position</div>
                </div>

                <div class="metric-card success">
                    <i class="fas fa-star metric-icon success"></i>
                    <div class="metric-label">Avg Credit Score</div>
                    <div class="metric-value" id="metric-credit">745</div>
                    <div class="metric-comparison">Prime borrowers</div>
                </div>

                <div class="metric-card info">
                    <i class="fas fa-chart-bar metric-icon info"></i>
                    <div class="metric-label">Queue Status</div>
                    <div class="metric-value" id="metric-queue">0</div>
                    <div class="metric-change">Jobs pending</div>
                </div>

                <div class="metric-card danger">
                    <i class="fas fa-times-circle metric-icon" style="color: var(--danger);"></i>
                    <div class="metric-label">Failed Applications</div>
                    <div class="metric-value" id="metric-failed">0</div>
                    <div class="metric-change">0% failure rate</div>
                </div>
            </div>

            <!-- CHARTS -->
            <div class="chart-section">
                <div class="chart-container">
                    <div class="chart-title"><i class="fas fa-line-chart"></i> Processing Trend</div>
                    <canvas id="trendChart"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title"><i class="fas fa-pie-chart"></i> Application Status</div>
                    <canvas id="statusChart"></canvas>
                </div>
            </div>

            <!-- JOB STATUS -->
            <div class="kpi-section">
                <div class="kpi-title">
                    <i class="fas fa-tasks"></i> Job Pipeline Status
                </div>
                <div class="status-grid">
                    <div class="status-card">
                        <div class="status-name">Data Ingestion</div>
                        <div class="status-value" id="job-ingestion">0</div>
                        <div class="status-bar">
                            <div class="status-bar-fill" style="width: 100%;"></div>
                        </div>
                    </div>
                    <div class="status-card">
                        <div class="status-name">Scoring</div>
                        <div class="status-value" id="job-scoring">0</div>
                        <div class="status-bar">
                            <div class="status-bar-fill" style="width: 100%;"></div>
                        </div>
                    </div>
                    <div class="status-card">
                        <div class="status-name">Repayment Calc</div>
                        <div class="status-value" id="job-repayment">0</div>
                        <div class="status-bar">
                            <div class="status-bar-fill" style="width: 100%;"></div>
                        </div>
                    </div>
                    <div class="status-card">
                        <div class="status-name">UX Updates</div>
                        <div class="status-value" id="job-ux">0</div>
                        <div class="status-bar">
                            <div class="status-bar-fill" style="width: 100%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- KPIs TAB -->
        <div id="kpis" class="tab-content">
            <div class="kpi-section">
                <div class="kpi-title">
                    <i class="fas fa-bullseye"></i> Key Performance Indicators
                </div>
                <div class="kpi-grid">
                    <div class="kpi-item">
                        <div class="kpi-value">98.5%</div>
                        <div class="kpi-label">System Uptime</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-value">2,450</div>
                        <div class="kpi-label">Jobs/Minute</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-value">8-22ms</div>
                        <div class="kpi-label">Avg Processing</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-value">$48.5M</div>
                        <div class="kpi-label">Total Volume</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-value">94.2%</div>
                        <div class="kpi-label">Approval Rate</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-value">745</div>
                        <div class="kpi-label">Median Credit</div>
                    </div>
                </div>
            </div>

            <!-- PERFORMANCE METRICS -->
            <div class="metrics-grid mt-20">
                <div class="metric-card primary">
                    <i class="fas fa-tachometer-alt metric-icon primary"></i>
                    <div class="metric-label">System Performance</div>
                    <div class="metric-value">99.2%</div>
                    <div class="metric-change">Excellent</div>
                </div>
                <div class="metric-card success">
                    <i class="fas fa-database metric-icon success"></i>
                    <div class="metric-label">Data Accuracy</div>
                    <div class="metric-value">99.8%</div>
                    <div class="metric-change">Validated</div>
                </div>
                <div class="metric-card info">
                    <i class="fas fa-users metric-icon info"></i>
                    <div class="metric-label">User Engagement</div>
                    <div class="metric-value">87%</div>
                    <div class="metric-change">Strong adoption</div>
                </div>
                <div class="metric-card warning">
                    <i class="fas fa-graduation-cap metric-icon warning"></i>
                    <div class="metric-label">Risk Score</div>
                    <div class="metric-value">Low</div>
                    <div class="metric-change">Healthy portfolio</div>
                </div>
            </div>
        </div>

        <!-- MORTGAGE SUITE TAB -->
        <div id="mortgages" class="tab-content">
            <div class="widget-grid">
                <!-- MORTGAGE CALCULATOR WIDGET -->
                <div class="mortgage-widget">
                    <div class="widget-header">
                        <div class="widget-title">Smart Calculator</div>
                        <div class="widget-icon"><i class="fas fa-calculator"></i></div>
                    </div>
                    <div class="widget-body">
                        <div class="widget-stat">
                            <span class="widget-stat-label">Loan Amount</span>
                            <span class="widget-stat-value">$300,000</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Interest Rate</span>
                            <span class="widget-stat-value">6.5%</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Loan Term</span>
                            <span class="widget-stat-value">30 years</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Monthly Payment</span>
                            <span class="widget-stat-value" style="color: var(--success);">$1,896.20</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Total Interest</span>
                            <span class="widget-stat-value">$382,629</span>
                        </div>
                        <button class="promo-btn" style="width: 100%; margin-top: 15px; color: var(--primary);">
                            Calculate Now
                        </button>
                    </div>
                </div>

                <!-- REFINANCE WIDGET -->
                <div class="mortgage-widget">
                    <div class="widget-header">
                        <div class="widget-title">Refinance Analysis</div>
                        <div class="widget-icon"><i class="fas fa-sync"></i></div>
                    </div>
                    <div class="widget-body">
                        <div class="widget-stat">
                            <span class="widget-stat-label">Current Rate</span>
                            <span class="widget-stat-value">7.2%</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Refinance Rate</span>
                            <span class="widget-stat-value" style="color: var(--success);">6.1%</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Monthly Savings</span>
                            <span class="widget-stat-value" style="color: var(--success);">$287</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Breakeven Period</span>
                            <span class="widget-stat-value">18 months</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Total Savings</span>
                            <span class="widget-stat-value" style="color: var(--success);">$52,428</span>
                        </div>
                        <button class="promo-btn" style="width: 100%; margin-top: 15px; color: var(--primary);">
                            Explore Refinance
                        </button>
                    </div>
                </div>

                <!-- AFFORDABILITY WIDGET -->
                <div class="mortgage-widget">
                    <div class="widget-header">
                        <div class="widget-title">Affordability Index</div>
                        <div class="widget-icon"><i class="fas fa-home"></i></div>
                    </div>
                    <div class="widget-body">
                        <div class="widget-stat">
                            <span class="widget-stat-label">Income Level</span>
                            <span class="widget-stat-value">$120,000</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Max Approval</span>
                            <span class="widget-stat-value" style="color: var(--success);">$480,000</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">DTI Ratio</span>
                            <span class="widget-stat-value">35%</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Approval Score</span>
                            <span class="widget-stat-value" style="color: var(--success);">92/100</span>
                        </div>
                        <div class="widget-stat">
                            <span class="widget-stat-label">Recommendation</span>
                            <span class="widget-stat-value" style="color: var(--success);">Pre-Approved</span>
                        </div>
                        <button class="promo-btn" style="width: 100%; margin-top: 15px; color: var(--primary);">
                            Get Pre-Approved
                        </button>
                    </div>
                </div>
            </div>

            <!-- MORTGAGE COMPARISON CHART -->
            <div class="kpi-section mt-20">
                <div class="kpi-title">
                    <i class="fas fa-columns"></i> Mortgage Comparison
                </div>
                <div class="chart-section">
                    <div class="chart-container">
                        <div class="chart-title">Payment Comparison</div>
                        <canvas id="paymentChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <div class="chart-title">Amortization Schedule</div>
                        <canvas id="amortizationChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- INSIGHTS TAB -->
        <div id="insights" class="tab-content">
            <div class="kpi-section">
                <div class="kpi-title">
                    <i class="fas fa-brain"></i> Market Insights & Trends
                </div>
                <div class="metrics-grid">
                    <div class="metric-card primary">
                        <i class="fas fa-arrow-up metric-icon primary"></i>
                        <div class="metric-label">Market Trend</div>
                        <div class="metric-value">+2.3%</div>
                        <div class="metric-change">Mortgage demand growing</div>
                    </div>
                    <div class="metric-card success">
                        <i class="fas fa-check metric-icon success"></i>
                        <div class="metric-label">Approval Velocity</div>
                        <div class="metric-value">+18%</div>
                        <div class="metric-change">vs 30-day average</div>
                    </div>
                    <div class="metric-card info">
                        <i class="fas fa-chart-area metric-icon info"></i>
                        <div class="metric-label">Avg Loan Size</div>
                        <div class="metric-value">$325K</div>
                        <div class="metric-comparison">Up from $298K</div>
                    </div>
                    <div class="metric-card warning">
                        <i class="fas fa-sliders-h metric-icon warning"></i>
                        <div class="metric-label">Rate Outlook</div>
                        <div class="metric-value">6.8%</div>
                        <div class="metric-comparison">Expected next month</div>
                    </div>
                </div>
            </div>

            <!-- INSIGHTS DETAIL -->
            <div class="chart-section mt-20">
                <div class="chart-container">
                    <div class="chart-title">Application Volume Trends</div>
                    <canvas id="volumeChart"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">Score Distribution</div>
                    <canvas id="scoreDistChart"></canvas>
                </div>
            </div>

            <!-- TOP INSIGHTS -->
            <div class="kpi-section mt-20">
                <div class="kpi-title">
                    <i class="fas fa-star"></i> Top Insights
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: var(--radius);">
                        <p style="font-weight: bold; margin-bottom: 10px;"><i class="fas fa-bolt"></i> Performance Peak</p>
                        <p style="font-size: 14px; opacity: 0.9;">Peak processing times occur 10-11 AM and 3-4 PM. Consider staffing accordingly.</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: var(--radius);">
                        <p style="font-weight: bold; margin-bottom: 10px;"><i class="fas fa-award"></i> Quality Leader</p>
                        <p style="font-size: 14px; opacity: 0.9;">Zero failed applications this month. Excellent data quality and underwriting accuracy.</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: var(--radius);">
                        <p style="font-weight: bold; margin-bottom: 10px;"><i class="fas fa-rocket"></i> Growth Opportunity</p>
                        <p style="font-size: 14px; opacity: 0.9;">Refinance applications up 35%. Consider targeted marketing campaigns.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- PROMOTIONS TAB -->
        <div id="promotions" class="tab-content">
            <div class="promo-section">
                <!-- PROMOTIONAL CARD 1 -->
                <div class="promo-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);  ">
                    <div class="promo-content">
                        <div class="promo-badge">Limited Time</div>
                        <div class="promo-title">Fast-Track Approvals</div>
                        <div class="promo-description">
                            Get approved in 24 hours with our express mortgage processing. Zero hidden fees, transparent pricing.
                        </div>
                        <button class="promo-btn">Learn More</button>
                    </div>
                </div>

                <!-- PROMOTIONAL CARD 2 -->
                <div class="promo-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);  ">
                    <div class="promo-content">
                        <div class="promo-badge">Exclusive Offer</div>
                        <div class="promo-title">Refinance to Save</div>
                        <div class="promo-description">
                            Lower your rate, reduce payments. Average savings: $287/month. Check your refinance eligibility now.
                        </div>
                        <button class="promo-btn">Check Savings</button>
                    </div>
                </div>

                <!-- PROMOTIONAL CARD 3 -->
                <div class="promo-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);  ">
                    <div class="promo-content">
                        <div class="promo-badge">New Feature</div>
                        <div class="promo-title">AI-Powered Advisor</div>
                        <div class="promo-description">
                            Get personalized mortgage recommendations powered by AI. Available 24/7 for your questions.
                        </div>
                        <button class="promo-btn">Start Chat</button>
                    </div>
                </div>

                <!-- PROMOTIONAL CARD 4 -->
                <div class="promo-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);  ">
                    <div class="promo-content">
                        <div class="promo-badge">Referral Program</div>
                        <div class="promo-title">Refer & Earn</div>
                        <div class="promo-description">
                            Refer friends and family. Earn $500-$2,000 per successful mortgage. Win-win for everyone.
                        </div>
                        <button class="promo-btn">Start Referring</button>
                    </div>
                </div>

                <!-- PROMOTIONAL CARD 5 -->
                <div class="promo-card" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);  ">
                    <div class="promo-content">
                        <div class="promo-badge">Special Offer</div>
                        <div class="promo-title">First-Time Buyer Program</div>
                        <div class="promo-description">
                            Special rates for first-time homebuyers. Down payment assistance and educational resources included.
                        </div>
                        <button class="promo-btn">Get Started</button>
                    </div>
                </div>

                <!-- PROMOTIONAL CARD 6 -->
                <div class="promo-card" style="background: linear-gradient(135deg, #ff9b6b 0%, #fc5c65 100%);  ">
                    <div class="promo-content">
                        <div class="promo-badge">Partnership</div>
                        <div class="promo-title">Real Estate Pro Network</div>
                        <div class="promo-description">
                            Connect with top real estate agents. Exclusive network discounts and co-marketing opportunities.
                        </div>
                        <button class="promo-btn">Join Network</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // TAB SWITCHING
        function switchTab(tabName) {
            // Hide all tabs
            const tabs = document.querySelectorAll('.tab-content');
            tabs.forEach(tab => tab.classList.remove('active'));

            // Remove active from buttons
            const btns = document.querySelectorAll('.tab-btn');
            btns.forEach(btn => btn.classList.remove('active'));

            // Show selected tab
            document.getElementById(tabName).classList.add('active');

            // Add active to button
            event.target.classList.add('active');

            // Initialize charts if needed
            setTimeout(() => {
                if (tabName === 'mortgages') initMortgageCharts();
                if (tabName === 'insights') initInsightCharts();
            }, 100);
        }

        // INITIALIZE TREND CHART
        function initTrendChart() {
            const ctx = document.getElementById('trendChart');
            if (!ctx) return;

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Applications Processed',
                        data: [65, 89, 72, 95, 78, 52, 45],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: true } }
                }
            });
        }

        // INITIALIZE STATUS CHART
        function initStatusChart() {
            const ctx = document.getElementById('statusChart');
            if (!ctx) return;

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Approved', 'Pending', 'Denied'],
                    datasets: [{
                        data: [65, 30, 5],
                        backgroundColor: ['#28a745', '#ffc107', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // MORTGAGE CHARTS
        function initMortgageCharts() {
            // Payment Comparison
            const paymentCtx = document.getElementById('paymentChart');
            if (paymentCtx && !paymentCtx.chart) {
                paymentCtx.chart = new Chart(paymentCtx, {
                    type: 'bar',
                    data: {
                        labels: ['15 Year', '20 Year', '30 Year'],
                        datasets: [{
                            label: 'Monthly Payment',
                            data: [2108, 1738, 1432],
                            backgroundColor: ['#667eea', '#764ba2', '#28a745']
                        }]
                    },
                    options: { responsive: true }
                });
            }

            // Amortization Chart
            const amortizationCtx = document.getElementById('amortizationChart');
            if (amortizationCtx && !amortizationCtx.chart) {
                amortizationCtx.chart = new Chart(amortizationCtx, {
                    type: 'area',
                    data: {
                        labels: ['Year 1', 'Year 5', 'Year 10', 'Year 15', 'Year 20', 'Year 30'],
                        datasets: [{
                            label: 'Principal Paid',
                            data: [12500, 65000, 135000, 175000, 205000, 300000],
                            backgroundColor: 'rgba(40, 167, 69, 0.2)',
                            borderColor: '#28a745'
                        }]
                    },
                    options: { responsive: true }
                });
            }
        }

        // INSIGHT CHARTS
        function initInsightCharts() {
            // Volume Chart
            const volumeCtx = document.getElementById('volumeChart');
            if (volumeCtx && !volumeCtx.chart) {
                volumeCtx.chart = new Chart(volumeCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                        datasets: [{
                            label: 'Applications',
                            data: [245, 318, 287, 356],
                            backgroundColor: '#667eea'
                        }]
                    },
                    options: { responsive: true }
                });
            }

            // Score Distribution
            const scoreCtx = document.getElementById('scoreDistChart');
            if (scoreCtx && !scoreCtx.chart) {
                scoreCtx.chart = new Chart(scoreCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Poor', 'Fair', 'Good', 'Excellent'],
                        datasets: [{
                            label: 'Count',
                            data: [25, 85, 156, 234],
                            backgroundColor: ['#dc3545', '#ffc107', '#17a2b8', '#28a745']
                        }]
                    },
                    options: { responsive: true }
                });
            }
        }

        // UPDATE METRICS FROM API
        async function updateMetrics() {
            try {
                // Simulated data - replace with actual API calls
                document.getElementById('total-processed').textContent = '1,206';
                document.getElementById('avg-score').textContent = '745';
                document.getElementById('success-rate').textContent = '94.2%';

                document.getElementById('metric-volume').textContent = '$48.5M';
                document.getElementById('metric-approval').textContent = '94.2%';
                document.getElementById('metric-time').textContent = '12ms';
                document.getElementById('metric-dti').textContent = '32%';
                document.getElementById('metric-ltv').textContent = '65%';
                document.getElementById('metric-credit').textContent = '745';
                document.getElementById('metric-queue').textContent = '0';
                document.getElementById('metric-failed').textContent = '0';

                document.getElementById('job-ingestion').textContent = '289';
                document.getElementById('job-scoring').textContent = '287';
                document.getElementById('job-repayment').textContent = '283';
                document.getElementById('job-ux').textContent = '281';
            } catch (error) {
                console.error('Error updating metrics:', error);
            }
        }

        // INITIALIZE ON LOAD
        document.addEventListener('DOMContentLoaded', () => {
            initTrendChart();
            initStatusChart();
            updateMetrics();

            // Refresh metrics every 30 seconds
            setInterval(updateMetrics, 30000);
        });
    </script>
</body>
</html>

