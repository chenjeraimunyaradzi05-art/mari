/**
 * Social Interactions Module
 * Handles likes, double-tap gestures, share helpers, search, and toast notifications
 */

(function () {
	class CommentThreadController {
		constructor({ csrfToken, ensureOnline, showToast, refreshCounts }) {
			this.csrfToken = csrfToken;
			this.ensureOnline = ensureOnline;
			this.showToast = showToast;
			this.refreshCounts = refreshCounts;
			this.threadState = new WeakMap();
			this.defaultAvatar = document.querySelector('meta[name="social-default-avatar"]')?.content || '';
			this.perPage = 6;
			this.registerEvents();
		}

		registerEvents() {
			document.addEventListener('click', (event) => {
				const trigger = event.target.closest('[data-comment-trigger]');
				if (trigger) {
					event.preventDefault();
					const card = trigger.closest('[data-post-card]');
					this.toggleThread(card, trigger);
					return;
				}

				const closeButton = event.target.closest('[data-close-comment-thread]');
				if (closeButton) {
					event.preventDefault();
					const card = closeButton.closest('[data-post-card]');
					this.closeThread(card);
					return;
				}

				const replyButton = event.target.closest('[data-comment-reply]');
				if (replyButton) {
					event.preventDefault();
					const card = replyButton.closest('[data-post-card]');
					const author = replyButton.dataset.commentAuthor ?? 'this comment';
					this.setReplyTarget(card, replyButton.dataset.commentReply, author);
					return;
				}

				const resetButton = event.target.closest('[data-reset-reply]');
				if (resetButton) {
					event.preventDefault();
					const card = resetButton.closest('[data-post-card]');
					this.clearReplyTarget(card);
					return;
				}

				const loadMore = event.target.closest('[data-load-more-comments]');
				if (loadMore) {
					event.preventDefault();
					const card = loadMore.closest('[data-post-card]');
					this.loadMoreComments(card, loadMore);
					return;
				}

				const loadReplies = event.target.closest('[data-load-replies]');
				if (loadReplies) {
					event.preventDefault();
					const card = loadReplies.closest('[data-post-card]');
					this.loadReplies(card, loadReplies.dataset.loadReplies, loadReplies);
				}
			});

			document.addEventListener('submit', (event) => {
				const form = event.target.closest('[data-comment-form]');
				if (!form) {
					return;
				}

				event.preventDefault();
				const card = form.closest('[data-post-card]');
				this.submitComment(card, form);
			});
		}

		getThread(card) {
			return card?.querySelector('[data-comment-thread]') ?? null;
		}

		getState(card) {
			if (!card) {
				return null;
			}

			if (!this.threadState.has(card)) {
				this.threadState.set(card, {
					page: 1,
					hasMore: false,
					loading: false,
					replies: {},
					initialized: false,
				});
			}

			return this.threadState.get(card);
		}

		toggleThread(card, trigger) {
			if (!card) {
				return;
			}

			const isOpen = card.dataset.threadOpen === 'true';
			if (isOpen) {
				this.closeThread(card);
				trigger?.setAttribute('aria-expanded', 'false');
				return;
			}

			this.openThread(card);
			trigger?.setAttribute('aria-expanded', 'true');
		}

		openThread(card) {
			const thread = this.getThread(card);
			if (!thread) {
				return;
			}

			card.dataset.threadOpen = 'true';
			thread.hidden = false;
			const state = this.getState(card);
			if (state && !state.initialized) {
				this.loadComments(card, { reset: true });
			}
		}

		closeThread(card) {
			const thread = this.getThread(card);
			if (!thread) {
				return;
			}

			card.dataset.threadOpen = 'false';
			thread.hidden = true;
			card.querySelectorAll('[data-comment-trigger]').forEach((node) => node.setAttribute('aria-expanded', 'false'));
		}

		async loadComments(card, { append = false, reset = false } = {}) {
			const thread = this.getThread(card);
			const state = this.getState(card);
			if (!thread || !state) {
				return;
			}

			const endpoint = card.dataset.commentsEndpoint;
			if (!endpoint || state.loading) {
				return;
			}

			if (!this.ensureOnline('load comments')) {
				return;
			}

			this.clearError(card);
			this.setThreadLoading(card, true);
			state.loading = true;
			if (reset) {
				state.page = 1;
				state.hasMore = false;
			}

			const nextPage = append ? state.page + 1 : 1;
			let url;
			try {
				url = new URL(endpoint, window.location.origin);
			} catch (error) {
				url = new URL(window.location.origin + endpoint);
			}
			url.searchParams.set('page', nextPage.toString());
			url.searchParams.set('per_page', this.perPage.toString());

			try {
				const response = await fetch(url.toString(), {
					headers: { 'Accept': 'application/json' },
					credentials: 'same-origin',
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const comments = Array.isArray(payload?.data) ? payload.data : [];
				const meta = payload?.meta ?? {};

				this.renderComments(card, comments, { append });
				state.page = meta.page ?? nextPage;
				state.hasMore = Boolean(meta.has_more);
				state.initialized = true;
				this.removeLoadMore(card);
				if (state.hasMore) {
					this.renderLoadMore(card);
				}
			} catch (error) {
				console.error('Unable to load comments', error);
				const message = error?.message ?? 'Unable to load comments right now.';
				this.showError(card, message);
			} finally {
				state.loading = false;
				this.setThreadLoading(card, false);
			}
		}

		renderComments(card, comments, { append = false } = {}) {
			const thread = this.getThread(card);
			const body = thread?.querySelector('[data-comment-thread-body]');
			const empty = thread?.querySelector('[data-comment-thread-empty]');
			if (!body) {
				return;
			}

			if (!append) {
				body.innerHTML = '';
			}

			if (!comments.length) {
				if (!append) {
					empty?.removeAttribute('hidden');
				}
				return;
			}

			empty?.setAttribute('hidden', 'hidden');
			const fragment = document.createDocumentFragment();
			comments.forEach((comment) => fragment.appendChild(this.buildCommentNode(comment)));
			body.appendChild(fragment);
		}

		renderLoadMore(card) {
			const thread = this.getThread(card);
			const body = thread?.querySelector('[data-comment-thread-body]');
			if (!body) {
				return;
			}

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'comment-thread__reply';
			button.dataset.loadMoreComments = 'true';
			button.textContent = 'Load older comments';
			body.appendChild(button);
		}

		removeLoadMore(card) {
			const thread = this.getThread(card);
			thread?.querySelector('[data-load-more-comments]')?.remove();
		}

		buildCommentNode(comment) {
			const item = document.createElement('article');
			item.className = 'comment-thread__item';
			if (comment?.id) {
				item.dataset.commentId = comment.id;
			}
			item.dataset.depth = comment?.depth ?? 0;

			const meta = document.createElement('div');
			meta.className = 'comment-thread__meta';
			const avatar = document.createElement('img');
			avatar.className = 'comment-thread__avatar';
			avatar.alt = comment?.user?.name ?? 'Member';
			avatar.src = comment?.user?.avatar || this.defaultAvatar;
			meta.appendChild(avatar);

			const name = document.createElement('span');
			name.textContent = comment?.user?.name ?? 'Member';
			meta.appendChild(name);

			const time = document.createElement('span');
			time.textContent = `• ${comment?.published_human ?? 'moments ago'}`;
			meta.appendChild(time);
			item.appendChild(meta);

			const body = document.createElement('p');
			body.className = 'comment-thread__body';
			body.textContent = comment?.content ?? '';
			item.appendChild(body);

			const actions = document.createElement('div');
			actions.className = 'comment-thread__actions-bar';
			const replyButton = document.createElement('button');
			replyButton.type = 'button';
			replyButton.className = 'comment-thread__reply';
			replyButton.dataset.commentReply = comment?.id ?? '';
			replyButton.dataset.commentAuthor = comment?.user?.name ?? 'this comment';
			replyButton.textContent = 'Reply';
			actions.appendChild(replyButton);

			const replyCount = Number(comment?.counts?.replies ?? 0);
			if (replyCount > 0) {
				const counter = document.createElement('span');
				counter.textContent = `${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`;
				actions.appendChild(counter);
			}

			item.appendChild(actions);

			if (Array.isArray(comment?.replies) && comment.replies.length) {
				const repliesWrapper = document.createElement('div');
				repliesWrapper.className = 'comment-thread__replies';
				comment.replies.forEach((reply) => repliesWrapper.appendChild(this.buildCommentNode(reply)));
				item.appendChild(repliesWrapper);
			}

			if (comment?.has_more_replies) {
				const moreReplies = document.createElement('button');
				moreReplies.type = 'button';
				moreReplies.className = 'comment-thread__reply';
				moreReplies.dataset.loadReplies = comment.id;
				moreReplies.textContent = 'Show more replies';
				item.appendChild(moreReplies);
			}

			return item;
		}

		ensureRepliesWrapper(node) {
			let wrapper = node.querySelector('.comment-thread__replies');
			if (!wrapper) {
				wrapper = document.createElement('div');
				wrapper.className = 'comment-thread__replies';
				node.appendChild(wrapper);
			}
			return wrapper;
		}

		setReplyTarget(card, commentId, authorName) {
			const thread = this.getThread(card);
			const form = thread?.querySelector('[data-comment-form]');
			if (!form) {
				return;
			}

			const input = form.querySelector('input[name="parent_id"]');
			if (input) {
				input.value = commentId ?? '';
			}

			const resetButton = form.querySelector('[data-reset-reply]');
			if (resetButton) {
				const targetLabel = resetButton.querySelector('[data-replying-to]');
				if (targetLabel) {
					targetLabel.textContent = authorName ?? 'this comment';
				}
				resetButton.hidden = false;
			}
		}

		clearReplyTarget(card) {
			const thread = this.getThread(card);
			const form = thread?.querySelector('[data-comment-form]');
			if (!form) {
				return;
			}

			const input = form.querySelector('input[name="parent_id"]');
			if (input) {
				input.value = '';
			}

			const resetButton = form.querySelector('[data-reset-reply]');
			if (resetButton) {
				resetButton.hidden = true;
			}
		}

		async submitComment(card, form) {
			const endpoint = card?.dataset?.commentEndpoint;
			if (!endpoint) {
				return;
			}

			const textarea = form.elements.content;
			const content = textarea?.value?.trim();
			if (!content) {
				this.showToast({ message: 'Write something kind before posting.', type: 'error' });
				return;
			}

			if (!this.ensureOnline('add a comment')) {
				return;
			}

			this.clearError(card);
			this.setFormBusy(form, true);

			const payload = { content };
			const parentId = form.querySelector('input[name="parent_id"]')?.value;
			if (parentId) {
				payload.parent_id = Number(parentId);
			}

			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'X-CSRF-TOKEN': this.csrfToken,
					},
					credentials: 'same-origin',
					body: JSON.stringify(payload),
				});
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw data;
				}

				const comment = data?.data?.comment ?? null;
				const parent = data?.data?.parent ?? null;
				const postPayload = data?.data?.post ?? null;

				if (comment) {
					this.insertComment(card, comment, parent);
					textarea.value = '';
					this.clearReplyTarget(card);
				}

				if (postPayload) {
					this.refreshCounts(card, postPayload);
				}

				this.showToast({ message: 'Comment added.', type: 'success' });
			} catch (error) {
				console.error('Unable to submit comment', error);
				const message = error?.errors?.content?.[0]
					?? error?.message
					?? 'Unable to add comment right now.';
				this.showError(card, message);
			} finally {
				this.setFormBusy(form, false);
			}
		}

		insertComment(card, comment, parent) {
			const thread = this.getThread(card);
			const body = thread?.querySelector('[data-comment-thread-body]');
			if (!thread || !body) {
				return;
			}

			thread.querySelector('[data-comment-thread-empty]')?.setAttribute('hidden', 'hidden');
			const node = this.buildCommentNode(comment);

			if (comment?.parent_id) {
				if (parent) {
					const parentNode = thread.querySelector(`[data-comment-id="${parent.id}"]`);
					if (parentNode) {
						parentNode.replaceWith(this.buildCommentNode(parent));
						return;
					}
				}

				const parentNode = thread.querySelector(`[data-comment-id="${comment.parent_id}"]`);
				if (parentNode) {
					this.ensureRepliesWrapper(parentNode).appendChild(node);
				} else {
					body.prepend(node);
				}
				return;
			}

			body.prepend(node);
		}

		async loadMoreComments(card, button) {
			if (!card) {
				return;
			}

			if (button && !button.dataset.originalLabel) {
				button.dataset.originalLabel = button.textContent;
			}

			if (button) {
				button.disabled = true;
				button.textContent = 'Loading...';
			}

			try {
				await this.loadComments(card, { append: true });
			} finally {
				if (button?.isConnected) {
					button.disabled = false;
					button.textContent = button.dataset.originalLabel ?? 'Load older comments';
				}
			}
		}

		async loadReplies(card, parentId, button) {
			const template = card?.dataset?.repliesEndpointTemplate;
			if (!card || !template || !parentId) {
				return;
			}

			if (!this.ensureOnline('load replies')) {
				return;
			}

			const state = this.getState(card);
			if (!state) {
				return;
			}

			const replyState = state.replies[parentId] ?? { page: 0, hasMore: true };
			if (!replyState.hasMore && replyState.page !== 0) {
				return;
			}

			const nextPage = replyState.page + 1;
			const url = `${template.replace('COMMENT_ID', parentId)}?page=${nextPage}&per_page=${this.perPage}`;
			if (button && !button.dataset.originalLabel) {
				button.dataset.originalLabel = button.textContent;
			}
			this.setRepliesLoading(button, true);

			try {
				const response = await fetch(url, {
					headers: { 'Accept': 'application/json' },
					credentials: 'same-origin',
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const replies = Array.isArray(payload?.data) ? payload.data : [];
				replyState.page = payload?.meta?.page ?? nextPage;
				replyState.hasMore = Boolean(payload?.meta?.has_more);
				state.replies[parentId] = replyState;

				const parentNode = this.getThread(card)?.querySelector(`[data-comment-id="${parentId}"]`);
				if (parentNode) {
					const wrapper = this.ensureRepliesWrapper(parentNode);
					replies.forEach((reply) => wrapper.appendChild(this.buildCommentNode(reply)));
				}

				if (!replyState.hasMore) {
					button?.remove();
				}
			} catch (error) {
				console.error('Unable to load replies', error);
				this.showError(card, 'Unable to load replies right now.');
			} finally {
				this.setRepliesLoading(button, false);
			}
		}

		setThreadLoading(card, isLoading) {
			const thread = this.getThread(card);
			const loading = thread?.querySelector('[data-comment-loading]');
			if (loading) {
				loading.hidden = !isLoading;
			}
		}

		showError(card, message) {
			const thread = this.getThread(card);
			const errorNode = thread?.querySelector('[data-comment-error]');
			if (errorNode) {
				errorNode.hidden = false;
				errorNode.textContent = message;
			}
		}

		clearError(card) {
			const thread = this.getThread(card);
			const errorNode = thread?.querySelector('[data-comment-error]');
			if (errorNode) {
				errorNode.hidden = true;
				errorNode.textContent = '';
			}
		}

		setFormBusy(form, isBusy) {
			const submit = form.querySelector('.comment-thread__submit');
			const label = submit?.querySelector('[data-comment-submit-label]');
			if (submit) {
				submit.disabled = Boolean(isBusy);
				submit.setAttribute('aria-busy', isBusy ? 'true' : 'false');
			}

			if (label) {
				label.textContent = isBusy ? 'Posting...' : 'Post';
			}
		}

		setRepliesLoading(button, isLoading) {
			if (!button) {
				return;
			}

			if (!button.dataset.originalLabel) {
				button.dataset.originalLabel = button.textContent;
			}

			if (!button.isConnected && !isLoading) {
				return;
			}

			button.disabled = Boolean(isLoading);
			button.textContent = isLoading ? 'Loading...' : button.dataset.originalLabel;
		}
	}


	class SocialInteractions {
		constructor() {
			this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
			this.doubleTapDelay = 275;
			this.tapTargets = new WeakMap();
			this.reactionPalette = window.socialReactionPalette || {};
			this.shareChannels = Array.isArray(window.socialShareChannels) ? window.socialShareChannels : [];
			this.toastStack = this.ensureToastStack();
			this.shareSheet = null;
			this.shareSheetDialog = null;
			this.shareSheetOptionsContainer = null;
			this.shareSheetContext = null;
			this.lastShareTrigger = null;
			this.activeReactionPicker = null;
			this.boundShareSheetKeydown = (event) => this.handleShareSheetKeydown(event);
			this.boundShareSheetClick = (event) => this.handleShareSheetClick(event);
			this.shareOptions = this.buildShareOptions();
			this.ensureShareSheetStyles();
			this.registerDelegates();
			this.registerRippleEffects();
			this.addSearchDebounce();
			this.prepareExistingCards(document);
			this.isOffline = !navigator.onLine;
			this.watchOfflineState();
			this.commentThreads = new CommentThreadController({
				csrfToken: this.csrfToken,
				ensureOnline: (label) => this.ensureOnline(label),
				showToast: (detail) => this.showToast(detail),
				refreshCounts: (card, postPayload) => this.refreshCounts(card, postPayload),
			});
		}

		registerDelegates() {
			document.addEventListener('click', (event) => {
				if (this.activeReactionPicker && !event.target.closest('[data-reaction-picker]') && !event.target.closest('[data-reaction-trigger]')) {
					this.closeReactionPicker();
				}

				const reactionOption = event.target.closest('[data-reaction-option]');
				if (reactionOption) {
					event.preventDefault();
					const card = reactionOption.closest('[data-post-card]');
					if (card) {
						this.applyReaction(card, reactionOption.dataset.reactionOption);
					}
					return;
				}

				const reactionTrigger = event.target.closest('[data-reaction-trigger]');
				if (reactionTrigger) {
					event.preventDefault();
					const card = reactionTrigger.closest('[data-post-card]');
					if (card) {
						this.toggleReactionPicker(card, reactionTrigger);
					}
					return;
				}

				const likeButton = event.target.closest('[data-like-button]');
				if (likeButton) {
					event.preventDefault();
					const card = likeButton.closest('[data-post-card]');
					if (card) {
						this.toggleLike(card);
					}
					return;
				}

				const saveButton = event.target.closest('[data-save-button]');
				if (saveButton) {
					event.preventDefault();
					const card = saveButton.closest('[data-post-card]');
					if (card) {
						this.toggleSave(card);
					}
					return;
				}

				const shareButton = event.target.closest('[data-share-card]');
				if (shareButton) {
					event.preventDefault();
					this.handleInlineShare(shareButton);
					return;
				}

				const moderationToggle = event.target.closest('[data-moderation-dismiss]');
				if (moderationToggle) {
					event.preventDefault();
					this.dismissModerationOverlay(moderationToggle);
					return;
				}

				if (event.target.closest('.like-btn')) {
					this.handleLegacyLike(event);
				}

				if (event.target.closest('.comment-btn')) {
					this.handleComment(event);
				}

				if (event.target.closest('.share-btn')) {
					this.handleLegacyShare(event);
				}
			});

			document.addEventListener('pointerup', (event) => {
				const hotspot = event.target.closest('[data-like-hotspot]');
				if (!hotspot || event.target.closest('[data-carousel-nav]')) {
					return;
				}

				const card = hotspot.closest('[data-post-card]');
				if (!card) {
					return;
				}

				const now = performance.now();
				const lastTap = this.tapTargets.get(hotspot) ?? 0;

				if (now - lastTap <= this.doubleTapDelay) {
					this.tapTargets.set(hotspot, 0);
					this.flashHeart(card);
					this.toggleLike(card, { viaDoubleTap: true });
				} else {
					this.tapTargets.set(hotspot, now);
				}
			});

			document.addEventListener('social:posts-inserted', (event) => {
				this.prepareExistingCards(event.detail?.scope ?? document);
			});

			window.addEventListener('social:toast', (event) => {
				if (event.detail?.message) {
					this.showToast(event.detail);
				}
			});

			document.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && this.activeReactionPicker) {
					this.closeReactionPicker();
				}
			});
		}

		watchOfflineState() {
			window.addEventListener('offline', () => {
				this.isOffline = true;
				document.dispatchEvent(new CustomEvent('social:offline', { detail: { offline: true } }));
			});

			window.addEventListener('online', () => {
				this.isOffline = false;
				document.dispatchEvent(new CustomEvent('social:offline', { detail: { offline: false } }));
			});
		}

		ensureOnline(actionLabel = 'complete this action') {
			if (!this.isOffline) {
				return true;
			}

			this.showToast({
				message: `You're offline – unable to ${actionLabel} right now.`,
				type: 'error',
			});

			return false;
		}

		refreshCounts(card, postPayload) {
			if (!card || !postPayload) {
				return;
			}

			const counts = postPayload.counts ?? {};
			if (typeof counts.comments === 'number') {
				const commentNode = card.querySelector('[data-comment-count]');
				if (commentNode) {
					commentNode.textContent = new Intl.NumberFormat().format(counts.comments);
				}
				card.dataset.commentCount = counts.comments;
			}

			if (typeof counts.likes === 'number' && typeof postPayload.liked === 'boolean') {
				this.updateLikeUI(card, postPayload.liked, counts.likes);
			}

			if (postPayload.reactions) {
				this.updateReactionState(card, postPayload.reactions);
			}
		}

		prepareExistingCards(scope = document) {
			scope.querySelectorAll('[data-post-card]').forEach((card) => {
				if (!card.querySelector('[data-tap-heart]')) {
					const heart = document.createElement('span');
					heart.className = 'tap-heart';
					heart.dataset.tapHeart = 'true';
					heart.setAttribute('aria-hidden', 'true');
					card.appendChild(heart);
				}

				const likeButton = card.querySelector('[data-like-button]');
				if (likeButton) {
					likeButton.classList.toggle('is-active', card.dataset.liked === 'true');
					likeButton.setAttribute('aria-pressed', card.dataset.liked === 'true' ? 'true' : 'false');
				}

				this.renderReactionSummary(card);
				this.syncReactionTriggerAvailability(card);
			});
		}

		syncReactionTriggerAvailability(card) {
			const trigger = card.querySelector('[data-reaction-trigger]');
			const picker = card.querySelector('[data-reaction-picker]');
			const hasPalette = Object.keys(this.reactionPalette || {}).length > 0;

			if (!trigger) {
				return;
			}

			if (!hasPalette) {
				trigger.setAttribute('hidden', 'hidden');
				picker?.setAttribute('hidden', 'hidden');
			} else {
				trigger.removeAttribute('hidden');
			}
		}

		async toggleLike(card, { reaction = null, viaDoubleTap = false } = {}) {
			const endpoint = card.dataset.likeEndpoint;
			if (!endpoint || card.dataset.likeBusy === 'true') {
				return;
			}

			if (!this.ensureOnline('update likes')) {
				return;
			}

			card.dataset.likeBusy = 'true';

			try {
				const headers = {
					'Accept': 'application/json',
					'X-Requested-With': 'XMLHttpRequest',
					'X-CSRF-TOKEN': this.csrfToken,
				};
				const options = {
					method: 'POST',
					headers,
					credentials: 'same-origin',
				};

				if (reaction) {
					headers['Content-Type'] = 'application/json';
					options.body = JSON.stringify({ reaction });
				}

				const response = await fetch(endpoint, options);
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const formatted = payload?.data?.post ?? null;
				const liked = typeof formatted?.liked === 'boolean'
					? formatted.liked
					: card.dataset.liked !== 'true';
				const likeCount = formatted?.counts?.likes ?? null;
				this.updateLikeUI(card, liked, likeCount);
				if (formatted?.reactions) {
					this.updateReactionState(card, formatted.reactions);
				} else {
					this.renderReactionSummary(card);
				}

				if (!viaDoubleTap) {
					const toastMessage = liked
						? this.buildReactionToastMessage(card.dataset.reactionActive || reaction)
						: 'Your reaction was removed.';
					this.showToast({
						message: toastMessage,
						type: liked ? 'success' : 'info',
					});
				}
			} catch (error) {
				console.error('Unable to toggle like', error);
				this.showToast({ message: 'Unable to update like right now.', type: 'error' });
			} finally {
				card.dataset.likeBusy = 'false';
			}
		}

		updateLikeUI(card, liked, likeCount) {
			card.dataset.liked = liked ? 'true' : 'false';
			const likeButton = card.querySelector('[data-like-button]');
			if (likeButton) {
				likeButton.classList.toggle('is-active', liked);
				likeButton.setAttribute('aria-pressed', liked ? 'true' : 'false');
			}

			const countNode = card.querySelector('[data-like-count]');
			if (countNode && typeof likeCount === 'number') {
				countNode.textContent = new Intl.NumberFormat().format(likeCount);
			}
		}

		async toggleSave(card) {
			const endpoint = card.dataset.saveEndpoint;
			if (!endpoint || card.dataset.saveBusy === 'true') {
				return;
			}

			if (!this.ensureOnline('update saves')) {
				return;
			}

			card.dataset.saveBusy = 'true';

			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'X-Requested-With': 'XMLHttpRequest',
						'X-CSRF-TOKEN': this.csrfToken,
					},
					credentials: 'same-origin',
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const postPayload = payload?.data?.post ?? null;
				const saved = typeof postPayload?.saved === 'boolean'
					? postPayload.saved
					: card.dataset.saved !== 'true';

				this.updateSaveUI(card, saved);
				this.refreshCounts(card, postPayload);
				this.showToast({ message: saved ? 'Saved to your list.' : 'Removed from saved posts.', type: 'success' });
			} catch (error) {
				console.error('Unable to toggle save', error);
				this.showToast({ message: 'Unable to update save right now.', type: 'error' });
			} finally {
				card.dataset.saveBusy = 'false';
			}
		}

		updateSaveUI(card, saved) {
			card.dataset.saved = saved ? 'true' : 'false';
			const button = card.querySelector('[data-save-button]');
			if (!button) {
				return;
			}

			button.classList.toggle('is-active', saved);
			button.setAttribute('aria-pressed', saved ? 'true' : 'false');

			const label = button.querySelector('[data-save-label]');
			if (label) {
				label.textContent = saved ? 'Saved' : 'Save';
			}
		}

		flashHeart(card) {
			const heart = card.querySelector('[data-tap-heart]');
			if (!heart) {
				return;
			}
			heart.classList.remove('is-active');
			void heart.offsetWidth;
			heart.classList.add('is-active');
		}

		applyReaction(card, reactionKey) {
			if (!card || !reactionKey) {
				return;
			}

			this.closeReactionPicker();
			this.toggleLike(card, { reaction: reactionKey });
		}

		toggleReactionPicker(card, trigger) {
			if (!card) {
				return;
			}

			if (this.activeReactionPicker && this.activeReactionPicker.card === card) {
				this.closeReactionPicker();
				return;
			}

			this.openReactionPicker(card, trigger);
		}

		openReactionPicker(card, trigger) {
			const picker = card.querySelector('[data-reaction-picker]');
			if (!picker) {
				return;
			}

			this.closeReactionPicker();
			picker.hidden = false;
			requestAnimationFrame(() => picker.classList.add('is-visible'));
			this.activeReactionPicker = { card, picker, trigger };
			if (trigger) {
				trigger.setAttribute('aria-expanded', 'true');
			}

			this.highlightReactionOptions(card);
			this.focusReactionOption(card);
		}

		closeReactionPicker() {
			if (!this.activeReactionPicker) {
				return;
			}

			const { picker, trigger } = this.activeReactionPicker;
			picker.classList.remove('is-visible');
			picker.hidden = true;
			if (trigger) {
				trigger.setAttribute('aria-expanded', 'false');
			}
			this.activeReactionPicker = null;
		}

		highlightReactionOptions(card) {
			const activeKey = card?.dataset?.reactionActive ?? '';
			card?.querySelectorAll('[data-reaction-option]')?.forEach((button) => {
				const isActive = activeKey && button.dataset.reactionOption === activeKey;
				button.classList.toggle('is-active', Boolean(isActive));
				button.setAttribute('aria-checked', isActive ? 'true' : 'false');
			});
		}

		focusReactionOption(card) {
			const options = Array.from(card?.querySelectorAll('[data-reaction-option]') ?? []);
			if (!options.length) {
				return;
			}

			const active = options.find((button) => button.classList.contains('is-active'));
			const target = active || options[0];
			requestAnimationFrame(() => target.focus());
		}

		updateReactionState(card, reactionMeta) {
			if (!card || !reactionMeta) {
				return;
			}

			if (reactionMeta.counts && typeof reactionMeta.counts === 'object') {
				try {
					card.dataset.reactionCounts = JSON.stringify(reactionMeta.counts);
				} catch (error) {
					console.warn('Unable to serialize reaction counts', error);
				}
			}

			if (typeof reactionMeta.active === 'string') {
				card.dataset.reactionActive = reactionMeta.active;
			} else if (!reactionMeta.active) {
				card.dataset.reactionActive = '';
			}

			this.highlightReactionOptions(card);
			this.renderReactionSummary(card);
		}

		parseReactionCounts(card) {
			if (!card?.dataset?.reactionCounts) {
				return {};
			}

			try {
				const parsed = JSON.parse(card.dataset.reactionCounts);
				return parsed && typeof parsed === 'object' ? parsed : {};
			} catch (error) {
				return {};
			}
		}

		renderReactionSummary(card) {
			const container = card.querySelector('[data-reaction-summary]');
			if (!container) {
				return;
			}

			const counts = this.parseReactionCounts(card);
			const entries = Object.entries(counts)
				.filter(([, value]) => Number(value) > 0)
				.sort((a, b) => Number(b[1]) - Number(a[1]));

			if (!entries.length) {
				container.innerHTML = '';
				container.setAttribute('hidden', 'hidden');
				return;
			}

			const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
			const iconsWrapper = document.createElement('div');
			iconsWrapper.className = 'reaction-summary__icons';
			entries.slice(0, 3).forEach(([reactionKey]) => {
				const icon = document.createElement('span');
				icon.className = 'reaction-summary__icon';
				icon.innerHTML = `<i class="${this.resolveReactionIcon(reactionKey)}" aria-hidden="true"></i>`;
				iconsWrapper.appendChild(icon);
			});

			const textWrapper = document.createElement('div');
			textWrapper.className = 'reaction-summary__text';
			const totalStrong = document.createElement('strong');
			totalStrong.textContent = new Intl.NumberFormat().format(total);
			textWrapper.appendChild(totalStrong);
			textWrapper.append(' reactions');

			if (card.dataset.reactionActive) {
				const youSpan = document.createElement('span');
				youSpan.className = 'reaction-summary__you';
				youSpan.textContent = `You reacted with ${this.resolveReactionLabel(card.dataset.reactionActive)}.`;
				textWrapper.append(' · ', youSpan);
			}

			container.innerHTML = '';
			container.appendChild(iconsWrapper);
			container.appendChild(textWrapper);
			container.removeAttribute('hidden');
		}

		buildReactionToastMessage(reactionKey) {
			if (!reactionKey) {
				return 'You showed some love.';
			}

			return `Reacted with ${this.resolveReactionLabel(reactionKey)}.`;
		}

		resolveReactionLabel(reactionKey) {
			if (!reactionKey) {
				return 'a reaction';
			}

			const entry = this.reactionPalette?.[reactionKey];
			if (entry?.label) {
				return entry.label;
			}

			return `${reactionKey.charAt(0).toUpperCase()}${reactionKey.slice(1)}`;
		}

		resolveReactionIcon(reactionKey) {
			const entry = this.reactionPalette?.[reactionKey];
			return entry?.icon ?? 'fas fa-heart';
		}

		async handleInlineShare(button) {
			const card = button.closest('[data-post-card]');
			const context = this.buildShareContext(card, button);

			if (!context?.url) {
				this.showToast({ message: 'We could not find a shareable link for this post.', type: 'error' });
				return;
			}

			if (navigator.share) {
				try {
					await this.shareViaDevice(context);
					return;
				} catch (error) {
					if (error?.name === 'AbortError') {
						return;
					}

					console.warn('Native share failed, falling back to share sheet.', error);
				}
			}

			this.openShareSheet(context);
		}

		buildShareContext(card, trigger) {
			const postId = card?.dataset.postId ?? trigger?.dataset.postId ?? null;
			const url = card?.querySelector('.post-link__anchor')?.href
				|| trigger?.dataset.shareUrl
				|| window.location.href;
			const title = card?.dataset.authorName
				|| card?.querySelector('.post-username')?.textContent?.trim()
				|| 'Share post';
			const summary = card?.dataset.postSummary
				|| card?.querySelector('.post-caption')?.textContent?.trim()
				|| '';

			return {
				postId: postId ? Number(postId) : null,
				url,
				title,
				summary,
				card,
				trigger,
			};
		}

		openShareSheet(context) {
			if (!this.shareSheet) {
				this.createShareSheet();
			}

			this.shareSheetContext = context;
			this.renderShareOptions(context);

			this.shareSheet.hidden = false;
			requestAnimationFrame(() => {
				this.shareSheet.classList.add('is-visible');
				this.focusFirstShareOption();
			});

			this.lastShareTrigger = context.trigger ?? null;
			if (this.lastShareTrigger) {
				this.lastShareTrigger.setAttribute('aria-expanded', 'true');
			}

			document.addEventListener('keydown', this.boundShareSheetKeydown);
			this.shareSheet.addEventListener('click', this.boundShareSheetClick);
		}

		createShareSheet() {
			const sheet = document.createElement('div');
			sheet.className = 'share-sheet';
			sheet.dataset.shareSheet = 'true';
			sheet.hidden = true;
			sheet.innerHTML = `
				<div class="share-sheet__backdrop" data-share-close></div>
				<div class="share-sheet__dialog" id="share-sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title" aria-describedby="share-sheet-description">
					<header class="share-sheet__header">
						<h2 id="share-sheet-title">Share this story</h2>
						<button type="button" class="share-sheet__close" data-share-close aria-label="Close share options">
							<span aria-hidden="true">&times;</span>
						</button>
					</header>
					<p id="share-sheet-description" class="share-sheet__subtitle">Choose where you would like this story to appear.</p>
					<div class="share-sheet__options" role="listbox" data-share-options></div>
					<footer class="share-sheet__footer">
						<small>Use ↑ and ↓ to move between share actions.</small>
					</footer>
				</div>
			`;

			document.body.appendChild(sheet);
			this.shareSheet = sheet;
			this.shareSheetDialog = sheet.querySelector('.share-sheet__dialog');
			this.shareSheetOptionsContainer = sheet.querySelector('[data-share-options]');
		}

		renderShareOptions(context) {
			if (!this.shareSheetOptionsContainer) {
				return;
			}

			this.shareSheetOptionsContainer.innerHTML = '';

			this.shareOptions.forEach((option) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'share-sheet__option';
				button.dataset.shareOption = option.id;
				button.innerHTML = `
					<span class="share-sheet__option-icon" aria-hidden="true"><i class="${option.icon}"></i></span>
					<span class="share-sheet__option-body">
						<span class="share-sheet__option-label">${option.label}</span>
						<span class="share-sheet__option-hint">${option.hint}</span>
					</span>
				`;

				if (typeof option.disabledWhen === 'function' && option.disabledWhen(context)) {
					button.disabled = true;
				}

				button.addEventListener('click', () => this.handleShareOptionSelect(option.id));
				this.shareSheetOptionsContainer.appendChild(button);
			});
		}

		closeShareSheet(focusReturn = true) {
			if (!this.shareSheet) {
				return;
			}

			this.shareSheet.classList.remove('is-visible');
			this.shareSheet.setAttribute('hidden', 'hidden');
			document.removeEventListener('keydown', this.boundShareSheetKeydown);
			this.shareSheet.removeEventListener('click', this.boundShareSheetClick);

			if (this.lastShareTrigger) {
				this.lastShareTrigger.setAttribute('aria-expanded', 'false');
				if (focusReturn) {
					this.lastShareTrigger.focus();
				}
			}
		}

		focusFirstShareOption() {
			const focusable = this.shareSheet?.querySelector('[data-share-option]:not(:disabled)');
			if (focusable) {
				focusable.focus();
			}
		}

		handleShareSheetKeydown(event) {
			if (!this.shareSheet?.classList.contains('is-visible')) {
				return;
			}

			if (event.key === 'Escape') {
				event.preventDefault();
				this.closeShareSheet();
				return;
			}

			if (event.key === 'Tab') {
				this.trapShareSheetFocus(event);
				return;
			}

			if (event.key === 'ArrowDown') {
				event.preventDefault();
				this.cycleShareOption(1);
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				this.cycleShareOption(-1);
			}
		}

		handleShareSheetClick(event) {
			if (event.target?.closest('[data-share-close]')) {
				this.closeShareSheet();
				return;
			}

			if (event.target === this.shareSheet) {
				this.closeShareSheet();
			}
		}

		trapShareSheetFocus(event) {
			const focusable = this.getShareSheetFocusable();
			if (focusable.length === 0) {
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const isShift = event.shiftKey;
			const active = document.activeElement;

			if (!isShift && active === last) {
				event.preventDefault();
				first.focus();
				return;
			}

			if (isShift && active === first) {
				event.preventDefault();
				last.focus();
			}
		}

		cycleShareOption(direction) {
			const options = Array.from(this.shareSheet?.querySelectorAll('[data-share-option]'));
			if (options.length === 0) {
				return;
			}

			const enabled = options.filter((option) => !option.disabled);
			if (enabled.length === 0) {
				return;
			}

			const active = document.activeElement;
			const currentIndex = enabled.indexOf(active);
			const targetIndex = currentIndex === -1
				? 0
				: (currentIndex + direction + enabled.length) % enabled.length;

			enabled[targetIndex].focus();
		}

		getShareSheetFocusable() {
			if (!this.shareSheetDialog) {
				return [];
			}

			return Array.from(this.shareSheetDialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
		}

		handleShareOptionSelect(optionId) {
			const option = this.shareOptions.find((entry) => entry.id === optionId);
			if (!option) {
				return;
			}

			Promise.resolve(option.handler(this.shareSheetContext))
				.then(() => this.closeShareSheet())
				.catch((error) => {
					if (error && error.__handled) {
						return;
					}
					console.error('Share option failed', error);
					this.showToast({ message: 'Unable to complete that action right now.', type: 'error' });
				});
		}

		async copyLinkToClipboard(context) {
			const url = typeof context === 'string' ? context : context?.url;
			if (!url) {
				throw new Error('Missing URL');
			}

			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(url);
			} else {
				const temp = document.createElement('input');
				temp.value = url;
				document.body.appendChild(temp);
				temp.select();
				document.execCommand('copy');
				temp.remove();
			}

			if (context?.postId) {
				await this.share(context.postId, 'copy', {
					card: context.card,
					successMessage: 'Post link copied to clipboard.',
				});
			} else {
				this.showToast({ message: 'Post link copied to clipboard.', type: 'success' });
			}
		}

		async shareViaMessage(context) {
			if (!context) {
				return;
			}

			window.dispatchEvent(new CustomEvent('social:share:message', {
				detail: {
					postId: context.postId,
					url: context.url,
					summary: context.summary,
					title: context.title,
				},
			}));

			const composeUrl = context.postId ? `/member/messages/compose?post=${context.postId}` : '/member/messages';
			window.open(composeUrl, '_blank', 'noopener,noreferrer');

			if (context.postId) {
				await this.share(context.postId, 'dm', {
					card: context.card,
					successMessage: 'Message composer opened in a new tab.',
				});
			} else {
				this.showToast({ message: 'Message composer opened in a new tab.', type: 'success' });
			}
		}

		async shareViaDevice(context) {
			if (!navigator.share) {
				throw new Error('native_share_unavailable');
			}

			try {
				await navigator.share({
					title: context.title,
					text: context.summary,
					url: context.url,
				});
			} catch (error) {
				if (error?.name === 'AbortError') {
					error.__handled = true;
				}
				throw error;
			}

			if (context.postId) {
				await this.share(context.postId, 'native', {
					card: context.card,
					successMessage: 'Shared with your contacts.',
				});
			} else {
				this.showToast({ message: 'Shared successfully.', type: 'success' });
			}
		}

		async openShareLink(context) {
			if (!context?.url) {
				throw new Error('missing_share_url');
			}

			window.open(context.url, '_blank', 'noopener,noreferrer');

			if (context.postId) {
				await this.share(context.postId, 'link', {
					card: context.card,
					successMessage: 'Link opened in a new tab.',
				});
			} else {
				this.showToast({ message: 'Link opened in a new tab.', type: 'success' });
			}
		}

		async repostToFeed(context, { mode = 'repost', commentary = null } = {}) {
			const card = context?.card || document.querySelector(`[data-post-card][data-post-id="${context?.postId}"]`);
			const endpoint = card?.dataset?.repostEndpoint || (context?.postId ? `/social/posts/${context.postId}/repost` : null);
			if (!endpoint) {
				throw new Error('repost_endpoint_unavailable');
			}

			const payload = {
				mode,
			};
			if (commentary) {
				payload.commentary = commentary;
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'X-CSRF-TOKEN': this.csrfToken,
				},
				credentials: 'same-origin',
				body: JSON.stringify(payload),
			});

			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw body;
			}

			const sharesCount = body?.data?.shares_count ?? null;
			if (context?.postId && typeof sharesCount === 'number') {
				this.syncShareCount(context.postId, sharesCount);
			}

			const message = body?.message ?? 'Reposted to your feed.';
			this.showToast({ message, type: 'success' });
			return body;
		}

		reportPost(context) {
			window.dispatchEvent(new CustomEvent('social:post:report', {
				detail: {
					postId: context.postId,
					url: context.url,
					reason: 'user_report',
				},
			}));

			this.showToast({ message: 'Thanks for reporting. Our moderators will review shortly.', type: 'success' });
		}

		buildShareOptions() {
			const options = [];
			const includes = (channel) => (this.shareChannels?.length ?? 0) === 0 || this.shareChannels.includes(channel);

			if (includes('native')) {
				options.push({
					id: 'device-share',
					label: 'Share via your device',
					icon: 'fas fa-mobile-alt',
					hint: 'Opens the native share sheet.',
					handler: (context) => this.shareViaDevice(context),
					disabledWhen: () => !navigator.share,
				});
			}

			if (includes('feed')) {
				options.push({
					id: 'share-feed',
					label: 'Repost to your feed',
					icon: 'fas fa-bullhorn',
					hint: 'Boost this story for your followers.',
					handler: (context) => this.repostToFeed(context),
					disabledWhen: (context) => !context.postId,
				});
			}

			if (includes('dm')) {
				options.push({
					id: 'share-message',
					label: 'Send via messages',
					icon: 'fas fa-paper-plane',
					hint: 'Paste directly into a DM thread.',
					handler: (context) => this.shareViaMessage(context),
				});
			}

			if (includes('link')) {
				options.push({
					id: 'open-link',
					label: 'Open share link',
					icon: 'fas fa-external-link-alt',
					hint: 'Preview in a new tab and grab the URL.',
					handler: (context) => this.openShareLink(context),
				});
			}

			if (includes('copy')) {
				options.push({
					id: 'copy-link',
					label: 'Copy link',
					icon: 'fas fa-link',
					hint: 'Copies the story URL to your clipboard.',
					handler: (context) => this.copyLinkToClipboard(context),
				});
			}

			options.push({
				id: 'report',
				label: 'Report / flag',
				icon: 'fas fa-flag',
				hint: 'Alert moderators about this story.',
				handler: (context) => this.reportPost(context),
			});

			return options;
		}

		/**
		 * === Legacy handlers for pages still using the old markup ===
		 */
		async handleLegacyLike(event) {
			const button = event.target.closest('.like-btn');
			const postId = button?.dataset?.postId;
			if (!button || !postId) {
				return;
			}

			const isLiked = button.dataset.liked === 'true';
			button.dataset.liked = (!isLiked).toString();
			const icon = button.querySelector('i');

			if (icon) {
				icon.classList.toggle('text-blue-500', !isLiked);
			}

			try {
				const response = await fetch(`/member/posts/${postId}/like`, {
					method: isLiked ? 'DELETE' : 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-CSRF-TOKEN': this.csrfToken,
					},
				});

				if (response.ok) {
					const data = await response.json();
					const card = button.closest('.post-card');
					const statsDiv = card?.querySelector('.post-stats');
					const likeSpan = statsDiv?.querySelector('span:first-child');
					if (likeSpan && typeof data.likes_count === 'number') {
						likeSpan.innerHTML = `<i class="fas fa-thumbs-up mr-1 text-blue-500"></i>${data.likes_count} Likes`;
					}
				}
			} catch (error) {
				console.error('Error liking post:', error);
				button.dataset.liked = isLiked.toString();
				if (icon) {
					icon.classList.toggle('text-blue-500', isLiked);
				}
			}
		}

		handleComment(event) {
			const button = event.target.closest('.comment-btn');
			if (!button) {
				return;
			}

			const card = button.closest('.post-card');
			const commentsSection = card?.querySelector('.comments-section');
			if (commentsSection) {
				commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}

			const commentInput = card?.querySelector('.comment-input');
			commentInput?.focus();
		}

		async handleLegacyShare(event) {
			const button = event.target.closest('.share-btn');
			if (!button) {
				return;
			}

			const card = button.closest('[data-post-card]')
				|| document.querySelector(`[data-post-card][data-post-id="${button.dataset.postId}"]`);
			const context = this.buildShareContext(card, button);

			if (!context.url) {
				this.showToast({ message: 'We could not open share options for this post.', type: 'error' });
				return;
			}

			this.openShareSheet(context);
		}

		async share(postId, channel, { card = null, successMessage = null, note = null } = {}) {
			const targetCard = card ?? document.querySelector(`[data-post-card][data-post-id="${postId}"]`);
			const endpoint = targetCard?.dataset?.shareEndpoint || (postId ? `/social/posts/${postId}/share` : null);
			const fallbackId = Number(targetCard?.dataset?.postId ?? 0);
			let resolvedPostId = postId != null ? Number(postId) : null;
			if (!Number.isFinite(resolvedPostId) || resolvedPostId <= 0) {
				resolvedPostId = Number.isFinite(fallbackId) && fallbackId > 0 ? fallbackId : null;
			}

			if (!endpoint) {
				throw new Error('share_endpoint_unavailable');
			}

			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'X-CSRF-TOKEN': this.csrfToken,
					},
					credentials: 'same-origin',
					body: JSON.stringify({ channel, note }),
				});

				const payload = await response.json().catch(() => ({}));

				if (!response.ok) {
					throw payload;
				}

				const count = payload?.data?.shares_count ?? payload?.shares_count ?? null;
				if (resolvedPostId) {
					this.syncShareCount(resolvedPostId, typeof count === 'number' ? count : null);
				}

				if (targetCard) {
					targetCard.dataset.sharedByViewer = 'true';
				}

				this.showToast({
					message: successMessage ?? `Post shared via ${channel}.`,
					type: 'success',
				});

				return payload;
			} catch (error) {
				console.error('Error sharing post:', error);
				if (!error?.__handled) {
					this.showToast({ message: 'Unable to share this post right now.', type: 'error' });
				}

				if (error && typeof error === 'object') {
					error.__handled = true;
					throw error;
				}

				const fallbackError = new Error('share_failed');
				fallbackError.__handled = true;
				throw fallbackError;
			}
		}

		/**
		 * Search helpers (legacy pages)
		 */
		async performSearch() {
			const query = document.getElementById('searchInput')?.value;
			if (!query || query.length < 2) return;

			try {
				const response = await fetch(`/member/social/search?q=${encodeURIComponent(query)}`, {
					headers: { 'X-CSRF-TOKEN': this.csrfToken },
				});
				const results = await response.json();
				this.displaySearchResults(results);
			} catch (error) {
				console.error('Error searching:', error);
			}
		}

		displaySearchResults(results) {
			const container = document.getElementById('searchResults');
			if (!container) return;

			const html = Object.entries(results).map(([type, items]) => `
				<div class="search-category mb-4">
					<h6 class="font-bold text-gray-900 mb-2">${type.charAt(0).toUpperCase() + type.slice(1)}</h6>
					${items.map(item => this.getSearchResultHTML(type, item)).join('')}
				</div>
			`).join('');

			container.innerHTML = html || '<p class="text-gray-600">No results found</p>';
		}

		getSearchResultHTML(type, item) {
			switch (type) {
				case 'connections':
					return `
						<div class="p-3 hover:bg-gray-50 rounded cursor-pointer">
							<a href="/member/connections/${item.id}" class="flex items-center gap-2">
								<img src="${item.avatar_url}" alt="${item.name}" class="w-8 h-8 rounded-full">
								<span>${item.name}</span>
							</a>
						</div>
					`;
				case 'posts':
					return `
						<div class="p-3 hover:bg-gray-50 rounded cursor-pointer">
							<a href="/member/posts/${item.id}" class="text-sm text-gray-700 truncate">
								${item.content.substring(0, 50)}...
							</a>
						</div>
					`;
				case 'groups':
					return `
						<div class="p-3 hover:bg-gray-50 rounded cursor-pointer">
							<a href="/member/groups/${item.id}" class="flex items-center gap-2">
								<div class="w-8 h-8 rounded bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
									${item.name.substring(0, 2)}
								</div>
								<span>${item.name}</span>
							</a>
						</div>
					`;
				default:
					return '';
			}
		}

		applyFilter(button) {
			document.querySelectorAll('.feed-filter-btn').forEach(btn => btn.classList.remove('active'));
			button.classList.add('active');
			const filter = button.dataset.filter;
			this.loadFeed(filter);
		}

		async loadFeed(filter = 'all') {
			try {
				const response = await fetch(`/member/posts?filter=${filter}`, {
					headers: { 'X-CSRF-TOKEN': this.csrfToken },
				});
				const data = await response.json();
				const feed = document.getElementById('posts-feed');
				if (feed) {
					feed.innerHTML = this.renderPosts(data.posts || []);
				}
			} catch (error) {
				console.error('Error loading feed:', error);
			}
		}

		renderPosts(posts) {
			if (!Array.isArray(posts) || posts.length === 0) {
				return '<p class="text-gray-600">No posts found</p>';
			}

			return posts.map(() => '<div class="post-card">...</div>').join('');
		}

		addSearchDebounce() {
			let debounceTimer;
			const searchInput = document.getElementById('searchInput');
			if (!searchInput) return;

			searchInput.addEventListener('keyup', () => {
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => this.performSearch(), 300);
			});
		}

		ensureShareSheetStyles() {
			if (document.getElementById('social-share-styles')) {
				return;
			}

			const style = document.createElement('style');
			style.id = 'social-share-styles';
			style.textContent = `
				.share-sheet {
					position: fixed;
					inset: 0;
					background: rgba(15, 23, 42, 0.55);
					display: none;
					align-items: center;
					justify-content: center;
					padding: 1.5rem;
					z-index: 1050;
				}

				.share-sheet.is-visible {
					display: flex;
				}

				.share-sheet__dialog {
					background: #fff;
					border-radius: 1.25rem;
					width: min(420px, 96vw);
					max-height: 90vh;
					display: flex;
					flex-direction: column;
					box-shadow: 0 30px 50px rgba(15, 23, 42, 0.2);
					padding: 1.25rem;
					animation: shareSheetFade 0.25s ease;
				}

				.share-sheet__header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 1rem;
				}

				.share-sheet__subtitle {
					margin-top: 0.5rem;
					margin-bottom: 0.5rem;
					color: #64748b;
				}

				.share-sheet__options {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
					margin-top: 0.5rem;
				}

				.share-sheet__option {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					width: 100%;
					border: 1px solid #e2e8f0;
					background: #f8fafc;
					border-radius: 0.85rem;
					padding: 0.85rem 1rem;
					font-size: 0.95rem;
					transition: box-shadow 0.2s ease, border-color 0.2s ease;
				}

				.share-sheet__option:focus-visible,
				.share-sheet__option:hover {
					border-color: #a5b4fc;
					box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
					outline: none;
				}

				.share-sheet__option-icon {
					width: 2.5rem;
					height: 2.5rem;
					border-radius: 999px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					background: #e0e7ff;
					color: #4338ca;
					font-size: 1rem;
				}

				.share-sheet__option-label {
					font-weight: 600;
					color: #0f172a;
				}

				.share-sheet__option-hint {
					display: block;
					font-size: 0.83rem;
					color: #64748b;
				}

				.share-sheet__close {
					border: none;
					background: transparent;
					font-size: 1.5rem;
					line-height: 1;
					color: #475569;
				}

				.share-sheet__footer {
					margin-top: 0.75rem;
					color: #94a3b8;
					text-align: left;
				}

				[data-post-card] {
					position: relative;
				}

				.post-moderation-overlay {
					position: absolute;
					inset: 0;
					border-radius: 1.25rem;
					background: rgba(15, 23, 42, 0.88);
					color: #fff;
					display: flex;
					gap: 1rem;
					align-items: flex-start;
					padding: 1.25rem;
					z-index: 30;
					backdrop-filter: blur(3px);
				}

				.post-moderation-overlay__icon {
					font-size: 1.25rem;
					line-height: 1;
				}

				.post-moderation-overlay__title {
					font-weight: 600;
				}

				.post-moderation-overlay__message {
					margin-bottom: 0.75rem;
					color: rgba(255, 255, 255, 0.9);
				}

				.post-moderation-overlay.is-dismissed {
					opacity: 0;
					pointer-events: none;
					transition: opacity 0.2s ease;
				}

				@keyframes shareSheetFade {
					from {
						opacity: 0;
						transform: translateY(12px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
			`;

			document.head.appendChild(style);
		}

		dismissModerationOverlay(button) {
			const overlay = button.closest('[data-moderation-overlay]');
			if (!overlay) {
				return;
			}

			overlay.classList.add('is-dismissed');
			overlay.setAttribute('aria-hidden', 'true');
			button.setAttribute('aria-expanded', 'true');

			const card = button.closest('[data-post-card]');
			if (card) {
				card.dataset.moderationRevealed = 'true';
			}

			overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
		}

		registerRippleEffects() {
			document.addEventListener('pointerdown', (event) => {
				const chip = event.target.closest('[data-action-ripple]');
				if (!chip) {
					return;
				}

				this.spawnActionRipple(chip, event);
			});

			document.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
					return;
				}

				const chip = event.target.closest('[data-action-ripple]');
				if (!chip) {
					return;
				}

				this.spawnActionRipple(chip);
			});
		}

		spawnActionRipple(chip, event = null) {
			if (!chip || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
				return;
			}

			chip.querySelectorAll('.action-chip__ripple').forEach((node) => node.remove());
			const ripple = document.createElement('span');
			ripple.className = 'action-chip__ripple';
			const rect = chip.getBoundingClientRect();
			const size = Math.max(rect.width, rect.height) * 1.6;
			ripple.style.width = `${size}px`;
			ripple.style.height = `${size}px`;

			let offsetX = rect.width / 2 - size / 2;
			let offsetY = rect.height / 2 - size / 2;
			if (event) {
				offsetX = event.clientX - rect.left - size / 2;
				offsetY = event.clientY - rect.top - size / 2;
			}

			ripple.style.left = `${offsetX}px`;
			ripple.style.top = `${offsetY}px`;
			chip.appendChild(ripple);
			ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
		}

		syncShareCount(postId, nextValue = null) {
			const card = document.querySelector(`[data-post-card][data-post-id="${postId}"]`);
			if (!card) {
				return;
			}

			const target = card.querySelector('[data-share-count]');
			if (!target) {
				return;
			}

			const current = Number(target.dataset.shareCountValue ?? target.textContent.replace(/[^0-9]/g, '')) || 0;
			const updated = typeof nextValue === 'number' ? nextValue : current + 1;
			target.dataset.shareCountValue = updated.toString();
			target.textContent = new Intl.NumberFormat().format(updated);
		}

		ensureToastStack() {
			let stack = document.querySelector('[data-toast-stack]');
			if (!stack) {
				stack = document.createElement('div');
				stack.className = 'toast-stack';
				stack.dataset.toastStack = 'true';
				stack.setAttribute('role', 'status');
				stack.setAttribute('aria-live', 'polite');
				stack.setAttribute('aria-atomic', 'false');
				document.body.appendChild(stack);
			}
			return stack;
		}

		showToast({ message, type = 'info', duration = 3200 }) {
			if (!message) {
				return;
			}

			const toast = document.createElement('div');
			toast.className = `toast toast--${type}`;
			toast.setAttribute('role', 'status');
			toast.setAttribute('aria-live', 'polite');
			toast.innerHTML = `<span>${message}</span><button type="button" aria-label="Dismiss notification">&times;</button>`;

			const dismissButton = toast.querySelector('button');
			dismissButton.addEventListener('click', () => this.dismissToast(toast));

			this.toastStack.appendChild(toast);

			requestAnimationFrame(() => {
				toast.classList.add('is-visible');
			});

			const timer = setTimeout(() => this.dismissToast(toast), duration);
			toast.dataset.timer = timer.toString();
		}

		dismissToast(toast) {
			if (!toast) {
				return;
			}

			const timer = toast.dataset.timer;
			if (timer) {
				clearTimeout(Number(timer));
			}

			toast.classList.remove('is-visible');
			toast.addEventListener('transitionend', () => toast.remove(), { once: true });
		}
	}

	window.socialInteractions = window.socialInteractions || new SocialInteractions();
})();

