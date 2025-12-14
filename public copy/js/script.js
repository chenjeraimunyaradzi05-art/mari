document.addEventListener('DOMContentLoaded', () => {
  if (window.smoothscroll && typeof window.smoothscroll.polyfill === 'function') {
    window.smoothscroll.polyfill();
  }

  const yearEl = document.querySelector('.year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const btnNav = document.querySelector('.btn-mobile-nav');
  if (btnNav) {
    btnNav.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (href === '#') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const sectionEl = document.querySelector(href);
        sectionEl?.scrollIntoView({ behavior: 'smooth' });
      }
      document.body.classList.remove('nav-open');
    });
  });

  const heroSection = document.querySelector('.section-hero');
  if (heroSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) {
          document.body.classList.add('sticky');
        } else {
          document.body.classList.remove('sticky');
        }
      },
      {
        root: null,
        threshold: 0,
        rootMargin: '-80px',
      }
    );

    observer.observe(heroSection);
  }

  document.querySelectorAll('.ad-slot').forEach((slot) => {
    const carousel = slot.querySelector('.ad-carousel');
    const cards = Array.from(slot.querySelectorAll('.ad-card'));

    if (!carousel || !cards.length) {
      return;
    }

    let currentIndex = 0;
    let timerId = null;
    let activeVideo = null;

    const setActiveCard = (index) => {
      cards.forEach((card, idx) => {
        const isActive = idx === index;
        card.classList.toggle('ad-card--active', isActive);
        const video = card.querySelector('video');
        if (video && !isActive) {
          video.pause();
          video.currentTime = 0;
        }
      });
    };

    const scrollToCard = (index) => {
      const target = cards[index];
      if (!target) {
        return;
      }
      carousel.scrollTo({
        left: target.offsetLeft - carousel.offsetLeft,
        behavior: 'smooth',
      });
    };

    const nextIndex = () => ((currentIndex + 1) % cards.length + cards.length) % cards.length;

    const activateIndex = (index) => {
      currentIndex = ((index % cards.length) + cards.length) % cards.length;
      setActiveCard(currentIndex);
      scrollToCard(currentIndex);
      scheduleAdvance();
    };

    const scheduleAdvance = () => {
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = null;
      }

      if (activeVideo) {
        activeVideo.pause();
        activeVideo.currentTime = 0;
        activeVideo = null;
      }

      const activeCard = cards[currentIndex];
      const video = activeCard.querySelector('video');

      if (video) {
        activeVideo = video;

        const startVideo = () => {
          video.currentTime = 0;
          video.play().catch(() => {});
        };

        if (video.readyState >= 2) {
          startVideo();
        } else {
          video.addEventListener('loadeddata', startVideo, { once: true });
        }

        const handleEnded = () => {
          video.removeEventListener('ended', handleEnded);
          if (activeVideo === video) {
            activeVideo = null;
          }
          activateIndex(nextIndex());
        };

        video.addEventListener('ended', handleEnded, { once: true });

        const fallbackMs = Number.isFinite(video.duration) && video.duration > 0
          ? Math.max(video.duration * 1000, 5000)
          : 12000;

        timerId = window.setTimeout(() => {
          video.removeEventListener('ended', handleEnded);
          if (activeVideo === video) {
            activeVideo = null;
          }
          activateIndex(nextIndex());
        }, fallbackMs + 400);
      } else if (cards.length > 1) {
        const delay = 5000 + Math.random() * 5000;
        timerId = window.setTimeout(() => activateIndex(nextIndex()), delay);
      }
    };

    setActiveCard(currentIndex);
    if (cards.length > 1) {
      scheduleAdvance();
    } else {
      cards[0].classList.add('ad-card--active');
    }
  });

  initMediaSliders();
  initImpactWidgets();

  const beaconMeta = document.querySelector('meta[name="ads-beacon-endpoint"]');
  const beaconUrl = beaconMeta?.getAttribute('content') || '';
  const impactTelemetryEndpoint = '/api/v1/analytics/events';
  const impactLocale = navigator.language || 'en-AU';
  const impactNumberFormatter = new Intl.NumberFormat(impactLocale, { maximumFractionDigits: 0 });
  const impactDecimalFormatter = new Intl.NumberFormat(impactLocale, { maximumFractionDigits: 2 });
  const IMPACT_ICON_MAP = {
    members: 'people-outline',
    jobs: 'briefcase-outline',
    housing: 'home-outline',
    ventures: 'rocket-outline',
    mentorship: 'people-circle-outline',
    roles: 'layers-outline',
    safety: 'shield-checkmark-outline',
    budget: 'wallet-outline',
    ai: 'sparkles-outline',
    radar: 'locate-outline',
    velocity: 'speedometer-outline',
  };

  if (beaconUrl) {
    const trackedImpressions = new Set();

    const impressionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const payload = buildAdPayload(entry.target, 'impression');
          if (!payload) {
            return;
          }

          const key = `${payload.creative_id}-${payload.slot}`;
          if (trackedImpressions.has(key)) {
            return;
          }

          trackedImpressions.add(key);
          postAdBeacon(payload);
          impressionObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    document.querySelectorAll('.ad-card[data-creative]').forEach((card) => {
      impressionObserver.observe(card);
    });

    document.querySelectorAll('.ad-cta[data-track-click="true"]').forEach((cta) => {
      cta.addEventListener('click', () => {
        const card = cta.closest('.ad-card');
        const payload = buildAdPayload(card, 'click');
        if (!payload) {
          return;
        }

        postAdBeacon(payload);
      });
    });
  }

  function initMediaSliders() {
    const sliders = document.querySelectorAll('[data-slider]');

    sliders.forEach((track) => {
      if (track.dataset.sliderInitialized === 'true') {
        return;
      }

      const slides = Array.from(track.children);
      if (slides.length < 2) {
        return;
      }

      track.dataset.sliderInitialized = 'true';
      track.classList.add('media-slider-track');

      const syncSlideWidths = () => {
        const width = track.clientWidth;
        slides.forEach((slide) => {
          slide.style.minWidth = `${width}px`;
          slide.style.maxWidth = `${width}px`;
        });
      };

      syncSlideWidths();
      window.addEventListener('resize', () => window.requestAnimationFrame(syncSlideWidths));

      slides.forEach((slide, index) => {
        slide.style.scrollSnapAlign = 'start';
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `Slide ${index + 1} of ${slides.length}`);
      });

      let currentIndex = 0;
      let autoplayId = null;

      const scrollToIndex = (index, { wrap = false } = {}) => {
        if (index < 0 || index >= slides.length) {
          if (!wrap) {
            return;
          }
          currentIndex = index < 0 ? slides.length - 1 : 0;
        } else {
          currentIndex = index;
        }

        const target = slides[currentIndex];
        track.scrollTo({
          left: target.offsetLeft - track.offsetLeft,
          behavior: 'smooth',
        });
        currentIndex = Math.max(0, Math.min(currentIndex, slides.length - 1));
      };

      const stopAutoplay = () => {
        if (autoplayId) {
          window.clearInterval(autoplayId);
          autoplayId = null;
        }
      };

      const startAutoplay = () => {
        stopAutoplay();
        autoplayId = window.setInterval(() => {
          const nextIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
          scrollToIndex(nextIndex, { wrap: true });
        }, 5000);
      };

      const restartAutoplay = () => {
        stopAutoplay();
        startAutoplay();
      };

      const detectClosestSlide = () => {
        const viewportCenter = track.scrollLeft + track.clientWidth / 2;
        let closest = 0;
        let minDistance = Number.POSITIVE_INFINITY;

        slides.forEach((slide, index) => {
          const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
          const distance = Math.abs(slideCenter - viewportCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closest = index;
          }
        });

        if (closest !== currentIndex) {
          currentIndex = closest;
          syncState();
        }
      };

      track.addEventListener('scroll', () => window.requestAnimationFrame(detectClosestSlide), {
        passive: true,
      });

      track.addEventListener('mouseenter', stopAutoplay);
      track.addEventListener('mouseleave', startAutoplay);

      startAutoplay();
    });
  }

  function buildAdPayload(card, event) {
    if (!card) {
      return null;
    }

    const dataset = card.dataset;
    const creativeId = Number(dataset.creative || 0);
    const campaignId = Number(dataset.campaign || 0);
    const signature = dataset.signature || '';
    const slot = dataset.slot || card.closest('.ad-slot')?.dataset.slot;

    if (!creativeId || !campaignId || !signature || !slot) {
      return null;
    }

    const meta = {
      page: window.location.pathname,
      device: window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString(),
    };

    return {
      creative_id: creativeId,
      campaign_id: campaignId,
      slot,
      event,
      signature,
      meta,
    };
  }

  function postAdBeacon(payload) {
    if (!beaconUrl || !payload) {
      return;
    }

    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(beaconUrl, new Blob([body], { type: 'application/json' }));
        return;
      }

      fetch(beaconUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (error) {
      console.error('Ads beacon failed', error);
    }
  }

  function initImpactWidgets() {
    const widgets = document.querySelectorAll('[data-impact-widget]');
    if (!widgets.length || !window.fetch) {
      return;
    }

    const cache = createImpactWidgetCache();

    widgets.forEach((widget) => {
      const endpoint = widget.dataset.impactEndpoint;
      const cacheKey = widget.dataset.impactCacheKey || `impact:${widget.dataset.impactWidget || widget.dataset.impactWidgetId || 'default'}`;
      const cacheTtlRaw = Number.parseInt(widget.dataset.impactCacheTtl ?? '', 10);
      const cacheTtl = Number.isFinite(cacheTtlRaw) && cacheTtlRaw > 0 ? cacheTtlRaw : 0;
      const grid = widget.querySelector('[data-impact-grid]');
      const windowLabel = widget.querySelector('[data-impact-window]');
      const generatedLabel = widget.querySelector('[data-impact-generated]');
      const refreshButton = widget.querySelector('[data-impact-refresh]');
      const context = {
        widget_id: widget.dataset.impactWidgetId || widget.dataset.impactWidget || 'impact-widget',
        audience: widget.dataset.impactAudience || 'public',
        timeframe: widget.dataset.impactTimeframe || 'daily',
      };

      if (!endpoint || !grid) {
        return;
      }

      const setState = (state) => {
        widget.dataset.impactState = state;
      };

      const renderFallback = (message, { error = false } = {}) => {
        setState(error ? 'error' : 'loading');
        grid.innerHTML = '';
        const card = document.createElement('article');
        card.className = 'impact-widget__card impact-widget__card--placeholder';
        if (error) {
          card.classList.add('is-error');
        }
        card.setAttribute('role', 'listitem');

        const label = document.createElement('p');
        label.className = 'impact-widget__label';
        label.textContent = error ? 'Telemetry paused' : 'Syncing';

        const description = document.createElement('p');
        description.className = 'impact-widget__description';
        description.textContent = message;

        card.append(label, description);
        grid.appendChild(card);
      };

      const renderMetrics = (payload, { fromCache = false } = {}) => {
        if (!payload) {
          renderFallback('Impact payload missing.', { error: true });
          postImpactTelemetry('impact.widget.error', {
            ...context,
            message: 'payload_missing',
          });
          return;
        }

        const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
        grid.innerHTML = '';

        if (!metrics.length) {
          const card = document.createElement('article');
          card.className = 'impact-widget__card is-empty';
          card.setAttribute('role', 'listitem');

          const description = document.createElement('p');
          description.className = 'impact-widget__description';
          description.textContent = 'Impact metrics will appear once data is captured.';
          card.append(description);
          grid.appendChild(card);
        } else {
          metrics.forEach((metric) => {
            const card = document.createElement('article');
            card.className = 'impact-widget__card';
            card.setAttribute('role', 'listitem');

            const icon = document.createElement('div');
            icon.className = 'impact-widget__icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = `<ion-icon name="${resolveImpactIcon(metric.icon)}"></ion-icon>`;

            const label = document.createElement('p');
            label.className = 'impact-widget__label';
            label.textContent = metric.label || 'Impact metric';

            const value = document.createElement('p');
            value.className = 'impact-widget__value';
            value.textContent = formatImpactValue(metric.value);

            const change = document.createElement('p');
            change.className = 'impact-widget__change';
            const changeMeta = formatImpactChange(metric);
            change.textContent = changeMeta.text;
            if (changeMeta.modifier) {
              change.classList.add(changeMeta.modifier);
            }

            const description = document.createElement('p');
            description.className = 'impact-widget__description';
            description.textContent = metric.description || '';

            card.append(icon, label, value, change, description);
            grid.appendChild(card);
          });
        }

        if (windowLabel && payload.window_start && payload.window_end) {
          windowLabel.textContent = formatImpactRange(payload.window_start, payload.window_end, payload.timeframe);
        }

        if (generatedLabel && payload.generated_at) {
          generatedLabel.textContent = formatImpactGenerated(payload.generated_at);
        }

        setState('ready');

        postImpactTelemetry('impact.widget.loaded', {
          ...context,
          cached: fromCache,
          metric_count: metrics.length,
          generated_at: payload.generated_at || null,
        });
      };

      const loadFromNetwork = async () => {
        renderFallback('Syncing live signals...');
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
            credentials: 'same-origin',
          });

          if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
          }

          const payload = await response.json();
          const data = payload?.data;
          if (!data) {
            throw new Error('Malformed impact payload');
          }

          if (cacheTtl > 0) {
            cache.write(cacheKey, data, cacheTtl);
          }

          renderMetrics(data, { fromCache: false });
        } catch (error) {
          setState('error');
          renderFallback('Unable to load impact metrics right now.', { error: true });
          postImpactTelemetry('impact.widget.error', {
            ...context,
            message: error?.message?.slice(0, 160) || 'unknown',
          });
        }
      };

      const hydrate = () => {
        const cached = cacheTtl > 0 ? cache.read(cacheKey) : null;
        if (cached?.data) {
          renderMetrics(cached.data, { fromCache: true });
          return;
        }
        loadFromNetwork();
      };

      if (refreshButton) {
        refreshButton.addEventListener('click', () => {
          postImpactTelemetry('impact.widget.refresh', context);
          loadFromNetwork();
        });
      }

      hydrate();
    });
  }

  function createImpactWidgetCache() {
    const memoryStore = new Map();
    let storage = null;

    try {
      const probeKey = '__impact_cache_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      storage = window.localStorage;
    } catch (error) {
      storage = null;
    }

    const read = (key) => {
      try {
        const raw = storage ? storage.getItem(key) : memoryStore.get(key);
        if (!raw) {
          return null;
        }

        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') {
          return null;
        }

        if (parsed.expires_at && parsed.expires_at <= Date.now()) {
          if (storage) {
            storage.removeItem(key);
          } else {
            memoryStore.delete(key);
          }
          return null;
        }

        return parsed;
      } catch (error) {
        return null;
      }
    };

    const write = (key, data, ttlMs) => {
      if (!ttlMs || ttlMs <= 0) {
        return;
      }

      const record = {
        data,
        expires_at: Date.now() + ttlMs,
      };

      try {
        if (storage) {
          storage.setItem(key, JSON.stringify(record));
        } else {
          memoryStore.set(key, record);
        }
      } catch (error) {
        /* no-op */
      }
    };

    return { read, write };
  }

  function resolveImpactIcon(key) {
    if (!key) {
      return 'stats-chart-outline';
    }
    return IMPACT_ICON_MAP[key] || 'stats-chart-outline';
  }

  function formatImpactValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0';
    }

    if (Number.isInteger(numeric)) {
      return impactNumberFormatter.format(numeric);
    }

    return impactDecimalFormatter.format(numeric);
  }

  function formatImpactRange(start, end, timeframe) {
    const startLabel = formatImpactDate(start, true);
    const endLabel = formatImpactDate(end, true);

    if (!startLabel || !endLabel) {
      return timeframe ? `${timeframe} window` : 'Live window';
    }

    return timeframe
      ? `${startLabel} -> ${endLabel} (${timeframe})`
      : `${startLabel} -> ${endLabel}`;
  }

  function formatImpactDate(value, includeTime = false) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const options = includeTime
      ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { month: 'short', day: 'numeric' };

    return new Intl.DateTimeFormat(impactLocale, options).format(date);
  }

  function formatImpactGenerated(timestamp) {
    const label = formatImpactDate(timestamp, true);
    if (!label) {
      return 'Generated moments ago';
    }
    return `Generated ${label}`;
  }

  function formatImpactChange(metric) {
    const change = Number(metric?.change);
    const hasPrevious = metric?.meta && metric.meta.previous !== null && metric.meta.previous !== undefined;
    const hasWindow = metric?.meta && metric.meta.window !== null && metric.meta.window !== undefined;

    if (!Number.isFinite(change) || change === 0) {
      return { text: 'Holding steady', modifier: null };
    }

    const prefix = change > 0 ? '+' : '-';
    const scope = hasPrevious ? 'vs last snapshot' : hasWindow ? 'this window' : 'change';
    return {
      text: `${prefix}${formatImpactValue(Math.abs(change))} ${scope}`,
      modifier: change > 0 ? 'is-positive' : 'is-negative',
    };
  }

  function postImpactTelemetry(eventName, properties = {}) {
    if (!eventName || !impactTelemetryEndpoint) {
      return;
    }

    try {
      fetch(impactTelemetryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        keepalive: true,
        body: JSON.stringify({
          event: eventName,
          properties,
        }),
      }).catch(() => {});
    } catch (error) {
      /* no-op */
    }
  }
});
