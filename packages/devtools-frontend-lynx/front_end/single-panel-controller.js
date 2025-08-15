/**
 * 单面板模式控制器
 * 通过 URL 参数 ?panel=panelName 来控制只显示指定面板
 */
(function() {
  'use strict';
  
  // 通用的 deepQuerySelectorAll 工具函数，支持跨 Shadow DOM 查询
  function deepQuerySelectorAll(root, selector) {
    const results = [];
    
    // 在当前层级查找匹配的元素
    try {
      const matches = root.querySelectorAll(selector);
      results.push(...matches);
    } catch (e) {
      // 忽略无效选择器
    }
    
    // 递归遍历所有子节点，包括 Shadow DOM
    function traverse(node) {
      // 遍历子节点
      for (const child of node.children || []) {
        // 检查是否有 shadowRoot
        if (child.shadowRoot) {
          try {
            // 在 shadowRoot 中查找匹配元素
            const shadowMatches = child.shadowRoot.querySelectorAll(selector);
            results.push(...shadowMatches);
            
            // 递归遍历 shadowRoot 的子节点
            traverse(child.shadowRoot);
          } catch (e) {
            // 处理 closed shadowRoot 或其他访问限制
          }
        }
        
        // 递归遍历普通子节点
        traverse(child);
      }
    }
    
    traverse(root);
    return results;
  }
  
  // 获取 URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  const panelParam = urlParams.get('panel');
  
  // 如果没有指定 panel 参数，则使用默认模式
  if (!panelParam) {
    console.log('[Single Panel Controller] 未指定 panel 参数，使用默认全面板模式');
    return;
  }
  
  console.log(`[Single Panel Controller] 初始化单面板模式: ${panelParam}`);
  
  // 等待 DevTools 初始化完成
  function waitForDevToolsReady() {
    return new Promise((resolve) => {
      let checkCount = 0;
      const maxChecks = 50; // 最多检查 5 秒
      
      function check() {
        checkCount++;
        
        // 查找主要的 DevTools 容器
        const devtoolsContainer = document.querySelector('#-blink-dev-tools');
        const tabbedPanes = deepQuerySelectorAll(document, '.tabbed-pane');
        
        if (devtoolsContainer && tabbedPanes.length > 0) {
          resolve();
        } else if (checkCount < maxChecks) {
          setTimeout(check, 100);
        } else {
          console.warn('[Single Panel Controller] DevTools 初始化超时');
          resolve();
        }
      }
      
      check();
    });
  }
  
  // 防抖机制：避免频繁执行 UI 隐藏操作
  let hideUITimer = null;
  function debouncedHideSinglePanelUI() {
    if (hideUITimer) {
      clearTimeout(hideUITimer);
    }
    hideUITimer = setTimeout(() => {
      hideSinglePanelUI();
      hideUITimer = null;
    }, 16); // 约 60fps 的频率
  }
  
  // 简化的单面板 UI 配置
  function hideSinglePanelUI() {
    console.log(`[实例 ${window.location.href}] 正在配置单面板模式: ${panelParam}`);
    
    // 1. 隐藏主 TabbedPane 的 header（顶部 tab 栏）
    // 如果使用了编译时过滤，这一步主要是隐藏剩余的 UI 装饰
    const mainTabbedPaneHeaders = deepQuerySelectorAll(document, '.tabbed-pane-header');
    mainTabbedPaneHeaders.forEach(header => {
      const tabbedPane = header.closest('.tabbed-pane');
      if (tabbedPane && tabbedPane.classList.contains('tabbed-pane-shadow')) {
        // 隐藏 header
        header.style.height = '0px';
        header.style.overflow = 'hidden';
        header.style.minHeight = '0px';
        console.log('[Single Panel Controller] 隐藏主面板 tab 栏');
      }
    });
    
    // 2. 隐藏 drawer 相关的 UI 元素
    // drawer-tabbed-pane 是底部抽屉面板的容器
    const drawerElements = deepQuerySelectorAll(document, '[class*="drawer"]');
    drawerElements.forEach(element => {
      if (element.classList.contains('drawer-tabbed-pane')) {
        element.style.display = 'none';
        console.log('[Single Panel Controller] 隐藏 drawer 面板');
      }
    });
    
    // 3. 隐藏 split-widget 中的 drawer 部分
    // split-widget 是分割布局的容器，通常包含主面板和抽屉面板
    const splitWidgets = deepQuerySelectorAll(document, '.split-widget');
    splitWidgets.forEach(widget => {
      // 查找 split-widget 内的 drawer-tabbed-pane
      const drawerPanes = widget.querySelectorAll('.drawer-tabbed-pane');
      drawerPanes.forEach(pane => {
        pane.style.display = 'none';
        console.log('[Single Panel Controller] 隐藏 split-widget 中的 drawer');
      });
      
      // 调整 split-widget 布局，让主面板占满整个空间
      widget.style.flexDirection = 'column';
      const mainPanes = widget.querySelectorAll('.split-widget-contents');
      mainPanes.forEach(pane => {
        if (!pane.querySelector('.drawer-tabbed-pane')) {
          pane.style.flex = '1';
          pane.style.height = '100%';
        }
      });
    });
    
    // 4. 隐藏任何剩余的 tab 头部元素
    // 这包括可能在 Shadow DOM 中的 tab 头部
    const tabHeaders = deepQuerySelectorAll(document, '.tabbed-pane-header-tabs');
    tabHeaders.forEach(tabHeader => {
      const parent = tabHeader.closest('.tabbed-pane');
      if (parent && parent.classList.contains('tabbed-pane-shadow')) {
        tabHeader.style.display = 'none';
        console.log('[Single Panel Controller] 隐藏额外的 tab 头部');
      }
    });
    
    // 5. 调整主面板容器的布局
    // 目标结构：<div class="widget vbox flex-auto view-container overflow-auto" tabindex="-1" role="tabpanel">
    const viewContainers = deepQuerySelectorAll(document, '.view-container');
    viewContainers.forEach(container => {
      if (container.classList.contains('widget') && 
          container.classList.contains('vbox') && 
          container.classList.contains('flex-auto') &&
          container.getAttribute('role') === 'tabpanel') {
        
        // 检查是否是目标面板的容器
        const panelElement = container.querySelector('.panel');
        const isTargetPanel = panelElement && (
          panelElement.className.includes(panelParam.toLowerCase()) || 
          panelElement.className.includes(panelParam) ||
          panelElement.getAttribute('aria-label')?.toLowerCase().includes(panelParam.toLowerCase())
        );
        
        if (isTargetPanel) {
          // 让目标面板容器占满整个空间
          container.style.height = '100vh';
          container.style.width = '100vw';
          container.style.position = 'fixed';
          container.style.top = '0';
          container.style.left = '0';
          container.style.zIndex = '1000';
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          
          console.log('[Single Panel Controller] 调整目标面板容器布局');
        } else {
          // 隐藏非目标面板容器
          container.style.display = 'none';
          console.log('[Single Panel Controller] 隐藏非目标面板容器');
        }
      }
    });
    
    // 6. 确保只显示目标面板的内容
    // 查找并显示对应的面板内容
    const panelContents = deepQuerySelectorAll(document, '.panel');
    panelContents.forEach(panel => {
      const className = panel.className;
      const ariaLabel = panel.getAttribute('aria-label') || '';
      const shouldShow = className.includes(panelParam.toLowerCase()) || 
                       className.includes(panelParam) ||
                       ariaLabel.toLowerCase().includes(panelParam.toLowerCase());
      
      if (!shouldShow) {
        panel.style.display = 'none';
        console.log(`[Single Panel Controller] 隐藏非目标面板: ${className}`);
      } else {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.height = '100%';
        panel.style.width = '100%';
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
        console.log(`[Single Panel Controller] 显示目标面板: ${className}, aria-label: ${ariaLabel}`);
      }
    });
    
    // 7. 隐藏工具栏和其他装饰性元素（但保留面板内部的工具栏）
    const toolbars = deepQuerySelectorAll(document, '.tabbed-pane-left-toolbar, .tabbed-pane-right-toolbar');
    toolbars.forEach(toolbar => {
      const parent = toolbar.closest('.tabbed-pane-header');
      if (parent) {
        toolbar.style.display = 'none';
        console.log('[Single Panel Controller] 隐藏顶部工具栏');
      }
    });
    
    // 8. 确保主要的 DevTools 容器可见
    const devtoolsMain = document.querySelector('#-blink-dev-tools');
    if (devtoolsMain) {
      devtoolsMain.style.display = 'block';
      devtoolsMain.style.height = '100vh';
      devtoolsMain.style.width = '100vw';
      console.log('[Single Panel Controller] 确保 DevTools 主容器可见');
    }
    
    // 9. 处理可能被隐藏的父容器
    const allContainers = deepQuerySelectorAll(document, '.widget, .vbox, .hbox');
    allContainers.forEach(container => {
      // 如果容器包含目标面板，确保它是可见的
      const hasTargetPanel = container.querySelector('.panel') && 
        container.querySelector('.panel').className.includes(panelParam.toLowerCase());
      
      if (hasTargetPanel) {
        container.style.display = 'flex';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        console.log('[Single Panel Controller] 确保包含目标面板的容器可见');
      }
    });
    
    console.log(`[Single Panel Controller] 单面板模式配置完成: ${panelParam}`);
  }
  
  // 创建 MutationObserver 来监听 DOM 变化
  function setupDOMObserver() {
    // 监听 DevTools 容器的变化
    const devtoolsContainer = document.querySelector('#-blink-dev-tools');
    if (!devtoolsContainer) {
      setTimeout(setupDOMObserver, 100);
      return;
    }
    
    // 创建 MutationObserver 监听 DOM 结构变化
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        // 检查是否有新增的相关节点
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              // 检查是否是我们关心的元素类型
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
        
        // 检查属性变化（如 class 变化）
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
        // 使用防抖机制避免频繁更新
        debouncedHideSinglePanelUI();
      }
    });
    
    // 配置观察选项
    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-selected']
    };
    
    // 开始观察
    observer.observe(devtoolsContainer, observerConfig);
    console.log(`[实例 ${window.location.href}] DOM Observer 已启动，监听 DevTools 变化`);
    
    return observer;
  }
  
  // 监听路由变化和历史记录变化
  function setupRouteObserver() {
    // 监听 popstate 事件（浏览器前进后退）
    window.addEventListener('popstate', () => {
      setTimeout(debouncedHideSinglePanelUI, 100);
    });
    
    // 监听 hashchange 事件
    window.addEventListener('hashchange', () => {
      setTimeout(debouncedHideSinglePanelUI, 100);
    });
    
    // 拦截 pushState 和 replaceState
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
    
    console.log(`[实例 ${window.location.href}] Route Observer 已启动，监听路由变化`);
  }
  
  // 监听焦点变化和用户交互
  function setupInteractionObserver() {
    // 监听焦点变化（可能触发面板切换）
    document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (target && target.closest && (
          target.closest('.tabbed-pane') ||
          target.closest('.drawer-tabbed-pane') ||
          target.closest('.panel'))) {
        setTimeout(debouncedHideSinglePanelUI, 50);
      }
    });
    
    // 监听点击事件（可能触发 UI 变化）
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.closest && (
          target.closest('.tabbed-pane-header') ||
          target.closest('.toolbar') ||
          target.closest('[role="tab"]'))) {
        setTimeout(debouncedHideSinglePanelUI, 100);
      }
    });
    
    console.log(`[实例 ${window.location.href}] Interaction Observer 已启动，监听用户交互`);
  }
  
  // 初始化单面板控制器
  function initSinglePanelController() {
    console.log(`[Single Panel Controller] 开始初始化，目标面板: ${panelParam}`);
    
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
  
  // 启动单面板控制器
  initSinglePanelController();
  
})();