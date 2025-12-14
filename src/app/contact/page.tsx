'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Message sent successfully! We'll get back to you soon.");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-linear-to-br from-purple-50 via-white to-pink-50 text-center">
        <div className="aura-container relative z-10">
          <span className="inline-block px-4 py-2 rounded-full bg-white border border-purple-200 text-purple-700 font-bold text-sm mb-6 shadow-sm">
            Get in Touch
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
            We&apos;d Love to Hear From You
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Have a question, suggestion, or just want to say hello? Our team is here to help you on your journey.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="aura-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Info Cards */}
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:-translate-y-1 transition-transform duration-300 text-center">
                <div className="w-16 h-16 mx-auto bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  📧
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Email Us</h3>
                <p className="text-slate-600 mb-4">For general inquiries and support</p>
                <a href="mailto:hello@athena.com" className="text-purple-600 font-bold hover:underline">hello@athena.com</a>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:-translate-y-1 transition-transform duration-300 text-center">
                <div className="w-16 h-16 mx-auto bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  📍
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Visit Us</h3>
                <p className="text-slate-600 mb-4">Come say hello at our HQ</p>
                <p className="text-slate-900 font-medium">123 Innovation Drive<br />Tech City, TC 90210</p>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:-translate-y-1 transition-transform duration-300 text-center">
                <div className="w-16 h-16 mx-auto bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  🤝
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Partner With Us</h3>
                <p className="text-slate-600 mb-4">For business and sponsorship</p>
                <a href="mailto:partners@athena.com" className="text-indigo-600 font-bold hover:underline">partners@athena.com</a>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 md:p-12">
                <h2 className="text-2xl font-bold text-slate-900 mb-8">Send us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">First Name</label>
                      <input type="text" required className="w-full rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 py-3" placeholder="Jane" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Last Name</label>
                      <input type="text" required className="w-full rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 py-3" placeholder="Doe" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                    <input type="email" required className="w-full rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 py-3" placeholder="jane@example.com" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
                    <select className="w-full rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 py-3">
                      <option>General Inquiry</option>
                      <option>Support Request</option>
                      <option>Partnership Opportunity</option>
                      <option>Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                    <textarea required rows={6} className="w-full rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500" placeholder="How can we help you?"></textarea>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full md:w-auto aura-btn aura-btn-primary px-10 py-4 text-lg flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                          Sending...
                        </>
                      ) : (
                        'Send Message'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-50">
        <div className="aura-container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-600">Quick answers to common questions about our platform.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { q: "How do I join the mentorship program?", a: "You can apply for mentorship through your dashboard once you've completed your profile." },
              { q: "Is there a cost to join?", a: "We offer both free community memberships and premium tiers with advanced features." },
              { q: "Can I contribute to the blog?", a: "Yes! We love hearing from our community. Submit your pitch through the 'Write for Us' page." },
              { q: "How can my company partner with Athena?", a: "Please reach out to our partnerships team using the form above." }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-2">{item.q}</h3>
                <p className="text-slate-600 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
