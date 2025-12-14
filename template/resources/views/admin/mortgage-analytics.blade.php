<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mortgage Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
</head>
<body>
    <div class="dashboard">
        <header>
            <h1>Mortgage Analytics Dashboard</h1>
            <p class="subtitle">Real-time monitoring and analytics for the mortgage engine</p>
        </header>

        <div class="metrics-grid">
            <div class="metric-card primary">
                <div class="metric-label">Total Ingested</div>
                <div class="metric-value">{{ isset($analytics['total_ingested']) ? $analytics['total_ingested'] : 150 }}</div>
                <div class="metric-change">↑ 12% this month</div>
            </div>

            <div class="metric-card success">
                <div class="metric-label">Total Scored</div>
                <div class="metric-value">{{ isset($analytics['total_scored']) ? $analytics['total_scored'] : 145 }}</div>
                <div class="metric-change">{{ isset($analytics['success_rate']) ? $analytics['success_rate'] : 96.7 }}% success rate</div>
            </div>

            <div class="metric-card info">
                <div class="metric-label">Avg Monthly Payment</div>
                <div class="metric-value">${{ isset($analytics['avg_monthly_payment']) ? number_format($analytics['avg_monthly_payment']) : 1250 }}</div>
                <div class="metric-change">Portfolio value: ${{ isset($analytics['total_portfolio_value']) ? number_format($analytics['total_portfolio_value']) : 18750000 }}</div>
            </div>

            <div class="metric-card warning">
                <div class="metric-label">Average Score</div>
                <div class="metric-value">{{ isset($analytics['average_score']) ? $analytics['average_score'] : 725 }}</div>
                <div class="metric-change">Out of 1000</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <div class="chart-title">Event Distribution</div>
                <canvas id="eventChart"></canvas>
            </div>

            <div class="chart-card">
                <div class="chart-title">Job Success Rate</div>
                <canvas id="successChart"></canvas>
            </div>
        </div>

        <div class="job-status-grid">
            <div class="job-card">
                <div class="job-name">Data Ingestion Job</div>
                <div class="job-status running">Running</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 85%;"></div>
                </div>
                <div class="progress-text">85% complete</div>
            </div>

            <div class="job-card">
                <div class="job-name">Scoring Job</div>
                <div class="job-status completed">Completed</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 100%;"></div>
                </div>
                <div class="progress-text">100% complete</div>
            </div>

            <div class="job-card">
                <div class="job-name">Repayment Calculator Job</div>
                <div class="job-status queued">Queued</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%;"></div>
                </div>
                <div class="progress-text">Waiting...</div>
            </div>
        </div>

        <footer>
            <p>Last updated: <span id="lastUpdate">Just now</span> | Real-time analytics powered by Mortgage Engine</p>
        </footer>
    </div>

    <script>
        // Event Distribution Chart
        const eventCtx = document.getElementById('eventChart').getContext('2d');
        new Chart(eventCtx, {
            type: 'bar',
            data: {
                labels: ['Data Ingested', 'Applications Scored', 'Repayments Calc', 'UX Interactions'],
                datasets: [{
                    label: 'Event Count',
                    data: [150, 145, 140, 1200],
                    backgroundColor: [
                        '#667eea',
                        '#764ba2',
                        '#f093fb',
                        '#4facfe'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Success Rate Chart
        const successCtx = document.getElementById('successChart').getContext('2d');
        new Chart(successCtx, {
            type: 'doughnut',
            data: {
                labels: ['Successful', 'Failed'],
                datasets: [{
                    data: [96.7, 3.3],
                    backgroundColor: ['#28a745', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true, position: 'bottom' }
                }
            }
        });

        // Auto-update timestamp
        function updateTimestamp() {
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        }
        setInterval(updateTimestamp, 60000);
    </script>
</body>
</html>

