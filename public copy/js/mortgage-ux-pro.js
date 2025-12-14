// Mortgage UX Hooks Pro - Advanced Frontend Integration Library
// Real-time visualizations, notifications, and interactive components

class MortgageUXHooksPro {
    constructor() {
        this.charts = {};
        this.notifications = [];
        this.updateInterval = null;
    }

    // =======================
    // ENHANCED VISUALIZATIONS
    // =======================

    /**
     * Display advanced mortgage score gauge with animations
     */
    showScoreGaugeAdvanced(score, maxScore = 1000) {
        const percentage = (score / maxScore) * 100;
        const color = this.getScoreColor(score);
        const rating = this.getScoreRating(score);

        const html = `
            <div class="score-gauge-container">
                <div class="score-gauge">
                    <svg viewBox="0 0 200 200">
                        <!-- Background circle -->
                        <circle cx="100" cy="100" r="90" fill="none" stroke="#eee" stroke-width="20"/>
                        <!-- Progress arc -->
                        <circle cx="100" cy="100" r="90" fill="none" stroke="${color}"
                                stroke-width="20" stroke-dasharray="${percentage * 5.65} 565"
                                transform="rotate(-90 100 100)" style="transition: stroke-dasharray 0.3s ease;"/>
                        <!-- Score text -->
                        <text x="100" y="100" text-anchor="middle" dominant-baseline="middle"
                              font-size="48" font-weight="bold" fill="${color}">${score}</text>
                        <text x="100" y="130" text-anchor="middle" font-size="16" fill="#666">${maxScore}</text>
                    </svg>
                </div>
                <div class="score-details">
                    <p class="score-rating" style="color: ${color};">${rating}</p>
                    <p class="score-percentage">${percentage.toFixed(1)}%</p>
                </div>
            </div>
        `;
        return html;
    }

    /**
     * Create interactive repayment schedule visualization
     */
    createRepaymentVisualization(principal, rate, years) {
        const monthlyRate = rate / 100 / 12;
        const numPayments = years * 12;
        const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                              (Math.pow(1 + monthlyRate, numPayments) - 1);

        let principalRemaining = principal;
        let totalInterest = 0;
        const schedule = [];

        for (let i = 0; i < numPayments; i++) {
            const interestPayment = principalRemaining * monthlyRate;
            const principalPayment = monthlyPayment - interestPayment;
            principalRemaining -= principalPayment;
            totalInterest += interestPayment;

            if (i % 12 === 0) {
                schedule.push({
                    year: i / 12,
                    principal: principal - principalRemaining,
                    interest: totalInterest,
                    remaining: Math.max(0, principalRemaining)
                });
            }
        }

        return {
            monthlyPayment: monthlyPayment,
            totalPayment: monthlyPayment * numPayments,
            totalInterest: totalInterest,
            schedule: schedule
        };
    }

