@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Social Feed Info Custom Styles */
    .feed-hero {
        background: linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #ffe4e6 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .feed-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        left: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(251, 113, 133, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #ffe4e6;
        border: 1px solid #fb7185;
        border-radius: 100px;
        color: #be123c;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(190, 18, 60, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #e11d48, #be123c);
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

    .info-card {
        display: flex;
        align-items: flex-start;
        gap: 20px;
        background: white;
        padding: 30px;
        border-radius: 20px;
        border: 1px solid #f1f5f9;
        margin-bottom: 30px;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .info-card:hover {
        box-shadow: 0 10px 30px rgba(225, 29, 72, 0.08);
        transform: translateX(5px);
        border-color: #fda4af;
    }

    .info-card.active {
        border-color: #e11d48;
        background: #fff1f2;
    }

    .info-icon {
        width: 60px;
        height: 60px;
        background: #ffe4e6;
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        color: #e11d48;
        flex-shrink: 0;
    }

    .info-content h3 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;
    }

    .info-content p {
        color: #64748b;
        line-height: 1.6;
        margin: 0;
    }

    /* Interactive Feed Demo Styles */
    .feed-demo-container {
        background: #fff;
        border-radius: 24px;
        box-shadow: 0 20px 60px -10px rgba(225, 29, 72, 0.15);
        border: 1px solid #f1f5f9;
        overflow: hidden;
        height: 600px;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .feed-header {
        padding: 20px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        z-index: 10;
    }

    .feed-scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #f8fafc;
        position: relative;
        scroll-behavior: smooth;
    }

    .feed-scroll-area::-webkit-scrollbar {
        width: 6px;
    }
    .feed-scroll-area::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 3px;
    }

    .feed-post {
        background: white;
        padding: 20px;
        border-radius: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03);
        animation: slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        border: 1px solid transparent;
        transition: all 0.2s;
    }

    .feed-post:hover {
        border-color: #fda4af;
        transform: translateY(-2px);
        box-shadow: 0 10px 25px -5px rgba(225, 29, 72, 0.1);
    }

    @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    .post-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fda4af 0%, #e11d48 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 0.9rem;
    }

    .post-meta h4 {
        font-size: 0.95rem;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
    }

    .post-meta span {
        font-size: 0.8rem;
        color: #94a3b8;
    }

    .post-body {
        color: #334155;
        font-size: 0.95rem;
        line-height: 1.5;
        margin-bottom: 15px;
    }

    .post-tags {
        display: flex;
        gap: 8px;
        margin-bottom: 15px;
    }

    .post-tag {
        font-size: 0.75rem;
        padding: 4px 10px;
        background: #f1f5f9;
        color: #64748b;
        border-radius: 100px;
        font-weight: 600;
    }

    .post-actions {
        display: flex;
        gap: 20px;
        border-top: 1px solid #f1f5f9;
        padding-top: 12px;
    }

    .action-btn {
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s;
        background: none;
        border: none;
        padding: 0;
    }

    .action-btn:hover { color: #e11d48; }
    .action-btn.active { color: #e11d48; }
    .action-btn.active ion-icon { transform: scale(1.2); }

    .demo-input-area {
        padding: 20px;
        background: white;
        border-top: 1px solid #f1f5f9;
        display: flex;
        gap: 15px;
        align-items: flex-start;
    }

    .demo-input {
        flex: 1;
        border: 2px solid #f1f5f9;
        border-radius: 12px;
        padding: 12px 16px;
        resize: none;
        transition: border-color 0.3s;
        font-family: inherit;
        font-size: 0.95rem;
        height: 50px;
    }

    .demo-input:focus {
        outline: none;
        border-color: #fda4af;
    }

    .btn-post {
        background: #e11d48;
        color: white;
        border: none;
        padding: 0 24px;
        height: 50px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
    }

    .btn-post:hover {
        background: #be123c;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
    }

    .typing-indicator {
        font-size: 0.8rem;
        color: #94a3b8;
        margin-bottom: 10px;
        height: 20px;
        opacity: 0;
        transition: opacity 0.3s;
    }
    .typing-indicator.visible { opacity: 1; }

</style>

<!-- Hero Section -->
<section class="feed-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="pulse-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            The Pulse of the Community
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Social Feed
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            A vibrant, real-time stream of ideas, questions, and celebrations. Connect with thousands of women instantly in a safe, moderated space.
        </p>
        <div class="wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
            <a href="#demo" class="btn btn-primary btn-lg" style="background: #e11d48; border-color: #e11d48; border-radius: 100px; padding: 12px 32px;">Try the Live Demo</a>
        </div>
    </div>
</section>

<!-- Interactive Demo Section -->
<section class="section-box mt-50 mb-50" id="demo">
    <div class="container">
        <div class="row">
            <!-- Feature List (Left) -->
            <div class="col-lg-5 mb-40 wow animate__animated animate__fadeInLeft">
                <h2 class="mb-30" style="font-weight: 800; color: #0f172a;">Why our feed is different</h2>

                <div class="info-card active" onclick="filterFeed('support')">
                    <div class="info-icon">
                        <ion-icon name="heart-outline"></ion-icon>
                    </div>
                    <div class="info-content">
                        <h3>Supportive by Design</h3>
                        <p>Our algorithm prioritizes encouragement. Trolls and negativity are filtered out before they reach you.</p>
                    </div>
                </div>

                <div class="info-card" onclick="filterFeed('growth')">
                    <div class="info-icon">
                        <ion-icon name="trending-up-outline"></ion-icon>
                    </div>
                    <div class="info-content">
                        <h3>Career Growth Focus</h3>
                        <p>Filter for job leads, mentorship requests, and salary negotiation tips instantly.</p>
                    </div>
                </div>

                <div class="info-card" onclick="filterFeed('privacy')">
                    <div class="info-icon">
                        <ion-icon name="shield-checkmark-outline"></ion-icon>
                    </div>
                    <div class="info-content">
                        <h3>Verified & Safe</h3>
                        <p>Connect with verified profiles. No bots, no spam, just real women helping women.</p>
                    </div>
                </div>
            </div>

            <!-- Interactive Feed (Right) -->
            <div class="col-lg-7 mb-40 wow animate__animated animate__fadeInRight">
                <div class="feed-demo-container">
                    <div class="feed-header">
                        <div style="font-weight: 700; color: #334155; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block;"></span>
                            Live Community Feed
                        </div>
                        <div style="font-size: 0.85rem; color: #64748b;">
                            <ion-icon name="people-outline" style="vertical-align: middle;"></ion-icon> 1,240 online
                        </div>
                    </div>

                    <div class="feed-scroll-area" id="feedContainer">
                        <!-- Posts will be injected here by JS -->
                    </div>

                    <div class="demo-input-area">
                        <div class="avatar" style="width: 35px; height: 35px; background: #e11d48;">You</div>
                        <input type="text" class="demo-input" id="postInput" placeholder="Share a win or ask for advice..." onkeypress="handleEnter(event)">
                        <button class="btn-post" onclick="addUserPost()">Post</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<script>
    // Mock Data
    const mockPosts = [
        {
            name: "Sarah Jenkins",
            initials: "SJ",
            time: "2 mins ago",
            content: "Just finished the Resume Parser tool and wow! It caught 3 typos I missed and suggested better keywords. Applying for the Senior PM role now! 🤞",
            tags: ["#CareerWin", "#JobSearch"],
            likes: 24,
            comments: 5,
            type: "growth"
        },
        {
            name: "Dr. Emily Chen",
            initials: "EC",
            time: "5 mins ago",
            content: "I have 2 slots open for mentorship this month. Specializing in HealthTech and leadership for introverts. DM me if interested!",
            tags: ["#Mentorship", "#HealthTech"],
            likes: 45,
            comments: 12,
            type: "support"
        },
        {
            name: "Maria Rodriguez",
            initials: "MR",
            time: "12 mins ago",
            content: "Does anyone have experience negotiating equity for a Series B startup? The offer looks good but I'm unsure about the vesting schedule.",
            tags: ["#AdviceNeeded", "#StartupLife"],
            likes: 8,
            comments: 15,
            type: "growth"
        },
        {
            name: "Athena Bot",
            initials: "AB",
            time: "Just now",
            content: "🎉 New Grant Alert: The 'Women in AI' micro-grant is now accepting applications. Check the Grants Lab for details.",
            tags: ["#Grants", "#Opportunity"],
            likes: 102,
            comments: 0,
            type: "growth"
        }
    ];

    const feedContainer = document.getElementById('feedContainer');
    let isAutoPosting = true;

    // Initialize Feed
    function initFeed() {
        mockPosts.forEach(post => addPostToDom(post));
        scrollToBottom();

        // Simulate live incoming posts
        setInterval(() => {
            if(isAutoPosting && Math.random() > 0.7) {
                const randomPost = generateRandomPost();
                addPostToDom(randomPost);
                scrollToBottom();
            }
        }, 5000);
    }

    function addPostToDom(post) {
        const postEl = document.createElement('div');
        postEl.className = 'feed-post';
        postEl.innerHTML = `
            <div class="post-header">
                <div class="avatar">${post.initials}</div>
                <div class="post-meta">
                    <h4>${post.name}</h4>
                    <span>${post.time}</span>
                </div>
            </div>
            <div class="post-body">${post.content}</div>
            <div class="post-tags">
                ${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}
            </div>
            <div class="post-actions">
                <button class="action-btn" onclick="toggleLike(this)">
                    <ion-icon name="heart-outline"></ion-icon> ${post.likes}
                </button>
                <button class="action-btn">
                    <ion-icon name="chatbubble-outline"></ion-icon> ${post.comments}
                </button>
                <button class="action-btn">
                    <ion-icon name="share-social-outline"></ion-icon> Share
                </button>
            </div>
        `;
        feedContainer.appendChild(postEl);
    }

    function addUserPost() {
        const input = document.getElementById('postInput');
        const content = input.value.trim();

        if (!content) return;

        const userPost = {
            name: "You",
            initials: "ME",
            time: "Just now",
            content: content,
            tags: ["#Community"],
            likes: 0,
            comments: 0,
            type: "support"
        };

        addPostToDom(userPost);
        input.value = '';
        scrollToBottom();

        // Simulate immediate engagement
        setTimeout(() => {
            const lastPost = feedContainer.lastElementChild;
            const likeBtn = lastPost.querySelector('.action-btn');
            likeBtn.innerHTML = '<ion-icon name="heart"></ion-icon> 1';
            likeBtn.classList.add('active');
        }, 2000);
    }

    function handleEnter(e) {
        if (e.key === 'Enter') addUserPost();
    }

    function toggleLike(btn) {
        const icon = btn.querySelector('ion-icon');
        let count = parseInt(btn.innerText);

        if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            icon.setAttribute('name', 'heart-outline');
            btn.innerHTML = `<ion-icon name="heart-outline"></ion-icon> ${count - 1}`;
        } else {
            btn.classList.add('active');
            icon.setAttribute('name', 'heart');
            btn.innerHTML = `<ion-icon name="heart"></ion-icon> ${count + 1}`;
        }
    }

    function scrollToBottom() {
        feedContainer.scrollTop = feedContainer.scrollHeight;
    }

    function generateRandomPost() {
        const names = ["Jessica L.", "Priya K.", "Sam W.", "Nadia B."];
        const contents = [
            "Just joined the platform! Excited to connect.",
            "Can anyone recommend a good book on financial literacy?",
            "Loving the new wellness hub features.",
            "Big shoutout to the support team for helping me today!"
        ];
        const tags = [["#NewHere"], ["#ReadingList"], ["#Wellness"], ["#Gratitude"]];

        const rand = Math.floor(Math.random() * names.length);

        return {
            name: names[rand],
            initials: names[rand].split(' ').map(n => n[0]).join(''),
            time: "Just now",
            content: contents[rand],
            tags: tags[rand],
            likes: Math.floor(Math.random() * 10),
            comments: 0,
            type: "support"
        };
    }

    function filterFeed(type) {
        // Visual feedback for tabs
        document.querySelectorAll('.info-card').forEach(card => card.classList.remove('active'));
        event.currentTarget.classList.add('active');

        // In a real app, this would filter. For demo, we'll just shake the feed
        feedContainer.style.opacity = '0.5';
        setTimeout(() => feedContainer.style.opacity = '1', 300);
    }

    // Start
    document.addEventListener('DOMContentLoaded', initFeed);

</script>
@endsection

