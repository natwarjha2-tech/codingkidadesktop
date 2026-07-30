/**
 * CodingKida Desktop — Navigation System
 * Universal back navigation with browser-style history.
 */

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL BACK NAVIGATION SYSTEM
// Browser-style navigation history for entire app
// ═══════════════════════════════════════════════════════════════

const navigationHistory = [];
let currentPageIndex = -1;
const MAX_HISTORY = 50; // Memory-efficient limit

const appPages = ['dashboard','courses','course-detail','video','chat','ai','live','downloads','offline-downloads','profile','enrolled-detail','completed-videos','streak-history','achievements','parent-report','help','referral','orders','mall','rate-us','about','student-progress','coding'];
const authPages = ['login','signup'];
const sidebarMap = { dashboard:'nav-dashboard', courses:'nav-courses', 'course-detail':'nav-courses', video:'nav-courses', chat:'nav-chat', ai:'nav-ai', live:'nav-live', downloads:'nav-downloads', 'offline-downloads':'nav-offline-downloads', profile:'nav-profile', 'enrolled-detail':'nav-dashboard', 'completed-videos':'nav-dashboard', 'streak-history':'nav-dashboard', 'achievements':'nav-dashboard', 'parent-report':'nav-profile', 'help':'nav-profile', 'referral':'nav-profile', 'orders':'nav-profile', 'mall':'nav-profile', 'rate-us':'nav-profile', 'about':'nav-profile', 'student-progress':'nav-profile','coding':'nav-coding' };

function getCurrentPageContext() {
  const currentPage = getCurrentActivePage();
  const context = {
    page: currentPage,
    scrollY: window.scrollY || 0,
    timestamp: Date.now()
  };

  // Capture video/lesson context
  if (currentPage === 'video' && _currentLessonContext) {
    context.lessonContext = {
      courseId: _currentLessonContext.courseId,
      moduleId: _currentLessonContext.moduleId,
      lessonId: _currentLessonContext.lessonId,
      courseTitle: _currentLessonContext.courseTitle,
      moduleTitle: _currentLessonContext.moduleTitle,
      lessonTitle: _currentLessonContext.lessonTitle
    };
    // Capture video time if available
    const videoEl = document.getElementById('lesson-video');
    if (videoEl && !videoEl.paused) {
      context.videoTime = videoEl.currentTime;
    }
  }

  // Capture course detail context
  if (currentPage === 'course-detail') {
    const courseTitle = document.getElementById('course-detail-title')?.textContent;
    if (courseTitle) {
      context.courseTitle = courseTitle;
    }
  }

  return context;
}

function getCurrentActivePage() {
  for (const page of appPages) {
    const el = document.getElementById('page-' + page);
    if (el && el.classList.contains('active')) {
      return page;
    }
  }
  return 'dashboard';
}

function restorePageContext(context) {
  if (!context) return;

  // Restore scroll position after a brief delay (let page render)
  if (context.scrollY) {
    setTimeout(() => {
      window.scrollTo(0, context.scrollY);
    }, 100);
  }

  // Restore video/lesson context
  if (context.lessonContext) {
    const lc = context.lessonContext;
    setTimeout(() => {
      openVideoFromBackend(lc.courseId, lc.moduleId, lc.lessonId);
      // Restore video time if available
      if (context.videoTime) {
        setTimeout(() => {
          const videoEl = document.getElementById('lesson-video');
          if (videoEl) {
            videoEl.currentTime = context.videoTime;
          }
        }, 500);
      }
    }, 50);
  }
}

function goBack() {
  if (currentPageIndex > 0) {
    currentPageIndex--;
    const previousPage = navigationHistory[currentPageIndex];
    
    // Navigate without adding to history
    _navigateInternal(previousPage.page, false);
    
    // Restore context
    restorePageContext(previousPage);
    
    // Update back button visibility
    updateBackButtonVisibility();
  }
}

