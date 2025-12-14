import './bootstrap';

import Alpine from 'alpinejs';
import { createApp } from 'vue';
import CareerWishlistDashboard from './components/careers/CareerWishlistDashboard.vue';
import BudgetDashboard from './components/money/BudgetDashboard.vue';
import BusinessFinanceWorkspace from './components/business/BusinessFinanceWorkspace.vue';
import WellbeingDashboard from './components/wellbeing/WellbeingDashboard.vue';
import EntertainmentDashboard from './components/entertainment/EntertainmentDashboard.vue';
import './modules/persona-middleware';
import './modules/onboarding';
import './modules/analytics';
import './modules/advertising';
import './modules/impact-widget';
import './modules/housing-dashboard';

window.Alpine = Alpine;

Alpine.start();

const mountCareerWishlist = () => {
	const careerRoot = document.getElementById('career-wishlist-root');

	if (!careerRoot) {
		return;
	}

	const userPayload = careerRoot.dataset.user ? JSON.parse(careerRoot.dataset.user) : {};

	createApp(CareerWishlistDashboard, {
		user: userPayload,
	}).mount(careerRoot);
};

mountCareerWishlist();

const mountMoneyDashboard = () => {
	const moneyRoot = document.getElementById('money-dashboard-root');

	if (!moneyRoot) {
		return;
	}

	const userPayload = moneyRoot.dataset.user ? JSON.parse(moneyRoot.dataset.user) : {};
	const aiPayload = moneyRoot.dataset.ai ? JSON.parse(moneyRoot.dataset.ai) : null;
	const aiEntry = moneyRoot.dataset.aiEntry ?? null;

	createApp(BudgetDashboard, {
		user: userPayload,
		ai: {
			entryUrl: aiEntry,
			contexts: aiPayload,
		},
	}).mount(moneyRoot);
};

mountMoneyDashboard();

const mountBusinessFinanceWorkspace = () => {
	const financeRoot = document.getElementById('business-finance-workspace-root');

	if (!financeRoot) {
		return;
	}

	const userPayload = financeRoot.dataset.user ? JSON.parse(financeRoot.dataset.user) : {};
	const aiPayload = financeRoot.dataset.ai ? JSON.parse(financeRoot.dataset.ai) : [];
	const aiEntry = financeRoot.dataset.aiEntry ?? null;

	createApp(BusinessFinanceWorkspace, {
		user: userPayload,
		ai: {
			contexts: aiPayload,
			entryUrl: aiEntry,
		},
	}).mount(financeRoot);
};

mountBusinessFinanceWorkspace();

const mountWellbeingDashboard = () => {
	const wellbeingRoot = document.getElementById('wellbeing-dashboard-root');

	if (!wellbeingRoot) {
		return;
	}

	const userPayload = wellbeingRoot.dataset.user ? JSON.parse(wellbeingRoot.dataset.user) : {};
	const interestPayload = wellbeingRoot.dataset.interests ? JSON.parse(wellbeingRoot.dataset.interests) : [];

	createApp(WellbeingDashboard, {
		user: userPayload,
		interests: interestPayload,
	}).mount(wellbeingRoot);
};

mountWellbeingDashboard();

const mountEntertainmentDashboard = () => {
	const entertainmentRoot = document.getElementById('entertainment-dashboard-root');

	if (!entertainmentRoot) {
		return;
	}

	const userPayload = entertainmentRoot.dataset.user ? JSON.parse(entertainmentRoot.dataset.user) : {};

	createApp(EntertainmentDashboard, {
		user: userPayload,
	}).mount(entertainmentRoot);
};

mountEntertainmentDashboard();

// Impact widget module auto-initialises when present on the page