    /**
     * Display comparison table with multiple mortgage options
     */
    showMortgageComparison(options) {
        const html = `
            <div class="comparison-table">
                <table>
                    <thead>
                        <tr>
                            <th>Term</th>
                            <th>Rate</th>
                            <th>Monthly Payment</th>
                            <th>Total Interest</th>
                            <th>Total Payment</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${options.map((opt, idx) => `
                            <tr class="comparison-row ${opt.recommended ? 'recommended' : ''}">
                                <td><strong>${opt.term} years</strong></td>
                                <td>${opt.rate}%</td>
                                <td class="highlight">$${opt.monthlyPayment.toFixed(2)}</td>
                                <td>$${opt.totalInterest.toFixed(2)}</td>
                                <td>$${opt.totalPayment.toFixed(2)}</td>
                                <td>
                                    <button class="action-btn" data-option="${idx}">
                                        ${opt.recommended ? '⭐ Recommended' : 'Select'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    /**
     * Show DTI and LTV breakdown with visual indicators
     */
    showFinancialMetrics(dti, ltv, income, monthlyDebts, loanAmount, propertyValue) {
        const dtiStatus = this.getMetricStatus(dti, 43, 36);
        const ltvStatus = this.getMetricStatus(ltv, 95, 80);

        const html = `
            <div class="financial-metrics">
                <div class="metric-box">
                    <div class="metric-header">
                        <span class="metric-label">Debt-to-Income Ratio</span>
                        <span class="metric-status ${dtiStatus.class}">${dtiStatus.label}</span>
                    </div>
                    <div class="metric-visual">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${dti}%; background: ${dtiStatus.color};"></div>
                        </div>
                        <div class="metric-details">
                            <span>${dti.toFixed(1)}%</span>
                            <span class="metric-note">Monthly debts: $${monthlyDebts} / Income: $${(income/12).toFixed(0)}</span>
                        </div>
                    </div>
                </div>

                <div class="metric-box">
                    <div class="metric-header">
                        <span class="metric-label">Loan-to-Value Ratio</span>
                        <span class="metric-status ${ltvStatus.class}">${ltvStatus.label}</span>
                    </div>
                    <div class="metric-visual">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${ltv}%; background: ${ltvStatus.color};"></div>
                        </div>
                        <div class="metric-details">
                            <span>${ltv.toFixed(1)}%</span>
                            <span class="metric-note">Loan: $${loanAmount} / Property: $${propertyValue}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return html;
    }

    /**
     * Real-time notifications with auto-dismiss
     */
    showNotification(type, title, message, duration = 5000) {
        const notificationId = 'notif-' + Date.now();
        const colors = {
            success: '#28a745',
            info: '#17a2b8',
            warning: '#ffc107',
            error: '#dc3545'
        };

        const html = `
            <div id="${notificationId}" class="notification notification-${type}" style="border-left: 4px solid ${colors[type]};">
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close" onclick="this.parentElement.remove();">×</button>
            </div>
        `;

        const container = document.getElementById('notification-container') || this.createNotificationContainer();
        container.insertAdjacentHTML('beforeend', html);

        if (duration > 0) {
            setTimeout(() => {
                const el = document.getElementById(notificationId);
                if (el) el.remove();
            }, duration);
        }

        return notificationId;
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            width: 400px;
            max-width: 90vw;
        `;
        document.body.appendChild(container);
        return container;
    }

    // =======================
    // INTERACTIVE DASHBOARDS
    // =======================

    /**
     * Create loan calculator widget
     */
    createLoanCalculator(defaultPrincipal = 300000, defaultRate = 6.5, defaultYears = 30) {
        const html = `
            <div class="loan-calculator">
                <div class="calculator-input-group">
                    <label>Loan Amount</label>
                    <div class="input-with-slider">
                        <input type="range" min="50000" max="1000000" step="10000" value="${defaultPrincipal}"
                               class="calculator-slider" id="principal-slider"
                               onchange="updateCalculation()">
                        <input type="number" value="${defaultPrincipal}" class="calculator-input" id="principal-input"
                               onchange="updateCalculation()">
                    </div>
                    <span class="input-value">$${defaultPrincipal.toLocaleString()}</span>
                </div>

                <div class="calculator-input-group">
                    <label>Interest Rate (%)</label>
                    <div class="input-with-slider">
                        <input type="range" min="2" max="12" step="0.1" value="${defaultRate}"
                               class="calculator-slider" id="rate-slider"
                               onchange="updateCalculation()">
                        <input type="number" value="${defaultRate}" step="0.1" class="calculator-input" id="rate-input"
                               onchange="updateCalculation()">
                    </div>
                    <span class="input-value">${defaultRate}%</span>
                </div>

                <div class="calculator-input-group">
                    <label>Loan Term (Years)</label>
                    <div class="input-with-slider">
                        <input type="range" min="5" max="40" step="1" value="${defaultYears}"
                               class="calculator-slider" id="years-slider"
                               onchange="updateCalculation()">
                        <input type="number" value="${defaultYears}" class="calculator-input" id="years-input"
                               onchange="updateCalculation()">
                    </div>
                    <span class="input-value">${defaultYears} years</span>
                </div>

                <div class="calculator-results">
                    <div class="result-item">
                        <span>Monthly Payment</span>
                        <span class="result-value" id="monthly-payment">$1,896.20</span>
                    </div>
                    <div class="result-item">
                        <span>Total Interest</span>
                        <span class="result-value" id="total-interest">$382,629</span>
                    </div>
                    <div class="result-item">
                        <span>Total Payment</span>
                        <span class="result-value" id="total-payment">$682,629</span>
                    </div>
                </div>

                <button class="calculator-submit">Get Pre-Approved</button>
            </div>
        `;
        return html;
    }

    /**
     * Show approval odds with visual breakdown
     */
    showApprovalOdds(creditScore, dti, ltv) {
        const odds = this.calculateApprovalOdds(creditScore, dti, ltv);

        const html = `
            <div class="approval-odds">
                <div class="odds-main">
                    <div class="odds-number">${odds.probability}%</div>
                    <div class="odds-label">Approval Probability</div>
                </div>

                <div class="odds-factors">
                    <div class="factor-item">
                        <span class="factor-label">Credit Score (${creditScore})</span>
                        <span class="factor-impact" style="color: ${this.getScoreColor(creditScore)};">
                            ${this.getScoreImpact(creditScore)}
                        </span>
                    </div>
                    <div class="factor-item">
                        <span class="factor-label">DTI Ratio (${dti}%)</span>
                        <span class="factor-impact" style="color: ${dti > 43 ? '#dc3545' : '#28a745'};">
                            ${dti > 43 ? '⚠️ High' : '✓ Good'}
                        </span>
                    </div>
                    <div class="factor-item">
                        <span class="factor-label">LTV Ratio (${ltv}%)</span>
                        <span class="factor-impact" style="color: ${ltv > 95 ? '#dc3545' : '#28a745'};">
                            ${ltv > 95 ? '⚠️ High' : '✓ Good'}
                        </span>
                    </div>
                </div>

                <div class="odds-recommendation">
                    ${odds.recommendation}
                </div>
            </div>
        `;
        return html;
    }

    // =======================
    // HELPER FUNCTIONS
    // =======================

    getScoreColor(score) {
        if (score >= 750) return '#28a745';
        if (score >= 650) return '#ffc107';
        return '#dc3545';
    }

    getScoreRating(score) {
        if (score >= 750) return 'Excellent';
        if (score >= 700) return 'Very Good';
        if (score >= 650) return 'Good';
        if (score >= 550) return 'Fair';
        return 'Poor';
    }

    getMetricStatus(value, poor, good) {
        if (value <= good) {
            return { class: 'status-good', label: '✓ Excellent', color: '#28a745' };
        }
        if (value <= poor) {
            return { class: 'status-fair', label: '⚠️ Fair', color: '#ffc107' };
        }
        return { class: 'status-poor', label: '✗ Poor', color: '#dc3545' };
    }

    getScoreImpact(score) {
        if (score >= 750) return '+25% Better Odds';
        if (score >= 700) return '+15% Better Odds';
        if (score >= 650) return '+5% Better Odds';
        if (score >= 550) return '-5% Worse Odds';
        return '-20% Worse Odds';
    }

    calculateApprovalOdds(creditScore, dti, ltv) {
        let odds = 50; // Base 50%

        // Credit score factor (0-30 points)
        if (creditScore >= 750) odds += 30;
        else if (creditScore >= 700) odds += 20;
        else if (creditScore >= 650) odds += 10;

        // DTI factor (0-25 points)
        if (dti <= 36) odds += 25;
        else if (dti <= 43) odds += 15;
        else odds -= 10;

        // LTV factor (0-20 points)
        if (ltv <= 80) odds += 20;
        else if (ltv <= 95) odds += 10;
        else odds -= 5;

        odds = Math.min(99, Math.max(1, odds));

        let recommendation = '';
        if (odds >= 80) {
            recommendation = '<div class="rec-excellent">🎉 Excellent! You\'re very likely to be approved. Apply now!</div>';
        } else if (odds >= 60) {
            recommendation = '<div class="rec-good">👍 Good chances! You meet most lending criteria. Consider applying.</div>';
        } else if (odds >= 40) {
            recommendation = '<div class="rec-fair">📋 Fair odds. You may want to improve credit score or reduce debt first.</div>';
        } else {
            recommendation = '<div class="rec-poor">⚠️ Low approval odds. Consider consulting with a mortgage advisor.</div>';
        }

        return { probability: Math.round(odds), recommendation };
    }

    // =======================
    // LIVE UPDATES
    // =======================

    /**
     * Start live metrics updates
     */
    startLiveUpdates(apiEndpoint, interval = 5000) {
        this.updateInterval = setInterval(() => {
            fetch(apiEndpoint)
                .then(res => res.json())
                .then(data => this.updateMetricsDisplay(data))
                .catch(err => console.error('Update failed:', err));
        }, interval);
    }

    /**
     * Stop live updates
     */
    stopLiveUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    updateMetricsDisplay(data) {
        // Update elements with data
        if (data.total_processed) {
            const el = document.getElementById('total-processed');
            if (el) el.textContent = data.total_processed;
        }
        // ... update other metrics
    }
}

// Initialize global instance
const mortgageUX = new MortgageUXHooksPro();

// Example usage:
// mortgageUX.showNotification('success', 'Application Received', 'Your mortgage application has been received.');
// mortgageUX.startLiveUpdates('/api/admin/mortgage-analytics/metrics');
