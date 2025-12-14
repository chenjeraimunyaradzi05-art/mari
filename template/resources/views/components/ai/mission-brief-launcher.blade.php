@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const conciergeUrl = @json($aiConciergeUrl);

        if (!csrf || !conciergeUrl) {
            return;
        }

        document.querySelectorAll('[data-ai-context-endpoint]').forEach((button) => {
            const originalLabel = button.innerHTML;

            button.addEventListener('click', async () => {
                const endpoint = button.dataset.aiContextEndpoint;
                if (!endpoint) {
                    return;
                }

                button.disabled = true;
                button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Preparing';

                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'X-CSRF-TOKEN': csrf,
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json',
                        },
                        credentials: 'same-origin',
                    });

                    if (!response.ok) {
                        throw new Error('Unable to prepare an AI context right now.');
                    }

                    const payload = await response.json();
                    const url = new URL(conciergeUrl, window.location.origin);
                    url.searchParams.set('context', 'public-sector-mission');

                    if (payload.context_payload) {
                        url.searchParams.set('context_payload', payload.context_payload);
                    }

                    if (payload.prompt) {
                        url.searchParams.set('prompt', payload.prompt);
                    }

                    window.location.href = url.toString();
                } catch (error) {
                    window.dispatchEvent(new CustomEvent('ai-launch-error', {
                        detail: error.message,
                    }));
                    alert(error.message || 'Unable to launch Athena with this brief.');
                } finally {
                    button.disabled = false;
                    button.innerHTML = originalLabel;
                }
            });
        });
    });
</script>
@endpush
