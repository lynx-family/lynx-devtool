/**
 * Single panel controller
 * Control only display the specified panel through the URL parameter ?panel=panelName
 */
(function() {
  'use strict';
  
  // Generic deepQuerySelectorAll tool function, support cross Shadow DOM query
  function deepQuerySelectorAll(root, selector) {
    const results = [];
    
    // Find matching elements at the current level
    try {
      const matches = root.querySelectorAll(selector);
      results.push(...matches);
    } catch (e) {
      // Ignore invalid selector
    }
    
    // Recursively traverse all child nodes, including Shadow DOM
    function traverse(node) {
      // Traverse child nodes
      for (const child of node.children || []) {
        // Check if there is a shadowRoot
        if (child.shadowRoot) {
          try {
            // Find matching elements in shadowRoot
            const shadowMatches = child.shadowRoot.querySelectorAll(selector);
            results.push(...shadowMatches);
            
            // Recursively traverse the child nodes of shadowRoot
            traverse(child.shadowRoot);
          } catch (e) {
            // Handle closed shadowRoot or other access restrictions
          }
        }
        
        // Recursively traverse normal child nodes
        traverse(child);
      }
    }
    
    traverse(root);
    return results;
  }
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const panelParam = urlParams.get('panel');
  
  // If no panel parameter is specified, use default mode
  if (!panelParam) {
    console.log('[Single Panel Controller] No panel parameter specified, using default full panel mode');
    return;
  }
  
  console.log(`[Single Panel Controller] Initialize single panel mode: ${panelParam}`);
  
  // Wait for DevTools to initialize
  function waitForDevToolsReady() {
    return new Promise((resolve) => {
      let checkCount = 0;
      const maxChecks = 50; // Maximum 5 seconds
      
      function check() {
        checkCount++;
        
        // Find the main DevTools container
        const devtoolsContainer = document.querySelector('#-blink-dev-tools');
        const tabbedPanes = deepQuerySelectorAll(document, '.tabbed-pane');
        
        if (devtoolsContainer && tabbedPanes.length > 0) {
          resolve();
        } else if (checkCount < maxChecks) {
          setTimeout(check, 100);
        } else {
          console.warn('[Single Panel Controller] DevTools initialization timeout');
          resolve();
        }
      }
      
      check();
    });
  }
  
  // Debounce mechanism: avoid frequent execution of UI hiding operations
  let hideUITimer = null;
  function debouncedHideSinglePanelUI() {
    if (hideUITimer) {
      clearTimeout(hideUITimer);
    }
    hideUITimer = setTimeout(() => {
      hideSinglePanelUI();
      hideUITimer = null;
    }, 16); // Approximately 60fps frequency
  }
  
  // Simplified single panel UI configuration
  function hideSinglePanelUI() {
    console.log(`[Instance ${window.location.href}] Configuring single panel mode: ${panelParam}`);
    
    // 1. Hide the header of the main TabbedPane (top tab bar)
    // If compile-time filtering is used, this step is mainly to hide the remaining UI decorations
    const mainTabbedPaneHeaders = deepQuerySelectorAll(document, '.tabbed-pane-header');
    mainTabbedPaneHeaders.forEach(header => {
      const tabbedPane = header.closest('.tabbed-pane');
      if (tabbedPane && tabbedPane.classList.contains('tabbed-pane-shadow')) {
        // Hide header
        header.style.height = '0px';
        header.style.overflow = 'hidden';
        header.style.minHeight = '0px';
        console.log('[Single Panel Controller] Hide main panel tab bar');
      }
    });
    
    // 2. Hide drawer-related UI elements
    // drawer-tabbed-pane is the container of the bottom drawer panel
    const drawerElements = deepQuerySelectorAll(document, '[class*="drawer"]');
    drawerElements.forEach(element => {
      if (element.classList.contains('drawer-tabbed-pane')) {
        element.style.display = 'none';
        console.log('[Single Panel Controller] Hide drawer panel');
      }
    });
    
    // 3. Hide the drawer part in split-widget
    // split-widget is the container of the split layout, usually containing the main panel and the drawer panel
    const splitWidgets = deepQuerySelectorAll(document, '.split-widget');
    splitWidgets.forEach(widget => {
      // Find the drawer-tabbed-pane in split-widget
      const drawerPanes = widget.querySelectorAll('.drawer-tabbed-pane');
      drawerPanes.forEach(pane => {
        pane.style.display = 'none';
        console.log('[Single Panel Controller] Hide drawer in split-widget');
      });
      
      // Adjust the split-widget layout, so that the main panel occupies the entire space
      widget.style.flexDirection = 'column';
      const mainPanes = widget.querySelectorAll('.split-widget-contents');
      mainPanes.forEach(pane => {
        if (!pane.querySelector('.drawer-tabbed-pane')) {
          pane.style.flex = '1';
          pane.style.height = '100%';
        }
      });
    });
    
    // 4. Hide any remaining tab header elements
    // This includes tab headers in Shadow DOM
    const tabHeaders = deepQuerySelectorAll(document, '.tabbed-pane-header-tabs');
    tabHeaders.forEach(tabHeader => {
      const parent = tabHeader.closest('.tabbed-pane');
      if (parent && parent.classList.contains('tabbed-pane-shadow')) {
        tabHeader.style.display = 'none';
        console.log('[Single Panel Controller] Hide additional tab headers');
      }
    });
    
    // 5. Adjust the layout of the main panel container
    // Target structure: <div class="widget vbox flex-auto view-container overflow-auto" tabindex="-1" role="tabpanel">
    const viewContainers = deepQuerySelectorAll(document, '.view-container');
    viewContainers.forEach(container => {
      if (container.classList.contains('widget') && 
          container.classList.contains('vbox') && 
          container.classList.contains('flex-auto') &&
          container.getAttribute('role') === 'tabpanel') {
        
        // Check if it is the container of the target panel
        const panelElement = container.querySelector('.panel');
        const isTargetPanel = panelElement && (
          panelElement.className.includes(panelParam.toLowerCase()) || 
          panelElement.className.includes(panelParam) ||
          panelElement.getAttribute('aria-label')?.toLowerCase().includes(panelParam.toLowerCase())
        );
        
        if (isTargetPanel) {
          // Make the target panel container occupy the entire space
          container.style.height = '100vh';
          container.style.width = '100vw';
          container.style.position = 'fixed';
          container.style.top = '0';
          container.style.left = '0';
          container.style.zIndex = '1000';
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          
          console.log('[Single Panel Controller] Adjust the layout of the target panel container');
        } else {
          // Hide the container of the non-target panel
          container.style.display = 'none';
          console.log('[Single Panel Controller] Hide the container of the non-target panel');
        }
      }
    });
    
    // 6. Ensure that only the content of the target panel is displayed
    // Find and display the corresponding panel content
    const panelContents = deepQuerySelectorAll(document, '.panel');
    panelContents.forEach(panel => {
      const className = panel.className;
      const ariaLabel = panel.getAttribute('aria-label') || '';
      const shouldShow = className.includes(panelParam.toLowerCase()) || 
                       className.includes(panelParam) ||
                       ariaLabel.toLowerCase().includes(panelParam.toLowerCase());
      
      if (!shouldShow) {
        panel.style.display = 'none';
        console.log(`[Single Panel Controller] Hide the non-target panel: ${className}`);
      } else {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.height = '100%';
        panel.style.width = '100%';
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
        console.log(`[Single Panel Controller] Display the target panel: ${className}, aria-label: ${ariaLabel}`);
      }
    });
    
    // 7. Hide the toolbar and other decorative elements (but keep the toolbar inside the panel)
    const toolbars = deepQuerySelectorAll(document, '.tabbed-pane-left-toolbar, .tabbed-pane-right-toolbar');
    toolbars.forEach(toolbar => {
      const parent = toolbar.closest('.tabbed-pane-header');
      if (parent) {
        toolbar.style.display = 'none';
        console.log('[Single Panel Controller] Hide the top toolbar');
      }
    });
    
    // 8. Ensure that the main DevTools container is visible
    const devtoolsMain = document.querySelector('#-blink-dev-tools');
    if (devtoolsMain) {
      devtoolsMain.style.display = 'block';
      devtoolsMain.style.height = '100vh';
      devtoolsMain.style.width = '100vw';
      console.log('[Single Panel Controller] Ensure the main DevTools container is visible');
    }
    
    // 9. Handle the parent container that may be hidden
    const allContainers = deepQuerySelectorAll(document, '.widget, .vbox, .hbox');
    allContainers.forEach(container => {
      // If the container contains the target panel, ensure it is visible
      const hasTargetPanel = container.querySelector('.panel') && 
        container.querySelector('.panel').className.includes(panelParam.toLowerCase());
      
      if (hasTargetPanel) {
        container.style.display = 'flex';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        console.log('[Single Panel Controller] Ensure the container containing the target panel is visible');
      }
    });
    
    console.log(`[Single Panel Controller] Single panel mode configuration completed: ${panelParam}`);
  }
  
  // Create a MutationObserver to listen for DOM changes
  function setupDOMObserver() {
    // Listen for changes in the DevTools container
    const devtoolsContainer = document.querySelector('#-blink-dev-tools');
    if (!devtoolsContainer) {
      setTimeout(setupDOMObserver, 100);
      return;
    }
    
    // Create a MutationObserver to listen for DOM structure changes
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        // Check if there are any new related nodes
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              // Check if it is the type of element we are interested in
              if (element.classList.contains('tabbed-pane') ||
                  element.classList.contains('tabbed-pane-header') ||
                  element.classList.contains('drawer-tabbed-pane') ||
                  element.classList.contains('split-widget') ||
                  element.classList.contains('view-container') ||
                  element.classList.contains('panel') ||
                  element.querySelector('.tabbed-pane, .drawer-tabbed-pane, .panel')) {
                shouldUpdate = true;
                break;
              }
            }
          }
        }
        
        // Check attribute changes (such as class changes)
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || 
             mutation.attributeName === 'style' ||
             mutation.attributeName === 'aria-selected')) {
          const target = mutation.target;
          if (target.classList.contains('tabbed-pane') ||
              target.classList.contains('tabbed-pane-header') ||
              target.classList.contains('view-container') ||
              target.classList.contains('panel')) {
            shouldUpdate = true;
          }
        }
      });
      
      if (shouldUpdate) {
        // Use debounce mechanism to avoid frequent updates
        debouncedHideSinglePanelUI();
      }
    });
    
    // Configure observation options
    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-selected']
    };
    
    // Start observing
    observer.observe(devtoolsContainer, observerConfig);
    console.log(`[Instance ${window.location.href}] DOM Observer started, listening for DevTools changes`);
    
    return observer;
  }
  
  // Listen for route changes and history changes
  function setupRouteObserver() {
    // Listen for popstate events (browser forward and backward)
    window.addEventListener('popstate', () => {
      setTimeout(debouncedHideSinglePanelUI, 100);
    });
    
    // Listen for hashchange events
    window.addEventListener('hashchange', () => {
      setTimeout(debouncedHideSinglePanelUI, 100);
    });
    
    // Intercept pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(debouncedHideSinglePanelUI, 100);
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(debouncedHideSinglePanelUI, 100);
    };
    
    console.log(`[Instance ${window.location.href}] Route Observer started, listening for route changes`);
  }
  
  // Listen for focus changes and user interactions
  function setupInteractionObserver() {
    // Listen for focus changes (may trigger panel switching)
    document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (target && target.closest && (
          target.closest('.tabbed-pane') ||
          target.closest('.drawer-tabbed-pane') ||
          target.closest('.panel'))) {
        setTimeout(debouncedHideSinglePanelUI, 50);
      }
    });
    
    // Listen for click events (may trigger UI changes)
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.closest && (
          target.closest('.tabbed-pane-header') ||
          target.closest('.toolbar') ||
          target.closest('[role="tab"]'))) {
        setTimeout(debouncedHideSinglePanelUI, 100);
      }
    });
    
    console.log(`[Instance ${window.location.href}] Interaction Observer started, listening for user interactions`);
  }
  
  // Initialize the single panel controller
  function initSinglePanelController() {
    console.log(`[Single Panel Controller] Start initialization, target panel: ${panelParam}`);
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        await waitForDevToolsReady();
        hideSinglePanelUI();
        setupDOMObserver();
        setupRouteObserver();
        setupInteractionObserver();
      });
    } else {
      waitForDevToolsReady().then(() => {
        hideSinglePanelUI();
        setupDOMObserver();
        setupRouteObserver();
        setupInteractionObserver();
      });
    }
  }
  
  // Start the single panel controller
  initSinglePanelController();
  
})();