const currencyFormatter = new Intl.NumberFormat('en-AU', {
	style: 'currency',
	currency: 'AUD',
	maximumFractionDigits: 0,
});

const currencyFormatterWithCents = new Intl.NumberFormat('en-AU', {
	style: 'currency',
	currency: 'AUD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-AU', {
	maximumFractionDigits: 1,
});

const parseNumber = (value, fallback = 0) => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : fallback;
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	return fallback;
};

const clamp = (value, min, max) => {
	const parsed = parseNumber(value, min);
	return Math.min(Math.max(parsed, min), max);
};

const calculateMonthlyRepayment = (loanAmount, annualRate, termYears) => {
	const principal = Math.max(0, parseNumber(loanAmount, 0));
	const annualPercent = Math.max(0, parseNumber(annualRate, 0));
	const months = Math.max(1, Math.round(parseNumber(termYears, 30) * 12));
	const monthlyRate = (annualPercent / 100) / 12;

	if (monthlyRate <= 0) {
		return principal / months;
	}

	const factor = (1 + monthlyRate) ** -months;
	return (principal * monthlyRate) / (1 - factor);
};

const formatDeltaValue = (delta, unit = 'year') => {
	const absolute = Math.abs(delta);
	const formatter = unit === 'month' ? currencyFormatterWithCents : currencyFormatter;
	const prefix = delta > 0 ? '+' : delta < 0 ? '-' : '';
	const suffix = unit === 'month' ? '/mo' : '/yr';

	return `${prefix}${formatter.format(absolute)} ${suffix}`;
};

const describeDeltaText = (delta, unit = 'month') => {
	const formatter = unit === 'month' ? currencyFormatterWithCents : currencyFormatter;
	const unitCopy = unit === 'month' ? 'per month' : 'per year';
	const direction = delta >= 0 ? 'Renting costs' : 'Owning costs';

	return `${direction} ${formatter.format(Math.abs(delta))} ${unitCopy} more`;
};

const buildCrossoverDetail = (monthlyRent, monthlyMortgage, rentGrowthPercent) => {
	if (!Number.isFinite(monthlyRent) || !Number.isFinite(monthlyMortgage) || monthlyMortgage <= 0) {
		return {
			copy: 'Provide rent and mortgage inputs to project crossover.',
			monthlyCopy: null,
			annualCopy: null,
		};
	}

	if (monthlyRent >= monthlyMortgage) {
		const rentCopy = currencyFormatterWithCents.format(monthlyRent);
		const mortgageCopy = currencyFormatterWithCents.format(monthlyMortgage);
		return {
			copy: `Rent already exceeds mortgage (${rentCopy} vs ${mortgageCopy}). Owning is cheaper today.`,
			monthlyCopy: rentCopy,
			annualCopy: currencyFormatter.format(monthlyRent * 12),
		};
	}

	const monthlyGrowthRate = rentGrowthPercent > 0 ? rentGrowthPercent / 100 / 12 : 0;

	if (monthlyGrowthRate <= 0) {
		return {
			copy: 'With flat rent growth, renting stays cheaper than owning.',
			monthlyCopy: null,
			annualCopy: null,
		};
	}

	const monthsToCrossover = Math.log(monthlyMortgage / monthlyRent) / Math.log(1 + monthlyGrowthRate);

	if (!Number.isFinite(monthsToCrossover) || monthsToCrossover < 0) {
		return {
			copy: 'Crossover is not reachable with the current growth rate.',
			monthlyCopy: null,
			annualCopy: null,
		};
	}

	const roundedMonths = Math.max(1, Math.ceil(monthsToCrossover));
	const years = Math.floor(roundedMonths / 12);
	const months = roundedMonths % 12;
	const durationParts = [];

	if (years > 0) {
		durationParts.push(`${years}y`);
	}

	if (months > 0) {
		durationParts.push(`${months}m`);
	}

	const durationCopy = durationParts.join(' ') || '1m';
	const projectedRentMonthly = monthlyRent * (1 + monthlyGrowthRate) ** roundedMonths;

	return {
		copy: `At this growth, rent meets the ${currencyFormatterWithCents.format(monthlyMortgage)}/mo mortgage in ~${durationCopy} when rent reaches ${currencyFormatterWithCents.format(projectedRentMonthly)}/mo.`,
		monthlyCopy: currencyFormatterWithCents.format(projectedRentMonthly),
		annualCopy: currencyFormatter.format(projectedRentMonthly * 12),
	};
};

