<footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ config('app.platform.name', 'Athena') }}</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                    {{ config('app.platform.tagline', 'Empowering women across every dimension of life.') }}
                </p>
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-500">
                    {{ config('app.platform.acknowledgement', 'Crafted with dignity, respect, and love for every member.') }}
                </p>
                <div class="flex space-x-4 mt-4">
                    <a href="#" class="text-gray-400 hover:text-gray-500">
                        <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                    <a href="#" class="text-gray-400 hover:text-gray-500">
                        <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg>
                    </a>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ __('Quick Links') }}</h3>
                <ul class="space-y-2 text-sm">
                    <li><a href="{{ \Illuminate\Support\Facades\Route::has('jobs.index') ? route('jobs.index') : url('/opportunities') }}" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Browse Opportunities') }}</a></li>
                    <li><a href="{{ \Illuminate\Support\Facades\Route::has('companies.index') ? route('companies.index') : url('/companies') }}" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Company Reviews') }}</a></li>
                    <li><a href="{{ \Illuminate\Support\Facades\Route::has('salaries.index') ? route('salaries.index') : url('/salaries') }}" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Salary Insights') }}</a></li>
                    <li><a href="{{ \Illuminate\Support\Facades\Route::has('career-coach.resume') ? route('career-coach.resume') : url('/career-coach') }}" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Career Coach') }}</a></li>
                    <li><a href="{{ \Illuminate\Support\Facades\Route::has('mastermind.index') ? route('mastermind.index') : url('/mastermind') }}" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Mastermind Groups') }}</a></li>
                </ul>
            </div>

            <div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ __('Resources') }}</h3>
                <ul class="space-y-2 text-sm">
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Career Guides') }}</a></li>
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Resume Templates') }}</a></li>
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Interview Tips') }}</a></li>
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Wellness Resources') }}</a></li>
                    <li><a href="{{ route('grants.index') }}" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Grant Navigator') }}</a></li>
                </ul>
            </div>

            <div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ __('Legal') }}</h3>
                <ul class="space-y-2 text-sm">
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Privacy Policy') }}</a></li>
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Terms of Service') }}</a></li>
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Cookie Policy') }}</a></li>
                    <li><a href="#" class="text-gray-600 dark:text-gray-400 hover:text-teal-600">{{ __('Contact Us') }}</a></li>
                </ul>
            </div>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">
                © {{ date('Y') }} {{ config('app.platform.name', 'Athena') }} · {{ __('Crafted by') }} {{ config('app.platform.developer', 'Munyaradzi Chenjerai') }}
            </p>
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {{ __('With respect for every identity, culture, and pathway to success.') }}
            </p>
        </div>
    </div>
</footer>
