@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Practice Session</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li><a href="{{ route('member.interview-coach.index') }}">Interview Coach</a></li>
                            <li>Practice</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-50">
        <div class="container">
            <div class="row">
                <div class="col-lg-12">
                    <!-- Progress Bar -->
                    <div class="card mb-4" style="border-radius: 15px; border: 2px solid #E91E8C;">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h5 class="mb-0">{{ $session->title }}</h5>
                                <span class="badge" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); font-size: 16px;">
                                    Question {{ $currentIndex + 1 }} of {{ $session->total_questions }}
                                </span>
                            </div>
                            <div class="progress" style="height: 10px; border-radius: 5px;">
                                <div class="progress-bar" id="sessionProgress" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);"
                                     role="progressbar" style="width: {{ ($currentIndex / $session->total_questions) * 100 }}%"></div>
                            </div>
                            <div class="d-flex justify-content-between mt-2">
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>
                                    <span id="timer">00:00</span>
                                </small>
                                <small class="text-muted">{{ round(($currentIndex / $session->total_questions) * 100) }}% Complete</small>
                            </div>
                        </div>
                    </div>

                    <!-- Question Card -->
                    <div class="card mb-4" style="border-radius: 15px;">
                        <div class="card-header" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; border-radius: 15px 15px 0 0;">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    <i class="{{ $currentQuestion->type_icon }} me-2"></i>
                                    {{ ucfirst(str_replace('_', ' ', $currentQuestion->type)) }} Question
                                </h5>
                                <div class="d-flex gap-3">
                                    <span class="badge bg-light text-dark">
                                        <i class="fas fa-signal me-1"></i>{{ ucfirst($currentQuestion->difficulty) }}
                                    </span>
                                    <span class="badge bg-light text-dark">
                                        <i class="fas fa-hourglass-half me-1"></i>{{ $currentQuestion->formatted_time_limit }}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="card-body p-4">
                            <h4 class="mb-4" style="color: #1F2937; line-height: 1.6;">{{ $currentQuestion->question }}</h4>

                            @if($currentQuestion->description)
                                <div class="alert alert-info" style="background: #EFF6FF; border-left: 4px solid #3B82F6;">
                                    <i class="fas fa-info-circle me-2"></i>
                                    {{ $currentQuestion->description }}
                                </div>
                            @endif

                            <!-- Answer Form -->
                            <form id="answerForm" onsubmit="return false;">
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Your Answer:</label>
                                    <textarea id="answerText" class="form-control" rows="10"
                                              placeholder="Type your answer here... Use the STAR method (Situation, Task, Action, Result) for better structure."
                                              style="font-size: 16px; line-height: 1.8;"></textarea>
                                    <div class="d-flex justify-content-between mt-2">
                                        <small class="text-muted">
                                            <span id="wordCount">0</span> words •
                                            Suggested: 100-150 words
                                        </small>
                                        <small class="text-muted">
                                            Time spent: <span id="questionTimer">00:00</span>
                                        </small>
                                    </div>
                                </div>

                                <!-- Tips Box -->
                                <div class="alert" style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border: none; border-radius: 10px;">
                                    <h6 style="color: #92400E;">💡 Tips for a great answer:</h6>
                                    <ul class="mb-0 small" style="color: #78350F;">
                                        <li>Be specific and provide concrete examples</li>
                                        <li>Use numbers and metrics when possible</li>
                                        <li>Structure your answer clearly (STAR method)</li>
                                        <li>Show enthusiasm and confidence</li>
                                    </ul>
                                </div>

                                <div class="d-flex gap-2">
                                    <button type="button" class="btn btn-primary btn-lg" onclick="submitAnswer()" id="submitBtn">
                                        <i class="fas fa-paper-plane me-2"></i>Submit Answer
                                    </button>
                                    <button type="button" class="btn btn-outline-secondary btn-lg" onclick="skipQuestion()" id="skipBtn">
                                        <i class="fas fa-forward me-2"></i>Skip Question
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Feedback Modal -->
    <div class="modal fade" id="feedbackModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content" style="border-radius: 15px; border: none;">
                <div class="modal-header" style="background: linear-gradient(135deg, #10B981 0%, #3B82F6 100%); color: white; border-radius: 15px 15px 0 0;">
                    <h5 class="modal-title"><i class="fas fa-check-circle me-2"></i>Answer Submitted!</h5>
                </div>
                <div class="modal-body p-4" id="feedbackContent">
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Analyzing...</span>
                        </div>
                        <p class="mt-3 text-muted">AI is analyzing your answer...</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="nextQuestion()" id="nextQuestionBtn" style="display: none;">
                        Next Question <i class="fas fa-arrow-right ms-2"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>

    @push('scripts')
    <script>
        let startTime = Date.now();
        let questionStartTime = Date.now();
        let timerInterval;
        let questionTimerInterval;

        // Start timers
        function startTimers() {
            // Session timer
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                document.getElementById('timer').textContent = formatTime(elapsed);
            }, 1000);

            // Question timer
            questionTimerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
                document.getElementById('questionTimer').textContent = formatTime(elapsed);
            }, 1000);
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // Word counter
        document.getElementById('answerText').addEventListener('input', function() {
            const words = this.value.trim().split(/\s+/).filter(word => word.length > 0).length;
            document.getElementById('wordCount').textContent = words;
        });

        // Submit answer
        async function submitAnswer() {
            const answer = document.getElementById('answerText').value.trim();

            if (answer.length < 10) {
                alert('Please provide a more detailed answer (at least 10 characters).');
                return;
            }

            const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);

            // Disable buttons
            document.getElementById('submitBtn').disabled = true;
            document.getElementById('skipBtn').disabled = true;

            // Show feedback modal
            const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
            modal.show();

            try {
                const response = await fetch('{{ route("member.interview-coach.submit-answer", $session->id) }}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': '{{ csrf_token() }}'
                    },
                    body: JSON.stringify({
                        question_id: {{ $currentQuestion->id }},
                        answer: answer,
                        time_taken: timeTaken
                    })
                });

                const data = await response.json();

                if (data.success) {
                    displayFeedback(data.feedback, data.progress);
                } else {
                    alert('Error submitting answer. Please try again.');
                    modal.hide();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error submitting answer. Please try again.');
                modal.hide();
            }
        }

        function displayFeedback(feedback, progress) {
            const content = document.getElementById('feedbackContent');

            // Score color
            let scoreColor = '#DC2626';
            if (feedback.score >= 90) scoreColor = '#10B981';
            else if (feedback.score >= 75) scoreColor = '#3B82F6';
            else if (feedback.score >= 60) scoreColor = '#F59E0B';
            else if (feedback.score >= 50) scoreColor = '#EF4444';

            let html = `
                <div class="text-center mb-4">
                    <div class="mb-3">
                        <div style="display: inline-block; position: relative;">
                            <svg width="150" height="150">
                                <circle cx="75" cy="75" r="60" fill="none" stroke="#F3F4F6" stroke-width="10"/>
                                <circle cx="75" cy="75" r="60" fill="none" stroke="${scoreColor}" stroke-width="10"
                                        stroke-dasharray="${2 * 3.14159 * 60}"
                                        stroke-dashoffset="${2 * 3.14159 * 60 * (1 - feedback.score / 100)}"
                                        stroke-linecap="round"
                                        style="transform: rotate(-90deg); transform-origin: center;"/>
                            </svg>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                                <div style="font-size: 36px; font-weight: bold; color: ${scoreColor};">${Math.round(feedback.score)}</div>
                                <div style="font-size: 14px; color: #6B7280;">Score</div>
                            </div>
                        </div>
                    </div>
                    <h5 style="color: ${scoreColor};">${feedback.score_badge}</h5>
                </div>

                <div class="row mb-3">
                    ${Object.entries(feedback.metrics).map(([key, metric]) => `
                        <div class="col-6 mb-2">
                            <div class="p-2 text-center" style="background: ${metric.color}15; border-radius: 8px;">
                                <div style="font-size: 20px; font-weight: bold; color: ${metric.color};">${Math.round(metric.score)}</div>
                                <small class="text-muted">${metric.label}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            if (feedback.strengths && feedback.strengths.length > 0) {
                html += `
                    <div class="mb-3">
                        <h6 style="color: #10B981;"><i class="fas fa-check-circle me-2"></i>Strengths</h6>
                        <ul class="list-unstyled">
                            ${feedback.strengths.map(s => `<li class="mb-1"><i class="fas fa-plus text-success me-2"></i>${s}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            if (feedback.weaknesses && feedback.weaknesses.length > 0) {
                html += `
                    <div class="mb-3">
                        <h6 style="color: #EF4444;"><i class="fas fa-exclamation-triangle me-2"></i>Areas to Improve</h6>
                        <ul class="list-unstyled">
                            ${feedback.weaknesses.map(w => `<li class="mb-1"><i class="fas fa-minus text-danger me-2"></i>${w}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            if (feedback.improvement_tip) {
                html += `
                    <div class="alert" style="background: linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 100%); border: none;">
                        <h6 style="color: #1E40AF;"><i class="fas fa-lightbulb me-2"></i>Tip for Next Time</h6>
                        <p class="mb-0 small" style="color: #1E3A8A;">${feedback.improvement_tip}</p>
                    </div>
                `;
            }

            content.innerHTML = html;
            document.getElementById('nextQuestionBtn').style.display = 'block';

            // Update progress bar
            const progressBar = document.getElementById('sessionProgress');
            progressBar.style.width = progress.percentage + '%';
        }

        function skipQuestion() {
            if (confirm('Are you sure you want to skip this question? You won\'t be able to come back to it.')) {
                nextQuestion();
            }
        }

        function nextQuestion() {
            // Reset question timer
            questionStartTime = Date.now();

            // Reload page to get next question
            window.location.reload();
        }

        // Start timers on page load
        startTimers();

        // Warn before leaving
        window.addEventListener('beforeunload', function (e) {
            e.preventDefault();
            e.returnValue = '';
        });
    </script>
    @endpush
@endsection
