<template>
  <div class="space-y-10">
    <section class="space-y-3 text-slate-800">
      <p class="text-[11px] uppercase tracking-[0.4em] text-pink-500 font-semibold">Athena Careers Hub</p>
      <h1 class="text-3xl font-extrabold leading-tight">
        Save your dream opportunities,<span class="text-transparent">.</span>
        <span class="text-rose-500">{{ displayName }}</span>
      </h1>
      <p class="text-base text-slate-600 max-w-3xl">
        Tell us the roles, trades, apprenticeships, or study pathways you would love to explore.
        We will quietly compare your wishes against new opportunities and send respectful notifications when we spot a match.
      </p>
    </section>

    <div class="grid gap-8 lg:grid-cols-[1.6fr_1fr] items-start">
      <section class="space-y-6">
        <div class="bg-white/90 backdrop-blur border border-violet-100 shadow-sm rounded-2xl p-6 space-y-5">
          <header class="space-y-1">
            <p class="text-xs font-semibold text-slate-500">
              {{ editingIndex === null ? 'Add a dream opportunity' : 'Edit dream opportunity' }}
            </p>
            <p class="text-[11px] text-slate-500">
              Capture as many variations as you like – career change, trades, public sector, or study.
            </p>
          </header>

          <form class="space-y-4" @submit.prevent="saveInterest">
            <div class="grid gap-4 md:grid-cols-3">
              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Pathway type</span>
                <select v-model="form.pathway_type" class="form-input">
                  <option v-for="option in pathwayOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Dream title</span>
                <input v-model="form.title" type="text" class="form-input" placeholder="e.g. Cyber security analyst" />
              </label>

              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Field / Area</span>
                <input v-model="form.field" type="text" class="form-input" placeholder="Healthcare, Carpentry" />
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Industry</span>
                <input v-model="form.industry" type="text" class="form-input" placeholder="Health, Construction" />
              </label>

              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Level</span>
                <input v-model="form.level" type="text" class="form-input" placeholder="Entry, Mid, Senior" />
              </label>

              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Timeline</span>
                <input v-model="form.timeline" type="text" class="form-input" placeholder="Now, 6-12 months" />
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Preferred location</span>
                <input v-model="form.preferred_location" type="text" class="form-input" placeholder="City, region, or remote" />
              </label>

              <label class="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input v-model="form.open_to_remote" type="checkbox" class="rounded border-slate-300" />
                <span>Open to remote or hybrid roles</span>
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Target roles or titles</span>
                <textarea
                  v-model="form.target_roles_input"
                  rows="2"
                  class="form-textarea"
                  placeholder="Product manager, Apprentice electrician"
                ></textarea>
                <span class="text-[11px] text-slate-400">Comma separated. We keep this private.</span>
              </label>

              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Target sectors</span>
                <textarea
                  v-model="form.target_sectors_input"
                  rows="2"
                  class="form-textarea"
                  placeholder="Healthcare, Public sector, Climate tech"
                ></textarea>
                <span class="text-[11px] text-slate-400">Optional. Helps us aim towards industries that energise you.</span>
              </label>
            </div>

            <label class="text-xs font-semibold text-slate-600 space-y-1">
              <span>Preferred locations list</span>
              <textarea
                v-model="form.preferred_locations_input"
                rows="2"
                class="form-textarea"
                placeholder="Brisbane, Gold Coast, Remote across QLD"
              ></textarea>
            </label>

            <div class="space-y-2">
              <span class="text-xs font-semibold text-slate-600">Preferred study modes or schedules</span>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="mode in studyModeOptions"
                  :key="mode.value"
                  class="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 shadow-sm"
                >
                  <input type="checkbox" :value="mode.value" v-model="form.preferred_study_modes" class="rounded border-slate-300" />
                  <span>{{ mode.label }}</span>
                </label>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Minimum annual pay (AUD)</span>
                <input v-model="form.min_pay_annual" type="number" min="0" step="1000" class="form-input" placeholder="Optional" />
              </label>

              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Stretch annual pay (AUD)</span>
                <input v-model="form.max_pay_annual" type="number" min="0" step="1000" class="form-input" placeholder="Optional" />
              </label>
            </div>

            <label class="text-xs font-semibold text-slate-600 space-y-1">
              <span>Intake window / availability</span>
              <input v-model="form.intake_window" type="text" class="form-input" placeholder="e.g. Ready by Term 2, 2026" />
            </label>

            <label class="text-xs font-semibold text-slate-600 space-y-1">
              <span>Skills or strengths you want to use</span>
              <textarea v-model="form.skills" rows="2" class="form-textarea" placeholder="List the skills, certifications, or passions you want honoured."></textarea>
            </label>

            <label class="text-xs font-semibold text-slate-600 space-y-1">
              <span>Notes for future-you or Athena</span>
              <textarea v-model="form.notes" rows="3" class="form-textarea" placeholder="Constraints, childcare needs, study preferences, or anything else we should remember."></textarea>
            </label>

            <label class="text-xs font-semibold text-slate-600 space-y-1">
              <span>Support needs or accessibility notes</span>
              <textarea
                v-model="form.support_needs"
                rows="2"
                class="form-textarea"
                placeholder="Scholarships, travel stipends, flexible rostering, tech access, etc."
              ></textarea>
            </label>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="flex items-center justify-between rounded-2xl border border-violet-100 bg-white px-4 py-3 text-xs font-semibold text-slate-600">
                <span>In-app nudges</span>
                <input v-model="form.notify_in_app" type="checkbox" class="rounded border-slate-300" />
              </label>
              <label class="flex items-center justify-between rounded-2xl border border-violet-100 bg-white px-4 py-3 text-xs font-semibold text-slate-600">
                <span>Email digests</span>
                <input v-model="form.notify_email" type="checkbox" class="rounded border-slate-300" />
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
              <label class="text-xs font-semibold text-slate-600 space-y-1">
                <span>Status</span>
                <select v-model="form.status" class="form-input">
                  <option v-for="statusOption in statusOptions" :key="statusOption.value" :value="statusOption.value">
                    {{ statusOption.label }}
                  </option>
                </select>
              </label>

              <div class="md:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-rose-500 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-60"
                  :disabled="saving"
                >
                  <span v-if="!saving">{{ editingIndex === null ? 'Save dream' : 'Update dream' }}</span>
                  <span v-else>Saving…</span>
                </button>
                <button
                  v-if="editingIndex !== null"
                  type="button"
                  class="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  @click="resetForm"
                >
                  Cancel edit
                </button>
              </div>
            </div>

            <p v-if="Object.keys(errors).length" class="text-sm text-rose-600">
              Please review the highlighted fields.
            </p>
            <p v-if="statusMessage" class="text-sm text-emerald-600">{{ statusMessage }}</p>
          </form>
        </div>

        <section class="bg-white/95 border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
          <header class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Your list</p>
              <h2 class="text-xl font-bold">Saved dreams ({{ interests.length }})</h2>
            </div>
            <button class="text-xs text-slate-500 hover:text-slate-700" @click="fetchInterests" :disabled="loading">
              Refresh
            </button>
          </header>

          <div v-if="loading" class="text-sm text-slate-500">Loading your wishes…</div>
          <div v-else-if="!interests.length" class="text-sm text-slate-500">
            Nothing saved yet. Add your first dream above and we will start monitoring quietly in the background.
          </div>

          <ul v-else class="space-y-4">
            <li
              v-for="(interest, index) in interests"
              :key="interest.id"
              class="border border-slate-100 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50"
            >
              <div class="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{{ interest.title ?? 'Untitled dream' }}</p>
                  <p class="text-xs text-slate-500">
                    {{ formatPathway(interest.pathway_type) }} · {{ interest.field || 'Any field' }}
                  </p>
                </div>
                <span :class="statusBadgeClass(interest.status)">{{ formatStatus(interest.status) }}</span>
              </div>

              <div class="grid gap-3 text-xs text-slate-600 mt-3 sm:grid-cols-2">
                <p><strong class="text-slate-500">Location:</strong> {{ interest.preferred_location || 'Flexible' }}</p>
                <p>
                  <strong class="text-slate-500">Remote:</strong>
                  {{ interest.open_to_remote ? 'Yes, happy to explore remote' : 'Prefers on-site / local' }}
                </p>
                <p><strong class="text-slate-500">Timeline:</strong> {{ interest.timeline || 'Anytime' }}</p>
                <p>
                  <strong class="text-slate-500">Pay goal:</strong>
                  {{ formatPay(interest.min_pay_annual, interest.max_pay_annual) }}
                </p>
              </div>

              <div class="grid gap-3 text-[11px] text-slate-500 mt-2 sm:grid-cols-2">
                <p v-if="interest.target_roles?.length">
                  <strong class="text-slate-500">Roles:</strong>
                  {{ interest.target_roles.join(', ') }}
                </p>
                <p v-if="interest.target_sectors?.length">
                  <strong class="text-slate-500">Sectors:</strong>
                  {{ interest.target_sectors.join(', ') }}
                </p>
                <p v-if="interest.preferred_locations_multi?.length">
                  <strong class="text-slate-500">Locations list:</strong>
                  {{ interest.preferred_locations_multi.join(', ') }}
                </p>
                <p v-if="interest.preferred_study_modes?.length">
                  <strong class="text-slate-500">Modes:</strong>
                  {{ interest.preferred_study_modes.join(', ') }}
                </p>
              </div>

              <p v-if="interest.notes" class="mt-3 text-sm text-slate-600 whitespace-pre-line">{{ interest.notes }}</p>
              <p v-if="interest.support_needs" class="mt-2 text-xs text-slate-500 whitespace-pre-line">
                <strong class="text-slate-500">Support needs:</strong> {{ interest.support_needs }}
              </p>

              <div class="flex flex-wrap items-center gap-4 mt-4 text-[11px] text-slate-500">
                <span>
                  Notifications:
                  <strong>
                    {{ interest.notify_in_app ? 'In-app' : '—' }}
                    {{ interest.notify_email ? '· Email' : '' }}
                  </strong>
                </span>
                <span>
                  Matches triggered:
                  <strong>{{ interest.match_count ?? 0 }}</strong>
                </span>
                <span>
                  Last ping:
                  <strong>{{ formatTimestamp(interest.last_matched_at) }}</strong>
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-4 mt-4 text-xs font-semibold">
                <button class="text-rose-500 hover:text-rose-600" @click="editInterest(index)">
                  Edit
                </button>
                <button
                  class="text-slate-400 hover:text-rose-500"
                  @click="deleteInterest(interest, index)"
                  :disabled="deletingId === interest.id"
                >
                  {{ deletingId === interest.id ? 'Deleting…' : 'Remove' }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </section>

      <aside class="space-y-4">
        <div class="bg-white border border-pink-100 rounded-2xl p-5 shadow-sm space-y-3">
          <p class="text-xs uppercase tracking-[0.3em] text-pink-500">What happens next?</p>
          <ul class="space-y-2 text-sm text-slate-600">
            <li>• We store these quietly and never share them without your consent.</li>
            <li>• Partner companies and training providers will never see personal info.</li>
            <li>• As new roles or intakes match, you will see warm notifications first.</li>
          </ul>
        </div>

        <div class="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
          <p class="text-xs uppercase tracking-[0.3em] text-rose-200">Match readiness</p>
          <p class="text-lg font-semibold">{{ summaryHeadline }}</p>
          <p class="text-sm text-slate-200">
            {{ summaryBody }}
          </p>
          <button class="mt-2 inline-flex items-center text-sm font-semibold text-rose-200 hover:text-rose-100" @click="fetchInterests">
            Recalculate
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
});

