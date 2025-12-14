'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Stethoscope, Heart, Activity, UserPlus, ShieldCheck, MapPin, Clock, Star, Dumbbell, Apple, Brain, ShoppingBag, Calendar, Store } from 'lucide-react';

export default function HealthcarePage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* Hero Section */}
      <div className="relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-rose-900/20 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Activity className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-medium text-rose-100">Holistic Health & Wellness</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-8 max-w-4xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Empowering Your <span className="text-rose-500">Health & Fitness</span> Journey.
          </h1>
          
          <p className="text-xl text-slate-300 mb-12 max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            From yoga classes and gym memberships to nutrition plans and wellness products. Discover services tailored for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
            {/* Card 1: Find Services */}
            <div className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-all group cursor-pointer">
              <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-rose-900/20">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Find Services</h3>
              <p className="text-slate-400 mb-6 min-h-12">
                Discover gyms, yoga studios, nutritionists, and wellness coaches near you.
              </p>
              <ul className="space-y-3 mb-8">
                {['Gyms & Studios', 'Personal Trainers', 'Wellness Classes'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/healthcare/search" className="inline-flex items-center gap-2 text-rose-400 font-bold hover:gap-3 transition-all">
                Explore Now <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Card 2: Shop Wellness */}
            <div className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-all group cursor-pointer">
              <div className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Shop Wellness</h3>
              <p className="text-slate-400 mb-6 min-h-12">
                Curated fitness equipment, supplements, and healthy meal plans.
              </p>
              <ul className="space-y-3 mb-8">
                {['Female Health Focus', 'Verified Suppliers', 'Exclusive Deals'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/healthcare/search?type=products" className="inline-flex items-center gap-2 text-rose-400 font-bold hover:gap-3 transition-all">
                Shop Now <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Card 3: List Business */}
            <div className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-all group cursor-pointer">
              <div className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">List Business</h3>
              <p className="text-slate-400 mb-6 min-h-12">
                Grow your fitness business or professional practice with us.
              </p>
              <ul className="space-y-3 mb-8">
                {['Reach New Clients', 'Manage Bookings', 'Brand Partnerships'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/healthcare/recruit" className="inline-flex items-center gap-2 text-rose-400 font-bold hover:gap-3 transition-all">
                Join as Partner <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Categories */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Explore Categories</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Everything you need for a balanced, healthy lifestyle.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Fitness & Gyms', icon: Dumbbell, count: '120+ Locations' },
            { name: 'Nutrition & Food', icon: Apple, count: '85+ Providers' },
            { name: 'Mindfulness', icon: Brain, count: '64+ Classes' },
            { name: 'Products', icon: ShoppingBag, count: '200+ Items' },
          ].map((cat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-rose-200 transition-all cursor-pointer group text-center">
              <div className="w-12 h-12 mx-auto bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 mb-4 group-hover:scale-110 transition-transform">
                <cat.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{cat.name}</h3>
              <p className="text-xs text-slate-500 font-medium">{cat.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing / Membership Plans */}
      <div className="bg-slate-900 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Partner Pricing</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Flexible plans for professionals, businesses, and brands.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {/* Professional */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700 hover:border-rose-500/50 transition-all flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Professional</h3>
                <p className="text-slate-400 text-sm">For coaches, nutritionists & chefs.</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">$29</span>
                <span className="text-rose-200/70">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Professional Profile
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Booking Management
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Client Messaging
                </li>
              </ul>
              <Link href="/healthcare/recruit?plan=professional" className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-600 transition-all text-center block mt-auto">
                Get Started
              </Link>
            </div>

            {/* Business (Gyms) */}
            <div className="bg-rose-600 rounded-3xl p-8 border border-rose-500 shadow-2xl shadow-rose-900/50 flex flex-col relative">
              <div className="absolute top-0 right-0 bg-white text-rose-600 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl uppercase tracking-wide">
                Most Popular
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Business</h3>
                <p className="text-rose-100 text-sm">For gyms, studios & clinics.</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">$99</span>
                <span className="text-rose-200/70">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-200 shrink-0" />
                  Class Scheduling
                </li>
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-200 shrink-0" />
                  Membership Leads
                </li>
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-200 shrink-0" />
                  Featured Listing
                </li>
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-200 shrink-0" />
                  Analytics Dashboard
                </li>
              </ul>
              <Link href="/healthcare/recruit?plan=business" className="w-full py-3 rounded-xl bg-white text-rose-600 font-bold hover:bg-rose-50 transition-all shadow-lg shadow-rose-900/20 text-center block mt-auto">
                Start Free Trial
              </Link>
            </div>

            {/* Brand Partner */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700 hover:border-rose-500/50 transition-all flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Brand Partner</h3>
                <p className="text-slate-400 text-sm">For product suppliers & brands.</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Marketplace Storefront
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Promotional Campaigns
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Affiliate Network Access
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  Lite & Easy Partnership
                </li>
              </ul>
              <Link href="/healthcare/recruit?plan=brand" className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-600 transition-all text-center block mt-auto">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
