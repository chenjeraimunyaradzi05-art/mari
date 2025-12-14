<div class="mb-8">
    <div class="flex items-center justify-between mb-4 px-2">
        <div>
            <h2 class="text-lg font-bold text-gray-900">Shorts & Reels</h2>
            <p class="text-xs text-gray-500">Quick bites of inspiration and fun.</p>
        </div>
        <a href="#" class="text-xs font-bold text-rose-600 hover:text-rose-700">View all</a>
    </div>

    <div class="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide">
        @foreach($videos as $video)
            <div class="min-w-[160px] w-[160px] h-[280px] bg-gray-900 rounded-xl relative overflow-hidden snap-center shadow-md group cursor-pointer">
                @php
                    $media = $video->media->first();
                    $thumbnail = $media ? ($media->thumbnail_url ?? $media->url) : null;
                @endphp

                @if($thumbnail)
                    <img src="{{ $thumbnail }}" alt="{{ $video->caption }}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                @else
                    <div class="w-full h-full bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-play text-white/50 text-2xl"></i>
                    </div>
                @endif

                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80"></div>

                <div class="absolute bottom-0 left-0 right-0 p-3">
                    <div class="flex items-center gap-2 mb-2">
                        <img src="{{ $video->profile->avatar_url ?? asset('images/default-avatar.png') }}" class="w-6 h-6 rounded-full border border-white/50">
                        <span class="text-xs font-bold text-white truncate">{{ $video->profile->username ?? 'User' }}</span>
                    </div>
                    <p class="text-white text-xs line-clamp-2 mb-2">{{ $video->caption }}</p>
                    <div class="flex items-center gap-3 text-white/80 text-[10px]">
                        <span class="flex items-center gap-1"><i class="fas fa-play"></i> {{ number_format($video->views_count ?? 0) }}</span>
                        <span class="flex items-center gap-1"><i class="fas fa-heart"></i> {{ number_format($video->likes_count ?? 0) }}</span>
                    </div>
                </div>

                <div class="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-[10px] font-bold text-white backdrop-blur-sm">
                    Short
                </div>
            </div>
        @endforeach

        <!-- View More Card -->
        <div class="min-w-[160px] w-[160px] h-[280px] bg-gray-100 rounded-xl flex flex-col items-center justify-center snap-center border-2 border-dashed border-gray-300 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer group">
            <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <i class="fas fa-arrow-right text-rose-500"></i>
            </div>
            <span class="text-sm font-bold text-gray-600 group-hover:text-rose-600">Explore More</span>
        </div>
    </div>
</div>
