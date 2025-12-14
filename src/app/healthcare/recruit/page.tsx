'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Mail, Phone, CreditCard, ArrowRight, ShieldCheck, Dumbbell, Apple, Store, HeartPulse } from 'lucide-react';

export default function HealthcareRecruit() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div></div>}>
      <PartnerOnboardingContent />
    </Suspense>
  );
}

function PartnerOnboardingContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState(searchParams.get('plan') || 'business');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      
      {/* Left Side - Content & Testimonials */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-16 text-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        <div className="absolute top-0 right-0 w-full h-full bg-linear-to-b from-rose-900/20 to-slate-900/90" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm mb-8">
            <HeartPulse className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-medium text-rose-100">Trusted Wellness Partner</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Grow Your <span className="text-rose-400">Health & Fitness</span> Business.
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed max-w-lg">
            Connect with thousands of clients looking for gyms, personal trainers, nutritionists, and wellness products.
          </p>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-3xl border border-slate-700">
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((_, i) => (
                <div key={i} className="w-5 h-5 text-amber-400 fill-amber-400">★</div>
              ))}
            </div>
            <p className="text-lg italic text-slate-200 mb-6">
              &quot;Since listing our gym on WellnessHub, our membership inquiries have doubled. The quality of leads is fantastic.&quot;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center font-bold text-xl">
                S
              </div>
              <div>
                <div className="font-bold">Sarah Jenkins</div>
                <div className="text-sm text-slate-400">Owner, Elite Fitness</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 p-8 lg:p-16 overflow-y-auto">
        <div className="max-w-md mx-auto">
          
          {/* Progress Steps */}
          <div className="flex items-center gap-4 mb-12">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= 1 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
            <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-rose-600' : 'bg-slate-100'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= 2 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
            <div className={`flex-1 h-1 rounded-full ${step >= 3 ? 'bg-rose-600' : 'bg-slate-100'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= 3 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</div>
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Partner Account</h2>
                <p className="text-slate-500">Start growing your business today.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Business Name</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="e.g. Elite Fitness Studio" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">First Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="John" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Last Name</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="Smith" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Business Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="email" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="contact@business.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="tel" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="0400 000 000" />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-900/10 transition-all flex items-center justify-center gap-2 group"
              >
                Continue <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Select Your Plan</h2>
                <p className="text-slate-500">Choose the right package for your business.</p>
              </div>

              <div className="space-y-4">
                {/* Plan Options */}
                <div 
                  onClick={() => setPlan('professional')}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${plan === 'professional' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 hover:border-rose-200'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Dumbbell className="w-5 h-5 text-rose-500" />
                      Professional
                    </h3>
                    <span className="font-bold text-slate-900">$29<span className="text-slate-500 text-sm font-normal">/mo</span></span>
                  </div>
                  <p className="text-sm text-slate-500">For individual trainers & nutritionists. Basic listing & booking.</p>
                </div>

                <div 
                  onClick={() => setPlan('business')}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all relative ${plan === 'business' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 hover:border-rose-200'}`}
                >
                  <div className="absolute -top-3 right-4 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                    Most Popular
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-5 h-5 text-rose-500" />
                      Business
                    </h3>
                    <span className="font-bold text-slate-900">$99<span className="text-slate-500 text-sm font-normal">/mo</span></span>
                  </div>
                  <p className="text-sm text-slate-500">For gyms & studios. Featured listing, analytics & priority support.</p>
                </div>

                <div 
                  onClick={() => setPlan('brand')}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${plan === 'brand' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 hover:border-rose-200'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Apple className="w-5 h-5 text-rose-500" />
                      Brand Partner
                    </h3>
                    <span className="font-bold text-slate-900">Custom</span>
                  </div>
                  <p className="text-sm text-slate-500">For product brands & large networks. National reach & API access.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-900/10 transition-all flex items-center justify-center gap-2 group"
                >
                  Continue to Payment <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Payment Details</h2>
                <p className="text-slate-500">Secure checkout powered by Stripe.</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                  <span className="text-slate-600">Selected Plan</span>
                  <span className="font-bold text-slate-900 capitalize">{plan}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-900 font-bold text-lg">Total</span>
                  <span className="text-rose-600 font-bold text-2xl">
                    {plan === 'professional' ? '$29.00' : plan === 'business' ? '$99.00' : 'Contact Sales'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Card Information</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="0000 0000 0000 0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Expiry</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="MM/YY" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">CVC</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" placeholder="123" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(2)}
                  className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                >
                  Back
                </button>
                <button 
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-900/10 transition-all flex items-center justify-center gap-2"
                >
                  Complete Order
                </button>
              </div>
              
              <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Payments are secure and encrypted.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
