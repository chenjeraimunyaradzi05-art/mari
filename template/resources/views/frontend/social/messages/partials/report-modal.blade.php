<div class="modal fade" id="reportMessageModal" tabindex="-1" aria-labelledby="reportMessageModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header bg-danger text-white">
                <h5 class="modal-title" id="reportMessageModalLabel"><i class="fas fa-flag mr-2"></i>Report Message</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="reportMessageForm">
                <div class="modal-body space-y-3">
                    <input type="hidden" name="message_id" id="report-message-id">

                    <div class="mb-3">
                        <label class="form-label" for="report-reason">Reason</label>
                        <select class="form-control" id="report-reason" name="reason" required>
                            <option value="harassment">Harassment</option>
                            <option value="discrimination">Discrimination</option>
                            <option value="spam">Spam</option>
                            <option value="scam">Scam</option>
                            <option value="threat">Threat</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="report-notes">Additional context <span class="text-muted">(optional)</span></label>
                        <textarea class="form-control" id="report-notes" name="notes" rows="3" placeholder="Describe what happened"></textarea>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Message preview</label>
                        <div class="p-3 bg-gray-100 rounded text-sm" data-report-preview>
                            Select a message to preview its contents before reporting.
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Safety quick actions</label>
                        <p class="text-muted small mb-2">We can instantly apply these protections while we review your report.</p>
                        <div class="form-check form-switch mb-2">
                            <input class="form-check-input" type="checkbox" role="switch" id="report-action-mute" data-quick-action="mute" checked>
                            <label class="form-check-label" for="report-action-mute">Mute this conversation</label>
                        </div>
                        <div class="form-check form-switch mb-2">
                            <input class="form-check-input" type="checkbox" role="switch" id="report-action-block" data-quick-action="block">
                            <label class="form-check-label" for="report-action-block">Block this person</label>
                        </div>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="report-action-evidence" data-quick-action="collect_evidence">
                            <label class="form-check-label" for="report-action-evidence">Collect supporting evidence</label>
                        </div>
                    </div>

                    <div class="mb-3" data-evidence-section>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label mb-0">Evidence attachments</label>
                            <button type="button" class="btn btn-sm btn-outline-secondary" data-evidence-add>
                                <i class="fas fa-paperclip me-1"></i>Add evidence
                            </button>
                        </div>
                        <p class="text-muted small mb-2">Attach up to three supporting snippets or URLs. Sensitive data stays private to the safety team.</p>
                        <div data-evidence-list class="space-y-2"></div>
                        <template id="report-evidence-template">
                            <div class="border rounded p-3 position-relative" data-evidence-entry>
                                <div class="mb-2">
                                    <label class="form-label small mb-1">Type</label>
                                    <select class="form-select form-select-sm" data-evidence-field="type">
                                        <option value="snippet">Snippet</option>
                                        <option value="link">Link</option>
                                        <option value="screenshot">Screenshot</option>
                                    </select>
                                </div>
                                <div class="mb-2">
                                    <label class="form-label small mb-1">Label</label>
                                    <input type="text" class="form-control form-control-sm" placeholder="What does this show?" data-evidence-field="label">
                                </div>
                                <div class="mb-2">
                                    <label class="form-label small mb-1">Reference / URL</label>
                                    <input type="text" class="form-control form-control-sm" placeholder="https://" data-evidence-field="reference">
                                </div>
                                <div class="mb-2">
                                    <label class="form-label small mb-1">Snippet</label>
                                    <textarea class="form-control form-control-sm" rows="2" placeholder="Paste the relevant excerpt" data-evidence-field="payload"></textarea>
                                </div>
                                <button type="button" class="btn btn-link text-danger p-0 small" data-evidence-remove>
                                    Remove
                                </button>
                            </div>
                        </template>
                    </div>

                    <div class="alert alert-success d-none" data-report-feedback></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-danger" data-report-submit>
                        <i class="fas fa-paper-plane mr-2"></i>Submit Report
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
