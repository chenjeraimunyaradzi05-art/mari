{{-- AI Job Posting Assistant Widget --}}
<div class="ai-job-assistant mb-4">
    <div class="card border-0 shadow-sm" style="border-top: 4px solid #E91E8C !important;">
        <div class="card-body p-4">
            <!-- Header -->
            <div class="d-flex align-items-center mb-4">
                <div class="me-3" style="width: 50px; height: 50px; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-robot fa-lg" style="color: white;"></i>
                </div>
                <div>
                    <h4 class="mb-0" style="color: #05264E;">
                        <i class="fas fa-sparkles" style="color: #E91E8C;"></i>
                        AI Job Posting Assistant
                    </h4>
                    <p class="text-muted mb-0" style="font-size: 13px;">Create professional job posts in seconds</p>
                </div>
            </div>

            <!-- Quick Actions Tabs -->
            <ul class="nav nav-pills mb-3" id="aiJobTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="description-tab" data-bs-toggle="pill" data-bs-target="#description" type="button" role="tab">
                        <i class="fas fa-file-alt me-1"></i> Description
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="skills-tab" data-bs-toggle="pill" data-bs-target="#skills" type="button" role="tab">
                        <i class="fas fa-star me-1"></i> Skills
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="salary-tab" data-bs-toggle="pill" data-bs-target="#salary" type="button" role="tab">
                        <i class="fas fa-dollar-sign me-1"></i> Salary
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="seo-tab" data-bs-toggle="pill" data-bs-target="#seo" type="button" role="tab">
                        <i class="fas fa-search me-1"></i> SEO
                    </button>
                </li>
            </ul>

            <div class="tab-content" id="aiJobTabContent">
                <!-- Description Generator -->
                <div class="tab-pane fade show active" id="description" role="tabpanel">
                    <div class="description-generator">
                        <h6 class="mb-3" style="color: #05264E;">AI Description Generator</h6>
                        <p class="text-muted" style="font-size: 13px;">Enter basic info and let AI create a professional job description</p>

                        <div class="row mb-3">
                            <div class="col-md-8">
                                <input type="text" id="aiJobTitle" class="form-control" placeholder="Job Title (e.g., Senior Laravel Developer)" style="font-size: 14px;">
                            </div>
                            <div class="col-md-4">
                                <select id="aiExperience" class="form-control" style="font-size: 14px;">
                                    <option value="">Experience Level</option>
                                    <option value="entry">Entry Level</option>
                                    <option value="mid">Mid-Level</option>
                                    <option value="senior">Senior</option>
                                    <option value="lead">Lead/Manager</option>
                                </select>
                            </div>
                        </div>

                        <button class="btn w-100 generate-description-btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">
                            <i class="fas fa-magic me-2"></i> Generate Professional Description
                        </button>

                        <div class="generated-description mt-3 d-none">
                            <div class="p-3" style="background: #F8F9FA; border-radius: 8px; max-height: 400px; overflow-y: auto;">
                                <div id="generatedDescriptionContent"></div>
                            </div>
                            <div class="d-flex justify-content-end mt-2 gap-2">
                                <button class="btn btn-sm btn-outline-secondary copy-description-btn">
                                    <i class="fas fa-copy me-1"></i> Copy
                                </button>
                                <button class="btn btn-sm use-description-btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">
                                    <i class="fas fa-check me-1"></i> Use This Description
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Skills Suggester -->
                <div class="tab-pane fade" id="skills" role="tabpanel">
                    <div class="skills-suggester">
                        <h6 class="mb-3" style="color: #05264E;">AI Skills Suggester</h6>
                        <p class="text-muted" style="font-size: 13px;">Get relevant skill recommendations based on your job title</p>

                        <button class="btn w-100 suggest-skills-btn" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white;">
                            <i class="fas fa-brain me-2"></i> Suggest Skills
                        </button>

                        <div class="suggested-skills mt-3 d-none">
                            <div class="alert" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%); border: none;">
                                <strong><i class="fas fa-lightbulb me-2" style="color: #E91E8C;"></i>Recommended Skills:</strong>
                                <div id="skillsList" class="mt-2"></div>
                            </div>
                            <button class="btn btn-sm w-100 add-all-skills-btn" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white;">
                                <i class="fas fa-plus me-1"></i> Add All to Job Post
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Salary Recommender -->
                <div class="tab-pane fade" id="salary" role="tabpanel">
                    <div class="salary-recommender">
                        <h6 class="mb-3" style="color: #05264E;">AI Salary Insights</h6>
                        <p class="text-muted" style="font-size: 13px;">Get market-based salary recommendations to attract top talent</p>

                        <button class="btn w-100 recommend-salary-btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">
                            <i class="fas fa-calculator me-2"></i> Get Salary Recommendation
                        </button>

                        <div class="salary-recommendation mt-3 d-none">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <div class="p-3 text-center" style="background: #FFF5F8; border-radius: 8px; border: 2px solid #E91E8C;">
                                        <small class="text-muted d-block">Minimum</small>
                                        <h4 class="mb-0" id="minSalary" style="color: #E91E8C;">$0</h4>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 text-center" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%); border-radius: 8px; border: 2px solid #8B5CF6;">
                                        <small class="text-muted d-block">Average</small>
                                        <h4 class="mb-0" id="avgSalary" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$0</h4>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 text-center" style="background: #F5F3FF; border-radius: 8px; border: 2px solid #8B5CF6;">
                                        <small class="text-muted d-block">Maximum</small>
                                        <h4 class="mb-0" id="maxSalary" style="color: #8B5CF6;">$0</h4>
                                    </div>
                                </div>
                            </div>
                            <div class="alert alert-info mt-3" style="background: #F0F9FF; border: none; font-size: 13px;">
                                <i class="fas fa-info-circle me-2"></i>
                                <span id="salaryInsight">This range is competitive for the Australian market</span>
                            </div>
                            <button class="btn btn-sm w-100 apply-salary-btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">
                                <i class="fas fa-check me-1"></i> Apply to Job Post
                            </button>
                        </div>
                    </div>
                </div>

                <!-- SEO Optimizer -->
                <div class="tab-pane fade" id="seo" role="tabpanel">
                    <div class="seo-optimizer">
                        <h6 class="mb-3" style="color: #05264E;">SEO Optimization</h6>
                        <p class="text-muted" style="font-size: 13px;">Improve your job's visibility in search results</p>

                        <button class="btn w-100 analyze-seo-btn" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white;">
                            <i class="fas fa-chart-line me-2"></i> Analyze SEO Score
                        </button>

                        <div class="seo-analysis mt-3 d-none">
                            <div class="text-center mb-3">
                                <h2 class="mb-0" id="seoScore" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">--</h2>
                                <small class="text-muted">SEO Score</small>
                                <div class="progress mt-2" style="height: 8px;">
                                    <div class="progress-bar" id="seoProgress" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);"></div>
                                </div>
                            </div>

                            <div id="seoSuggestions"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>



