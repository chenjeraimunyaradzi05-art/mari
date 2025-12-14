{{-- AI-Powered Application Assistant Widget --}}
<div class="ai-application-assistant mt-40">
    <div class="card border-0 shadow-lg" style="border-top: 4px solid #E91E8C !important;">
        <div class="card-body p-4">
            <!-- Header -->
            <div class="d-flex align-items-center mb-4">
                <div class="me-3" style="width: 50px; height: 50px; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-robot fa-lg" style="color: white;"></i>
                </div>
                <div>
                    <h4 class="mb-0" style="color: #05264E;">
                        <i class="fas fa-sparkles" style="color: #E91E8C;"></i>
                        AI Application Assistant
                    </h4>
                    <p class="text-muted mb-0" style="font-size: 13px;">Get personalized insights before you apply</p>
                </div>
            </div>

            <!-- Match Score -->
            <div class="application-score-section mb-4 p-3" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%); border-radius: 12px;">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0" style="color: #05264E;">
                        <i class="fas fa-chart-pie me-2" style="color: #E91E8C;"></i>
                        Your Match Score
                    </h6>
                    <button class="btn btn-sm calculate-score-btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; font-size: 12px;">
                        <i class="fas fa-calculator me-1"></i> Calculate
                    </button>
                </div>

                <div class="score-result d-none">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <span style="font-size: 14px; color: #666;">Overall Match</span>
                        <span class="score-value" style="font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">--</span>
                    </div>
                    <div class="progress" style="height: 8px; border-radius: 10px;">
                        <div class="progress-bar score-progress" role="progressbar" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); width: 0%;"></div>
                    </div>
                    <p class="score-message mt-2 mb-0" style="font-size: 13px; color: #666;"></p>

                    <!-- Score Breakdown -->
                    <div class="score-breakdown mt-3">
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="p-2" style="background: white; border-radius: 8px;">
                                    <small class="text-muted d-block">Skills Match</small>
                                    <strong class="skills-score" style="color: #E91E8C;">--%</strong>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2" style="background: white; border-radius: 8px;">
                                    <small class="text-muted d-block">Experience</small>
                                    <strong class="experience-score" style="color: #8B5CF6;">--%</strong>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2" style="background: white; border-radius: 8px;">
                                    <small class="text-muted d-block">Profile Score</small>
                                    <strong class="profile-score" style="color: #E91E8C;">--%</strong>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-2" style="background: white; border-radius: 8px;">
                                    <small class="text-muted d-block">Success Rate</small>
                                    <strong class="success-rate" style="color: #8B5CF6;">--%</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI Tips -->
            <div class="ai-tips-section mb-4">
                <h6 class="mb-3" style="color: #05264E;">
                    <i class="fas fa-lightbulb me-2" style="color: #E91E8C;"></i>
                    Personalized Application Tips
                </h6>
                <div class="tips-list">
                    <!-- Tips will be loaded here -->
                    <div class="text-center py-3">
                        <div class="spinner-border text-primary spinner-border-sm d-none loading-tips" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px;">Click "Calculate" to get personalized tips</p>
                    </div>
                </div>
            </div>

            <!-- Cover Letter Generator -->
            <div class="cover-letter-section">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0" style="color: #05264E;">
                        <i class="fas fa-file-alt me-2" style="color: #8B5CF6;"></i>
                        AI Cover Letter Generator
                    </h6>
                    <button class="btn btn-sm generate-cover-letter-btn" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; font-size: 12px;">
                        <i class="fas fa-magic me-1"></i> Generate
                    </button>
                </div>

                <div class="cover-letter-result d-none">
                    <div class="p-3" style="background: #F8F9FA; border-radius: 8px; border: 1px solid #E0E0E0; max-height: 300px; overflow-y: auto;">
                        <div class="cover-letter-text" style="white-space: pre-line; font-size: 13px; line-height: 1.8;"></div>
                    </div>
                    <div class="d-flex justify-content-end mt-2 gap-2">
                        <button class="btn btn-sm btn-outline-secondary copy-cover-letter">
                            <i class="fas fa-copy me-1"></i> Copy
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-cover-letter">
                            <i class="fas fa-edit me-1"></i> Edit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>



