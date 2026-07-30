/**
 * CodingKida Desktop — PDF Viewer
 * In-app PDF canvas viewer using PDF.js (no download/print possible).
 */

// ─── PDF.js Canvas Viewer (no download/print possible) ───────────────────────

let _pdfDoc = null;
let _pdfCurrentPage = 1;
let _pdfScale = 1.5;

function closePdfViewer() {
  const viewer = document.getElementById('pdf-viewer-modal');
  if (viewer) viewer.style.display = 'none';
  _pdfDoc = null;
  _pdfCurrentPage = 1;
  const canvas = document.getElementById('pdf-canvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

function _renderPdfPage(pageNum) {
  if (!_pdfDoc) return;
  _pdfDoc.getPage(pageNum).then(function(page) {
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: _pdfScale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    page.render({ canvasContext: ctx, viewport: viewport });
    document.getElementById('pdf-page-info').textContent = pageNum + ' / ' + _pdfDoc.numPages;
    _pdfCurrentPage = pageNum;
  });
}

function pdfPrevPage() {
  if (_pdfCurrentPage <= 1) return;
  _renderPdfPage(_pdfCurrentPage - 1);
}

function pdfNextPage() {
  if (!_pdfDoc || _pdfCurrentPage >= _pdfDoc.numPages) return;
  _renderPdfPage(_pdfCurrentPage + 1);
}

function pdfZoomIn() {
  _pdfScale = Math.min(_pdfScale + 0.25, 3.0);
  _renderPdfPage(_pdfCurrentPage);
}

function pdfZoomOut() {
  _pdfScale = Math.max(_pdfScale - 0.25, 0.5);
  _renderPdfPage(_pdfCurrentPage);
}

function _openPdfInCanvas(url) {
  const viewer = document.getElementById('pdf-viewer-modal');
  if (!viewer) return;
  viewer.style.display = 'flex';
  _pdfScale = 1.5;
  _pdfCurrentPage = 1;
  document.getElementById('pdf-page-info').textContent = 'Loading...';

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    pdfjsLib.getDocument(url).promise.then(function(pdf) {
      _pdfDoc = pdf;
      _renderPdfPage(1);
    }).catch(function() {
      alert('Could not load PDF.');
      closePdfViewer();
    });
  } else {
    alert('PDF viewer not available.');
    closePdfViewer();
  }
}

async function openPdfInApp(url) {
  if (!url) return;
  // Use local HTTP server to serve PDF — avoids CSP issues and works offline
  if (window.electron && window.electron.playDownload) {
    const userId = getCurrentUserId();
    const lessonId = _currentVideoData ? _currentVideoData.lessonId : null;
    if (lessonId) {
      const result = await window.electron.playDownload({ lessonId, type: 'pdf', userId });
      if (result.success) {
        _openPdfInCanvas(result.serveUrl);
        return;
      }
    }
  }
  // Fallback: open signed URL in canvas viewer (online only)
  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    let pdfUrl = url;
    if (url.includes('amazonaws.com')) {
      const res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ url }),
      });
      if (res.ok) { const d = await res.json(); if (d.signedUrl) pdfUrl = d.signedUrl; }
    }
    _openPdfInCanvas(pdfUrl);
  } catch { alert('Could not open PDF.'); }
}