<script>
document.addEventListener('DOMContentLoaded', function() {
    // Generate Description
    document.querySelector('.generate-description-btn')?.addEventListener('click', function() {
        const title = document.getElementById('aiJobTitle').value;
        const experience = document.getElementById('aiExperience').value;

        if (!title) {
            alert('Please enter a job title');
            return;
        }

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Generating...';

        // Simulate API call
        setTimeout(() => {
            const description = generateJobDescription(title, experience);
            document.getElementById('generatedDescriptionContent').innerHTML = description;
            document.querySelector('.generated-description').classList.remove('d-none');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic me-2"></i> Generate Professional Description';
        }, 2000);
    });

    // Suggest Skills
    document.querySelector('.suggest-skills-btn')?.addEventListener('click', function() {
        const title = document.getElementById('aiJobTitle').value || 'this position';

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Analyzing...';

        setTimeout(() => {
            const skills = ['Laravel', 'PHP', 'MySQL', 'JavaScript', 'Vue.js', 'Git', 'RESTful API', 'Problem Solving'];
            const skillsHtml = skills.map(skill =>
                `<span class="skill-badge">${skill}</span>`
            ).join('');
            document.getElementById('skillsList').innerHTML = skillsHtml;
            document.querySelector('.suggested-skills').classList.remove('d-none');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-brain me-2"></i> Suggest Skills';
        }, 1500);
    });

    // Recommend Salary
    document.querySelector('.recommend-salary-btn')?.addEventListener('click', function() {
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Calculating...';

        setTimeout(() => {
            document.getElementById('minSalary').textContent = '$60,000';
            document.getElementById('avgSalary').textContent = '$80,000';
            document.getElementById('maxSalary').textContent = '$100,000';
            document.querySelector('.salary-recommendation').classList.remove('d-none');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-calculator me-2"></i> Get Salary Recommendation';
        }, 1500);
    });

    // Analyze SEO
    document.querySelector('.analyze-seo-btn')?.addEventListener('click', function() {
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Analyzing...';

        setTimeout(() => {
            const score = 85;
            document.getElementById('seoScore').textContent = score + '/100';
            document.getElementById('seoProgress').style.width = score + '%';

            const suggestions = `
                <div class="alert alert-success" style="font-size: 13px; border: none; background: #F0FDF4;">
                    <i class="fas fa-check-circle me-2"></i> Title length is optimal
                </div>
                <div class="alert alert-warning" style="font-size: 13px; border: none; background: #FFF7ED;">
                    <i class="fas fa-exclamation-circle me-2"></i> Add more keywords to description
                </div>
            `;
            document.getElementById('seoSuggestions').innerHTML = suggestions;
            document.querySelector('.seo-analysis').classList.remove('d-none');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-chart-line me-2"></i> Analyze SEO Score';
        }, 1500);
    });

    // Helper function
    function generateJobDescription(title, experience) {
        return `
            <h5>About the Role</h5>
            <p>We are seeking a talented ${title} to join our growing team. This is an exciting opportunity to work on innovative projects and make a real impact.</p>

            <h5>Key Responsibilities</h5>
            <ul>
                <li>Lead and execute projects aligned with company objectives</li>
                <li>Collaborate with cross-functional teams to deliver high-quality results</li>
                <li>Contribute to strategic planning and continuous improvement initiatives</li>
                <li>Mentor junior team members and share knowledge effectively</li>
            </ul>

            <h5>Required Qualifications</h5>
            <ul>
                <li>Proven experience in a similar role</li>
                <li>Strong technical and problem-solving skills</li>
                <li>Excellent communication and teamwork abilities</li>
                <li>Bachelor's degree in relevant field or equivalent experience</li>
            </ul>
        `;
    }

    // Copy description
    document.querySelector('.copy-description-btn')?.addEventListener('click', function() {
        const text = document.getElementById('generatedDescriptionContent').innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.innerHTML = '<i class="fas fa-check me-1"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-copy me-1"></i> Copy';
            }, 2000);
        });
    });
});
</script>

