<?php

namespace App\Services;

use Exception;
use Throwable;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;

class AIErrorHandler
{
    /**
     * Handle an AI-related error.
     *
     * @param Throwable $e The exception thrown.
     * @param string $context A short description of what was happening (e.g., "generating-bio").
     * @return array An array containing a user-friendly message and code.
     */
    public function handle(Throwable $e, string $context = 'ai-operation'): array
    {
        $errorId = uniqid('ai_err_', true);

        // Log the full error details for debugging
        Log::error("AI Error [{$context}] ({$errorId}): " . $e->getMessage(), [
            'exception' => $e,
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'context' => $context,
        ]);

        // Return a safe, formatted response for the frontend/user
        return [
            'success' => false,
            'error_id' => $errorId,
            'message' => $this->getUserFriendlyMessage($e),
            'retryable' => $this->isRetryable($e),
            'code' => $e->getCode() ?: 500,
        ];
    }

    /**
     * Determine if the error is transient and the operation should be retried.
     * Useful for Rate Limits (429) or Timeouts.
     */
    public function isRetryable(Throwable $e): bool
    {
        if ($e instanceof ConnectionException) {
            return true; // Timeouts, DNS issues
        }

        if ($e instanceof RequestException) {
            // Retry on Too Many Requests (429) or Server Errors (5xx)
            return in_array($e->response->status(), [429, 500, 502, 503, 504]);
        }

        // Check message strings for common API timeout keywords
        $message = strtolower($e->getMessage());
        return str_contains($message, 'timeout')
            || str_contains($message, 'rate limit')
            || str_contains($message, 'unavailable');
    }

    /**
     * Get a user-friendly error message based on the exception type.
     */
    private function getUserFriendlyMessage(Throwable $e): string
    {
        if ($this->isRetryable($e)) {
            return 'The AI service is currently busy or unavailable. Please try again in a moment.';
        }

        // Handle specific OpenAI / API key errors if known
        if (str_contains(strtolower($e->getMessage()), 'api key')) {
            return 'Configuration error: AI service credentials are invalid.';
        }

        // Default generic message
        return 'An error occurred while processing your request. Please contact support if this persists.';
    }
}
