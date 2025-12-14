@extends('frontend.layouts.master')

@section('contents')
	<section class="section-box mt-75">
		<div class="breacrumb-cover">
			<div class="container">
				<div class="row align-items-center">
					<div class="col-lg-12">
						<h2 class="mb-20">Edit CV</h2>
						<ul class="breadcrumbs">
							<li><a class="home-icon" href="{{ route('home') }}">Home</a></li>
							<li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
							<li>Edit CV</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="section-box mt-50">
		<div class="container">
			<div class="row">

				@include('frontend.candidate-dashboard.sidebar')

				<div class="col-lg-9 col-md-8">
					@if(session('success'))
						<div class="alert alert-success">{{ session('success') }}</div>
					@endif

					<div class="card shadow-sm mb-4" style="border-radius: 18px;">
						<div class="card-body p-4">
							<div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
								<div>
									<h3 class="mb-1" style="color: #05264E;">{{ $cv->title }}</h3>
									<p class="text-muted mb-0">ATS Score <span style="color: #E91E8C; font-weight: bold;">{{ $cv->ats_score }}%</span> · Completion {{ $cv->completion_percentage }}%</p>
								</div>
								<div class="d-flex gap-2">
									<a href="{{ route('member.cv-builder.preview', $cv->slug) }}" class="btn btn-outline-secondary"><i class="fas fa-eye me-2"></i>Preview</a>
									<a href="{{ route('member.cv-builder.download', $cv->slug) }}" class="btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;"><i class="fas fa-download me-2"></i>Download</a>
								</div>
							</div>

							<form method="POST" action="{{ route('member.cv-builder.update', $cv->slug) }}">
								@csrf
								@method('PUT')

								<div class="row g-4">
									<div class="col-md-6">
										<label class="form-label fw-bold">Title</label>
										<input type="text" name="title" class="form-control" value="{{ old('title', $form['title']) }}" required>
									</div>
									<div class="col-md-6">
										<label class="form-label fw-bold">Template</label>
										<select name="template" class="form-select">
											@foreach($templates as $key => $label)
												<option value="{{ $key }}" @selected(old('template', $form['template']) === $key)>{{ $label }}</option>
											@endforeach
										</select>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Professional Summary</label>
										<textarea name="professional_summary" class="form-control" rows="4">{{ old('professional_summary', $form['professional_summary']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Skills <small class="text-muted">comma separated</small></label>
										<textarea name="skills" class="form-control" rows="2">{{ old('skills', $form['skills']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Experience <small class="text-muted">Role | Company | Start | End | Highlights</small></label>
										<textarea name="experience" class="form-control" rows="5">{{ old('experience', $form['experience']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Education <small class="text-muted">Degree | Institution | Year</small></label>
										<textarea name="education" class="form-control" rows="3">{{ old('education', $form['education']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Certifications <small class="text-muted">Name | Issuer | Year</small></label>
										<textarea name="certifications" class="form-control" rows="3">{{ old('certifications', $form['certifications']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Projects <small class="text-muted">Name | Description</small></label>
										<textarea name="projects" class="form-control" rows="3">{{ old('projects', $form['projects']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Languages <small class="text-muted">Language | Proficiency</small></label>
										<textarea name="languages" class="form-control" rows="2">{{ old('languages', $form['languages']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Achievements <small class="text-muted">one per line</small></label>
										<textarea name="achievements" class="form-control" rows="2">{{ old('achievements', $form['achievements']) }}</textarea>
									</div>
								</div>

								<div class="d-flex justify-content-between align-items-center gap-3 mt-4 flex-wrap">
									<div class="d-flex gap-2">
										<form method="POST" action="{{ route('member.cv-builder.toggle-visibility', $cv->slug) }}">
											@csrf
											<button class="btn btn-outline-secondary" type="submit">
												<i class="fas fa-{{ $cv->is_public ? 'eye-slash' : 'eye' }} me-2"></i>{{ $cv->is_public ? 'Make Private' : 'Make Public' }}
											</button>
										</form>
										<form method="POST" action="{{ route('member.cv-builder.create-version', $cv->slug) }}">
											@csrf
											<button class="btn btn-outline-primary" type="submit">
												<i class="fas fa-copy me-2"></i>Duplicate
											</button>
										</form>
									</div>

									<div class="d-flex gap-2">
										<a href="{{ route('member.cv-builder.index') }}" class="btn btn-outline-secondary">Back</a>
										<button type="submit" class="btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">Save Changes</button>
									</div>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
@endsection