function updateBackButtonVisibility() {
  const currentPage = getCurrentActivePage();
  const hasHistory = currentPageIndex > 0;
  
  // Remove all existing back buttons first
  document.querySelectorAll('.universal-back-btn').forEach(btn => btn.remove());
  
  // Show back button if there's history and not on dashboard
  if (hasHistory && currentPage !== 'dashboard') {
    const pageEl = document.getElementById('page-' + currentPage);
    if (!pageEl) return;
    
    // Special handling for video page - add to existing topbar
    if (currentPage === 'video') {
      const topbarLeft = pageEl.querySelector('.vp-topbar-left');
      if (topbarLeft) {
        // Create compact back button for video page
        const backBtn = document.createElement('button');
        backBtn.className = 'universal-back-btn btn btn-outline btn-sm';
        backBtn.onclick = goBack;
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back';
        backBtn.style.cssText = 'padding:6px 12px; flex-shrink:0; margin-right:12px;';
        backBtn.title = 'Go back (Alt + ←)';
        
        // Insert as first child of topbar-left
        topbarLeft.insertBefore(backBtn, topbarLeft.firstChild);
        return;
      }
    }
    
    // For all other pages - add as first element
    const backBtn = document.createElement('button');
    backBtn.className = 'universal-back-btn';
    backBtn.onclick = goBack;
    backBtn.innerHTML = '<i class="fas fa-arrow-left" style="font-size:0.8rem;"></i><span>Back</span>';
    backBtn.style.cssText = `
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 8px 16px;
      color: rgba(255,255,255,0.65);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      margin-bottom: 16px;
    `;
    backBtn.title = 'Go back (Alt + ←)';
    
    // Hover effects
    backBtn.onmouseenter = function() {
      this.style.background = 'rgba(108,71,255,0.12)';
      this.style.borderColor = 'rgba(108,71,255,0.25)';
      this.style.color = '#fff';
      this.style.transform = 'translateX(-3px)';
      this.style.boxShadow = '0 4px 16px rgba(108,71,255,0.25)';
    };
    backBtn.onmouseleave = function() {
      this.style.background = 'rgba(255,255,255,0.04)';
      this.style.borderColor = 'rgba(255,255,255,0.08)';
      this.style.color = 'rgba(255,255,255,0.65)';
      this.style.transform = 'translateX(0)';
      this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    };
    
    // Insert as first child of page
    pageEl.insertBefore(backBtn, pageEl.firstChild);
  }
}

function _navigateInternal(page, addToHistory) {
  // Existing navigate logic (will be called from both navigate() and goBack())
  authPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });

  const app = document.getElementById('app');

  if (authPages.includes(page)) {
    app.style.display = 'none';
    const el = document.getElementById('page-' + page);
    if (el) el.style.display = 'flex';
    return;
  }

  app.style.display = 'flex';

  appPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  if (page === 'downloads') renderDownloads();
  if (page === 'offline-downloads') renderOfflineDownloads();
  if (page === 'parent-report') loadParentReport();
  if (page === 'help') loadHelpPage();
  if (page === 'referral') loadReferralPage();
  if (page === 'orders') loadOrdersPage();
  if (page === 'mall') loadMallPage();
  if (page === 'rate-us') loadRateUsPage();
  if (page === 'student-progress') loadStudentProgress();
  if (page === 'coding' && typeof codingPgInit === 'function') {
    // Ensure page-coding is inside main-content (fixes placement issue)
    var pgEl = document.getElementById('page-coding');
    var mc = document.querySelector('.main-content');
    if (pgEl && mc && pgEl.parentElement !== mc) {
      mc.appendChild(pgEl);
    }
    codingPgInit();
    if (mc) mc.scrollTop = 0;
  }

  // Refresh dashboard data when navigating to profile
  if (page === 'profile' || page === 'dashboard') {
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
    // Preload profile sub-pages data in background
    if (page === 'profile' && t) {
      loadOrdersPage();
      loadMallPage();
      loadRateUsPage();
      loadParentReport();
      loadReferralPage();
      loadHelpPage();
      loadStudentProgress();
    }
    // Fetch weekly streak count once on dashboard load
    if (page === 'dashboard' && t) {
      loadWeeklyStreakCount();
    }
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = sidebarMap[page];
  if (navId) {
    const navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add('active');
  }

  // Add to navigation history if requested
  if (addToHistory) {
    // Remove forward history (user took new path)
    navigationHistory.splice(currentPageIndex + 1);
    
    // Capture current context before navigating
    const context = getCurrentPageContext();
    context.page = page; // Update to new page
    
    // Add to history
    navigationHistory.push(context);
    currentPageIndex = navigationHistory.length - 1;
    
    // Limit history size for memory efficiency
    if (navigationHistory.length > MAX_HISTORY) {
      navigationHistory.shift();
      currentPageIndex--;
    }
    
    // Update back button visibility
    updateBackButtonVisibility();
  }
}

function navigate(page) {
  // Public API - always adds to history
  _navigateInternal(page, true);
}