const interests = ref([]);
const loading = ref(true);
const saving = ref(false);
const deletingId = ref(null);
const editingIndex = ref(null);
const statusMessage = ref('');
const errors = reactive({});

const pathwayOptions = [
  { value: 'job', label: 'Job / Career' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'traineeship', label: 'Traineeship' },
  { value: 'trade', label: 'Trade pathway' },
  { value: 'tafe_course', label: 'TAFE / VET Course' },
  { value: 'university_course', label: 'University Course' },
  { value: 'public_sector', label: 'Public Sector / Government' },
  { value: 'other', label: 'Other / Not sure yet' },
];

const statusOptions = [
  { value: 'active', label: 'Actively exploring' },
  { value: 'paused', label: 'Pausing for now' },
  { value: 'fulfilled', label: 'Already fulfilled' },
];

const studyModeOptions = [
  { value: 'on-campus', label: 'On-campus' },
  { value: 'online', label: 'Online / remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'evenings', label: 'Evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'intensive', label: 'Intensive blocks' },
];

const timestampFormatter = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const blankForm = () => ({
  pathway_type: 'job',
  title: '',
  target_roles_input: '',
  target_sectors_input: '',
  field: '',
  industry: '',
  level: '',
  preferred_location: '',
  preferred_locations_input: '',
  preferred_study_modes: [],
  open_to_remote: false,
  min_pay_annual: '',
  max_pay_annual: '',
  timeline: '',
  intake_window: '',
  skills: '',
  notes: '',
  support_needs: '',
  status: 'active',
  notify_in_app: true,
  notify_email: false,
});

