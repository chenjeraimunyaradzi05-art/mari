@extends('frontend.layouts.master')

@section('contents')
	<section class="section-box mt-75">
		<div class="breacrumb-cover">
			<div class="container">
				<div class="row align-items-center">
					<div class="col-lg-12">
						<h2 class="mb-20">Create AI CV</h2>
						<ul class="breadcrumbs">
							<li><a class="home-icon" href="{{ route('home') }}">Home</a></li>
							<li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
							<li>Create CV</li>
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
					<div class="card shadow-sm mb-4" style="border-radius: 18px;">
						<div class="card-body p-4">
							<h3 class="mb-2" style="color: #05264E;">Start A New CV</h3>
							<p class="text-muted mb-4">We pre-filled what we could from your profile. Tweak, expand, and add new highlights before saving.</p>

							@if($errors->any())
								<div class="alert alert-danger">
									<ul class="mb-0">
										@foreach($errors->all() as $error)
											<li>{{ $error }}</li>
										@endforeach
									</ul>
								</div>
							@endif

							<form method="POST" action="{{ route('member.cv-builder.store') }}">
								@csrf

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
										<textarea name="professional_summary" class="form-control" rows="4" placeholder="A few lines that capture your value proposition.">{{ old('professional_summary', $form['professional_summary']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Skills <small class="text-muted">comma separated</small></label>
										<textarea name="skills" class="form-control" rows="2" placeholder="e.g. Project Management, React, Stakeholder Engagement">{{ old('skills', $form['skills']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Experience <small class="text-muted">Role | Company | Start | End | Highlights</small></label>
										<textarea name="experience" class="form-control" rows="5" placeholder="Product Manager | FutureWorks | 2022-01-01 | Present | Led cross-functional launch">{{ old('experience', $form['experience']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Education <small class="text-muted">Degree | Institution | Year</small></label>
										<textarea name="education" class="form-control" rows="3" placeholder="BSc Computer Science | University of Cape Town | 2022">{{ old('education', $form['education']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Certifications <small class="text-muted">Name | Issuer | Year</small></label>
										<textarea name="certifications" class="form-control" rows="3" placeholder="AWS Solutions Architect | Amazon | 2024">{{ old('certifications', $form['certifications']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Projects <small class="text-muted">Name | Description</small></label>
										<textarea name="projects" class="form-control" rows="3" placeholder="AI Job Matcher | Built recommendation engine for apprenticeships">{{ old('projects', $form['projects']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Languages <small class="text-muted">Language | Proficiency</small></label>
										<textarea name="languages" class="form-control" rows="2" placeholder="English | Fluent">{{ old('languages', $form['languages']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Achievements <small class="text-muted">one per line</small></label>
										<textarea name="achievements" class="form-control" rows="2" placeholder="Winner, Young Innovators Hackathon 2024">{{ old('achievements', $form['achievements']) }}</textarea>
									</div>

									<div class="col-12">
										<label class="form-label fw-bold">Custom Sections <small class="text-muted">optional YAML (title: items)</small></label>
										<textarea name="custom_sections" class="form-control" rows="4" placeholder="Volunteer Work:
- Mentored 20 students in coding club">{{ old('custom_sections', $form['custom_sections'] ?? '') }}</textarea>
									</div>
								</div>

								<div class="d-flex justify-content-end gap-3 mt-4">
									<a href="{{ route('member.cv-builder.index') }}" class="btn btn-outline-secondary">Cancel</a>
									<button type="submit" class="btn" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">Save CV</button>
								</div>
							</form>
						</div>
					</div>

					<div class="card shadow-sm" style="border-radius: 18px;">
						<div class="card-body p-4">
							<h5 class="mb-3" style="color: #05264E;">Tips to boost your ATS score</h5>
							<ul class="mb-0 text-muted" style="list-style: disc; padding-left: 18px;">
								<li>Mirror keywords from the roles you care about.</li>
								<li>Quantify achievements to show the outcome of your work.</li>
								<li>Keep bullet points concise and results-focused.</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
@endsection
