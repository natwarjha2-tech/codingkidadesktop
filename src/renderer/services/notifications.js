/**
 * CodingKida Desktop — Notification Service (API-backed)
 * 
 * Architecture:
 * - Server notifications (course_enrolled, payment_failed, achievement, etc.)
 *   → Fetched from /api/notifications (cursor-based sync)
 *   → Stored in local cache for instant UI
 * 
 * - App Update notifications
 *   → Desktop-only (Electron updater), stored in localStorage
 *   → Not sent to server (desktop-specific event)
 * 
 * Sync triggers:
 *   - App init / user login
 *   - Window focus (user returns from browser)
 *   - After enrollment deep link
 */

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════

var _notifItems = [];          // In-memory cache of notifications (server + local)
var _notifCursor = null;       // Last sync cursor (ISO timestamp)
var _notifSyncing = false;     // Prevent concurrent syncs

// localStorage keys (user-specific — set after login)
var NOTIF_CURSOR_KEY_PREFIX = 'ck_notif_cursor_';
var NOTIF_LOCAL_KEY_PREFIX  = 'ck_notif_local_';  // For local-only (app_update)
var NOTIF_SERVER_CACHE_PREFIX = 'ck_notif_scache_'; // Cached server notifications

// ═══════════════════════════════════════════════════════
// CURSOR HELPERS
// ═══════════════════════════════════════════════════════

function _notifGetCursor() {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
  if (!userId) return null;
  return localStorage.getItem(NOTIF_CURSOR_KEY_PREFIX + userId) || null;
}

function _notifSaveCursor(cursor) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
  if (!userId || !cursor) return;
  localStorage.setItem(NOTIF_CURSOR_KEY_PREFIX + userId, cursor);
}

// ═══════════════════════════════════════════════════════
// LOCAL-ONLY (APP UPDATE) STORAGE
// ═══════════════════════════════════════════════════════

function _notifGetLocalItems() {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(NOTIF_LOCAL_KEY_PREFIX + userId) || '[]');
  } catch(e) { return []; }
}

function _notifSaveLocalItems(items) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
  if (!userId) return;
  // Keep max 20 local notifications
  if (items.length > 20) items = items.slice(0, 20);
  try {
    localStorage.setItem(NOTIF_LOCAL_KEY_PREFIX + userId, JSON.stringify(items));
  } catch(e) {}
}

function _notifLocalExists(idempotencyKey) {
  return _notifGetLocalItems().some(function(n) { return n.idempotencyKey === idempotencyKey; });
}

// ═══════════════════════════════════════════════════════
// SERVER NOTIFICATION CACHE (persists fetched server notifications)
// ═══════════════════════════════════════════════════════

function _notifGetServerCache() {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(NOTIF_SERVER_CACHE_PREFIX + userId) || '[]');
  } catch(e) { return []; }
}

function _notifSaveServerCache(items) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
  if (!userId) return;
  // Keep max 100 server notifications
  if (items.length > 100) items = items.slice(0, 100);
  try {
    localStorage.setItem(NOTIF_SERVER_CACHE_PREFIX + userId, JSON.stringify(items));
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════
// SYNC FROM SERVER (Cursor-based)
// ═══════════════════════════════════════════════════════

/**
 * Sync notifications from server.
 * Uses cursor to fetch only new/missed notifications since last sync.
 * Merges with local app_update notifications.
 */
function notifSync() {
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token || _notifSyncing) return;

  _notifSyncing = true;
  var cursor = _notifGetCursor();

  var body = { action: 'sync', limit: 30 };
  if (cursor) body.after = cursor;

  fetch(BASE_URL + '/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      // Map newly-fetched server items to internal format
      var newServerItems = (data.items || []).map(function(n) {
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.body,
          timestamp: new Date(n.createdAt).getTime(),
          read: n.read,
          action: _notifParseAction(n.action),
          isLocal: false,
        };
      });

      // Merge new server items with PREVIOUSLY cached server items (de-dupe by id)
      var cachedServerItems = _notifGetServerCache();
      var serverSeen = {};
      var mergedServer = newServerItems.concat(cachedServerItems).filter(function(n) {
        if (serverSeen[n.id]) return false;
        serverSeen[n.id] = true;
        return true;
      });
      mergedServer.sort(function(a, b) { return b.timestamp - a.timestamp; });

      // Persist merged server items to cache
      _notifSaveServerCache(mergedServer);

      // Build full in-memory list: server items + local app_update items
      var localItems = _notifGetLocalItems();
      var seen = {};
      var merged = mergedServer.concat(localItems).filter(function(n) {
        if (seen[n.id]) return false;
        seen[n.id] = true;
        return true;
      });
      merged.sort(function(a, b) { return b.timestamp - a.timestamp; });

      _notifItems = merged;

      // Advance cursor only if we successfully got a response
      _notifSaveCursor(new Date().toISOString());

      // Recompute unread from full merged list (server unreadCount only counts server-side)
      _notifUpdateBadge();
    }
  })
  .catch(function() {
    // Silently fail — show cached data
    _notifRebuildFromLocal();
  })
  .finally(function() {
    _notifSyncing = false;
  });
}

