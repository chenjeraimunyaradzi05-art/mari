@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Contact Custom Styles */
    .contact-hero {
        background: linear-gradient(135deg, #fdf4ff 0%, #ffffff 50%, #f0f9ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .contact-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(216, 180, 254, 0.2) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .contact-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(253, 164, 175, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #f3e8ff;
        border: 1px solid #d8b4fe;
        border-radius: 100px;
        color: #9333ea;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(147, 51, 234, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #4c1d95, #db2777);
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

    .contact-card {
        background: white;
        padding: 40px;
        border-radius: 24px;
        height: 100%;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        text-align: center;
    }

    .contact-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 40px -10px rgba(147, 51, 234, 0.1);
        border-color: #d8b4fe;
    }

    .contact-icon {
        width: 60px;
        height: 60px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        margin: 0 auto 24px;
    }

    .form-section {
        padding: 80px 0;
        background: white;
    }

    .form-box {
        background: white;
        padding: 50px;
        border-radius: 30px;
        box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.05);
        border: 1px solid #f1f5f9;
    }

    .btn-send-message {
        background: linear-gradient(135deg, #9333ea 0%, #db2777 100%);
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 50px;
        font-weight: 700;
        font-size: 1.1rem;
        transition: all 0.3s ease;
    }

    .btn-send-message:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(147, 51, 234, 0.3);
        color: white;
    }

    .input-style input, .textarea-style textarea {
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 15px 20px;
        transition: all 0.3s ease;
    }

    .input-style input:focus, .textarea-style textarea:focus {
        border-color: #9333ea;
        box-shadow: 0 0 0 4px rgba(147, 51, 234, 0.1);
    }
</style>

<!-- Hero Section -->
<section class="contact-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="chatbubbles-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Contact Us
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            We'd Love to Hear From You
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Have a question about the Athena platform? Our team is here to help you navigate your journey to economic security.
        </p>
    </div>
</section>

<!-- Contact Info Cards -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="contact-card" style="background: #f3e8ff; border-color: #e9d5ff;">
                    <div class="contact-icon" style="background: white; color: #9333ea;">
                        <ion-icon name="mail-outline"></ion-icon>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #6b21a8; margin-bottom: 10px;">Email Support</h3>
                    <p style="color: #581c87; margin-bottom: 5px;">Our team is here to help.</p>
                    <a href="mailto:{{ config('settings.contact_email', 'support@athena.com') }}" style="color: #9333ea; font-weight: 600;">{{ config('settings.contact_email', 'support@athena.com') }}</a>
                </div>
            </div>

            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="contact-card" style="background: #fce7f3; border-color: #fbcfe8;">
                    <div class="contact-icon" style="background: white; color: #db2777;">
                        <ion-icon name="call-outline"></ion-icon>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #9d174d; margin-bottom: 10px;">Phone</h3>
                    <p style="color: #831843; margin-bottom: 5px;">Mon-Fri from 8am to 5pm.</p>
                    <a href="tel:{{ config('settings.contact_phone', '+1 (555) 000-0000') }}" style="color: #db2777; font-weight: 600;">{{ config('settings.contact_phone', '+1 (555) 000-0000') }}</a>
                </div>
            </div>

            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="contact-card" style="background: #dcfce7; border-color: #bbf7d0;">
                    <div class="contact-icon" style="background: white; color: #16a34a;">
                        <ion-icon name="logo-whatsapp"></ion-icon>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #15803d; margin-bottom: 10px;">WhatsApp</h3>
                    <p style="color: #14532d; margin-bottom: 5px;">Chat with us directly.</p>
                    <a href="https://wa.me/{{ str_replace(['+', ' ', '(', ')', '-'], '', config('settings.contact_phone', '15550000000')) }}" target="_blank" style="color: #16a34a; font-weight: 600;">Chat Now</a>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Form Section -->
