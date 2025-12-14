<section class="section-box mt-90 mb-50">
    <div class="container">
        <div class="text-center">
            <h2 class="section-title mb-10 wow animate__animated animate__fadeInUp" style="font-size: 2.8rem; font-weight: 800; background: linear-gradient(to right, #9333ea, #db2777); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">What our clients say</h2>
            <p class="font-lg wow animate__animated animate__fadeInUp" style="font-size: 1.2rem; color: #475569; font-weight: 500;">Testimonials from our partners and members</p>
        </div>
        <div class="row mt-50">
            @if(isset($reviews) && $reviews->count() > 0)
                @foreach($reviews as $review)
                <div class="col-lg-4 col-md-6 col-sm-12 mb-30">
                    <div class="card-grid-2 hover-up">
                        <div class="card-grid-2-image-left">
                            <div class="card-grid-2-image-rd-online">
                                <figure>
                                    <img alt="Reviewer" src="{{ asset($review->image ?? 'default-uploads/avatar.png') }}">
                                </figure>
                            </div>
                            <div class="card-profile pt-10">
                                <h5>{{ $review->name ?? 'Client' }}</h5>
                                <span class="font-xs color-text-mutted">{{ $review->title ?? 'Partner' }}</span>
                            </div>
                        </div>
                        <div class="card-block-info">
                            <p class="font-sm color-text-paragraph mt-10">
                                {{ $review->review ?? 'No review text provided.' }}
                            </p>
                        </div>
                    </div>
                </div>
                @endforeach
            @else
                <div class="col-12 text-center">
                    <div style="background: #fdf4ff; border: 1px dashed #d8b4fe; padding: 40px; border-radius: 20px; display: inline-block;">
                        <ion-icon name="chatbubbles-outline" style="font-size: 3rem; color: #d8b4fe; margin-bottom: 15px;"></ion-icon>
                        <p style="color: #9333ea; font-weight: 600; font-size: 1.1rem;">No reviews available at the moment.</p>
                        <p style="color: #6b7280; font-size: 0.9rem;">Check back soon to see what our community is saying!</p>
                    </div>
                </div>
            @endif
        </div>
    </div>
</section>
