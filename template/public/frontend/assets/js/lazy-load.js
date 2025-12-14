/**
 * Lazy Loading Images with Intersection Observer
 * Modern, performant image lazy loading
 * Saves bandwidth and improves initial page load time
 */

(function() {
    'use strict';

    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
        // Fallback: load all images immediately
        document.querySelectorAll('img[data-src]').forEach(function(img) {
            img.src = img.dataset.src;
            if (img.dataset.srcset) {
                img.srcset = img.dataset.srcset;
            }
            img.classList.add('loaded');
        });
        return;
    }

    // Configuration for Intersection Observer
    const config = {
        // Load images 50px before they enter viewport
        rootMargin: '50px 0px',
        threshold: 0.01
    };

    // Track loaded images to prevent duplicate loads
    let loadedImages = new Set();

    /**
     * Load image when it enters viewport
     */
    function loadImage(image) {
        // Prevent duplicate loading
        if (loadedImages.has(image)) {
            return;
        }
        loadedImages.add(image);

        // Get the real src from data-src attribute
        const src = image.dataset.src;
        const srcset = image.dataset.srcset;

        if (!src) return;

        // Create new image to preload
        const imgLoader = new Image();

        imgLoader.onload = function() {
            // Set the actual source
            image.src = src;
            if (srcset) {
                image.srcset = srcset;
            }

            // Add loaded class for CSS transitions
            image.classList.add('loaded');
            image.classList.remove('lazy');

            // Remove data attributes to clean up
            delete image.dataset.src;
            delete image.dataset.srcset;
        };

        imgLoader.onerror = function() {
            // On error, still remove lazy class to prevent retry loop
            image.classList.remove('lazy');
            console.warn('Failed to load image:', src);
        };

        // Start loading
        imgLoader.src = src;
        if (srcset) {
            imgLoader.srcset = srcset;
        }
    }

    /**
     * Callback for Intersection Observer
     */
    function onIntersection(entries, observer) {
        entries.forEach(function(entry) {
            // Image has entered viewport
            if (entry.isIntersecting) {
                const image = entry.target;
                loadImage(image);

                // Stop observing this image
                observer.unobserve(image);
            }
        });
    }

    // Create the observer
    const observer = new IntersectionObserver(onIntersection, config);

    /**
     * Initialize lazy loading for all images with data-src
     */
    function initLazyLoad() {
        const lazyImages = document.querySelectorAll('img[data-src]');

        lazyImages.forEach(function(image) {
            // Add lazy class for CSS styling
            image.classList.add('lazy');

            // Set a transparent placeholder if no src exists
            if (!image.src || image.src === '') {
                image.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
            }

            // Start observing
            observer.observe(image);
        });

        console.log('Lazy loading initialized for ' + lazyImages.length + ' images');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLazyLoad);
    } else {
        initLazyLoad();
    }

    // Re-initialize for dynamically added images
    window.reinitLazyLoad = initLazyLoad;

})();
