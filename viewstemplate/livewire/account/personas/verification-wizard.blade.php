<div class="space-y-6" wire:key="persona-verification-wizard">
    @if ($submissionComplete && $statusMessage)
        <div class="alert alert-success d-flex align-items-start gap-3" role="alert">
            <span class="badge bg-success rounded-circle mt-1">✓</span>
            <div>
                <strong>Submission received</strong>
                <p class="mb-0">{{ $statusMessage }}</p>
            </div>
        </div>
    @endif

    <div class="card shadow-sm">
        <div class="card-header bg-white">
            <nav class="nav nav-pills flex-wrap gap-2">
                @foreach ($steps as $index => $stepKey)
                    @php
                        $isActive = $step === $stepKey;
                        $label = $stepLabels[$stepKey] ?? ucfirst($stepKey);
                    @endphp
                    <button type="button"
                        class="btn btn-sm {{ $isActive ? 'btn-primary' : 'btn-outline-secondary' }}"
                        wire:click="goToStep('{{ $stepKey }}')">
                        <span class="badge rounded-pill bg-light text-dark me-2">{{ $index + 1 }}</span>
                        {{ $label }}
                    </button>
                @endforeach
            </nav>
        </div>
        <div class="card-body">
            <form wire:submit.prevent="submit" class="vstack gap-4">
                @if ($step === 'identity')
                    <section class="vstack gap-3">
                        <h5>Tell us about this persona</h5>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label">Full name<span class="text-danger">*</span></label>
                                <input type="text" class="form-control" wire:model.defer="form.identity.full_name">
                                @error('form.identity.full_name')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Preferred name</label>
                                <input type="text" class="form-control" wire:model.defer="form.identity.preferred_name">
                                @error('form.identity.preferred_name')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Contact email<span class="text-danger">*</span></label>
                                <input type="email" class="form-control" wire:model.defer="form.identity.contact_email">
                                @error('form.identity.contact_email')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Contact phone</label>
                                <input type="text" class="form-control" wire:model.defer="form.identity.contact_phone" placeholder="+61 400 000 000">
                                @error('form.identity.contact_phone')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                        </div>
                    </section>
                @endif

                @if ($step === 'credentials')
                    <section class="vstack gap-3">
                        <h5>Credential details</h5>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label">Verification method<span class="text-danger">*</span></label>
                                <select class="form-select" wire:model.defer="form.credentials.request_type">
                                    <option value="document_upload">Supporting documents</option>
                                    <option value="government_id">Government ID</option>
                                    <option value="organization_email">Organization email domain</option>
                                </select>
                                @error('form.credentials.request_type')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">License number</label>
                                <input type="text" class="form-control" wire:model.defer="form.credentials.license_number">
                                @error('form.credentials.license_number')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Issuing authority</label>
                                <input type="text" class="form-control" wire:model.defer="form.credentials.license_authority">
                                @error('form.credentials.license_authority')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">License expiry</label>
                                <input type="date" class="form-control" wire:model.defer="form.credentials.license_expires_at">
                                @error('form.credentials.license_expires_at')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                            </div>
                        </div>
                    </section>
                @endif

                @if ($step === 'evidence')
                    <section class="vstack gap-3">
                        <h5>Evidence & reviewer context</h5>
                        <div>
                            <label class="form-label">Notes for reviewers</label>
                            <textarea class="form-control" rows="4" wire:model.defer="form.evidence.notes" placeholder="Explain why this persona should be verified"></textarea>
                            @error('form.evidence.notes')
                                <small class="text-danger">{{ $message }}</small>
                            @enderror
                        </div>
                        <div>
                            <label class="form-label d-flex justify-content-between align-items-center">
                                Evidence links
                                <button type="button" class="btn btn-sm btn-outline-primary" wire:click="addEvidenceRow">Add link</button>
                            </label>
                            <div class="vstack gap-2">
                                @foreach ($evidenceLinks as $index => $link)
                                    <div class="input-group">
                                        <input type="url" class="form-control" placeholder="https://example.com"
                                            wire:model.defer="form.evidence.links.{{ $index }}">
                                        @if ($index > 2)
                                            <button class="btn btn-outline-danger" type="button"
                                                wire:click="removeEvidenceRow({{ $index }})">Remove</button>
                                        @endif
                                    </div>
                                @endforeach
                            </div>
                            @error('form.evidence.links.*')
                                <small class="text-danger">{{ $message }}</small>
                            @enderror
                        </div>
                    </section>
                @endif

                @if ($step === 'documents')
                    <section class="vstack gap-4">
                        <h5>Upload documents</h5>
                        <div class="row g-4">
                            <div class="col-md-6">
                                <label class="form-label">Government-issued ID<span class="text-danger">*</span></label>
                                <input type="file" class="form-control" wire:model="uploads.government_id" accept="image/*,.pdf">
                                @error('documents.government_id')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                                @if ($documentSummary['government_id'])
                                    <div class="alert alert-secondary mt-2 py-2 px-3 d-flex justify-content-between align-items-center">
                                        <span>{{ $documentSummary['government_id']['metadata']['original_name'] ?? basename($documentSummary['government_id']['path']) }}</span>
                                        <button type="button" class="btn btn-sm btn-link text-danger p-0" wire:click="removeDocument('government_id')">Remove</button>
                                    </div>
                                @endif
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Proof of credential or address<span class="text-danger">*</span></label>
                                <input type="file" class="form-control" wire:model="uploads.proof_of_address" accept="image/*,.pdf">
                                @error('documents.proof_of_address')
                                    <small class="text-danger">{{ $message }}</small>
                                @enderror
                                @if ($documentSummary['proof_of_address'])
                                    <div class="alert alert-secondary mt-2 py-2 px-3 d-flex justify-content-between align-items-center">
                                        <span>{{ $documentSummary['proof_of_address']['metadata']['original_name'] ?? basename($documentSummary['proof_of_address']['path']) }}</span>
                                        <button type="button" class="btn btn-sm btn-link text-danger p-0" wire:click="removeDocument('proof_of_address')">Remove</button>
                                    </div>
                                @endif
                            </div>
                        </div>
                        <div>
                            <label class="form-label">Additional supporting files</label>
                            <input type="file" class="form-control" multiple wire:model="uploads.supporting" accept="image/*,.pdf">
                            <div class="row g-2 mt-2">
                                @foreach ($documentSummary['supporting'] as $index => $doc)
                                    <div class="col-md-4">
                                        <div class="border rounded p-2 d-flex justify-content-between align-items-center">
                                            <span class="text-truncate">{{ $doc['metadata']['original_name'] ?? basename($doc['path']) }}</span>
                                            <button type="button" class="btn btn-link text-danger p-0" wire:click="removeDocument('supporting', {{ $index }})">×</button>
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    </section>
                @endif

                @if ($step === 'review')
                    <section class="vstack gap-4">
                        <h5>Review & submit</h5>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="border rounded p-3">
                                    <h6 class="text-muted">Identity</h6>
                                    <dl class="mb-0">
                                        <dt>Name</dt>
                                        <dd>{{ $form['identity']['full_name'] }}</dd>
                                        <dt>Email</dt>
                                        <dd>{{ $form['identity']['contact_email'] }}</dd>
                                        <dt>Phone</dt>
                                        <dd>{{ $form['identity']['contact_phone'] ?: '—' }}</dd>
                                    </dl>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="border rounded p-3">
                                    <h6 class="text-muted">Credentials</h6>
                                    <dl class="mb-0">
                                        <dt>Method</dt>
                                        <dd>{{ \Illuminate\Support\Str::title(str_replace('_', ' ', $form['credentials']['request_type'])) }}</dd>
                                        <dt>License #</dt>
                                        <dd>{{ $form['credentials']['license_number'] ?: '—' }}</dd>
                                        <dt>Authority</dt>
                                        <dd>{{ $form['credentials']['license_authority'] ?: '—' }}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="consent-terms"
                                wire:model="form.consent.terms_confirmed">
                            <label class="form-check-label" for="consent-terms">
                                I confirm these details are accurate and authorize the verification team to review and store the attached documents.
                            </label>
                            @error('form.consent.terms_confirmed')
                                <small class="text-danger">{{ $message }}</small>
                            @enderror
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="consent-ai" wire:model="form.consent.ai_updates">
                            <label class="form-check-label" for="consent-ai">
                                Send me AI-powered nudges about renewal windows and best practices.
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="consent-share" wire:model="form.consent.share_with_partners">
                            <label class="form-check-label" for="consent-share">
                                Share my verified status with trusted women-focused partners.
                            </label>
                        </div>
                        @error('form.review.submit')
                            <small class="text-danger">{{ $message }}</small>
                        @enderror
                    </section>
                @endif

                <div class="d-flex justify-content-between border-top pt-3 mt-2">
                    <div class="d-flex gap-2">
                        @if ($step !== 'identity')
                            <button type="button" class="btn btn-outline-secondary" wire:click="previous" wire:loading.attr="disabled">Back</button>
                        @endif
                        <button type="button" class="btn btn-link" wire:click="saveDraft" wire:loading.attr="disabled">Save draft</button>
                    </div>
                    <div>
                        @if ($step !== 'review')
                            <button type="button" class="btn btn-primary" wire:click="next" wire:loading.attr="disabled">
                                Continue
                            </button>
                        @else
                            <button type="submit" class="btn btn-success" wire:loading.attr="disabled">
                                Submit for review
                            </button>
                        @endif
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div wire:loading.flex wire:target="submit,next,previous,goToStep,saveDraft,uploads.government_id,uploads.proof_of_address,uploads.supporting"
        class="position-fixed top-0 start-0 end-0 bottom-0 bg-white bg-opacity-75 d-flex align-items-center justify-content-center">
        <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <p class="mb-0">Saving your progress…</p>
        </div>
    </div>
</div>
