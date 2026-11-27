/**
 * URL Theme Controller
 * Apply theme based on URL parameter ?theme=dark or ?theme=light
 */
(function() {
  'use strict';

  const DARK_THEME_CLASS = '-theme-with-dark-background';

  function waitForCachedResources() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // Maximum 5 seconds (50 * 100ms)

      function checkCachedResources() {
        attempts++;

        // Check if cachedResources is available
        const cachedResources = globalThis.EXPORTED_CACHED_RESOURCES_ONLY_FOR_LIGHTHOUSE;

        if (cachedResources && cachedResources.size > 0) {
          resolve(cachedResources);
        } else if (attempts < maxAttempts) {
          setTimeout(checkCachedResources, 100);
        } else {
          resolve(null);
        }
      }

      checkCachedResources();
    });
  }

  function injectHighlightStyleSheets() {
    waitForCachedResources().then(cachedResources => {
      if (cachedResources) {
        // Use the cached resources to inject styles like ThemeSupport does
        injectHighlightStyleSheetsFromCache(cachedResources);
      } else {
        // Fallback to manual injection
        injectHighlightStyleSheetsManually();
      }
    });
  }

  function injectHighlightStyleSheetsFromCache(cachedResources) {
    // Store cache reference globally for reuse
    window._urlThemeControllerCache = cachedResources;

    // Remove existing syntax highlight styles
    const existingStyles = document.querySelectorAll('style[data-url-theme-highlight]');
    existingStyles.forEach(style => style.remove());

    // Always inject base syntax highlighting from cache
    injectStyleSheetFromCache(cachedResources, 'ui/legacy/inspectorSyntaxHighlight.css', 'base-highlight');

    // Inject dark theme syntax highlighting if dark theme is active
    if (document.body.classList.contains(DARK_THEME_CLASS)) {
      injectStyleSheetFromCache(cachedResources, 'ui/legacy/inspectorSyntaxHighlightDark.css', 'dark-highlight');
    }

    // Set up observer for new shadow roots
    observeNewShadowRoots(cachedResources);
  }

  function injectStyleSheetFromCache(cachedResources, cssPath, id) {
    const content = cachedResources.get(cssPath) || '';
    if (!content) {
      console.error('[URL Theme Controller]', cssPath, 'not found in cached resources. Available paths:', Array.from(cachedResources.keys()).filter(k => k.includes('css')));
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-url-theme-highlight', id);
    styleElement.textContent = content;
    document.head.appendChild(styleElement);

    // Also inject to any existing shadow roots
    const allElements = document.querySelectorAll('*');
    let shadowRootCount = 0;
    allElements.forEach(element => {
      if (element.shadowRoot) {
        const shadowStyleElement = document.createElement('style');
        shadowStyleElement.setAttribute('data-url-theme-highlight', id);
        shadowStyleElement.textContent = content;
        element.shadowRoot.appendChild(shadowStyleElement);
        shadowRootCount++;
      }
    });
  }

  function injectHighlightStyleSheetsManually() {
    // Remove existing syntax highlight styles
    const existingStyles = document.querySelectorAll('style[data-url-theme-highlight]');
    existingStyles.forEach(style => style.remove());

    // Always inject base syntax highlighting
    injectStyleSheet('ui/legacy/inspectorSyntaxHighlight.css', 'base-highlight');

    // Inject dark theme syntax highlighting if dark theme is active
    if (document.body.classList.contains(DARK_THEME_CLASS)) {
      injectStyleSheet('ui/legacy/inspectorSyntaxHighlightDark.css', 'dark-highlight');
    }
  }

  function injectStyleSheet(cssPath, id) {
    // Create a new style element
    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-url-theme-highlight', id);

    // Try to load the CSS content (this is a simplified version)
    // In a real DevTools environment, we would need to fetch from the runtime cache
    // For now, we'll add a placeholder that would work with the actual system
    fetch('./' + cssPath)
      .then(response => response.text())
      .then(cssText => {
        styleElement.textContent = cssText;
      })
      .catch(error => {
        console.warn(`[URL Theme Controller] Failed to load ${cssPath}:`, error);
        // Fallback: inject empty style to maintain consistency
        styleElement.textContent = `/* Failed to load ${cssPath} */`;
      });

    document.head.appendChild(styleElement);
  }

  function setThemeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    if (themeParam === 'dark') {
      document.body.classList.add(DARK_THEME_CLASS);
    } else if (themeParam === 'light') {
      document.body.classList.remove(DARK_THEME_CLASS);
    }

    // Inject appropriate syntax highlighting styles
    injectHighlightStyleSheets();

  }

  function initUrlThemeController() {
    // Apply theme immediately
    setThemeFromUrl();

    // Listen for URL changes (browser back/forward)
    window.addEventListener('popstate', () => {
      setThemeFromUrl();
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      setThemeFromUrl();
    });

    // Intercept pushState and replaceState for SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(setThemeFromUrl, 50);
    };

    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(setThemeFromUrl, 50);
    };
  }

  function observeNewShadowRoots(cachedResources) {
    // Use MutationObserver to watch for new elements that might have shadow roots
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            // Check if this element has a shadow root
            if (element.shadowRoot) {
              injectHighlightStylesToShadowRoot(element.shadowRoot, cachedResources);
            }
            // Also check all child elements for shadow roots
            const shadowHosts = element.querySelectorAll('*');
            shadowHosts.forEach(host => {
              if (host.shadowRoot) {
                injectHighlightStylesToShadowRoot(host.shadowRoot, cachedResources);
              }
            });
          }
        });
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function injectHighlightStylesToShadowRoot(shadowRoot, cachedResources) {
    // Remove existing highlight styles from this shadow root
    const existingStyles = shadowRoot.querySelectorAll('style[data-url-theme-highlight]');
    existingStyles.forEach(style => style.remove());

    // Inject base syntax highlighting
    const baseContent = cachedResources.get('ui/legacy/inspectorSyntaxHighlight.css') || '';
    if (baseContent) {
      const baseStyle = document.createElement('style');
      baseStyle.setAttribute('data-url-theme-highlight', 'base-highlight');
      baseStyle.textContent = baseContent;
      shadowRoot.appendChild(baseStyle);
    }

    // Inject dark theme syntax highlighting if dark theme is active
    if (document.body.classList.contains(DARK_THEME_CLASS)) {
      const darkContent = cachedResources.get('ui/legacy/inspectorSyntaxHighlightDark.css') || '';
      if (darkContent) {
        const darkStyle = document.createElement('style');
        darkStyle.setAttribute('data-url-theme-highlight', 'dark-highlight');
        darkStyle.textContent = darkContent;
        shadowRoot.appendChild(darkStyle);
      }
    }
  }

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const themeParam = urlParams.get('theme');

  // Only initialize if theme parameter is present
  if (themeParam) {

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUrlThemeController);
    } else {
      initUrlThemeController();
    }
  }

})();