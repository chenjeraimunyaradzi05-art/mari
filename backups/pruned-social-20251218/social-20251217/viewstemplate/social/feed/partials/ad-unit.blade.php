<article class="bg-white rounded-2xl shadow-sm p-6 border border-rose-100 mb-6 relative overflow-hidden group">
    <div class="absolute top-0 right-0 bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
        SPONSORED
    </div>

    <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                <i class="fas fa-rocket"></i>
            </div>
        </div>
        <div class="flex-1">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-gray-900 text-base">Athena Premium Partners</h4>
                    <p class="text-xs text-gray-500">Recommended for your business growth</p>
                </div>
            </div>

            <p class="text-gray-600 text-sm mb-4 leading-relaxed">
                Scale your impact with our new enterprise tools. Connect with 500+ verified investors and mentors in the Athena network today.
            </p>

            @if(rand(0, 1))
                <div class="rounded-xl overflow-hidden mb-4 bg-gray-50 border border-gray-100">
                    <div class="aspect-video bg-gray-200 flex items-center justify-center text-gray-400">
                        <i class="fas fa-chart-line text-4xl"></i>
                    </div>
                    <div class="p-3">
                        <p class="text-xs font-bold text-gray-700">Q4 Growth Report Available</p>
                        <p class="text-[10px] text-gray-500">Download the full analysis</p>
                    </div>
                </div>
            @endif

            <div class="flex gap-3">
                <button type="button" class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                    Learn More
                </button>
                <button type="button" class="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors">
                    Dismiss
                </button>
            </div>
        </div>
    </div>
</article>
