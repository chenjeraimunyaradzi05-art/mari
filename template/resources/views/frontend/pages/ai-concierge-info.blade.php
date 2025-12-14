@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena AI Concierge Custom Styles */
    .ai-hero {
        background: linear-gradient(135deg, #f3e8ff 0%, #ffffff 50%, #fae8ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .ai-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(147, 51, 234, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #f3e8ff;
        border: 1px solid #a855f7;
        border-radius: 100px;
        color: #7e22ce;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(126, 34, 206, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #9333ea, #7c3aed);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 24px;
        letter-spacing: -0.02em;
        position: relative;
        z-index: 1;
    }

    .hero-subtitle {
        font-size: 1.25rem;
        color: #475569;
        line-height: 1.8;
        margin-bottom: 40px;
        max-width: 700px;
        margin-left: auto;
        margin-right: auto;
        position: relative;
        z-index: 1;
    }

    .chat-preview {
        background: white;
        border-radius: 24px;
        box-shadow: 0 20px 50px -10px rgba(147, 51, 234, 0.15);
        border: 1px solid #e9d5ff;
        max-width: 600px;
        margin: 0 auto;
        padding: 30px;
        text-align: left;
    }

    .chat-message {
        margin-bottom: 20px;
        display: flex;
        gap: 15px;
    }

    .chat-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #f3e8ff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9333ea;
        flex-shrink: 0;
    }

    .chat-bubble {
        background: #f8fafc;
        padding: 15px 20px;
        border-radius: 0 20px 20px 20px;
        color: #334155;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .chat-bubble.user {
        background: #9333ea;
        color: white;
        border-radius: 20px 0 20px 20px;
    }

    .chat-message.user {
        flex-direction: row-reverse;
    }

    /* Responsive Adjustments */
    @media (max-width: 768px) {
        .ai-hero {
            padding: 40px 0;
        }

        .hero-title {
            font-size: 2rem;
        }

        .hero-subtitle {
            font-size: 1rem;
            padding: 0 15px;
        }

        .chat-preview {
            padding: 20px;
            margin: 0 15px;
            width: auto;
        }

        .chat-message {
            gap: 10px;
        }

        .chat-avatar {
            width: 32px;
            height: 32px;
            font-size: 0.9rem;
        }

        .chat-bubble {
            padding: 12px 15px;
            font-size: 0.9rem;
        }
    }
</style>

<!-- Hero Section -->
<section class="ai-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="sparkles-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Your 24/7 Career Copilot
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            AI Concierge
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Stuck on a cover letter? Need interview prep at 2 AM? Our AI Concierge is always ready to help you navigate your career journey.
        </p>

        <div class="chat-preview wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
            <div class="chat-message">
                <div class="chat-avatar"><ion-icon name="sparkles"></ion-icon></div>
                <div class="chat-bubble">
                    Hello! I noticed you're applying for a Senior PM role. Would you like me to review your resume against the job description?
                </div>
            </div>
            <div class="chat-message user">
                <div class="chat-avatar" style="background: #e2e8f0; color: #64748b;"><ion-icon name="person"></ion-icon></div>
                <div class="chat-bubble user">
                    Yes please! I'm worried my leadership experience isn't highlighted enough.
                </div>
            </div>
            <div class="chat-message">
                <div class="chat-avatar"><ion-icon name="sparkles"></ion-icon></div>
                <div class="chat-bubble">
                    I can help with that. Let's rewrite your "Professional Summary" to emphasize your team management skills. Here is a draft...
                </div>
            </div>
        </div>

        <!-- Interactive Chat Input -->
        <div class="chat-input-container wow animate__animated animate__fadeInUp" data-wow-delay="0.3s" style="max-width: 600px; margin: 20px auto 0;">
            <form id="ai-chat-form" style="position: relative;">
                <input type="text" id="ai-chat-input" class="form-control" placeholder="Ask Athena anything..." style="padding-right: 50px; border-radius: 100px; padding-left: 25px; height: 50px; box-shadow: 0 4px 15px rgba(147, 51, 234, 0.1); border: 1px solid #e9d5ff;">
                <button type="submit" style="position: absolute; right: 5px; top: 5px; height: 40px; width: 40px; border-radius: 50%; background: #9333ea; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
                    <ion-icon name="send"></ion-icon>
                </button>
            </form>
        </div>
    </div>
</section>

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', function() {
        const chatForm = document.getElementById('ai-chat-form');
        const chatInput = document.getElementById('ai-chat-input');
        const chatPreview = document.querySelector('.chat-preview');
        const isLoggedIn = @json(auth()->check());
        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;

            // Add user message
            appendMessage(message, 'user');
            chatInput.value = '';

            // Show typing indicator
            const typingId = showTypingIndicator();

            if (isLoggedIn) {
                // Send to backend
                fetch("{{ route('ai.concierge.respond') }}", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        context: 'career-copilot', // Updated context
                        question: message,
                        surface: 'concierge-info-page'
                    })
                })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    removeTypingIndicator(typingId);
                    appendMessage(data.answer, 'ai');
                })
                .catch(error => {
                    console.error('Error:', error);
                    removeTypingIndicator(typingId);
                    appendMessage("I'm having trouble connecting right now. Please try again later.", 'ai');
                });
            } else {
                // Simulate response for guests
                setTimeout(() => {
                    removeTypingIndicator(typingId);
                    appendMessage("I'd love to help you with that! Please <a href='{{ route('login') }}' style='color: #9333ea; text-decoration: underline;'>log in</a> to your account so I can provide personalized assistance and access your career data.", 'ai');
                }, 1500);
            }
        });

        function appendMessage(text, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${sender}`;

            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'chat-avatar';
            if (sender === 'user') {
                avatarDiv.style.background = '#e2e8f0';
                avatarDiv.style.color = '#64748b';
                avatarDiv.innerHTML = '<ion-icon name="person"></ion-icon>';
            } else {
                avatarDiv.innerHTML = '<ion-icon name="sparkles"></ion-icon>';
            }

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `chat-bubble ${sender}`;
            bubbleDiv.innerHTML = text;

            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(bubbleDiv);

            chatPreview.appendChild(messageDiv);

            // Scroll to bottom
            // chatPreview.scrollTop = chatPreview.scrollHeight; // If it had scroll
        }

        function showTypingIndicator() {
            const id = 'typing-' + Date.now();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.id = id;

            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'chat-avatar';
            avatarDiv.innerHTML = '<ion-icon name="sparkles"></ion-icon>';

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'chat-bubble';
            bubbleDiv.innerHTML = '<span class="typing-dots">...</span>';

            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(bubbleDiv);
            chatPreview.appendChild(messageDiv);

            return id;
        }

        function removeTypingIndicator(id) {
            const element = document.getElementById(id);
            if (element) element.remove();
        }
    });
</script>
@endpush

@endsection
