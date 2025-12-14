// Mortgage UX Hooks - Advanced Frontend Integration

// Chart.js for visualizations (add to HTML head: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>)

function showMortgageScore(score) {
    // Display mortgage score to user with visual feedback
    const scoreColor = score >= 750 ? 'green' : score >= 650 ? 'yellow' : 'red';
    const message = score >= 750 ? 'Excellent!' : score >= 650 ? 'Good' : 'Fair';

    const html = `
        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            <h3>Your Mortgage Score</h3>
            <div style="font-size: 48px; font-weight: bold; color: ${scoreColor}; margin: 20px 0;">
                ${score}
            </div>
            <p style="font-size: 18px; color: ${scoreColor};">${message}</p>
            <canvas id="scoreChart"></canvas>
        </div>
    `;

    // Show in modal or update DOM
    if (typeof updateUI !== 'undefined') {
        updateUI('mortgage-score', html);
    }

    // Draw score gauge chart
    setTimeout(() => drawScoreGauge(score), 100);
}

function showRepaymentDetails(details) {
    // Display repayment details with interactive chart
    const monthlyPayment = details.monthly_payment || 1200;
    const totalPayment = details.total_payment || 144000;
    const totalInterest = totalPayment - 100000; // Example principal

    const html = `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            <h3>Repayment Calculator</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #666; margin: 0; font-size: 14px;">Monthly Payment</p>
                    <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 10px 0;">$${monthlyPayment.toFixed(2)}</p>
                </div>
                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #666; margin: 0; font-size: 14px;">Total Payment</p>
                    <p style="font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0;">$${totalPayment.toFixed(2)}</p>
                </div>
            </div>
            <canvas id="repaymentChart" style="max-height: 300px;"></canvas>
        </div>
    `;

    if (typeof updateUI !== 'undefined') {
        updateUI('repayment-details', html);
    }

    // Draw repayment breakdown chart
    setTimeout(() => drawRepaymentChart(monthlyPayment, totalPayment, totalInterest), 100);
}

function drawScoreGauge(score) {
    const canvas = document.getElementById('scoreChart');
    if (!canvas || typeof Chart === 'undefined') return;

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Score', 'Remaining'],
            datasets: [{
                data: [score, 1000 - score],
                backgroundColor: [
                    score >= 750 ? '#28a745' : score >= 650 ? '#ffc107' : '#dc3545',
                    '#e9ecef'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'bottom' }
            }
        }
    });
}

function drawRepaymentChart(monthly, total, interest) {
    const canvas = document.getElementById('repaymentChart');
    if (!canvas || typeof Chart === 'undefined') return;

    new Chart(canvas, {
        type: 'pie',
        data: {
            labels: ['Principal', 'Interest'],
            datasets: [{
                data: [total - interest, interest],
                backgroundColor: ['#007bff', '#fd7e14']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'bottom' }
            }
        }
    });
}

function updateUI(elementId, html) {
    // Update DOM with new content
    const element = document.getElementById(elementId) || document.createElement('div');
    element.id = elementId;
    element.innerHTML = html;

    if (!document.getElementById(elementId)) {
        document.body.appendChild(element);
    }
}

// Real-time feedback notifications
function showNotification(message, type = 'info') {
    const bgColor = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8';
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
}

// Example usage: these would be triggered by backend events or AJAX
// showMortgageScore(85);
// showRepaymentDetails({monthly_payment: 1200, total_payment: 144000});
// showNotification('Mortgage data updated!', 'success');
