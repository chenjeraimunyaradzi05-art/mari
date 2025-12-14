@extends('frontend.layouts.master')

@section('title', 'Resume Parser - Upload & Analyze')

@section('contents')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-8">
            <!-- Header -->
            <div class="mb-5">
                <h1 class="h2 fw-bold mb-2">
                    <i class="fas fa-file-pdf text-danger me-2"></i>AI Resume Parser
                </h1>
                <p class="text-muted">Upload your resume and let AI extract your information automatically</p>
            </div>

            <!-- Progress Info -->
            <div class="alert alert-info mb-4">
                <div class="d-flex align-items-start">
                    <i class="fas fa-circle-info mt-1 me-2"></i>
                    <div>
                        <strong>How it works:</strong>
                        <ol class="mb-0 mt-2">
                            <li>Upload your resume (PDF, DOC, or DOCX)</li>
                            <li>AI will extract your information</li>
                            <li>Review the parsed data</li>
                            <li>Apply to your profile</li>
                        </ol>
                    </div>
                </div>
            </div>

            <!-- Upload Card -->
            <div class="card shadow-sm mb-4">
                <div class="card-body p-5">
                    <form id="resumeUploadForm" enctype="multipart/form-data">
                        @csrf

                        <!-- File Input Area -->
                        <div class="upload-area border-2 border-dashed rounded-3 p-5 text-center bg-light position-relative" id="uploadArea">
                            <div class="upload-content">
                                <div class="mb-3">
                                    <i class="fas fa-cloud-upload-alt fa-3x text-primary"></i>
                                </div>
                                <h5 class="fw-bold mb-2">Click to upload or drag and drop</h5>
                                <p class="text-muted mb-3">PDF, DOC, DOCX (Max 5MB)</p>
                                <input type="file" id="resumeInput" name="resume" class="d-none" accept=".pdf,.doc,.docx" required>
                                <button type="button" class="btn btn-primary" id="browseBtn">
                                    <i class="fas fa-folder-open me-2"></i>Browse Files
                                </button>
                            </div>
                            <div class="loading d-none text-center">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="text-muted">Parsing your resume...</p>
                            </div>
                        </div>

                        <!-- Selected File Info -->
                        <div id="fileInfo" class="mt-4 d-none">
                            <div class="alert alert-light border">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <i class="fas fa-file me-2"></i>
                                        <strong id="fileName"></strong>
                                        <div class="small text-muted" id="fileSize"></div>
                                    </div>
                                    <button type="button" class="btn btn-sm btn-outline-danger" id="removeFileBtn">
                                        <i class="fas fa-times"></i> Remove
                                    </button>
                                </div>

                                <!-- Upload Progress -->
                                <div class="mt-3">
                                    <div class="progress" style="height: 4px;">
                                        <div id="uploadProgress" class="progress-bar bg-success" role="progressbar" style="width: 0%"></div>
                                    </div>
                                    <small class="text-muted d-block mt-2">
                                        <span id="uploadStatus">Ready to upload</span>
                                    </small>
                                </div>

                                <!-- Submit Button -->
                                <div class="mt-4">
                                    <button type="submit" class="btn btn-success btn-lg w-100" id="submitBtn">
                                        <i class="fas fa-magic me-2"></i>Parse Resume with AI
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Error Message -->
                        <div id="errorAlert" class="alert alert-danger mt-3 d-none" role="alert">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            <span id="errorMessage"></span>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Features -->
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <div class="card text-center p-4">
                        <i class="fas fa-bolt text-warning fa-2x mb-2"></i>
                        <h6 class="fw-bold">Smart Extraction</h6>
                        <small class="text-muted">Automatically extracts personal info, skills, experience</small>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card text-center p-4">
                        <i class="fas fa-check-circle text-success fa-2x mb-2"></i>
                        <h6 class="fw-bold">Review Before Apply</h6>
                        <small class="text-muted">Verify all parsed data before updating your profile</small>
                    </div>
                </div>
            </div>

            <!-- Supported Formats -->
            <div class="card bg-light border-0">
                <div class="card-body">
                    <h6 class="fw-bold mb-3">Supported Formats</h6>
                    <div class="row text-center">
                        <div class="col-4">
                            <i class="fas fa-file-pdf text-danger fa-lg mb-2 d-block"></i>
                            <small>PDF</small>
                        </div>
                        <div class="col-4">
                            <i class="fas fa-file-word text-primary fa-lg mb-2 d-block"></i>
                            <small>Microsoft Word</small>
                        </div>
                        <div class="col-4">
                            <i class="fas fa-file-alt text-info fa-lg mb-2 d-block"></i>
                            <small>Documents</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const resumeInput = document.getElementById('resumeInput');
    const fileInfo = document.getElementById('fileInfo');
    const errorAlert = document.getElementById('errorAlert');
    const browseBtn = document.getElementById('browseBtn');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const uploadForm = document.getElementById('resumeUploadForm');

    // Browse button click
    browseBtn.addEventListener('click', () => resumeInput.click());

    // File input change
    resumeInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('bg-primary', 'bg-opacity-10');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('bg-primary', 'bg-opacity-10');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('bg-primary', 'bg-opacity-10');
        resumeInput.files = e.dataTransfer.files;
        handleFileSelect();
    });

    // Remove file
    removeFileBtn.addEventListener('click', () => {
        resumeInput.value = '';
        fileInfo.classList.add('d-none');
        errorAlert.classList.add('d-none');
    });

    // Handle file selection
    function handleFileSelect() {
        const file = resumeInput.files[0];

        if (!file) return;

        // Validate file type
        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
            showError('Please upload a PDF or Word document');
            resumeInput.value = '';
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showError('File size must not exceed 5MB');
            resumeInput.value = '';
            return;
        }

        // Show file info
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(2) + ' KB';
        fileInfo.classList.remove('d-none');
        errorAlert.classList.add('d-none');
    }

    // Form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = resumeInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('resume', file);
        formData.append('_token', document.querySelector('meta[name="csrf-token"]').content);

        try {
            // Show loading state
            document.querySelector('.upload-content').classList.add('d-none');
            document.querySelector('.loading').classList.remove('d-none');
            document.getElementById('submitBtn').disabled = true;

            // Upload file
            const response = await fetch('/member/resume-parser/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to parse resume');
            }

            // Success - redirect to preview
            window.location.href = '/member/resume-parser/preview';

        } catch (error) {
            showError(error.message);
            document.querySelector('.upload-content').classList.remove('d-none');
            document.querySelector('.loading').classList.add('d-none');
            document.getElementById('submitBtn').disabled = false;
        }
    });

    function showError(message) {
        document.getElementById('errorMessage').textContent = message;
        errorAlert.classList.remove('d-none');
    }
});
</script>
@endpush


@endsection