const form = reactive(blankForm());

const displayName = computed(() => props.user?.preferred_name ?? props.user?.name ?? 'friend');

const summaryHeadline = computed(() => {
  if (!interests.value.length) {
    return 'Add a dream to begin';
  }

  const active = interests.value.filter((interest) => interest.status === 'active').length;
  if (active === 0) {
    return 'All dreams are paused';
  }

  if (active === 1) {
    return '1 dream is waitlist-ready';
  }

  return `${active} dreams are waitlist-ready`;
});

const summaryBody = computed(() => {
  if (!interests.value.length) {
    return 'Your dashboard cards will light up once you save your first pathway intention.';
  }

  return 'Keep your list updated so Athena notifications stay gentle, relevant, and empowering.';
});

onMounted(() => {
  fetchInterests();
});

const fetchInterests = async () => {
  loading.value = true;
  statusMessage.value = '';

  try {
    const { data } = await window.axios.get('/api/v1/careers/interests');
    interests.value = data.interests ?? [];
  } catch (error) {
    console.error('Failed to load career interests', error);
  } finally {
    loading.value = false;
  }
};

const saveInterest = async () => {
  saving.value = true;
  statusMessage.value = '';
  clearErrors();

  const payload = mapPayload(form);

  try {
    if (editingIndex.value === null) {
      const { data } = await window.axios.post('/api/v1/careers/interests', payload);
      interests.value.unshift(data.interest);
      statusMessage.value = 'Dream saved. We will keep searching quietly.';
    } else {
      const target = interests.value[editingIndex.value];
      const { data } = await window.axios.put(`/api/v1/careers/interests/${target.id}`, payload);
      interests.value.splice(editingIndex.value, 1, data.interest);
      statusMessage.value = 'Dream updated.';
    }

    resetForm();
  } catch (error) {
    handleError(error);
  } finally {
    saving.value = false;
  }
};

