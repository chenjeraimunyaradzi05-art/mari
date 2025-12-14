<template>
    <div class="entertainment-dashboard bg-gray-50 min-h-screen">
        <!-- Navigation Tabs -->
        <div class="bg-white shadow sticky top-0 z-30">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex space-x-8">
                        <button
                            @click="activeTab = 'cinema'"
                            :class="[activeTab === 'cinema' ? 'border-indigo-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', 'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium']"
                        >
                            Cinema
                        </button>
                        <button
                            @click="activeTab = 'pulse'"
                            :class="[activeTab === 'pulse' ? 'border-pink-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', 'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium']"
                        >
                            Pulse (Shorts)
                        </button>
                    </div>
                    <div class="flex items-center">
                        <button @click="showUploadModal = true" class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                            Upload Content
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Cinema View (Netflix Style) -->
        <div v-if="activeTab === 'cinema'" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Featured / Trending -->
            <div v-if="trending.length > 0" class="mb-12">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">Trending Now</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div v-for="item in trending" :key="item.id" class="group relative bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow" @click="playVideo(item)">
                        <div class="aspect-w-16 aspect-h-9 bg-gray-200">
                            <img :src="item.thumbnail_url || '/images/default-video-thumb.jpg'" class="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200" alt="">
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                                <svg class="w-12 h-12 text-white opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                        </div>
                        <div class="p-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full uppercase">{{ item.type }}</span>
                                <span class="text-xs text-gray-500">{{ formatDuration(item.duration) }}</span>
                            </div>
                            <h3 class="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{{ item.title }}</h3>
                            <p class="text-sm text-gray-600 line-clamp-2">{{ item.description }}</p>
                            <div class="mt-4 flex items-center text-sm text-gray-500">
                                <span class="flex items-center"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> {{ formatNumber(item.views) }}</span>
                                <span class="mx-2">•</span>
                                <span>{{ item.creator.name }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Categories -->
            <div v-for="category in categories" :key="category.key" class="mb-12">
                <div class="flex justify-between items-end mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">{{ category.name }}</h2>
                    <a href="#" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View All</a>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div v-for="item in category.items" :key="item.id" class="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow cursor-pointer" @click="playVideo(item)">
                        <div class="aspect-w-16 aspect-h-9 bg-gray-200">
                            <img :src="item.thumbnail_url || '/images/default-video-thumb.jpg'" class="object-cover w-full h-full" alt="">
                        </div>
                        <div class="p-3">
                            <h3 class="text-md font-semibold text-gray-900 line-clamp-1">{{ item.title }}</h3>
                            <p class="text-xs text-gray-500 mt-1">{{ item.creator.name }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pulse View (TikTok Style) -->
        <div v-if="activeTab === 'pulse'" class="bg-black min-h-[calc(100vh-4rem)] flex justify-center py-8">
            <div class="w-full max-w-md space-y-8">
                <div v-for="video in pulseFeed" :key="video.id" class="relative bg-gray-900 rounded-xl overflow-hidden aspect-[9/16] shadow-2xl group">
                    <!-- Video Player -->
                    <div class="absolute inset-0 flex items-center justify-center bg-gray-800 cursor-pointer" @click="togglePlay($event)">
                        <video
                            v-if="video.video_url"
                            :src="video.video_url"
                            :poster="video.thumbnail_url"
                            class="absolute inset-0 w-full h-full object-cover"
                            loop
                            muted
                            playsinline
                            ref="pulseVideos"
                        ></video>
                        <img v-else :src="video.thumbnail_url" class="absolute inset-0 w-full h-full object-cover opacity-50" alt="">

                        <!-- Play Icon Overlay (hidden when playing) -->
                        <div class="z-10 w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-opacity-30 transition pointer-events-none play-icon">
                            <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>

                    <!-- Overlay Info -->
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-20 pointer-events-none">
                        <div class="flex items-center mb-3 pointer-events-auto">
                            <img :src="video.creator.avatar || '/images/default-avatar.png'" class="w-10 h-10 rounded-full border-2 border-white mr-3">
                            <span class="text-white font-bold text-sm">@{{ video.creator.name }}</span>
                            <button
                                @click.stop="toggleFollow(video.creator)"
                                :class="[video.creator.is_following ? 'bg-gray-600' : 'bg-pink-600', 'ml-auto text-white text-xs px-3 py-1 rounded-full font-medium transition-colors']"
                            >
                                {{ video.creator.is_following ? 'Following' : 'Follow' }}
                            </button>
                        </div>
                        <p class="text-white text-sm mb-2">{{ video.title }}</p>
                        <div class="flex items-center text-gray-300 text-xs mb-4">
                            <svg class="w-3 h-3 mr-1 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                            {{ video.details?.music_track || 'Original Sound' }}
                        </div>
                    </div>

                    <!-- Side Actions -->
                    <div class="absolute bottom-20 right-2 flex flex-col items-center space-y-4 pointer-events-auto">
                        <button @click.stop="toggleLike(video)" class="flex flex-col items-center text-white group">
                            <div class="w-10 h-10 bg-gray-800/50 rounded-full flex items-center justify-center mb-1 backdrop-blur-sm transition-transform group-active:scale-90">
                                <svg :class="[video.is_liked ? 'text-pink-500' : 'text-white', 'w-6 h-6 transition-colors']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            </div>
                            <span class="text-xs font-medium">{{ formatNumber(video.likes) }}</span>
                        </button>
                        <button class="flex flex-col items-center text-white">
                            <div class="w-10 h-10 bg-gray-800/50 rounded-full flex items-center justify-center mb-1 backdrop-blur-sm">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
                            </div>
                            <span class="text-xs font-medium">Comment</span>
                        </button>
                        <button class="flex flex-col items-center text-white">
                            <div class="w-10 h-10 bg-gray-800/50 rounded-full flex items-center justify-center mb-1 backdrop-blur-sm">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                            </div>
                            <span class="text-xs font-medium">Share</span>
                        </button>
                    </div>
                </div>

                <!-- Load More Trigger -->
                <div class="text-center py-4">
                    <button @click="loadMorePulse" class="text-white text-sm bg-gray-800 px-4 py-2 rounded-full hover:bg-gray-700">Load More</button>
                </div>
            </div>
        </div>

        <!-- Video Player Modal (Cinema Mode) -->
        <div v-if="selectedVideo" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95" @click.self="closeVideo">
            <div class="relative w-full max-w-6xl aspect-video bg-black shadow-2xl rounded-lg overflow-hidden">
                <button @click="closeVideo" class="absolute top-4 right-4 z-10 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <video
                    :src="selectedVideo.video_url"
                    controls
                    autoplay
                    class="w-full h-full"
                ></video>
                <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent pointer-events-none">
                    <h2 class="text-2xl font-bold text-white mb-2">{{ selectedVideo.title }}</h2>
                    <p class="text-gray-300 line-clamp-2 max-w-3xl">{{ selectedVideo.description }}</p>
                </div>
            </div>
        </div>

        <!-- Upload Modal (Simplified) -->
        <div v-if="showUploadModal" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="showUploadModal = false"></div>
                <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">Upload Content</h3>
                        <div class="mt-4 space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Type</label>
                                <select v-model="uploadForm.type" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                    <option value="short_video">Short Video (Pulse)</option>
                                    <option value="movie">Movie</option>
                                    <option value="documentary">Documentary</option>
                                    <option value="educational">Educational</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Title / Caption</label>
                                <input type="text" v-model="uploadForm.title" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Description</label>
                                <textarea v-model="uploadForm.description" rows="3" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"></textarea>
                            </div>
                            <!-- Media upload would go here -->
                            <div class="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                                <p class="text-sm text-gray-500">Drag and drop video file here</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm" @click="submitUpload">
                            Upload
                        </button>
                        <button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" @click="showUploadModal = false">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    props: {
        user: {
            type: Object,
            required: false,
            default: () => ({})
        }
    },
    data() {
        return {
            activeTab: 'cinema', // 'cinema' or 'pulse'
            trending: [],
            categories: [
                { key: 'movie', name: 'Movies', items: [] },
                { key: 'documentary', name: 'Documentaries', items: [] },
                { key: 'educational', name: 'Learn & Grow', items: [] },
                { key: 'success_story', name: 'Success Stories', items: [] },
            ],
            pulseFeed: [],
            pulseExcludeIds: [],
            showUploadModal: false,
            selectedVideo: null, // For Cinema player
            uploadForm: {
                type: 'short_video',
                title: '',
                description: '',
            }
        }
    },
    mounted() {
        this.fetchDashboard();
        this.fetchPulseFeed();
    },
    methods: {
        async fetchDashboard() {
            try {
                const response = await axios.get('/api/v1/entertainment/dashboard');
                this.trending = response.data.data;

                // Fetch categories
                this.categories.forEach(cat => this.fetchCategory(cat.key));
            } catch (error) {
                console.error('Error fetching dashboard:', error);
            }
        },
        async fetchCategory(category) {
            try {
                const response = await axios.get(`/api/v1/entertainment/browse?category=${category}&per_page=4`);
                const catIndex = this.categories.findIndex(c => c.key === category);
                if (catIndex !== -1) {
                    this.categories[catIndex].items = response.data.data;
                }
            } catch (error) {
                console.error(`Error fetching ${category}:`, error);
            }
        },
        async fetchPulseFeed() {
            try {
                const params = new URLSearchParams();
                this.pulseExcludeIds.forEach(id => params.append('exclude_ids[]', id));

                const response = await axios.get('/api/v1/entertainment/feed', { params });
                const newItems = response.data.data;

                this.pulseFeed = [...this.pulseFeed, ...newItems];
                this.pulseExcludeIds = [...this.pulseExcludeIds, ...newItems.map(i => i.id)];
            } catch (error) {
                console.error('Error fetching pulse feed:', error);
            }
        },
        loadMorePulse() {
            this.fetchPulseFeed();
        },
        playVideo(item) {
            this.selectedVideo = item;
        },
        closeVideo() {
            this.selectedVideo = null;
        },
        togglePlay(event) {
            const videoEl = event.currentTarget.querySelector('video');
            const iconEl = event.currentTarget.querySelector('.play-icon');

            if (videoEl) {
                if (videoEl.paused) {
                    videoEl.play();
                    iconEl.style.opacity = '0';
                } else {
                    videoEl.pause();
                    iconEl.style.opacity = '1';
                }
            }
        },
        async toggleLike(video) {
            try {
                // Optimistic update
                const wasLiked = video.is_liked;
                video.is_liked = !wasLiked;
                video.likes = wasLiked ? video.likes - 1 : video.likes + 1;

                const response = await axios.post(`/api/v1/entertainment/${video.id}/like`);

                // Sync with server response
                video.is_liked = response.data.liked;
                video.likes = response.data.likes_count;
            } catch (error) {
                console.error('Error liking video:', error);
                // Revert on error
                video.is_liked = !video.is_liked;
                video.likes = video.is_liked ? video.likes + 1 : video.likes - 1;
            }
        },
        async toggleFollow(creator) {
            try {
                // Optimistic update
                const wasFollowing = creator.is_following;
                creator.is_following = !wasFollowing;

                const response = await axios.post(`/api/v1/entertainment/profiles/${creator.id}/follow`);

                // Sync
                creator.is_following = response.data.following;
            } catch (error) {
                console.error('Error following creator:', error);
                creator.is_following = !creator.is_following;
            }
        },
        formatNumber(num) {
            if (!num) return '0';
            if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num > 1000) return (num / 1000).toFixed(1) + 'K';
            return num;
        },
        formatDuration(seconds) {
            if (!seconds) return '';
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        },
        async submitUpload() {
            // Mock upload logic
            console.log('Uploading:', this.uploadForm);
            this.showUploadModal = false;
            alert('Content uploaded successfully! (Mock)');
        }
    }
}
</script>

<style scoped>
.animate-spin-slow {
    animation: spin 3s linear infinite;
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
</style>