<script>
document.addEventListener('DOMContentLoaded', function() {
    const jobId = '{{ $job->id ?? '' }}';

    // Calculate Score
    document.querySelector('.calculate-score-btn')?.addEventListener('click', function() {
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Calculating...';

        // Simulate API call (replace with actual API endpoint)
        setTimeout(() => {
            const score = Math.floor(Math.random() * 30) + 65; // 65-95
            displayScore(score);
            loadTips();
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync me-1"></i> Recalculate';
        }, 1500);
    });

    function displayScore(score) {
        const scoreResult = document.querySelector('.score-result');
        scoreResult.classList.remove('d-none');

        document.querySelector('.score-value').textContent = score + '%';
        document.querySelector('.score-progress').style.width = score + '%';

        // Update message based on score
        const message = score >= 80 ? 'Excellent match! You should definitely apply.' :
                       score >= 60 ? 'Good match! Consider adding more relevant details.' :
                       'Fair match. Update your profile to improve your chances.';
        document.querySelector('.score-message').textContent = message;

        // Update breakdown (simulated values)
        document.querySelector('.skills-score').textContent = Math.floor(Math.random() * 20 + 70) + '%';
        document.querySelector('.experience-score').textContent = Math.floor(Math.random() * 20 + 65) + '%';
        document.querySelector('.profile-score').textContent = Math.floor(Math.random() * 20 + 60) + '%';
        document.querySelector('.success-rate').textContent = Math.floor(Math.random() * 20 + 55) + '%';
    }

    function loadTips() {
        const tipsList = document.querySelector('.tips-list');
        const tips = [
                {
                icon: 'video',
                title: 'Add a Professional Video',
                description: 'Members with video profiles are 3x more likely to get interviews',
                priority: 'high',
                action: '{{ route("member.profile.index") }}#pills-video-tab'
            },
            {
                icon: 'star',
                title: 'Highlight Relevant Skills',
                description: 'Add skills matching the job requirements to improve your match score',
                priority: 'medium',
                action: '{{ route("member.profile.index") }}#pills-profile-tab'
            },
            {
                icon: 'clock',
                title: 'Apply Early',
                description: 'Early applications get more attention from recruiters',
                priority: 'high',
                action: '#'
            }
        ];

        tipsList.innerHTML = tips.map(tip => `
            <div class="tip-item ${tip.priority}-priority">
                <div class="d-flex align-items-start">
                    <i class="fas fa-${tip.icon} me-2 mt-1" style="color: ${tip.priority === 'high' ? '#E91E8C' : tip.priority === 'medium' ? '#8B5CF6' : '#3B82F6'};"></i>
                    <div class="flex-grow-1">
                        <strong style="font-size: 13px; color: #05264E;">${tip.title}</strong>
                        <p class="mb-0 mt-1 text-muted" style="font-size: 12px;">${tip.description}</p>
                    </div>
                    ${tip.action !== '#' ? `<a href="${tip.action}" class="btn btn-sm btn-outline-primary" style="font-size: 11px;">Action</a>` : ''}
                </div>
            </div>
        `).join('');
    }

    // Generate Cover Letter
    document.querySelector('.generate-cover-letter-btn')?.addEventListener('click', function() {
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Generating...';

        // Simulate API call
        setTimeout(() => {
            const coverLetter = `Dear Hiring Manager,

I am writing to express my strong interest in this position. With my background and expertise, I am confident in my ability to contribute effectively to your team.

Throughout my career, I have developed a comprehensive skill set that aligns perfectly with your requirements. My experience has equipped me with the technical knowledge and practical skills needed to excel in this role.

            I am excited about the possibility of bringing my unique perspective and dedication to your team. I am confident that my skills and enthusiasm make me an ideal member for this position.

Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to your organization's success.

Sincerely,
{{ auth()->user()->name ?? 'Your Name' }}`;

            displayCoverLetter(coverLetter);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync me-1"></i> Regenerate';
        }, 2000);
    });

    function displayCoverLetter(text) {
        const result = document.querySelector('.cover-letter-result');
        result.classList.remove('d-none');
        document.querySelector('.cover-letter-text').textContent = text;
    }

    // Copy Cover Letter
    document.querySelector('.copy-cover-letter')?.addEventListener('click', function() {
        const text = document.querySelector('.cover-letter-text').textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.innerHTML = '<i class="fas fa-check me-1"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-copy me-1"></i> Copy';
            }, 2000);
        });
    });
});
</script>