const editInterest = (index) => {
  editingIndex.value = index;
  const interest = interests.value[index];

  Object.assign(form, {
    pathway_type: interest.pathway_type,
    title: interest.title,
    target_roles_input: arrayToCsv(interest.target_roles),
    target_sectors_input: arrayToCsv(interest.target_sectors),
    field: interest.field,
    industry: interest.industry,
    level: interest.level,
    preferred_location: interest.preferred_location,
    preferred_locations_input: arrayToCsv(interest.preferred_locations_multi),
    preferred_study_modes: interest.preferred_study_modes ?? [],
    open_to_remote: Boolean(interest.open_to_remote),
    min_pay_annual: interest.min_pay_annual ?? '',
    max_pay_annual: interest.max_pay_annual ?? '',
    timeline: interest.timeline,
    intake_window: interest.intake_window,
    skills: interest.skills,
    notes: interest.notes,
    support_needs: interest.support_needs,
    status: interest.status,
    notify_in_app: Boolean(interest.notify_in_app),
    notify_email: Boolean(interest.notify_email),
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const deleteInterest = async (interest, index) => {
  if (!window.confirm('Remove this dream from your wishlist?')) {
    return;
  }

  deletingId.value = interest.id;
  statusMessage.value = '';

  try {
    await window.axios.delete(`/api/v1/careers/interests/${interest.id}`);
    interests.value.splice(index, 1);
    if (editingIndex.value === index) {
      resetForm();
    }
    statusMessage.value = 'Dream removed.';
  } catch (error) {
    handleError(error);
  } finally {
    deletingId.value = null;
  }
};

const resetForm = () => {
  Object.assign(form, blankForm());
  editingIndex.value = null;
  clearErrors();
};

const clearErrors = () => {
  Object.keys(errors).forEach((key) => delete errors[key]);
};

const handleError = (error) => {
  if (error?.response?.status === 422) {
    Object.assign(errors, error.response.data.errors ?? {});
  } else {
    console.error('Dream wishlist error', error);
    statusMessage.value = 'Something went wrong. Please try again shortly.';
  }
};

const mapPayload = (source) => {
  const targetRoles = csvToArray(source.target_roles_input, 8);
  const targetSectors = csvToArray(source.target_sectors_input, 8);
  const preferredLocations = csvToArray(source.preferred_locations_input, 8);
  const studyModes = Array.isArray(source.preferred_study_modes)
    ? source.preferred_study_modes.map((mode) => mode?.trim()).filter(Boolean)
    : [];

  return {
    pathway_type: source.pathway_type,
    title: nullable(source.title),
    target_roles: targetRoles.length ? targetRoles : null,
    target_sectors: targetSectors.length ? targetSectors : null,
    field: nullable(source.field),
    industry: nullable(source.industry),
    level: nullable(source.level),
    preferred_location: nullable(source.preferred_location),
    preferred_locations_multi: preferredLocations.length ? preferredLocations : null,
    preferred_study_modes: studyModes.length ? studyModes : null,
    open_to_remote: Boolean(source.open_to_remote),
    min_pay_annual: numericOrNull(source.min_pay_annual),
    max_pay_annual: numericOrNull(source.max_pay_annual),
    timeline: nullable(source.timeline),
    intake_window: nullable(source.intake_window),
    skills: nullable(source.skills),
    notes: nullable(source.notes),
    support_needs: nullable(source.support_needs),
    status: source.status,
    notify_in_app: Boolean(source.notify_in_app),
    notify_email: Boolean(source.notify_email),
  };
};

const nullable = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

const numericOrNull = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const formatStatus = (status) => {
  const found = statusOptions.find((option) => option.value === status);
  return found ? found.label : status;
};

const statusBadgeClass = (status) => {
  if (status === 'active') {
    return 'text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600';
  }

  if (status === 'paused') {
    return 'text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-600';
  }

  return 'text-[11px] font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500';
};

const formatPathway = (pathway) => {
  const found = pathwayOptions.find((option) => option.value === pathway);
  return found ? found.label : pathway;
};

const formatPay = (min, max) => {
  if (!min && !max) {
    return 'Flexible';
  }

  if (min && max) {
    return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`;
  }

  if (min) {
    return `From $${Number(min).toLocaleString()}`;
  }

  return `Up to $${Number(max).toLocaleString()}`;
};

const formatTimestamp = (value) => {
  if (!value) {
    return 'Not yet';
  }

  try {
    return timestampFormatter.format(new Date(value));
  } catch (error) {
    console.warn('Unable to format timestamp', error);
    return 'Recently';
  }
};

const csvToArray = (value, limit = 8) => {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, limit);
};

const arrayToCsv = (values) => {
  if (!Array.isArray(values) || !values.length) {
    return '';
  }

  return values.join(', ');
};
</script>

<style scoped>
.form-input,
.form-textarea {
  @apply w-full rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner shadow-violet-50 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200;
}
</style>
