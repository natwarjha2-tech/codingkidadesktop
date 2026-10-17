/**
 * CodingKida Desktop — Live Class virtual background (ISOLATED feature)
 *
 * Teams-style camera background replacement: when the camera is ON, the user's
 * real background is replaced with a chosen image, so only their face/body
 * shows over the image. Everyone sees it automatically because the replacement
 * is applied to the OUTGOING camera track (a Chime video transform device), so
 * the processed frames are what Chime sends — no broadcast needed.
 *
 * Powered by the Chime SDK's BackgroundReplacementVideoFrameProcessor (bundled
 * in window.ChimeSDK) + its segmentation model/WASM which load on demand from
 * Amazon's CDN (static.sdkassets.chime.aws — allowed in the CSP). Online only,
 * which is fine (live class is always online).
 *
 * Integration: live-room.js calls lrBgMakeVideoInput(deviceId) when starting
 * the camera; it returns either the raw deviceId (no background) or a
 * DefaultVideoTransformDevice wrapping the chosen background. lrBgSelect() wires
 * the picker. All state lives here; nothing else is touched.
 */

var _LR_BG_COUNT = 7;                 // number of assets/live-bg/bg-N.jpg files
var _LR_BG_PREF_KEY = 'ck_live_bg';   // saved selection: '' (none) or '1'..'7'
var _lrBgProcessor = null;            // active BackgroundReplacementProcessor
var _lrBgTransformDevice = null;      // active DefaultVideoTransformDevice
var _lrBgCurrent = '';                // current selection ('' = none)
var _lrBgLoading = false;             // guard while building the processor

// Saved selection (default: none).
function _lrBgSaved() {
  try { return localStorage.getItem(_LR_BG_PREF_KEY) || ''; } catch (e) { return ''; }
}
function _lrBgSave(sel) {
  try { localStorage.setItem(_LR_BG_PREF_KEY, sel || ''); } catch (e) {}
}

// Absolute-ish path to a background image (relative to the renderer).
function _lrBgImageUrl(n) {
  return 'assets/live-bg/bg-' + n + '.jpg';
}

// Load a background image as a Blob WITHOUT fetch(). On file:// (packaged/dev
// Electron) a fetch() of a local asset hits the CSP `connect-src` directive and
// is blocked ("Refused to connect ... file:///..."). Loading via an <img>
// element goes through `img-src` instead (where 'self' local files are allowed),
// then we draw it to a canvas and export a Blob — CSP-safe + works on file://.
function _lrBgLoadBlob(n) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1280;
        canvas.height = img.naturalHeight || 720;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob returned null'));
        }, 'image/jpeg', 0.92);
      } catch (e) { reject(e); }
    };
    img.onerror = function () { reject(new Error('image failed to load: ' + _lrBgImageUrl(n))); };
    img.src = _lrBgImageUrl(n);
  });
}

/**
 * Build the camera input for live-room.js:
 *   - no background selected → return the raw deviceId (plain camera),
 *   - a background selected   → return a DefaultVideoTransformDevice that applies
 *     the replacement processor to that camera.
 * Never throws — on any failure it falls back to the plain deviceId so the
 * camera still works.
 */
async function lrBgMakeVideoInput(deviceId) {
  _lrBgCurrent = _lrBgSaved();
  if (!_lrBgCurrent) return deviceId; // no background → plain camera

  try {
    var device = await _lrBgBuildTransformDevice(deviceId, _lrBgCurrent);
    return device || deviceId;
  } catch (e) {
    console.warn('[live-bg] could not apply background; using plain camera:', e);
    return deviceId;
  }
}

// Create (or rebuild) the transform device for a given camera + background.
async function _lrBgBuildTransformDevice(deviceId, sel) {
  var S = window.ChimeSDK;
  if (!S || !S.BackgroundReplacementVideoFrameProcessor || !S.DefaultVideoTransformDevice) {
    return null;
  }

  // Release any previous processor/device before creating a new one.
  await _lrBgDispose();

  var logger = new S.ConsoleLogger('CK-Live-BG', S.LogLevel ? S.LogLevel.ERROR : 50);

  // Load the chosen image as a Blob (via <img>+canvas — CSP/file:// safe).
  var blob = await _lrBgLoadBlob(sel);

  // Create the processor (downloads model/WASM from the Chime CDN on first use).
  _lrBgProcessor = await S.BackgroundReplacementVideoFrameProcessor.create(
    null,                       // default asset spec (CDN)
    { logger: logger, imageBlob: blob }
  );
  if (!_lrBgProcessor) return null;

  // Wrap the camera in a transform device using the processor.
  _lrBgTransformDevice = new S.DefaultVideoTransformDevice(logger, deviceId, [_lrBgProcessor]);
  return _lrBgTransformDevice;
}