const registerHousingDashboard = (Alpine) => {
	if (!Alpine || typeof Alpine.data !== 'function') {
		return;
	}

	Alpine.data('mortgageWidget', (defaults = {}) => ({
		defaults: defaults ?? {},
		form: {
			home_price: parseNumber(defaults.home_price ?? 650000),
			deposit_percent: parseNumber(defaults.deposit_percent ?? 15),
			interest_rate: parseNumber(defaults.interest_rate ?? 5.9),
			term_years: parseNumber(defaults.term_years ?? 30),
		},
		monthlyRepaymentCopy: '',
		mortgageSummaryCopy: '',
		frameId: null,
		init() {
			this.refreshLoanOutputs();
		},
		scheduleMortgageRefresh() {
			if (this.frameId) {
				cancelAnimationFrame(this.frameId);
			}

			this.frameId = requestAnimationFrame(() => this.refreshLoanOutputs());
		},
		refreshLoanOutputs() {
			const homePrice = Math.max(0, parseNumber(this.form.home_price, this.defaults.home_price ?? 650000));
			const depositPercent = clamp(this.form.deposit_percent ?? this.defaults.deposit_percent ?? 15, 0, 95);
			const interestRate = Math.max(0, parseNumber(this.form.interest_rate, this.defaults.interest_rate ?? 5.9));
			const termYears = Math.max(1, parseNumber(this.form.term_years, this.defaults.term_years ?? 30));

			const depositAmount = homePrice * (depositPercent / 100);
			const loanAmount = Math.max(0, homePrice - depositAmount);
			const monthlyRepayment = calculateMonthlyRepayment(loanAmount, interestRate, termYears);

			this.monthlyRepaymentCopy = currencyFormatter.format(Math.round(monthlyRepayment));
			const depositCopy = numberFormatter.format(depositPercent);
			this.mortgageSummaryCopy = `Loan ${currencyFormatter.format(loanAmount)} with ${depositCopy}% deposit over ${termYears} years.`;
		},
		applyRate(rate) {
			this.form.interest_rate = parseNumber(rate, this.defaults.interest_rate ?? 5.9);
			this.scheduleMortgageRefresh();

			if (this.$refs?.interestInput) {
				this.$nextTick(() => this.$refs.interestInput.focus());
			}
		},
	}));

	Alpine.data('rentVsBuyWidget', (config = {}) => ({
		config: config ?? {},
		form: {
			weekly_rent: parseNumber(config.weekly_rent ?? 620),
			rent_growth: parseNumber(config.rent_growth_rate ?? 3.2),
			rent_deposit: parseNumber(config.deposit_percent ?? 20),
		},
		deltaAnnualCopy: '$0 /yr',
		deltaMonthlyCopy: 'Monthly delta appears after adjustments.',
		rentSummaryCopy: 'Monthly comparison appears here.',
		crossoverCopy: 'Projection appears here.',
		crossoverMonthlyValue: null,
		crossoverAnnualValue: null,
		frameId: null,
		init() {
			this.refreshRentOutputs();
		},
		scheduleRentRefresh() {
			if (this.frameId) {
				cancelAnimationFrame(this.frameId);
			}

			this.frameId = requestAnimationFrame(() => this.refreshRentOutputs());
		},
		refreshRentOutputs() {
			const weeklyRent = Math.max(0, parseNumber(this.form.weekly_rent, this.config.weekly_rent ?? 620));
			const rentGrowth = Math.max(0, parseNumber(this.form.rent_growth, this.config.rent_growth_rate ?? 3.2));
			const depositPercent = clamp(this.form.rent_deposit ?? this.config.deposit_percent ?? 20, 0, 60);

			const annualRentToday = weeklyRent * 52;
			const annualRentNext = annualRentToday * (1 + rentGrowth / 100);
			const averageAnnualRent = (annualRentToday + annualRentNext) / 2;
			const monthlyRentCurrent = annualRentToday / 12;
			const monthlyRentNext = annualRentNext / 12;
			const averageMonthlyRent = averageAnnualRent / 12;

			const baseHomePrice = Math.max(0, parseNumber(this.config.home_price ?? 650000));
			const interestRate = Math.max(0, parseNumber(this.config.interest_rate ?? 5.9));
			const termYears = Math.max(1, parseNumber(this.config.term_years ?? 30));
			const depositAmount = baseHomePrice * (depositPercent / 100);
			const loanAmount = Math.max(0, baseHomePrice - depositAmount);
			const monthlyMortgage = calculateMonthlyRepayment(loanAmount, interestRate, termYears);
			const annualMortgage = monthlyMortgage * 12;

			const annualDelta = averageAnnualRent - annualMortgage;
			const monthlyDelta = annualDelta / 12;

			this.deltaAnnualCopy = formatDeltaValue(annualDelta, 'year');
			this.deltaMonthlyCopy = describeDeltaText(monthlyDelta, 'month');

			const rentNowCopy = currencyFormatterWithCents.format(monthlyRentCurrent);
			const rentFutureCopy = currencyFormatterWithCents.format(monthlyRentNext);
			const averageRentCopy = currencyFormatterWithCents.format(averageMonthlyRent);
			const mortgageCopy = currencyFormatterWithCents.format(monthlyMortgage);
			const growthCopy = numberFormatter.format(rentGrowth);
			const depositCopy = numberFormatter.format(depositPercent);

			this.rentSummaryCopy = `Rent averages ${averageRentCopy}/mo (${rentNowCopy} now → ${rentFutureCopy} next year at ${growthCopy}% growth) versus ${mortgageCopy}/mo owning with a ${depositCopy}% deposit.`;

			const crossover = buildCrossoverDetail(monthlyRentCurrent, monthlyMortgage, rentGrowth);
			this.crossoverCopy = crossover.copy;
			this.crossoverMonthlyValue = crossover.monthlyCopy;
			this.crossoverAnnualValue = crossover.annualCopy;
		},
	}));
};

const bootHousingDashboard = () => {
	if (window.__housingDashboardInitialized) {
		return;
	}

	const register = () => {
		if (window.__housingDashboardInitialized) {
			return;
		}

		registerHousingDashboard(window.Alpine);
		window.__housingDashboardInitialized = true;
	};

	if (window.Alpine && typeof window.Alpine === 'object') {
		register();
	} else {
		document.addEventListener('alpine:init', register, { once: true });
	}
};

bootHousingDashboard();
