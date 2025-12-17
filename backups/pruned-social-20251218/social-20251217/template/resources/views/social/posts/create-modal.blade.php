@php
    $limits = $composerLimits ?? ['maxMedia' => 5, 'maxFileSizeMb' => 12];
@endphp

<div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300"
    data-create-post-modal
    data-max-media="{{ $limits['maxMedia'] }}"
    data-max-size="{{ $limits['maxFileSizeMb'] }}"
    data-accepted-types="{{ implode(',', $limits['acceptedTypes'] ?? []) }}"
>
    <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" data-close-create-post></div>
    <div class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl transform scale-95 transition-transform duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div class="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div>
                <p class="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Share an update</p>
                <h3 class="text-xl font-bold text-gray-900">Inspire your network</h3>
            </div>
            <button type="button" class="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100" data-close-create-post aria-label="Close create post modal">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <form class="p-6" action="{{ $createPostRoute }}" method="POST" enctype="multipart/form-data" data-create-post-form>
            @csrf
            <div class="flex items-center gap-3 mb-6">
                <img src="{{ $profileAvatar }}" alt="{{ auth()->user()?->name }}" class="w-12 h-12 rounded-full object-cover border border-gray-100">
                <div>
                    <p class="font-bold text-gray-900">{{ auth()->user()?->name }}</p>
                    <span class="text-xs text-gray-500">Your story will appear in the social feed</span>
                </div>
            </div>

            <div class="mb-6">
                <label for="composer-content" class="visually-hidden">What's on your mind?</label>
                <textarea
                    id="composer-content"
                    name="content"
                    rows="5"
                    class="w-full border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 resize-none p-4 text-gray-700 placeholder-gray-400"
                    placeholder="Celebrate a milestone, share a learning, or ask for support..."
                    maxlength="5000"
                ></textarea>
                <div class="text-right text-xs text-gray-400 mt-1">Max 5,000 characters</div>
            </div>

            <div class="mb-6">
                <label class="block text-sm font-bold text-gray-700 mb-2">Add media</label>
                <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer relative group" data-media-dropzone>
                    <input type="file" name="media[]" accept="image/*,video/*" multiple class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" data-media-input>
                    <div class="pointer-events-none">
                        <div class="w-12 h-12 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <i class="fas fa-cloud-upload-alt text-xl"></i>
                        </div>
                        <p class="text-gray-900 font-medium mb-1">Drag & drop or click to upload</p>
                        <small class="text-gray-500">Up to {{ $limits['maxMedia'] }} items ({{ $limits['maxFileSizeMb'] }}MB each)</small>
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4" data-media-preview hidden></div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2" for="composer-visibility">Visibility</label>
                    <select id="composer-visibility" name="visibility" class="w-full border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500">
                        <option value="public">Public</option>
                        <option value="followers">Followers only</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2" for="composer-type">Post type</label>
                    <select id="composer-type" name="post_type" class="w-full border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500">
                        <option value="post">Regular post</option>
                        <option value="reel">Reel</option>
                        <option value="story">Story (24h)</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2" for="composer-location">Location (optional)</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i class="fas fa-map-marker-alt"></i></span>
                        <input type="text" id="composer-location" name="location" class="w-full pl-10 border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500" placeholder="Add a city or venue">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2" for="composer-tags">Tags (comma separated)</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i class="fas fa-hashtag"></i></span>
                        <input type="text" id="composer-tags" name="tags" class="w-full pl-10 border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500" placeholder="product, hiring, growth">
                    </div>
                </div>
            </div>

            <div class="mb-6">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="comments_disabled" value="1" class="rounded border-gray-300 text-rose-600 focus:ring-rose-500">
                    <span class="text-sm text-gray-700">Disable comments for this post</span>
                </label>
            </div>

            <div class="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6" data-form-errors hidden></div>

            <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                <button type="button" class="px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors" data-close-create-post>Cancel</button>
                <button type="submit" class="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 hover:scale-[1.02] transition-all flex items-center gap-2" data-submit-post>
                    <span>Create post</span>
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </form>
    </div>
</div>