<section class="form-section" style="background: linear-gradient(135deg, #fdf4ff 0%, #f0f9ff 100%);">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="form-box wow animate__animated animate__fadeInUp" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 25px 50px -12px rgba(147, 51, 234, 0.15);">
                    <div class="text-center mb-40">
                        <h2 style="font-size: 2.8rem; font-weight: 800; background: linear-gradient(to right, #9333ea, #db2777); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 15px;">Send us a Message</h2>
                        <p style="font-size: 1.1rem; color: #475569; font-weight: 500;">We usually respond within 24 hours.</p>
                    </div>

                    <form class="contact-form-style" id="contact-form" action="" method="post">
                        @csrf
                        <div class="row">
                            <div class="col-lg-6 col-md-6">
                                <div class="input-style mb-20">
                                    <label style="font-weight: 600; color: #334155; margin-bottom: 8px; display: block;">Name</label>
                                    <input class="font-sm color-text-paragraph-2" name="name" placeholder="Enter your name" type="text" style="background: #f8fafc; border-color: #e2e8f0;">
                                </div>
                            </div>
                            <div class="col-lg-6 col-md-6">
                                <div class="input-style mb-20">
                                    <label style="font-weight: 600; color: #334155; margin-bottom: 8px; display: block;">Email</label>
                                    <input class="font-sm color-text-paragraph-2" name="email" placeholder="Enter your email" type="text" style="background: #f8fafc; border-color: #e2e8f0;">
                                </div>
                            </div>
                            <div class="col-lg-12 col-md-12">
                                <div class="input-style mb-20">
                                    <label style="font-weight: 600; color: #334155; margin-bottom: 8px; display: block;">Subject</label>
                                    <input class="font-sm color-text-paragraph-2" name="subject" placeholder="Your subject" type="text" style="background: #f8fafc; border-color: #e2e8f0;">
                                </div>
                            </div>
                            <div class="col-lg-12 col-md-12">
                                <div class="textarea-style mb-30">
                                    <label style="font-weight: 600; color: #334155; margin-bottom: 8px; display: block;">Message</label>
                                    <textarea class="font-sm color-text-paragraph-2" name="message" placeholder="How can we help you?" style="height: 150px; background: #f8fafc; border-color: #e2e8f0;"></textarea>
                                </div>
                                <div class="text-center">
                                    <button class="submit btn btn-send-message" type="submit" style="padding: 18px 50px; font-size: 1.1rem; box-shadow: 0 10px 20px -5px rgba(147, 51, 234, 0.4);">Send Message</button>
                                </div>
                            </div>
                        </div>
                    </form>
                    <p class="form-messege"></p>
                </div>
            </div>
        </div>
    </div>
</section>

@if (config('settings.site_map'))
<section class="contact_map mt-80 mb-80">
    <div class="container">
        <div class="row">
            <div class="col-12 wow animate__animated animate__fadeInUp">
                <div style="border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);">
                    {!! config('settings.site_map') !!}
                </div>
            </div>
        </div>
    </div>
</section>
@endif

@endsection

@push('scripts')
  <script>
    $(document).ready(function() {
        $("#contact-form").on('submit', function(e){
            e.preventDefault();
            let formData = $(this).serialize();
            let button = $('.submit');

            $.ajax({
                method: 'POST',
                url: '{{ route("send-mail") }}',
                data: formData,
                beforeSend: function() {
                    button.text("Sending...");
                    button.prop('disabled', true);
                },
                success: function(response) {
                    button.text("Send Message")
                    button.prop('disabled', false);
                    $("#contact-form").trigger('reset');
                    notyf.success(response.message);
                },
                error: function(xhr, status, error) {
                    let erorrs = xhr.responseJSON.errors;
                    $.each(erorrs, function(index, value) {
                        notyf.error(value[0]);
                    });
                    button.text("Send Message");
                    button.prop('disabled', false);

                }
            })
        });
    })
  </script>
@endpush
