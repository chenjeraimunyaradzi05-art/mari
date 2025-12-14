@extends('frontend.layouts.master')

@section('page_title', 'Learning discovery')

@push('styles')
<style>
    .dashboard-gradient-text {
        background: linear-gradient(135deg, #be185d 0%, #db2777 50%, #e11d48 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    .perspective-container {
        perspective: 1000px;
    }
    .tab-content {
        display: none;
        animation: fadeIn 0.5s ease-out;
    }
    .tab-content.active {
        display: block;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
    .animate-float {
        animation: float 3s ease-in-out infinite;
    }
</style>
@endpush

@section('content')
    <div class="min-h-screen bg-rose-50 py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <!-- Header Section -->
            <div class="text-center mb-16 relative">
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
                <span class="inline-block py-1 px-3 rounded-full bg-pink-100 text-pink-600 text-xs font-bold uppercase tracking-wider mb-4 border border-pink-200">Education & Pathways</span>
                <h1 class="text-5xl md:text-6xl font-extrabold text-rose-950 tracking-tight mb-6">
                    Discover Your <span class="dashboard-gradient-text">Future</span>
                </h1>
                <p class="text-xl text-rose-950 max-w-2xl mx-auto leading-relaxed font-medium">
                    Explore curated opportunities across universities, trades, and apprenticeships designed to accelerate your career.
                </p>
            </div>

            <!-- Navigation Tabs -->
            <div class="flex flex-wrap justify-center gap-4 mb-12">
                <button onclick="switchTab('university')" id="tab-university" class="tab-btn active px-6 py-3 rounded-full border-2 border-transparent bg-white text-rose-700 font-bold shadow-sm hover:bg-pink-50 transition-all duration-300 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                    University
                </button>
                <button onclick="switchTab('trades')" id="tab-trades" class="tab-btn px-6 py-3 rounded-full border-2 border-transparent bg-white text-rose-700 font-bold shadow-sm hover:bg-pink-50 transition-all duration-300 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
                    Trades
                </button>
                <button onclick="switchTab('apprenticeships')" id="tab-apprenticeships" class="tab-btn px-6 py-3 rounded-full border-2 border-transparent bg-white text-rose-700 font-bold shadow-sm hover:bg-pink-50 transition-all duration-300 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Apprenticeships
                </button>
                <button onclick="switchTab('internships')" id="tab-internships" class="tab-btn px-6 py-3 rounded-full border-2 border-transparent bg-white text-rose-700 font-bold shadow-sm hover:bg-pink-50 transition-all duration-300 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Internships
                </button>
            </div>

            <!-- University Dashboard -->
            <div id="content-university" class="tab-content active">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Stats Column -->
                    <div class="space-y-6">
                        <div class="bg-white p-6 rounded-3xl shadow-sm border border-rose-100">
                            <h3 class="text-lg font-bold text-rose-950 mb-4">Academic Overview</h3>
                            <div class="space-y-4">
                                <div class="flex items-center justify-between p-4 bg-rose-50 rounded-2xl">
                                    <span class="text-sm font-bold text-rose-800">Universities</span>
                                    <span class="text-2xl font-bold text-rose-950">42</span>
                                </div>
                                <div class="flex items-center justify-between p-4 bg-rose-50 rounded-2xl">
                                    <span class="text-sm font-bold text-rose-800">Scholarships</span>
                                    <span class="text-2xl font-bold text-rose-950">$2.4M</span>
                                </div>
                                <div class="flex items-center justify-between p-4 bg-rose-50 rounded-2xl">
                                    <span class="text-sm font-bold text-rose-800">Courses</span>
                                    <span class="text-2xl font-bold text-rose-950">1,250+</span>
                                </div>
                            </div>
                        </div>

                        <div class="bg-linear-to-br from-pink-700 to-rose-800 p-6 rounded-3xl shadow-lg text-white relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <h3 class="text-xl font-bold mb-2 relative z-10">Need Guidance?</h3>
                            <p class="text-white mb-6 text-sm relative z-10 font-medium">Book a session with a university career counselor today.</p>
                            <button class="w-full py-3 bg-white text-pink-700 font-bold rounded-xl hover:bg-pink-50 transition-colors relative z-10">Find a Mentor</button>
                        </div>
                    </div>

                    <!-- Main Content -->
                    <div class="lg:col-span-2 space-y-8">
                        <!-- Featured Universities -->
                        <section>
                            <h2 class="text-2xl font-bold text-rose-950 mb-6">Featured Universities</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <!-- Uni Card 1 -->
                                <div class="group perspective-container">
                                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 hover:shadow-xl hover:border-pink-300 transition-all duration-300 h-full relative overflow-hidden">
                                        <div class="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-pink-500 to-rose-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                        <div class="flex items-start justify-between mb-4">
                                            <div class="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-2xl">🏛️</div>
                                            <span class="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Top Rated</span>
                                        </div>
                                        <h3 class="text-xl font-bold text-rose-950 mb-2">Global Tech University</h3>
                                        <p class="text-rose-600 text-sm mb-4">Leading the way in AI and Robotics research with state-of-the-art facilities.</p>
                                        <a href="#" class="text-pink-600 font-bold text-sm hover:text-pink-800 flex items-center gap-1">View Courses <span aria-hidden="true">&rarr;</span></a>
                                    </div>
                                </div>
                                <!-- Uni Card 2 -->
                                <div class="group perspective-container">
                                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 hover:shadow-xl hover:border-pink-300 transition-all duration-300 h-full relative overflow-hidden">
                                        <div class="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                        <div class="flex items-start justify-between mb-4">
                                            <div class="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-2xl">🎨</div>
                                            <span class="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">Creative</span>
                                        </div>
                                        <h3 class="text-xl font-bold text-rose-950 mb-2">Institute of Design</h3>
                                        <p class="text-rose-600 text-sm mb-4">Where creativity meets technology. Explore our new digital arts program.</p>
                                        <a href="#" class="text-pink-600 font-bold text-sm hover:text-pink-800 flex items-center gap-1">View Courses <span aria-hidden="true">&rarr;</span></a>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <!-- Quick Actions -->
                        <section>
                            <h2 class="text-2xl font-bold text-rose-950 mb-6">Quick Actions</h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <a href="#" class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 hover:border-pink-300 hover:shadow-md transition-all text-center group">
                                    <div class="w-10 h-10 mx-auto bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-3 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <span class="text-xs font-bold text-rose-900">Search Courses</span>
                                </a>
                                <a href="#" class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 hover:border-pink-300 hover:shadow-md transition-all text-center group">
                                    <div class="w-10 h-10 mx-auto bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-3 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <span class="text-xs font-bold text-rose-900">Deadlines</span>
                                </a>
                                <a href="#" class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 hover:border-pink-300 hover:shadow-md transition-all text-center group">
                                    <div class="w-10 h-10 mx-auto bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-3 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <span class="text-xs font-bold text-rose-900">Applications</span>
                                </a>
                                <a href="#" class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 hover:border-pink-300 hover:shadow-md transition-all text-center group">
                                    <div class="w-10 h-10 mx-auto bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-3 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                                    </div>
                                    <span class="text-xs font-bold text-rose-900">News</span>
                                </a>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <!-- Trades Dashboard -->
            <div id="content-trades" class="tab-content">
                <div class="bg-white rounded-3xl shadow-xl border border-rose-100 p-8 text-center">
                    <div class="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl animate-float">🛠️</div>
                    <h2 class="text-3xl font-bold text-rose-950 mb-4">Master a Trade</h2>
                    <p class="text-rose-700 max-w-2xl mx-auto mb-8">
                        Connect with industry leaders and find hands-on training programs. From carpentry to electrical engineering, build your future with practical skills.
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="p-6 bg-orange-50 rounded-2xl border border-orange-100">
                            <h3 class="font-bold text-orange-900 mb-2">Construction</h3>
                            <p class="text-sm text-orange-700">High demand for skilled builders.</p>
                        </div>
                        <div class="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                            <h3 class="font-bold text-blue-900 mb-2">Electrical</h3>
                            <p class="text-sm text-blue-700">Power the future with specialized training.</p>
                        </div>
                        <div class="p-6 bg-green-50 rounded-2xl border border-green-100">
                            <h3 class="font-bold text-green-900 mb-2">Plumbing</h3>
                            <p class="text-sm text-green-700">Essential services with great stability.</p>
                        </div>
                    </div>
                    <a href="{{ auth()->check() ? route('education.tafe.dashboard') : route('login') }}" class="inline-flex items-center px-8 py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg hover:shadow-rose-300/50">
                        Explore TAFE Dashboard
                    </a>
                </div>
            </div>

            <!-- Apprenticeships Dashboard -->
            <div id="content-apprenticeships" class="tab-content">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="bg-white p-8 rounded-3xl shadow-sm border border-rose-100">
                        <h2 class="text-2xl font-bold text-rose-950 mb-4">Earn While You Learn</h2>
                        <p class="text-rose-700 mb-6">Apprenticeships combine practical training in a job with study. As an apprentice, you'll:</p>
                        <ul class="space-y-3 mb-8">
                            <li class="flex items-center text-rose-800">
                                <svg class="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                Work alongside experienced staff
                            </li>
                            <li class="flex items-center text-rose-800">
                                <svg class="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                Gain job-specific skills
                            </li>
                            <li class="flex items-center text-rose-800">
                                <svg class="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                Earn a wage and get holiday pay
                            </li>
                        </ul>
                        <button class="w-full py-3 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition-colors">Find an Apprenticeship</button>
                    </div>
                    <div class="bg-linear-to-br from-rose-500 to-pink-600 rounded-3xl p-8 text-white flex flex-col justify-center items-center text-center">
                        <div class="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm">
                            <span class="text-4xl">🚀</span>
                        </div>
                        <h3 class="text-2xl font-bold mb-2">Featured Opportunity</h3>
                        <p class="text-pink-100 mb-6">Digital Marketing Apprentice at TechStart Inc.</p>
                        <a href="#" class="px-6 py-2 bg-white text-rose-600 font-bold rounded-lg hover:bg-pink-50 transition-colors">Apply Now</a>
                    </div>
                </div>
            </div>

            <!-- Internships Dashboard -->
            <div id="content-internships" class="tab-content">
                <div class="bg-white rounded-3xl shadow-xl border border-rose-100 overflow-hidden">
                    <div class="p-8 border-b border-rose-100">
                        <div class="flex justify-between items-center">
                            <h2 class="text-2xl font-bold text-rose-950">Latest Internships</h2>
                            <a href="#" class="text-pink-600 font-bold text-sm hover:text-pink-800">View All</a>
                        </div>
                    </div>
                    <div class="divide-y divide-rose-50">
                        <!-- Internship Item -->
                        <div class="p-6 hover:bg-rose-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">G</div>
                                <div>
                                    <h3 class="font-bold text-rose-950">Software Engineering Intern</h3>
                                    <p class="text-sm text-rose-600">Google • Sydney, AU</p>
                                </div>
                            </div>
                            <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full self-start md:self-center">Paid</span>
                        </div>
                        <!-- Internship Item -->
                        <div class="p-6 hover:bg-rose-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold">C</div>
                                <div>
                                    <h3 class="font-bold text-rose-950">Graphic Design Intern</h3>
                                    <p class="text-sm text-rose-600">Canva • Remote</p>
                                </div>
                            </div>
                            <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full self-start md:self-center">Paid</span>
                        </div>
                        <!-- Internship Item -->
                        <div class="p-6 hover:bg-rose-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600 font-bold">A</div>
                                <div>
                                    <h3 class="font-bold text-rose-950">Marketing Assistant</h3>
                                    <p class="text-sm text-rose-600">Atlassian • Sydney, AU</p>
                                </div>
                            </div>
                            <span class="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full self-start md:self-center">Unpaid</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>

@endsection

@push('scripts')
    <script>
        function switchTab(tabName) {
            // Hide all content
            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.remove('active');
            });

            // Deactivate all buttons
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('active');
                el.classList.remove('bg-pink-100');
                el.classList.remove('text-pink-700');
                el.classList.remove('border-pink-200');
                // Reset to default
                el.classList.add('bg-white');
                el.classList.add('text-rose-600');
                el.classList.add('border-transparent');
            });

            // Show selected content
            document.getElementById('content-' + tabName).classList.add('active');

            // Activate button
            const btn = document.getElementById('tab-' + tabName);
            btn.classList.add('active');
            btn.classList.remove('bg-white');
            btn.classList.remove('text-rose-600');
            btn.classList.remove('border-transparent');
        }
    </script>
@endpush
