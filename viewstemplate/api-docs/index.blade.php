<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>API Documentation</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    
</head>
<body>
<div id="swagger-ui"></div>
@if ($specMissing)
    <div style="max-width: 960px; margin: 2rem auto; padding: 1.5rem; background-color: #fef3c7; color: #78350f; border: 1px solid #fcd34d; border-radius: 0.75rem;">
    <strong>Spec file missing.</strong> Publish <code>resources/api-docs/api-docs.json</code> with <code>php scripts/publish-openapi.php</code> (or <code>composer run openapi:publish</code>) and ensure the storage symlink exists (<code>php artisan storage:link</code>).
    </div>
@endif
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.min.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const specUrl = @json($specUrl);
        if (!specUrl) {
            return;
        }

        SwaggerUIBundle({
            url: specUrl,
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout"
        });
    });
</script>
</body>
</html>