/**
 * Rebuild in-memory list from cached data (server cache + local items).
 * Used for instant display before/without a fresh sync.
 */
function _notifRebuildFromLocal() {
  var serverItems = _notifGetServerCache();
  var localItems = _notifGetLocalItems();
  var seen = {};
  var merged = serverItems.concat(localItems).filter(function(n) {
    if (seen[n.id]) return false;
    seen[n.id] = true;
    return true;
  });
  merged.sort(function(a, b) { return b.timestamp - a.timestamp; });
  _notifItems = merged;
  _notifUpdateBadge();
}

/**
 * Parse action JSON from server to internal format.
 */
function _notifParseAction(action) {
  if (!action) return null;
  if (typeof action === 'string') {
    try { action = JSON.parse(action); } catch(e) { return null; }
  }
  return action;
}

// ═══════════════════════════════════════════════════════
// CRUD — SERVER (non-blocking API calls)
// ═══════════════════════════════════════════════════════

function _notifApiCall(body, onSuccess) {
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;
  fetch(BASE_URL + '/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) { if (data.success && onSuccess) onSuccess(data); })
  .catch(function() {});
}

function notifMarkAsRead(notifId) {
  // Optimistic update in memory
  var notif = _notifItems.find(function(n) { return n.id === notifId; });
  if (notif && !notif.read) {
    notif.read = true;
    _notifUpdateBadge();
  }

  // Local item (app_update): update in localStorage
  if (notif && notif.isLocal) {
    var locals = _notifGetLocalItems();
    locals.forEach(function(n) { if (n.id === notifId) n.read = true; });
    _notifSaveLocalItems(locals);
    return;
  }

  // Server item: update cache + API call
  var cache = _notifGetServerCache();
  cache.forEach(function(n) { if (n.id === notifId) n.read = true; });
  _notifSaveServerCache(cache);
  _notifApiCall({ action: 'mark-read', id: notifId }, null);
}

function notifMarkAllAsRead() {
  // Optimistic update
  _notifItems.forEach(function(n) { n.read = true; });
  _notifUpdateBadge();

  // Update local items in localStorage
  var locals = _notifGetLocalItems();
  locals.forEach(function(n) { n.read = true; });
  _notifSaveLocalItems(locals);

  // Update server cache
  var cache = _notifGetServerCache();
  cache.forEach(function(n) { n.read = true; });
  _notifSaveServerCache(cache);

  // Server: mark all read
  _notifApiCall({ action: 'mark-all-read' }, null);
}

function notifDelete(notifId) {
  var notif = _notifItems.find(function(n) { return n.id === notifId; });

  // Remove from memory
  _notifItems = _notifItems.filter(function(n) { return n.id !== notifId; });
  _notifUpdateBadge();

  // Local item: remove from localStorage
  if (notif && notif.isLocal) {
    var locals = _notifGetLocalItems().filter(function(n) { return n.id !== notifId; });
    _notifSaveLocalItems(locals);
    return;
  }

  // Server item: remove from cache + API call
  var cache = _notifGetServerCache().filter(function(n) { return n.id !== notifId; });
  _notifSaveServerCache(cache);
  _notifApiCall({ action: 'delete', id: notifId }, null);
}

function notifClearAll() {
  _notifItems = [];
  _notifUpdateBadge();

  // Clear local items + server cache
  _notifSaveLocalItems([]);
  _notifSaveServerCache([]);

  // Server: clear all
  _notifApiCall({ action: 'clear-all' }, null);
}

// ═══════════════════════════════════════════════════════
// APP UPDATE NOTIFICATION (Desktop-only, localStorage)
// ═══════════════════════════════════════════════════════

/**
 * Create an app update notification (stored locally, not on server).
 * Idempotent: same version never creates duplicate.
 */
function notifAppUpdateAvailable(version) {
  var idKey = 'app_update_' + version;
  if (_notifLocalExists(idKey)) return; // Already notified for this version

  var notif = {
    id: 'local_' + Date.now(),
    type: 'app_update',
    title: 'Update Available',
    message: 'CodingKida v' + version + ' is ready to install. Restart to update.',
    timestamp: Date.now(),
    read: false,
    idempotencyKey: idKey,
    action: { type: 'restart_update' },
    isLocal: true,
  };

  var locals = _notifGetLocalItems();
  locals.unshift(notif);
  _notifSaveLocalItems(locals);

  // Add to in-memory list immediately
  _notifItems.unshift(notif);
  _notifUpdateBadge();
}

// ═══════════════════════════════════════════════════════
// NOTIFICATION ACTION HANDLER
// ═══════════════════════════════════════════════════════

function notifHandleClick(notifId) {
  var notif = _notifItems.find(function(n) { return n.id === notifId; });
  if (!notif) return;

  notifMarkAsRead(notifId);

  var action = notif.action;
  if (action) {
    if (action.type === 'deeplink' && action.target) {
      // Parse target path to page name
      var target = String(action.target);
      if (target.startsWith('/courses/') && target.length > 9) {
        var courseId = target.replace('/courses/', '');
        if (typeof openCourseDetail === 'function') openCourseDetail(courseId);
        else if (typeof navigate === 'function') navigate('courses');
      } else if (target === '/achievements' || target === 'achievements') {
        if (typeof navigate === 'function') navigate('achievements');
      } else if (target === '/courses' || target === 'courses') {
        if (typeof navigate === 'function') navigate('courses');
      } else if (target === '/coding' || target === 'coding') {
        if (typeof navigate === 'function') navigate('coding');
      } else if (typeof navigate === 'function') {
        // Fallback: navigate to dashboard
        navigate('dashboard');
      }
    } else if (action.type === 'navigate' && action.target) {
      if (typeof navigate === 'function') navigate(action.target);
    } else if (action.type === 'external' && action.url) {
      if (window.electron && window.electron.openExternal) {
        window.electron.openExternal(action.url);
      }
    } else if (action.type === 'openCourse' && action.courseId) {
      if (typeof openCourseDetail === 'function') openCourseDetail(action.courseId);
    } else if (action.type === 'restart_update') {
      if (window.electron && window.electron.quitAndInstallUpdate) {
        window.electron.quitAndInstallUpdate();
      }
    }
  }

  _notifHidePanel();
}

// ═══════════════════════════════════════════════════════
// UI: BADGE + PANEL
// ═══════════════════════════════════════════════════════

function _notifUpdateBadge(serverUnreadCount) {
  // Prefer server unread count when available; fallback to local count
  var count = (serverUnreadCount !== undefined)
    ? serverUnreadCount
    : _notifItems.filter(function(n) { return !n.read; }).length;
  var badge = document.getElementById('topbar-notif-count');
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function notifTogglePanel() {
  var panel = document.getElementById('notif-panel');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    _notifRenderPanel();
    panel.style.display = 'block';
    // Sync in background when panel opens
    notifSync();
  } else {
    panel.style.display = 'none';
  }
}

function _notifHidePanel() {
  var panel = document.getElementById('notif-panel');
  if (panel) panel.style.display = 'none';
}

function _notifRenderPanel() {
  var panel = document.getElementById('notif-panel');
  if (!panel) return;

  var all = _notifItems;
  var html = '';

  // Header
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06);">';
  html += '  <span style="font-size:0.88rem;font-weight:700;color:#fff;">Notifications</span>';
  html += '  <div style="display:flex;gap:8px;">';
  if (all.some(function(n) { return !n.read; })) {
    html += '  <button onclick="notifMarkAllAsRead();_notifRenderPanel();" style="font-size:0.68rem;color:#a78bfa;background:none;border:none;cursor:pointer;font-weight:600;">Mark all read</button>';
  }
  if (all.length > 0) {
    html += '  <button onclick="if(confirm(\'Clear all notifications?\')){notifClearAll();_notifRenderPanel();}" style="font-size:0.68rem;color:#ef4444;background:none;border:none;cursor:pointer;font-weight:600;">Clear</button>';
  }
  html += '  </div>';
  html += '</div>';

  if (all.length === 0) {
    html += '<div style="padding:40px 20px;text-align:center;">';
    html += '  <i class="fas fa-bell-slash" style="font-size:1.5rem;color:rgba(255,255,255,0.15);margin-bottom:8px;display:block;"></i>';
    html += '  <p style="color:rgba(255,255,255,0.4);font-size:0.82rem;">No notifications yet</p>';
    html += '</div>';
  } else {
    html += '<div style="max-height:360px;overflow-y:auto;">';
    all.forEach(function(n) {
      var icon = _notifGetIcon(n.type);
      var timeAgo = _notifTimeAgo(n.timestamp);
      var readStyle = n.read ? 'opacity:0.6;' : '';
      var unreadDot = !n.read ? '<span style="position:absolute;top:12px;right:12px;width:6px;height:6px;border-radius:50%;background:#a78bfa;"></span>' : '';

      html += '<div onclick="notifHandleClick(\'' + n.id + '\')" style="position:relative;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:background 0.15s;' + readStyle + '" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'transparent\'">';
      html += unreadDot;
      html += '  <div style="display:flex;align-items:flex-start;gap:10px;">';
      html += '    <div style="width:28px;height:28px;border-radius:8px;background:' + icon.bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.75rem;">' + icon.emoji + '</div>';
      html += '    <div style="flex:1;min-width:0;">';
      html += '      <div style="font-size:0.78rem;font-weight:600;color:#fff;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _notifSanitize(n.title) + '</div>';
      html += '      <div style="font-size:0.72rem;color:rgba(255,255,255,0.55);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + _notifSanitize(n.message) + '</div>';
      html += '      <div style="font-size:0.65rem;color:rgba(255,255,255,0.3);margin-top:4px;">' + timeAgo + '</div>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';
  }

  panel.innerHTML = html;
}

function _notifGetIcon(type) {
  switch (type) {
    case 'app_update':         return { emoji: '🔄', bg: 'rgba(96,165,250,0.15)' };
    case 'course_enrolled':    return { emoji: '✅', bg: 'rgba(34,197,94,0.15)' };
    case 'payment_failed':     return { emoji: '❌', bg: 'rgba(239,68,68,0.15)' };
    case 'new_course':         return { emoji: '🚀', bg: 'rgba(168,85,247,0.15)' };
    case 'achievement':        return { emoji: '🏆', bg: 'rgba(251,191,36,0.15)' };
    case 'weekly_streak':      return { emoji: '🔥', bg: 'rgba(251,146,60,0.15)' };
    case 'leaderboard_winner': return { emoji: '🥇', bg: 'rgba(251,191,36,0.15)' };
    case 'custom':             return { emoji: '📣', bg: 'rgba(139,92,246,0.15)' };
    default:                   return { emoji: '🔔', bg: 'rgba(255,255,255,0.08)' };
  }
}

function _notifTimeAgo(ts) {
  var diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 172800000) return 'Yesterday';
  return Math.floor(diff / 86400000) + 'd ago';
}

function _notifSanitize(str) {
  if (!str) return '';
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════

function notifInit() {
  // Show local items instantly (from cache)
  _notifRebuildFromLocal();
  // Sync from server
  notifSync();
}

// Close panel on outside click
document.addEventListener('click', function(e) {
  var panel = document.getElementById('notif-panel');
  var bellBtn = document.getElementById('topbar-notif-btn');
  if (panel && panel.style.display === 'block' && bellBtn && !bellBtn.contains(e.target) && !panel.contains(e.target)) {
    panel.style.display = 'none';
  }
});
