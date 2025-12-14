(function () {
  'use strict';

  const PostsModule = {
    displayFeed(posts = []) {
      const feed = document.getElementById('posts-feed');
      if (!feed) {
        return;
      }

      if (!Array.isArray(posts) || posts.length === 0) {
        feed.innerHTML = '<p class="text-slate-500 text-sm">Your network is quiet. Start the conversation above.</p>';
        return;
      }

      const fragment = document.createDocumentFragment();
      posts.forEach((post) => fragment.appendChild(this.renderPostCard(post)));
      feed.innerHTML = '';
      feed.appendChild(fragment);
    },

    renderPostCard(post) {
      const safePost = post || {};
      const user = safePost.user || {};
      const article = document.createElement('article');
      article.className = 'neo-card post-card post-card--client';

      const header = document.createElement('header');
      header.className = 'post-card__header';

      const avatar = document.createElement('img');
      avatar.className = 'post-card__avatar';
      avatar.alt = user.name || 'Member';
      avatar.src = user.avatar || '/images/default-avatar.png';

      const meta = document.createElement('div');
      meta.className = 'post-card__meta';

      const name = document.createElement('p');
      name.className = 'post-card__author';
      name.textContent = user.name || 'Community member';

      const time = document.createElement('p');
      time.className = 'post-card__time';
      time.textContent = safePost.published_human || 'Moments ago';

      meta.appendChild(name);
      meta.appendChild(time);

      header.appendChild(avatar);
      header.appendChild(meta);
      article.appendChild(header);

      if (safePost.content) {
        const content = document.createElement('p');
        content.className = 'post-card__content';
        content.textContent = safePost.content;
        article.appendChild(content);
      }

      const mediaItems = Array.isArray(safePost.media) ? safePost.media : [];
      if (mediaItems.length > 0) {
        const gallery = document.createElement('div');
        gallery.className = 'post-card__media';

        mediaItems.slice(0, 2).forEach((item) => {
          if (!item || !item.path) {
            return;
          }

          if ((item.type || '').indexOf('video') === 0) {
            const video = document.createElement('video');
            video.src = item.path;
            video.controls = true;
            video.playsInline = true;
            gallery.appendChild(video);
          } else {
            const img = document.createElement('img');
            img.src = item.path;
            img.alt = user.name || 'Media attachment';
            gallery.appendChild(img);
          }
        });

        article.appendChild(gallery);
      }

      const footer = document.createElement('footer');
      footer.className = 'post-card__footer';

      const stats = document.createElement('p');
      stats.className = 'post-card__stats';
      const counts = safePost.counts || {};
      const likes = Number(counts.likes || 0).toLocaleString();
      const comments = Number(counts.comments || 0).toLocaleString();
      stats.textContent = `${likes} likes • ${comments} comments`;

      footer.appendChild(stats);
      article.appendChild(footer);

      return article;
    },
  };

  window.PostsModule = Object.assign({}, window.PostsModule || {}, PostsModule);

  const ready = (callback) => {
    if (document.readyState === 'loading') {
      const handler = () => {
        document.removeEventListener('DOMContentLoaded', handler);
        callback();
      };
      document.addEventListener('DOMContentLoaded', handler);
    } else {
      callback();
    }
  };

  ready(() => {
    initComposer(window.socialComposerConfig || {});
  });

  function initComposer(config) {
    const form = document.getElementById('composer-form');
    if (!form) {
      return;
    }

    const root = form.querySelector('[data-composer-root]');
    if (!root) {
      return;
    }

    const elements = {
      form: form,
      root: root,
      textarea: root.querySelector('[data-composer-input]'),
      charCount: root.querySelector('[data-char-count]'),
      status: root.querySelector('[data-composer-status]'),
      dropzone: root.querySelector('[data-dropzone]'),
      fileInput: root.querySelector('[data-media-input]'),
      uploadTrigger: root.querySelector('[data-upload-trigger]'),
      attachmentList: root.querySelector('[data-attachment-list]'),
      sessionInputs: root.querySelector('[data-session-inputs]'),
      importInputs: root.querySelector('[data-import-inputs]'),
      submitButton: root.querySelector('[data-composer-submit]'),
      uploaderHint: root.querySelector('[data-uploader-hint]'),
      privacy: root.querySelector('[data-privacy]'),
      privacyTrigger: root.querySelector('[data-privacy-trigger]'),
      privacyMenu: root.querySelector('[data-privacy-menu]'),
      privacyValue: root.querySelector('[data-privacy-value]'),
      privacyDescription: root.querySelector('[data-privacy-description]'),
      privacyInput: root.querySelector('[data-privacy-input]'),
      captureTriggers: root.querySelectorAll('[data-capture-trigger]'),
      captureModal: root.querySelector('[data-capture-modal]'),
      capturePreview: root.querySelector('[data-capture-preview]'),
      captureStatus: root.querySelector('[data-capture-status]'),
      captureStart: root.querySelector('[data-capture-start]'),
      captureStop: root.querySelector('[data-capture-stop]'),
      captureCloseButtons: root.querySelectorAll('[data-capture-close]'),
      linkImportPanel: root.querySelector('[data-link-import-panel]'),
      linkImportTrigger: root.querySelector('[data-link-import-trigger]'),
      linkImportInput: root.querySelector('[data-link-import-input]'),
      linkImportSubmit: root.querySelector('[data-link-import-submit]'),
      linkImportCancel: root.querySelector('[data-link-import-cancel]'),
      linkImportStatus: root.querySelector('[data-link-import-status]'),
      linkImportList: root.querySelector('[data-link-import-list]'),
      integrationsTrigger: root.querySelector('[data-integrations-trigger]'),
      integrationsPanel: root.querySelector('[data-integrations-panel]'),
      integrationsStatus: root.querySelector('[data-integrations-status]'),
      integrationsList: root.querySelector('[data-integrations-list]'),
      integrationsCloseButtons: root.querySelectorAll('[data-integrations-close]'),
      integrationsRefresh: root.querySelector('[data-integrations-refresh]'),
    };

    const uploadLimits = (config && config.uploadLimits) || {};
    const privacyOptions = Array.isArray(config && config.privacyOptions) ? config.privacyOptions : [];
    const state = {
      attachments: new Map(),
      uploading: 0,
      placeholder: (config && config.placeholder) || '__MEDIA_SESSION__',
      routes: (config && config.routes) || {},
      limits: {
        maxMedia: Number(uploadLimits.max_media != null ? uploadLimits.max_media : 5),
        maxFileBytes: Number(((uploadLimits.max_file_mb != null ? uploadLimits.max_file_mb : 12) * 1024 * 1024)),
      },
      csrfToken: (config && config.csrfToken) || getCsrfToken(),
      privacyOptions: privacyOptions,
      activePrivacy: (config && config.activePrivacy) || null,
      importItems: new Map(),
      importLimits: {
        maxPerRequest: Number(config && config.integrations && config.integrations.max_links != null ? config.integrations.max_links : 5),
        maxAttachments: Number(config && config.integrations && config.integrations.max_attachments != null ? config.integrations.max_attachments : 5),
      },
      captureConfig: (config && config.capture) || {},
      endpoints: (config && config.endpoints) || {},
      integrationProviders: Array.isArray(config && config.integrations && config.integrations.providers)
        ? config.integrations.providers
        : [],
      integrationProviderMap: new Map(),
      integrationStatuses: new Map(),
      consentCache: {},
    };

    if (Array.isArray(state.integrationProviders)) {
      state.integrationProviders.forEach((provider) => {
        if (provider && provider.key) {
          state.integrationProviderMap.set(provider.key, provider);
        }
      });
    }

    wireCharCount(elements);
    wireDropzone(elements, state);
    wireFilePicker(elements, state);
    wirePrivacy(elements, state);
    wireFormSubmit(elements, state);
    initCapture(elements, state);
    initLinkImporter(elements, state);
    initIntegrationManager(elements, state);
    updateSubmitState(elements, state);
  }

  function initCapture(elements, state) {
    const triggers = elements.captureTriggers;
    const modal = elements.captureModal;
    if (!modal || !triggers || triggers.length === 0) {
      return;
    }

    if (state.captureConfig && state.captureConfig.enabled === false) {
      triggers.forEach((button) => {
        if (button) {
          button.disabled = true;
          button.title = 'Live capture has been disabled by admins.';
        }
      });
      return;
    }

    if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
      triggers.forEach((button) => {
        if (button) {
          button.disabled = true;
          button.title = 'Live capture is not supported in this browser.';
        }
      });
      return;
    }

    const preview = elements.capturePreview;
    const statusEl = elements.captureStatus;
    const startButton = elements.captureStart;
    const stopButton = elements.captureStop;
    let activeType = 'video';
    let stream = null;
    let recorder = null;
    let chunks = [];
    let stopTimer = null;
    let shouldAttach = true;

    const updateStatus = (message) => {
      if (statusEl) {
        statusEl.textContent = message;
      }
    };

    const cleanupStream = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (preview) {
        preview.srcObject = null;
      }
    };

    const hideModal = () => {
      modal.hidden = true;
      cleanupStream();
      if (startButton) {
        startButton.disabled = false;
      }
      if (stopButton) {
        stopButton.disabled = true;
      }
      if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }
      updateStatus('Grant access to your microphone or camera to begin.');
    };

    const parseResolution = () => {
      const defaults = { width: 1280, height: 720 };
      const captureConfig = state.captureConfig || {};
      const maxRes = captureConfig.video && captureConfig.video.max_resolution ? captureConfig.video.max_resolution : null;
      if (typeof maxRes === 'string' && maxRes.includes('x')) {
        const parts = maxRes.split('x');
        const width = Number(parts[0]) || defaults.width;
        const height = Number(parts[1]) || defaults.height;
        return { width, height };
      }

      return defaults;
    };

    const requestStream = (type) => {
      const wantsVideo = type !== 'audio';
      const resolution = parseResolution();
      const constraints = {
        audio: true,
        video: wantsVideo ? { width: resolution.width, height: resolution.height } : false,
      };

      return navigator.mediaDevices.getUserMedia(constraints)
        .then((mediaStream) => {
          stream = mediaStream;
          if (preview) {
            preview.srcObject = stream;
            preview.muted = true;
            const playPromise = preview.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
          }
          updateStatus(wantsVideo ? 'Camera live. Press start when ready.' : 'Microphone live. Press start when ready.');
        })
        .catch((error) => {
          console.error('Capture permission error', error);
          updateStatus('We could not access your device. Check browser permissions.');
          throw error;
        });
    };

    const ensureConsent = (type) => {
      const endpoint = state.endpoints && (state.endpoints.capture_consent || state.endpoints.captureConsent);
      if (!endpoint) {
        return Promise.resolve();
      }

      const now = Date.now();
      const intervalHours = Number(state.captureConfig && state.captureConfig.consent_interval_hours != null
        ? state.captureConfig.consent_interval_hours
        : 24);
      const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
      const cacheKey = type === 'audio' ? 'audio' : 'video';
      if (state.consentCache[cacheKey] && (now - state.consentCache[cacheKey]) < intervalMs) {
        return Promise.resolve();
      }

      const payload = {
        capture_type: cacheKey,
        context: 'social_composer',
        consent_copy: state.captureConfig && state.captureConfig.consent_copy ? state.captureConfig.consent_copy : undefined,
      };

      return fetch(endpoint, {
        method: 'POST',
        headers: buildJsonHeaders(state),
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      })
        .then(handleJsonResponse)
        .then(() => {
          state.consentCache[cacheKey] = now;
        })
        .catch((error) => {
          console.warn('Consent recording failed', error);
        });
    };

    const chooseMime = () => {
      const captureConfig = state.captureConfig || {};
      const key = activeType === 'audio' ? 'audio' : 'video';
      const section = captureConfig[key] || {};
      const preferred = section.preferred_mime;
      const mimeTypes = Array.isArray(section.mime_types) ? section.mime_types : [];
      const supported = (candidate) => {
        if (!candidate) {
          return true;
        }
        if (window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function') {
          return MediaRecorder.isTypeSupported(candidate);
        }
        return true;
      };

      if (preferred && supported(preferred)) {
        return preferred;
      }

      for (let index = 0; index < mimeTypes.length; index += 1) {
        if (supported(mimeTypes[index])) {
          return mimeTypes[index];
        }
      }

      return key === 'audio' ? 'audio/webm' : 'video/webm';
    };

    const startRecording = async () => {
      try {
        shouldAttach = true;
        if (!stream) {
          await requestStream(activeType);
        }
        await ensureConsent(activeType);
      } catch (error) {
        return;
      }

      if (!stream) {
        return;
      }

      chunks = [];
      const mimeType = chooseMime();
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (error) {
        console.error('Recorder initialisation failed', error);
        updateStatus('Recording is unavailable in this browser.');
        return;
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        finalizeCapture();
      };

      recorder.start(1000);
      if (startButton) {
        startButton.disabled = true;
      }
      if (stopButton) {
        stopButton.disabled = false;
      }
      updateStatus('Recording… tap stop when finished.');
      const maxSeconds = Number(state.captureConfig && state.captureConfig.max_duration_seconds != null
        ? state.captureConfig.max_duration_seconds
        : 180);
      stopTimer = setTimeout(() => {
        stopRecording(false, 'Max duration reached, finishing up…');
      }, Math.max(1000, maxSeconds * 1000));
    };

    const stopRecording = (forceAbort = false, message = null) => {
      if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }

      if (message) {
        updateStatus(message);
      }

      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else if (forceAbort) {
        finalizeCapture(true);
      }

      if (startButton) {
        startButton.disabled = false;
      }
      if (stopButton) {
        stopButton.disabled = true;
      }
    };

    const finalizeCapture = (aborted = false) => {
      const shouldKeep = !aborted && shouldAttach && chunks.length > 0;
      if (shouldKeep) {
        const blobType = chunks[0].type || (activeType === 'audio' ? 'audio/webm' : 'video/webm');
        const blob = new Blob(chunks, { type: blobType });
        const extension = blob.type.indexOf('audio/') === 0 ? 'webm' : 'webm';
        const filename = `capture-${activeType}-${Date.now()}.${extension}`;
        const file = new File([blob], filename, { type: blob.type });
        handleFiles([file], elements, state);
        setStatus(elements, activeType === 'audio' ? 'Audio clip attached.' : 'Video clip attached.');
      }

      chunks = [];
      shouldAttach = true;
      recorder = null;
      hideModal();
    };

    const toggleModal = (type) => {
      activeType = type === 'audio' ? 'audio' : 'video';
      modal.hidden = false;
      updateStatus('Connecting to your device…');
      requestStream(activeType).catch(() => {});
    };

    Array.from(triggers || []).forEach((trigger) => {
      if (!trigger) {
        return;
      }
      trigger.addEventListener('click', () => toggleModal(trigger.dataset.captureTrigger || 'video'));
    });

    if (startButton) {
      startButton.addEventListener('click', () => startRecording());
    }

    if (stopButton) {
      stopButton.addEventListener('click', () => stopRecording(false));
    }

    if (elements.captureCloseButtons && elements.captureCloseButtons.forEach) {
      elements.captureCloseButtons.forEach((button) => {
        button.addEventListener('click', () => {
          shouldAttach = false;
          stopRecording(true);
        });
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) {
        shouldAttach = false;
        stopRecording(true);
      }
    });
  }

  function initLinkImporter(elements, state) {
    const trigger = elements.linkImportTrigger;
    const panel = elements.linkImportPanel;
    const input = elements.linkImportInput;
    const submit = elements.linkImportSubmit;
    const cancel = elements.linkImportCancel;
    const statusEl = elements.linkImportStatus;
    const list = elements.linkImportList;
    if (!trigger || !panel || !input || !submit || !list) {
      return;
    }

    const endpoint = state.endpoints && (state.endpoints.link_import || state.endpoints.linkImport);
    if (!endpoint) {
      trigger.disabled = true;
      if (statusEl) {
        statusEl.textContent = 'Link importing is unavailable right now.';
        statusEl.classList.remove('hidden');
      }
      return;
    }

    list.hidden = true;

    const showStatus = (message, isError) => {
      if (!statusEl) {
        if (isError) {
          setStatus(elements, message);
        }
        return;
      }

      statusEl.textContent = message;
      statusEl.classList.toggle('hidden', !message);
      statusEl.classList.toggle('text-rose-600', Boolean(isError));
      statusEl.classList.toggle('text-emerald-600', !isError);
    };

    const togglePanel = (show) => {
      const shouldShow = typeof show === 'boolean' ? show : panel.hidden;
      panel.hidden = !shouldShow;
      if (!panel.hidden) {
        input.focus();
      } else {
        input.value = '';
        showStatus('', false);
      }
    };

    trigger.addEventListener('click', () => togglePanel(panel.hidden));

    if (cancel) {
      cancel.addEventListener('click', () => togglePanel(false));
    }

    submit.addEventListener('click', async () => {
      const links = parseLinks(input.value);
      if (links.length === 0) {
        showStatus('Paste at least one supported link.', true);
        return;
      }

      if (links.length > state.importLimits.maxPerRequest) {
        showStatus(`You can import up to ${state.importLimits.maxPerRequest} links at once.`, true);
        return;
      }

      if (state.importItems.size >= state.importLimits.maxAttachments) {
        showStatus('You have reached the attachment limit for imported links.', true);
        return;
      }

      submit.disabled = true;
      showStatus('Importing links…', false);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: buildJsonHeaders(state),
          body: JSON.stringify({ links }),
          credentials: 'same-origin',
        });
        const payload = await handleJsonResponse(response);
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) {
          showStatus('No supported providers detected.', true);
          return;
        }

        let added = 0;
        items.forEach((item) => {
          if (state.importItems.size < state.importLimits.maxAttachments) {
            if (addImportItem(elements, state, item)) {
              added += 1;
            }
          }
        });

        if (added === 0) {
          showStatus('All items are already attached or limits were reached.', true);
        } else {
          showStatus('Links queued. You can add more or close this panel.', false);
          input.value = '';
          togglePanel(false);
        }
      } catch (error) {
        console.error('Link import failed', error);
        showStatus(error && error.message ? error.message : 'Unable to import links right now.', true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function initIntegrationManager(elements, state) {
    const trigger = elements.integrationsTrigger;
    const panel = elements.integrationsPanel;
    if (!trigger || !panel) {
      return;
    }

    const indexEndpoint = state.endpoints && (state.endpoints.integrations_index || state.endpoints.integrationsIndex);
    const connectTemplate = state.endpoints && (state.endpoints.integrations_connect || state.endpoints.integrationsConnect);
    const disconnectTemplate = state.endpoints && (state.endpoints.integrations_disconnect || state.endpoints.integrationsDisconnect);

    if (!indexEndpoint) {
      trigger.disabled = true;
      return;
    }

    const setStatus = (message, isError) => {
      if (!elements.integrationsStatus) {
        return;
      }
      elements.integrationsStatus.textContent = message;
      elements.integrationsStatus.classList.toggle('text-rose-600', Boolean(isError));
      elements.integrationsStatus.classList.toggle('text-slate-600', !isError);
    };

    const closePanel = () => {
      panel.hidden = true;
    };

    const render = () => {
      const list = elements.integrationsList;
      if (!list) {
        return;
      }

      list.innerHTML = '';
      const providers = state.integrationProviders.length > 0
        ? state.integrationProviders
        : Array.from(state.integrationStatuses.values());

      if (!providers.length) {
        setStatus('No integrations configured for your account.', false);
        return;
      }

      providers.forEach((provider) => {
        const status = state.integrationStatuses.get(provider.key) || {};
        const item = document.createElement('li');
        item.className = 'composer-integrations__item';
        const meta = document.createElement('div');
        meta.className = 'composer-integrations__meta';

        const label = document.createElement('p');
        label.className = 'font-semibold mb-0';
        label.textContent = provider.label || provider.key;
        const hint = document.createElement('small');
        hint.className = 'text-slate-500';
        hint.textContent = status.connected ? 'Connected' : 'Not connected';
        meta.appendChild(label);
        meta.appendChild(hint);

        const action = document.createElement('button');
        action.type = 'button';
        action.className = status.connected ? 'composer-secondary' : 'composer-primary';
        action.textContent = status.connected ? 'Disconnect' : 'Connect';
        action.disabled = (!status.connected && !connectTemplate) || (status.connected && !disconnectTemplate);

        action.addEventListener('click', () => {
          if (status.connected) {
            disconnect(provider.key);
          } else {
            connect(provider.key);
          }
        });

        item.appendChild(meta);
        item.appendChild(action);
        list.appendChild(item);
      });

      setStatus('Connections update every few minutes.', false);
    };

    const loadStatuses = (force = false) => {
      if (!force && state.integrationStatuses.size > 0) {
        render();
        return;
      }

      setStatus('Syncing provider statuses…', false);
      fetch(indexEndpoint, {
        headers: buildJsonHeaders(state, { acceptOnly: true }),
        credentials: 'same-origin',
      })
        .then(handleJsonResponse)
        .then((payload) => {
          const providers = Array.isArray(payload.data) ? payload.data : payload;
          if (Array.isArray(providers)) {
            state.integrationStatuses.clear();
            providers.forEach((entry) => {
              if (entry && entry.provider) {
                state.integrationStatuses.set(entry.provider, Object.assign(
                  { provider: entry.provider },
                  entry,
                  { connected: Boolean(entry.connected || entry.status === 'connected') }
                ));
              }
            });
          }
          render();
        })
        .catch((error) => {
          console.error('Unable to load integrations', error);
          setStatus('Unable to load providers right now.', true);
        });
    };

    const connect = async (providerKey) => {
      if (!connectTemplate) {
        return;
      }

      const endpoint = connectTemplate.replace('__provider__', providerKey);
      setStatus(`Connecting ${resolveProviderLabel(state, providerKey)}…`, false);

      try {
        const payload = {};
        const handle = window.prompt('Add your handle (optional)');
        if (handle) {
          payload.handle = handle;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: buildJsonHeaders(state),
          body: JSON.stringify(payload),
          credentials: 'same-origin',
        });

        const body = await handleJsonResponse(response);
        const normalized = body && body.data ? body.data : body;
        state.integrationStatuses.set(providerKey, Object.assign({
          provider: providerKey,
          connected: true,
          status: 'connected',
        }, normalized));
        render();
        setStatus('Connected successfully.', false);
      } catch (error) {
        console.error('Integration connect failed', error);
        setStatus(error && error.message ? error.message : 'Unable to connect.', true);
      }
    };

    const disconnect = async (providerKey) => {
      if (!disconnectTemplate) {
        return;
      }

      const endpoint = disconnectTemplate.replace('__provider__', providerKey);
      setStatus(`Disconnecting ${resolveProviderLabel(state, providerKey)}…`, false);

      try {
        await fetch(endpoint, {
          method: 'DELETE',
          headers: buildJsonHeaders(state, { acceptOnly: true }),
          credentials: 'same-origin',
        }).then(handleJsonResponse);

        state.integrationStatuses.set(providerKey, {
          provider: providerKey,
          connected: false,
          status: 'disconnected',
        });
        render();
        setStatus('Disconnected.', false);
      } catch (error) {
        console.error('Integration disconnect failed', error);
        setStatus(error && error.message ? error.message : 'Unable to disconnect.', true);
      }
    };

    trigger.addEventListener('click', () => {
      panel.hidden = false;
      loadStatuses();
    });

    if (elements.integrationsCloseButtons && elements.integrationsCloseButtons.forEach) {
      elements.integrationsCloseButtons.forEach((button) => button.addEventListener('click', () => closePanel()));
    }

    if (elements.integrationsRefresh) {
      elements.integrationsRefresh.addEventListener('click', () => loadStatuses(true));
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        closePanel();
      }
    });
  }

  function addImportItem(elements, state, item) {
    if (!item || !item.signature || !elements.importInputs || !elements.linkImportList) {
      return false;
    }

    if (state.importItems.has(item.signature)) {
      return false;
    }

    if (state.importItems.size >= state.importLimits.maxAttachments) {
      return false;
    }

    const entry = document.createElement('li');
    entry.className = 'composer-link-import__item';
    entry.dataset.importSignature = item.signature;

    const meta = document.createElement('div');
    meta.className = 'composer-link-import__meta';

    const label = document.createElement('p');
    label.className = 'font-semibold mb-0';
    label.textContent = resolveProviderLabel(state, item.provider || 'link');

    const link = document.createElement('small');
    link.className = 'text-slate-500 break-all';
    link.textContent = item.original_url || item.embed_url || '';

    meta.appendChild(label);
    meta.appendChild(link);

    const actions = document.createElement('div');
    actions.className = 'composer-link-import__actions';

    if (item.original_url || item.embed_url) {
      const openButton = document.createElement('a');
      openButton.href = item.original_url || item.embed_url;
      openButton.target = '_blank';
      openButton.rel = 'noopener';
      openButton.textContent = 'Open preview';
      actions.appendChild(openButton);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'composer-link-import__remove';
    removeButton.innerHTML = '<span class="visually-hidden">Remove</span><i class="fas fa-times"></i>';
    removeButton.addEventListener('click', () => removeImportItem(elements, state, item.signature));
    actions.appendChild(removeButton);

    entry.appendChild(meta);
    entry.appendChild(actions);

    elements.linkImportList.appendChild(entry);

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'import_items[]';
    input.value = JSON.stringify(item);
    elements.importInputs.appendChild(input);

    state.importItems.set(item.signature, {
      element: entry,
      hiddenInput: input,
    });

    updateImportListVisibility(elements, state);

    return true;
  }

  function removeImportItem(elements, state, signature) {
    const current = state.importItems.get(signature);
    if (!current) {
      return;
    }

    if (current.element) {
      current.element.remove();
    }

    if (current.hiddenInput) {
      current.hiddenInput.remove();
    }

    state.importItems.delete(signature);
    updateImportListVisibility(elements, state);
  }

  function updateImportListVisibility(elements, state) {
    if (elements.linkImportList) {
      elements.linkImportList.hidden = state.importItems.size === 0;
    }
  }

  function resolveProviderLabel(state, providerKey) {
    if (state.integrationProviderMap && state.integrationProviderMap.has(providerKey)) {
      const provider = state.integrationProviderMap.get(providerKey);
      return provider.label || providerKey;
    }

    const snapshot = state.integrationStatuses && state.integrationStatuses.get
      ? state.integrationStatuses.get(providerKey)
      : null;

    if (snapshot && snapshot.label) {
      return snapshot.label;
    }

    if (providerKey) {
      return providerKey;
    }

    return 'Link';
  }

  function parseLinks(value) {
    if (!value) {
      return [];
    }

    const tokens = value
      .split(/[\n,]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    const seen = new Set();
    const links = [];
    tokens.forEach((token) => {
      if (!seen.has(token)) {
        seen.add(token);
        links.push(token);
      }
    });

    return links;
  }

  function wireCharCount(elements) {
    const input = elements.textarea;
    const counter = elements.charCount;

    if (!input || !counter) {
      return;
    }

    const update = () => {
      const length = input.value.length;
      counter.textContent = `${length} / 5000`;
    };

    input.addEventListener('input', update);
    update();
  }

  function wireDropzone(elements, state) {
    const dropzone = elements.dropzone;
    if (!dropzone) {
      return;
    }

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, () => {
        dropzone.classList.remove('is-dragging');
      });
    });

    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      const transfer = event.dataTransfer;
      const files = transfer && transfer.files ? transfer.files : null;
      if (files && files.length > 0) {
        handleFiles(Array.from(files), elements, state);
      }
    });

    if (elements.uploadTrigger) {
      elements.uploadTrigger.addEventListener('click', () => {
        if (elements.fileInput) {
          elements.fileInput.click();
        }
      });
    }
  }

  function wireFilePicker(elements, state) {
    const fileInput = elements.fileInput;
    if (!fileInput) {
      return;
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFiles(Array.from(fileInput.files), elements, state);
        fileInput.value = '';
      }
    });
  }

  function wirePrivacy(elements, state) {
    const trigger = elements.privacyTrigger;
    const menu = elements.privacyMenu;

    if (!trigger || !menu) {
      return;
    }

    const selectOption = (key) => {
      const option = state.privacyOptions.find((item) => item.key === key);
      if (!option) {
        return;
      }

      if (elements.privacyValue) {
        elements.privacyValue.textContent = option.label;
      }
      if (elements.privacyDescription) {
        elements.privacyDescription.textContent = option.description;
      }
      if (elements.privacyInput) {
        elements.privacyInput.value = option.visibility;
      }

      menu.querySelectorAll('[data-privacy-option]').forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.privacyOption === key);
      });
    };

    menu.addEventListener('click', (event) => {
      const target = event.target.closest('[data-privacy-option]');
      if (!target) {
        return;
      }

      selectOption(target.dataset.privacyOption);
      menu.hidden = true;
    });

    trigger.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
    });

    document.addEventListener('click', (event) => {
      if (!menu.hidden && !menu.contains(event.target) && event.target !== trigger) {
        menu.hidden = true;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        menu.hidden = true;
      }
    });

    const preferredKey = state.activePrivacy && state.activePrivacy.key
      ? state.activePrivacy.key
      : (state.privacyOptions[0] ? state.privacyOptions[0].key : null);

    if (preferredKey) {
      selectOption(preferredKey);
    }
  }

  function wireFormSubmit(elements, state) {
    const form = elements.form;
    if (!form) {
      return;
    }

    form.addEventListener('submit', (event) => {
      if (state.uploading > 0) {
        event.preventDefault();
        setStatus(elements, 'Please wait for uploads to finish before posting.');
        return;
      }

      const textValue = elements.textarea ? elements.textarea.value : '';
      if (!textValue.trim() && state.attachments.size === 0) {
        event.preventDefault();
        setStatus(elements, 'Share a thought or attach at least one photo/video.');
        return;
      }

      if (elements.submitButton) {
        elements.submitButton.disabled = true;
      }
    });
  }

  function handleFiles(files, elements, state) {
    clearStatus(elements);

    const remainingSlots = state.limits.maxMedia - state.attachments.size;
    if (remainingSlots <= 0) {
      setStatus(elements, `You can attach up to ${state.limits.maxMedia} files.`);
      return;
    }

    const accepted = [];

    files.forEach((file) => {
      if (accepted.length >= remainingSlots) {
        return;
      }

      if (!isSupportedFile(file)) {
        setStatus(elements, `${file.name} is not a supported media type.`);
        return;
      }

      if (file.size > state.limits.maxFileBytes) {
        const maxMb = Math.round(state.limits.maxFileBytes / 1024 / 1024);
        setStatus(elements, `${file.name} exceeds the ${maxMb}MB limit.`);
        return;
      }

      accepted.push(file);
    });

    accepted.forEach((file) => queueUpload(file, elements, state));
  }

  function queueUpload(file, elements, state) {
    const attachment = createAttachment(file, elements, state);
    state.attachments.set(attachment.localId, attachment);
    state.uploading += 1;
    updateSubmitState(elements, state);
    uploadFile(attachment, elements, state)
      .catch((error) => {
        if (attachment.cancelled) {
          return;
        }
        console.error('Upload failed', error);
        markAttachmentError(attachment, error && error.message ? error.message : 'Upload failed');
      })
      .finally(() => {
        state.uploading = Math.max(0, state.uploading - 1);
        updateSubmitState(elements, state);
      });
  }

  async function uploadFile(attachment, elements, state) {
    const chunkBytes = chooseChunkSize(attachment.file);
    const totalChunks = Math.max(1, Math.ceil(attachment.file.size / chunkBytes));
    attachment.status.textContent = 'Starting upload…';

    const payload = {
      media_type: attachment.file.type.indexOf('video/') === 0 ? 'video' : 'image',
      mime_type: attachment.file.type || null,
      total_size: attachment.file.size,
      chunk_size: chunkBytes,
      total_chunks: totalChunks,
    };

    const session = await createSession(state, payload);
    attachment.sessionId = session.id;
    if (attachment.cancelled) {
      return;
    }

    await uploadChunks(state, attachment, chunkBytes, totalChunks);
    if (attachment.cancelled) {
      return;
    }

    await finalizeSession(state, attachment);
    if (attachment.cancelled) {
      return;
    }

    persistSessionInput(elements, attachment);
    attachment.status.textContent = 'Upload complete • safety scan running…';
    await pollScan(state, attachment);

    if (!attachment.cancelled) {
      attachment.status.textContent = 'Ready to post';
      if (attachment.element && attachment.element.dataset) {
        attachment.element.dataset.status = 'completed';
      }
    }
  }

  function createAttachment(file, elements, state) {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    const li = document.createElement('li');
    li.className = 'composer-attachment';
    li.dataset.attachmentId = id;

    const thumbnail = document.createElement('div');
    thumbnail.className = 'composer-attachment__thumb';

    if (file.type.indexOf('image/') === 0) {
      const img = document.createElement('img');
      img.alt = file.name;
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => URL.revokeObjectURL(objectUrl);
      thumbnail.appendChild(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'composer-attachment__icon';
      icon.innerHTML = '<i class="fas fa-video"></i>';
      thumbnail.appendChild(icon);
    }

    const body = document.createElement('div');
    body.className = 'composer-attachment__body';

    const title = document.createElement('p');
    title.className = 'composer-attachment__title';
    title.textContent = file.name;

    const details = document.createElement('p');
    details.className = 'composer-attachment__details';
    details.textContent = formatBytes(file.size);

    const status = document.createElement('p');
    status.className = 'composer-attachment__status';
    status.textContent = 'Queued';

    body.appendChild(title);
    body.appendChild(details);
    body.appendChild(status);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'composer-attachment__remove';
    remove.innerHTML = '<span class="visually-hidden">Remove</span><i class="fas fa-times"></i>';
    remove.addEventListener('click', () => removeAttachment(id, elements, state));

    li.appendChild(thumbnail);
    li.appendChild(body);
    li.appendChild(remove);

    if (elements.attachmentList) {
      elements.attachmentList.appendChild(li);
    }

    return {
      localId: id,
      file,
      element: li,
      status,
      remove,
      sizeLabel: details,
      cancelled: false,
      sessionId: null,
    };
  }

  function removeAttachment(localId, elements, state) {
    if (!state || !state.attachments.has(localId)) {
      return;
    }

    const attachment = state.attachments.get(localId);
    attachment.cancelled = true;
    if (attachment.hiddenInput) {
      attachment.hiddenInput.remove();
    }
    if (attachment.element) {
      attachment.element.remove();
    }
    state.attachments.delete(localId);
    updateSubmitState(elements, state);
  }

  function createSession(state, payload) {
    const routes = state.routes || {};
    const url = routes.create;
    if (!url) {
      return Promise.reject(new Error('Upload route unavailable.'));
    }

    return fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(state),
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    }).then(handleJsonResponse);
  }

  function uploadChunks(state, attachment, chunkBytes, totalChunks) {
    const routes = state.routes || {};
    const urlTemplate = routes.chunk;
    if (!urlTemplate) {
      return Promise.reject(new Error('Chunk route unavailable.'));
    }

    if (!attachment.sessionId) {
      return Promise.reject(new Error('Upload session missing.'));
    }

    let promise = Promise.resolve();
    for (let index = 0; index < totalChunks; index += 1) {
      promise = promise.then(() => {
        if (attachment.cancelled) {
          throw new Error('Upload cancelled.');
        }

        const start = index * chunkBytes;
        const end = Math.min(start + chunkBytes, attachment.file.size);
        const chunk = attachment.file.slice(start, end);
        const chunkIndex = index + 1;
        attachment.status.textContent = `Uploading chunk ${chunkIndex}/${totalChunks}`;

        const url = urlTemplate.replace(state.placeholder, attachment.sessionId);
        const data = new FormData();
        data.append('chunk_index', chunkIndex.toString());
        data.append('chunk', chunk, attachment.file.name);

        return fetch(url, {
          method: 'POST',
          headers: buildUploadHeaders(state),
          body: data,
          credentials: 'same-origin',
        }).then(handleJsonResponse);
      });
    }

    return promise;
  }

  function finalizeSession(state, attachment) {
    const routes = state.routes || {};
    const urlTemplate = routes.complete;
    if (!urlTemplate) {
      return Promise.reject(new Error('Finalize route unavailable.'));
    }

    const url = urlTemplate.replace(state.placeholder, attachment.sessionId);
    attachment.status.textContent = 'Processing upload…';

    return fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(state),
      body: JSON.stringify({}),
      credentials: 'same-origin',
    }).then(handleJsonResponse);
  }

  function pollScan(state, attachment) {
    if (!attachment.sessionId) {
      return Promise.resolve();
    }

    const routes = state.routes || {};
    const urlTemplate = routes.show;
    if (!urlTemplate) {
      return Promise.resolve();
    }

    const url = urlTemplate.replace(state.placeholder, attachment.sessionId);
    const maxAttempts = 10;
    let attempt = 0;

    const poll = () => {
      attempt += 1;
      return fetch(url, {
        headers: buildJsonHeaders(state, { acceptOnly: true }),
        credentials: 'same-origin',
      })
        .then(handleJsonResponse)
        .then((session) => {
          const status = session.scan_status;
          const verdict = session.scan_verdict;

          if (['failed', 'blocked'].includes(status) || verdict === 'block') {
            throw new Error('Upload blocked by safety systems.');
          }

          if (status === 'running' || status === 'pending') {
            if (attempt >= maxAttempts) {
              return;
            }

            attachment.status.textContent = 'Safety scan running…';
            return delay(2000).then(poll);
          }
        });
    };

    return poll().catch((error) => {
      console.warn('Scan polling error', error);
      throw error;
    });
  }

  function persistSessionInput(elements, attachment) {
    if (!attachment.sessionId || !elements.sessionInputs) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'media_sessions[]';
    input.value = attachment.sessionId;
    elements.sessionInputs.appendChild(input);
    attachment.hiddenInput = input;
  }

  function markAttachmentError(attachment, message) {
    attachment.status.textContent = message;
    attachment.element.classList.add('is-error');
    if (attachment.hiddenInput) {
      attachment.hiddenInput.remove();
    }
  }

  function setStatus(elements, message) {
    if (!elements.status) {
      return;
    }
    elements.status.textContent = message;
    elements.status.classList.remove('hidden');
  }

  function clearStatus(elements) {
    if (!elements.status) {
      return;
    }
    elements.status.textContent = '';
    elements.status.classList.add('hidden');
  }

  function updateSubmitState(elements, state) {
    if (elements.submitButton) {
      elements.submitButton.disabled = state.uploading > 0;
    }

    if (elements.uploaderHint) {
      const used = state.attachments.size;
      const max = state.limits.maxMedia;
      if (state.uploading > 0) {
        elements.uploaderHint.textContent = `Uploading ${state.uploading} item${state.uploading === 1 ? '' : 's'}…`;
      } else {
        const remaining = Math.max(0, max - used);
        elements.uploaderHint.textContent = `You can add ${remaining} more item${remaining === 1 ? '' : 's'}.`;
      }
    }
  }

  function chooseChunkSize(file) {
    const minChunk = 512 * 1024; // 512KB
    const maxChunk = 4 * 1024 * 1024; // 4MB

    if (!file || !file.size) {
      return minChunk;
    }

    if (file.size <= minChunk) {
      return Math.max(1, file.size);
    }

    return Math.min(maxChunk, file.size);
  }

  function isSupportedFile(file) {
    if (!file || !file.type) {
      return false;
    }

    return file.type.indexOf('image/') === 0 || file.type.indexOf('video/') === 0;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) {
      return '0 B';
    }

    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(1)} ${units[index]}`;
  }

  function buildJsonHeaders(state, options = {}) {
    const headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (!options.acceptOnly) {
      headers['Content-Type'] = 'application/json';
    }

    if (!options.acceptOnly && state.csrfToken) {
      headers['X-CSRF-TOKEN'] = state.csrfToken;
    }

    return headers;
  }

  function buildUploadHeaders(state) {
    const headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (state.csrfToken) {
      headers['X-CSRF-TOKEN'] = state.csrfToken;
    }

    return headers;
  }

  function handleJsonResponse(response) {
    if (!response.ok) {
      return response
        .json()
        .catch(() => ({}))
        .then((body) => {
          const message = body && body.message ? body.message : 'Upload request failed.';
          throw new Error(message);
        });
    }

    return response.json().then((body) => {
      if (body && Object.prototype.hasOwnProperty.call(body, 'data')) {
        return body.data;
      }
      return body;
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  }

})();