// Dispose the active processor/device (safe to call anytime).
async function _lrBgDispose() {
  try { if (_lrBgTransformDevice) await _lrBgTransformDevice.stop(); } catch (e) {}
  try { if (_lrBgProcessor) await _lrBgProcessor.destroy(); } catch (e) {}
  _lrBgTransformDevice = null;
  _lrBgProcessor = null;
}

// ── Picker UI ──────────────────────────────────────────────────────────────────

// Wire the background button + build the picker (idempotent). Called on room open.
function lrBgWire() {
  var btn = document.getElementById('lr-bg-btn');
  if (btn) btn.onclick = function (e) { e.stopPropagation(); _lrBgTogglePicker(); };
  _lrBgBuildPicker();

  if (!_lrBgOutsideWired) {
    _lrBgOutsideWired = true;
    document.addEventListener('click', function (ev) {
      var picker = document.getElementById('lr-bg-picker');
      var b = document.getElementById('lr-bg-btn');
      if (!picker || picker.style.display === 'none') return;
      if ((b && b.contains(ev.target)) || picker.contains(ev.target)) return;
      picker.style.display = 'none';
    });
  }
}
var _lrBgOutsideWired = false;
var _lrBgBuilt = false;

function _lrBgBuildPicker() {
  if (_lrBgBuilt) return;
  var grid = document.getElementById('lr-bg-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // "None" option.
  grid.appendChild(_lrBgCell('', 'None', null));
  for (var i = 1; i <= _LR_BG_COUNT; i++) {
    grid.appendChild(_lrBgCell(String(i), 'Background ' + i, _lrBgImageUrl(i)));
  }
  _lrBgBuilt = true;
  _lrBgMarkActive(_lrBgSaved());
}

function _lrBgCell(sel, label, imgUrl) {
  var cell = document.createElement('button');
  cell.className = 'lr-bg-cell';
  cell.type = 'button';
  cell.setAttribute('data-sel', sel);
  cell.title = label;
  if (imgUrl) {
    cell.style.backgroundImage = 'url("' + imgUrl + '")';
  } else {
    cell.classList.add('none');
    cell.innerHTML = '<i class="fas fa-ban"></i>';
  }
  cell.onclick = function (e) { e.stopPropagation(); lrBgSelect(sel); };
  return cell;
}

function _lrBgMarkActive(sel) {
  var cells = document.querySelectorAll('#lr-bg-grid .lr-bg-cell');
  cells.forEach(function (c) {
    if (c.getAttribute('data-sel') === (sel || '')) c.classList.add('active');
    else c.classList.remove('active');
  });
}

function _lrBgTogglePicker() {
  var picker = document.getElementById('lr-bg-picker');
  if (!picker) return;
  if (picker.style.display === 'none' || !picker.style.display) {
    _lrBgBuildPicker();
    _lrBgMarkActive(_lrBgSaved());
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

/**
 * Select a background ('' = none, '1'..'7'). Saves the choice and, if the camera
 * is currently on, re-applies it live by restarting the video input through the
 * transform device.
 */
async function lrBgSelect(sel) {
  if (_lrBgLoading) return;
  _lrBgSave(sel);
  _lrBgCurrent = sel;
  _lrBgMarkActive(sel);
  _lrBgClosePicker();

  // Re-apply live only if the camera is on (live-room.js owns camera state).
  if (typeof _lrCamOn !== 'undefined' && _lrCamOn && typeof lrBgReapplyCamera === 'function') {
    _lrBgLoading = true;
    try { await lrBgReapplyCamera(); } catch (e) {} finally { _lrBgLoading = false; }
  }
}

function _lrBgClosePicker() {
  var picker = document.getElementById('lr-bg-picker');
  if (picker) picker.style.display = 'none';
}

// Called on teardown — dispose processor + reset UI flags.
function lrBgStop() {
  _lrBgClosePicker();
  _lrBgDispose();
}
