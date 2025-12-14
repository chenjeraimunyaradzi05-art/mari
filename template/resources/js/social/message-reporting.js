(function () {
    class MessageReportController {
        constructor() {
            this.context = {
                source: 'frontend.action_sheet',
                conversationId: null,
                subjectUserId: null,
                metadata: {},
            };
            this.pendingMetadata = {};
            this.initialized = false;
            this.previewCopy = '';
            this.quickActionFields = {};
            this.quickActionDefaults = {
                mute: true,
                block: false,
                collect_evidence: false,
            };
            this.maxEvidenceEntries = 3;
            this.evidenceListEl = null;
            this.evidenceTemplate = null;
            this.addEvidenceButton = null;
            this.evidenceSection = null;

            this.handleActionClick = this.handleActionClick.bind(this);
            this.handleFormSubmit = this.handleFormSubmit.bind(this);
            this.handleEvidenceListClick = this.handleEvidenceListClick.bind(this);
        }

        init() {
            if (this.initialized) {
                this.refreshDomReferences();
                return;
            }

            this.initialized = true;
            this.refreshDomReferences();
            document.addEventListener('click', this.handleActionClick);
        }

        refreshDomReferences() {
            this.modalEl = document.getElementById('reportMessageModal');
            this.formEl = document.getElementById('reportMessageForm');
            this.previewEl = document.querySelector('[data-report-preview]');
            this.feedbackEl = document.querySelector('[data-report-feedback]');
            this.hiddenMessageInput = this.formEl ? this.formEl.querySelector('input[name="message_id"]') : null;
            this.notesField = this.formEl ? this.formEl.querySelector('textarea[name="notes"]') : null;
            this.reasonField = this.formEl ? this.formEl.querySelector('select[name="reason"]') : null;
            this.submitButton = this.formEl ? this.formEl.querySelector('[data-report-submit]') : null;
            this.quickActionFields = {
                mute: this.formEl ? this.formEl.querySelector('[data-quick-action="mute"]') : null,
                block: this.formEl ? this.formEl.querySelector('[data-quick-action="block"]') : null,
                collect_evidence: this.formEl ? this.formEl.querySelector('[data-quick-action="collect_evidence"]') : null,
            };
            this.evidenceListEl = this.formEl ? this.formEl.querySelector('[data-evidence-list]') : null;
            this.addEvidenceButton = this.formEl ? this.formEl.querySelector('[data-evidence-add]') : null;
            this.evidenceTemplate = document.getElementById('report-evidence-template');
            this.evidenceSection = this.formEl ? this.formEl.querySelector('[data-evidence-section]') : null;

            if (this.formEl && !this.formEl.dataset.reportBound) {
                this.formEl.addEventListener('submit', this.handleFormSubmit);
                this.formEl.dataset.reportBound = 'true';
            }

            if (this.addEvidenceButton && !this.addEvidenceButton.dataset.bound) {
                this.addEvidenceButton.addEventListener('click', () => this.addEvidenceEntry());
                this.addEvidenceButton.dataset.bound = 'true';
            }

            if (this.evidenceListEl && !this.evidenceListEl.dataset.bound) {
                this.evidenceListEl.addEventListener('click', this.handleEvidenceListClick);
                this.evidenceListEl.dataset.bound = 'true';
            }

            Object.values(this.quickActionFields).forEach((field) => {
                if (field && !field.dataset.quickActionBound) {
                    field.addEventListener('change', () => this.syncQuickActionState());
                    field.dataset.quickActionBound = 'true';
                }
            });

            this.toggleEvidenceSectionVisibility();
        }

        handleActionClick(event) {
            const button = event.target.closest('.message-action');

            if (!button) {
                return;
            }

            event.preventDefault();
            const previewAttr = button.dataset.messagePreview || '';
            const metadataAttr = button.dataset.reportMetadata || '';
            const subjectUserId = button.dataset.subjectUserId;
            let metadataPayload = {};

            if (metadataAttr) {
                try {
                    metadataPayload = JSON.parse(decodeURIComponent(metadataAttr));
                } catch (_error) {
                    metadataPayload = {};
                }
            }

            if (subjectUserId) {
                this.setContext({ subjectUserId: Number(subjectUserId) || subjectUserId });
            }

            this.open(
                button.dataset.messageId || '',
                decodeURIComponent(previewAttr || ''),
                metadataPayload
            );
        }

        open(messageId, preview = '', metadata = {}) {
            this.init();
            this.refreshDomReferences();

            if (!this.formEl) {
                return;
            }

            this.pendingMetadata = metadata || {};
            this.resetQuickActions();
            this.resetEvidence();

            if (this.hiddenMessageInput) {
                this.hiddenMessageInput.value = messageId || '';
            }

            if (this.reasonField) {
                this.reasonField.value = this.reasonField.options?.[0]?.value || 'harassment';
            }

            if (this.notesField) {
                this.notesField.value = '';
            }

            if (this.previewEl) {
                const printable = preview?.trim() || 'Message preview unavailable, but the report will include the full content.';
                this.previewEl.textContent = printable;
                this.previewCopy = printable;
            }

            this.setFeedback('');
            this.enqueueMetadata(metadata);
            this.toggleEvidenceSectionVisibility();

            const bootstrapLib = this.getBootstrap();

            if (this.modalEl && bootstrapLib && bootstrapLib.Modal) {
                const modalInstance = bootstrapLib.Modal.getOrCreateInstance(this.modalEl);
                modalInstance.show();
            }
        }

        async handleFormSubmit(event) {
            event.preventDefault();

            if (!this.formEl) {
                return;
            }

            const messageId = this.hiddenMessageInput?.value?.trim();
            const reason = this.reasonField?.value;
            const notes = this.notesField?.value?.trim();

            if (!messageId) {
                this.setFeedback('Select a message before filing a report.', 'error');
                return;
            }

            this.submitButton?.setAttribute('disabled', 'disabled');
            this.setFeedback('');

            const metadata = this.composeMetadata({
                message_id: messageId ? Number(messageId) : null,
                reason,
                message_preview: this.previewCopy || null,
            });
            const actions = this.collectActions();
            const evidence = actions.collect_evidence ? this.collectEvidence() : [];
            const payload = {
                subject_user_id: this.resolveSubjectUserId(),
                category: reason,
                severity: this.mapSeverity(reason),
                description: this.composeDescription(reason, notes),
                metadata,
                actions,
            };

            if (evidence.length) {
                payload.evidence = evidence;
            }

            try {
                const response = await fetch('/api/v1/social/incidents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': this.getCsrfToken(),
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    const message = body?.message
                        || body?.errors?.reason?.[0]
                        || 'Unable to submit your report right now. Please try again soon.';

                    throw new Error(message);
                }

                this.setFeedback('Report submitted successfully. Our safety team has been notified.', 'success');
                this.dispatchReportEvent(await response.json().catch(() => null));

                const bootstrapLib = this.getBootstrap();
                if (this.modalEl && bootstrapLib && bootstrapLib.Modal) {
                    setTimeout(() => {
                        bootstrapLib.Modal.getOrCreateInstance(this.modalEl).hide();
                    }, 900);
                }
            } catch (error) {
                this.setFeedback(error.message || 'Unable to submit your report right now.', 'error');
            } finally {
                this.submitButton?.removeAttribute('disabled');
            }
        }

        dispatchReportEvent(payload) {
            try {
                window.dispatchEvent(new CustomEvent('messaging:report-filed', { detail: payload }));
            } catch (_error) {
                // Swallow dispatch issues silently
            }
        }

        collectActions() {
            const actions = {};

            Object.entries(this.quickActionFields || {}).forEach(([key, field]) => {
                if (field) {
                    actions[key] = !!field.checked;
                }
            });

            return actions;
        }

        collectEvidence() {
            if (!this.evidenceListEl) {
                return [];
            }

            return Array.from(this.evidenceListEl.querySelectorAll('[data-evidence-entry]'))
                .map((entry) => {
                    const type = entry.querySelector('[data-evidence-field="type"]')?.value?.trim() || 'snippet';
                    const label = entry.querySelector('[data-evidence-field="label"]')?.value?.trim() || null;
                    const reference = entry.querySelector('[data-evidence-field="reference"]')?.value?.trim() || '';
                    const payloadRaw = entry.querySelector('[data-evidence-field="payload"]')?.value?.trim() || '';

                    if (!reference && !payloadRaw) {
                        return null;
                    }

                    return {
                        type,
                        label,
                        reference: reference || null,
                        payload: payloadRaw ? { text: payloadRaw } : null,
                    };
                })
                .filter(Boolean);
        }

        addEvidenceEntry() {
            if (!this.evidenceTemplate || !this.evidenceListEl) {
                return;
            }

            if (this.evidenceEntryCount() >= this.maxEvidenceEntries) {
                this.setFeedback(`You can attach up to ${this.maxEvidenceEntries} evidence items.`, 'error');
                return;
            }

            const fragment = this.evidenceTemplate.content.cloneNode(true);
            this.evidenceListEl.appendChild(fragment);

            if (this.quickActionFields?.collect_evidence && !this.quickActionFields.collect_evidence.checked) {
                this.quickActionFields.collect_evidence.checked = true;
            }

            this.toggleEvidenceSectionVisibility();
        }

        handleEvidenceListClick(event) {
            const removeButton = event.target.closest('[data-evidence-remove]');

            if (!removeButton) {
                return;
            }

            event.preventDefault();
            const entry = removeButton.closest('[data-evidence-entry]');

            if (entry) {
                entry.remove();
                this.toggleEvidenceSectionVisibility();
            }
        }

        evidenceEntryCount() {
            if (!this.evidenceListEl) {
                return 0;
            }

            return this.evidenceListEl.querySelectorAll('[data-evidence-entry]').length;
        }

        evidenceListHasEntries() {
            return this.evidenceEntryCount() > 0;
        }

        resetQuickActions() {
            Object.entries(this.quickActionFields || {}).forEach(([key, field]) => {
                if (!field) {
                    return;
                }

                const defaultValue = Object.prototype.hasOwnProperty.call(this.quickActionDefaults, key)
                    ? this.quickActionDefaults[key]
                    : false;

                field.checked = !!defaultValue;
            });

            this.syncQuickActionState();
        }

        resetEvidence() {
            if (this.evidenceListEl) {
                this.evidenceListEl.innerHTML = '';
            }

            this.toggleEvidenceSectionVisibility();
        }

        syncQuickActionState() {
            this.toggleEvidenceSectionVisibility();
        }

        toggleEvidenceSectionVisibility() {
            if (!this.evidenceSection) {
                return;
            }

            const shouldShow = this.evidenceListHasEntries()
                || !!this.quickActionFields?.collect_evidence?.checked;

            this.evidenceSection.classList.toggle('d-none', !shouldShow);
        }

        mapSeverity(reason) {
            switch (reason) {
                case 'threat':
                case 'scam':
                    return 'high';
                case 'harassment':
                case 'discrimination':
                    return 'medium';
                case 'spam':
                    return 'low';
                default:
                    return 'medium';
            }
        }

        composeDescription(reason, notes) {
            const trimmed = (notes || '').trim();

            if (trimmed) {
                return trimmed;
            }

            const preview = this.previewCopy ? ` Preview: "${this.previewCopy}".` : '';
            return `Reporter flagged this message for ${reason}.${preview}`.trim();
        }

        resolveSubjectUserId() {
            const candidates = [
                this.context?.subjectUserId,
                this.context?.metadata?.subject_user_id,
                this.pendingMetadata?.subject_user_id,
            ];

            for (const value of candidates) {
                if (typeof value === 'undefined' || value === null || value === '') {
                    continue;
                }

                const numeric = Number(value);
                if (!Number.isNaN(numeric) && numeric > 0) {
                    return numeric;
                }
            }

            return null;
        }

        composeMetadata(extra = {}) {
            const baseMetadata = {
                source: this.context?.source || 'frontend.action_sheet',
                conversation_id: this.context?.conversationId || null,
                submitted_at: new Date().toISOString(),
            };

            const contextMetadata = typeof this.context?.metadata === 'object' ? this.context.metadata : {};
            return Object.assign({}, baseMetadata, contextMetadata, this.pendingMetadata || {}, extra || {});
        }

        enqueueMetadata(metadata = {}) {
            this.pendingMetadata = metadata || {};
        }

        setContext(context = {}) {
            this.context = {
                ...this.context,
                ...context,
                metadata: {
                    ...(this.context?.metadata || {}),
                    ...(context?.metadata || {}),
                },
            };
        }

        setFeedback(message, status = '') {
            if (!this.feedbackEl) {
                return;
            }

            if (!message) {
                this.feedbackEl.classList.add('d-none');
                this.feedbackEl.classList.remove('alert-success', 'alert-danger');
                this.feedbackEl.textContent = '';
                return;
            }

            this.feedbackEl.classList.remove('d-none');
            this.feedbackEl.classList.remove('alert-success', 'alert-danger');
            this.feedbackEl.textContent = message;
            this.feedbackEl.classList.toggle('alert-success', status === 'success');
            this.feedbackEl.classList.toggle('alert-danger', status === 'error');
        }

        getCsrfToken() {
            const token = document.querySelector('meta[name="csrf-token"]');
            return token ? token.content : '';
        }

        getBootstrap() {
            return window.bootstrap || window.Bootstrap || null;
        }
    }

    const controller = new MessageReportController();
    window.MessageReportActions = controller;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => controller.init());
    } else {
        controller.init();
    }
})();
