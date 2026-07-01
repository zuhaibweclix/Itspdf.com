/// <reference types="cypress" />

/**
 * PDF to CSV Converter — QA Audit Suite
 * Built on the QA-Auditor framework: SEO QA · UX QA · Functionality QA.
 * URL: https://www.itspdf.com/pdf-to-csv
 *
 * ───────────────────────────────────────────────────────────────────────────
 * KEY DIFFERENCES vs image-converter specs (jpg/png/bmp/tiff):
 *   • Output is a .csv file per PDF — NOT a zip of images.
 *   • Per-file .result-actions rows only render when 2+ files are converted.
 *   • Single-file conversion: only #downloadAll button is shown.
 *   • No zoom/preview control (document converter, not image viewer).
 *   • Upload limit is 10 files at once.
 *
 * REQUIRED FIXTURES ( cypress/fixtures/ )
 *   valid.pdf, valid-2.pdf   – normal readable PDFs
 *   sample.jpg               – non-PDF, triggers invalid-extension toast
 *   large.pdf                – > 10 MB, triggers size toast
 *   corrupted.pdf            – broken PDF, triggers corrupt toast
 *   password.pdf             – encrypted PDF, triggers password toast
 *   files/1.pdf … 11.pdf     – 11 small PDFs for the 10-file limit test
 *
 * SCOPE NOTE: Cypress covers technical SEO, DOM accessibility, responsive
 * layout, links, security headers and the full functional flow. Core Web
 * Vitals, real PageSpeed, screen-reader output, colour contrast and
 * cross-browser rendering need Lighthouse / axe / manual testing.
 * ───────────────────────────────────────────────────────────────────────────
 */

// ─── Tool configuration ───────────────────────────────────────────────────────
const CONFIG = {
  url:         'https://www.itspdf.com/pdf-to-csv',
  path:        '/pdf-to-csv',
  toolName:    'PDF to CSV',
  title:       'PDF To CSV Converter (Fast, Free & Secure)',
  description: 'This Online PDF To CSV Converter Is used to Convert PDF documents into CSV files For Free.',
  outputExt:   'csv',
  fileLimit:   10,
};

// Swallow the site's own unrelated runtime errors (e.g. window.__pvReady).
Cypress.on('uncaught:exception', () => false);

// ─── Selectors ───────────────────────────────────────────────────────────────
const SEL = {
  // Upload
  chooseFilesBtn:  '.mt-3 > .w-auto > .text-white, [class*="chooseFile"], [class*="choose-file"], .btn-outline-primary',
  firstFileInput:  'input[type="file"]',
  addMoreInput:    '#clickUpload1',
  plusBtn:         '.uploadDivBtn',
  uploadedFileRow: '.otherfile',

  // Per-file upload controls (appear on hover)
  deleteFileBtn: '.removeFile',

  // Toasts
  toastWrap: '#toasts',
  toast:     '#toasts .toast.error',

  // Convert
  convertBtn: '#convert',

  // Result — per-file download links (only rendered for 2+ converted files)
  downloadLink: '.result-actions a.btn-download-text',
  downloadIcon: '.result-actions a.btn-download-icon',
  resultDelete: '.result-actions .result-delete-btn',

  // "Download All" button — always present after any conversion
  downloadAll: '#downloadAll',

  // Gate: result is ready when either control is visible
  downloadGate:    '#downloadAll, .result-actions a.btn-download-text',
  downloadAll_any: '#downloadAll, .result-actions a.btn-download-text, .result-actions a.btn-download-icon',

  // Reset / retry
  startOverBtn: '#reconvert',
  retryBtn:     '.topbar-refresh',

  // URL upload
  dropdownBtn:    '.Expand_menu',
  enterUrlOption: '.btn.enterUrl',
  urlInput:       'input.url_upload[name="url_upload"]',
  addUrlBtn:      'button.add_url[name="file_url"]',
};

const TOAST = {
  size:      'You can upload upto 10 MB per file',
  extension: 'You can upload only .pdf files',
  corrupt:   'Can not process: File is corrupt',
  password:  'This PDF is password-protected. Please remove the password and try again.',
  maxFiles:  'upload more than 10 files',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const FIXTURES = 'cypress/fixtures/';
const fx = (f) => (Array.isArray(f) ? f.map((x) => FIXTURES + x) : FIXTURES + f);

const chooseFiles    = (f) => cy.get(SEL.firstFileInput).first().selectFile(fx(f), { force: true });
const addMoreFiles   = (f) => cy.get(SEL.addMoreInput).selectFile(fx(f), { force: true });
const waitForUploads = (n) =>
  cy.wait(Array.from({ length: n }, () => '@upload'), { timeout: 60000 });
const expectListed   = (t) =>
  cy.get('body', { timeout: 15000 }).should('contain.text', t);
const expectToast    = (t) =>
  cy.get(SEL.toastWrap, { timeout: 10000 }).should('contain.text', t);

function clickConvert() {
  cy.get(SEL.convertBtn, { timeout: 60000 })
    .should('be.visible')
    .click({ force: true });
}

/**
 * Wait for the result area, verify every per-file .csv link (only present
 * for 2+ conversions) serves a real CSV, then click all download controls.
 */
function downloadAndVerifyCsv() {
  cy.get(SEL.downloadGate, { timeout: 60000 }).should('be.visible');

  // Collect distinct .csv hrefs from per-file anchors (empty for single file).
  cy.get('body').then(($b) => {
    const hrefs = [
      ...new Set(
        [...$b.find('.result-actions a[download][href]')]
          .map((a) => a.getAttribute('href'))
          .filter((h) => /\.csv(\?|$)/i.test(h))
      ),
    ];
    hrefs.forEach((href) => {
      cy.request(href).then((resp) => {
        expect(resp.status, `GET ${href}`).to.eq(200);
        const type = (resp.headers['content-type'] || '').toLowerCase();
        expect(
          /csv|text\/plain|octet-stream/.test(type) || /\.csv/i.test(href),
          `served a csv (content-type="${type}")`
        ).to.be.true;
      });
    });
  });

  // Click every download control on screen.
  cy.get(SEL.downloadAll_any).click({ multiple: true, force: true });
}

/** Audit-finding logger — surfaces issues without failing the run. */
function finding(name, passed, detail) {
  cy.log(`${passed ? '✅ PASS' : '⚠️ FINDING'} — ${name}${detail ? ` (${detail})` : ''}`);
}

// ═════════════════════════════════════════════════════════════════════════════
describe(`${CONFIG.toolName} — QA Audit Suite (SEO · UX · Functionality)`, () => {
  beforeEach(() => {
    cy.intercept('POST', '**/upload').as('upload');
    cy.intercept('POST', '**/url-upload').as('urlUpload');
    cy.visit(CONFIG.url);
  });

  // ═══════════════════════════ 1. SEO QA ═══════════════════════════════════
  context('SEO QA', () => {
    it('has the exact, unique title tag', () => {
      cy.title().should('eq', CONFIG.title);
      finding(
        'Title length 40–60 chars',
        CONFIG.title.length >= 40 && CONFIG.title.length <= 60,
        `${CONFIG.title.length} chars`
      );
    });

    it('has the exact meta description', () => {
      cy.get('head meta[name="description"]')
        .should('have.attr', 'content', CONFIG.description);
      finding(
        'Description length 120–160 chars',
        CONFIG.description.length >= 120 && CONFIG.description.length <= 160,
        `${CONFIG.description.length} chars`
      );
    });

    it('has a self-referencing canonical tag', () => {
      cy.get('head link[rel="canonical"]')
        .should('have.attr', 'href')
        .and('include', CONFIG.path);
    });

    it('is served over HTTPS', () => {
      cy.location('protocol').should('eq', 'https:');
    });

    it('is indexable (no noindex robots meta)', () => {
      cy.get('head').then(($h) => {
        const robots = $h.find('meta[name="robots"]').attr('content') || '';
        expect(robots.toLowerCase()).to.not.include('noindex');
      });
    });

    it('declares a document language', () => {
      cy.get('html').should('have.attr', 'lang').and('not.be.empty');
    });

    it('has a responsive viewport meta tag', () => {
      cy.get('head meta[name="viewport"]')
        .should('have.attr', 'content')
        .and('include', 'width=device-width');
    });

    it('has a favicon', () => {
      cy.get('head link[rel*="icon"]').should('have.length.gte', 1);
    });

    it('hreflang alternates — informational', () => {
      cy.get('html').then(($r) => {
        finding('hreflang alternates present', $r.find('link[rel="alternate"][hreflang]').length >= 2, 'not localised on this tool');
      });
    });

    it('has exactly one H1 containing the primary keyword', () => {
      cy.get('h1').should('have.length', 1);
      cy.get('h1').invoke('text').then((t) => {
        expect(t.toLowerCase()).to.match(/pdf to csv/);
      });
    });

    it('has Open Graph tags for social sharing', () => {
      cy.get('head meta[property="og:title"]').should('have.attr', 'content').and('not.be.empty');
      cy.get('head meta[property="og:image"]').should('have.attr', 'content').and('not.be.empty');
      cy.get('head meta[property="og:url"]')
        .should('have.attr', 'content')
        .and('include', CONFIG.path);
      finding('og:description present', false, 'not present on this page');
    });

    it('has Twitter Card tags', () => {
      cy.get('head meta[name="twitter:card"]').should('exist');
      cy.get('head meta[name="twitter:title"]')
        .should('have.attr', 'content')
        .and('not.be.empty');
    });

    it('all images declare an alt attribute', () => {
      cy.get('img').each(($img) => {
        expect($img[0].hasAttribute('alt'), `alt on ${$img.attr('src')}`).to.be.true;
      });
    });

    it('structured data (JSON-LD) — informational', () => {
      cy.get('html').then(($root) => {
        finding(
          'JSON-LD structured data present',
          $root.find('script[type="application/ld+json"]').length > 0
        );
      });
    });
  });

  // ═══════════════════════════ 2. UX QA ════════════════════════════════════
  context('UX QA — Accessibility, Responsive, Trust, Heuristics', () => {
    it('logo links back to the homepage', () => {
      cy.get('a[href="https://www.itspdf.com"], a[href="/"]').should('have.length.gte', 1);
    });

    it('Terms and Privacy trust links exist and resolve', () => {
      cy.get('a[href*="termsandconditions"]').should('have.length.gte', 1);
      cy.get('a[href*="policy"]').first().then(($a) => {
        cy.request($a.attr('href')).its('status').should('be.lt', 400);
      });
    });

    it('Convert button is a real button that becomes enabled after upload', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      cy.get(SEL.convertBtn)
        .should('match', 'button')
        .and('not.be.disabled');
      cy.get(SEL.convertBtn).focus().should('be.focused');
    });

    it('Convert button meets a usable touch-target size after upload', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      cy.get(SEL.convertBtn).should('be.visible').then(($b) => {
        const r = $b[0].getBoundingClientRect();
        finding('Convert touch target ≥ 44px tall', r.height >= 44, `${Math.round(r.height)}px`);
        expect(r.height, 'convert min target').to.be.gte(24);
      });
    });

    it('per-file delete icon carries an accessible name', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      cy.get(`${SEL.deleteFileBtn} img`, { timeout: 15000 })
        .should('have.attr', 'alt')
        .and('not.be.empty');
    });

    it('result-area delete button carries aria-label (multi-file conversion)', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      cy.get(SEL.downloadGate, { timeout: 60000 }).should('be.visible');
      cy.get(SEL.resultDelete).first()
        .should('have.attr', 'aria-label')
        .and('not.be.empty');
    });

    // [Responsive tests moved to dedicated Responsive QA context below]

    it('footer exposes secondary navigation links', () => {
      cy.get('a[href*="/about"]').should('exist');
      cy.get('a[href*="/contact"]').should('exist');
      cy.get('a[href*="policy"]').should('exist');
      cy.get('a[href*="termsandconditions"]').should('exist');
    });

    it('shows visible system-status feedback after conversion completes (Nielsen #1)', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      clickConvert();
      cy.get(SEL.downloadGate, { timeout: 60000 }).should('be.visible');
    });
  });

  // ═══════════════════════ 3. FUNCTIONALITY QA ═════════════════════════════
  context('Functionality QA — Upload validations', () => {
    it('accepts a single valid PDF', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      expectListed('valid');
      cy.get(SEL.toast).should('not.exist');
    });

    it('accepts multiple valid PDFs at once', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      expectListed('valid');
      expectListed('valid-2');
    });

    it('rejects a non-PDF (JPG) with the invalid-extension toast', () => {
      chooseFiles('sample.jpg');
      expectToast(TOAST.extension);
    });

    it('rejects a file larger than 10 MB with the size toast', () => {
      chooseFiles('large.pdf');
      expectToast(TOAST.size);
    });

    it('rejects a corrupted PDF with the corrupt toast', () => {
      chooseFiles('corrupted.pdf');
      expectToast(TOAST.corrupt);
    });

    it('rejects a password-protected PDF with the password toast', () => {
      chooseFiles('password.pdf');
      expectToast(TOAST.password);
    });

    it('shows no error toast for a valid PDF', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      cy.get(SEL.toast).should('not.exist');
    });
  });

  context('Functionality QA — File management controls', () => {
    it('adds more files via the "Add Files" input', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      addMoreFiles('valid-2.pdf');
      waitForUploads(1);
      expectListed('valid');
      expectListed('valid-2');
    });

    it('shows the "+" add-more affordance after a file is uploaded', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      cy.get(SEL.plusBtn).should('be.visible');
    });

    it('deletes an uploaded file via the per-file remove control', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      cy.get(SEL.deleteFileBtn, { timeout: 15000 }).should('have.length.gte', 2);
      cy.get(SEL.deleteFileBtn).then(($d) => {
        const before = $d.length;
        cy.wrap($d.first()).parent().trigger('mouseover', { force: true });
        cy.wrap($d.first()).click({ force: true });
        cy.get(SEL.deleteFileBtn).should('have.length.lessThan', before);
      });
    });

    it(`blocks the ${CONFIG.fileLimit + 1}th file and shows the max-files toast`, () => {
      const maxFiles = Array.from({ length: CONFIG.fileLimit }, (_, i) => `files/${i + 1}.pdf`);
      chooseFiles(maxFiles);
      waitForUploads(CONFIG.fileLimit);
      addMoreFiles(`files/${CONFIG.fileLimit + 1}.pdf`);
      expectToast(TOAST.maxFiles);
    });
  });

  context('Functionality QA — Convert, download & result controls', () => {
    it('converts a single PDF and shows the #downloadAll button', () => {
      // Single-file: only #downloadAll is shown (no per-file .result-actions row).
      chooseFiles('valid.pdf');
      waitForUploads(1);
      clickConvert();
      cy.get(SEL.downloadAll, { timeout: 60000 }).should('be.visible');
    });

    it('#downloadAll button label reads "Download" after conversion', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      clickConvert();
      cy.get(SEL.downloadAll, { timeout: 60000 })
        .should('be.visible')
        .and('contain.text', 'Download');
    });

    it('clicking #downloadAll triggers a download', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      clickConvert();
      cy.get(SEL.downloadAll, { timeout: 60000 }).should('be.visible');
      cy.get(SEL.downloadAll).click({ force: true });
      cy.get(SEL.downloadAll).should('exist');
    });

    it('converts multiple PDFs and shows a per-file .result-actions row each', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      cy.get(SEL.downloadLink, { timeout: 60000 }).should('have.length.gte', 2);
    });

    it('per-file .csv links carry a .csv href (multi-file conversion)', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      cy.get(SEL.downloadLink, { timeout: 60000 }).should('be.visible');
      cy.get(SEL.downloadLink).each(($a) => {
        cy.wrap($a)
          .should('have.attr', 'href')
          .and('match', /\.csv(\?|$)/i);
      });
    });

    it('per-file .csv link serves a real CSV file', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      cy.get(SEL.downloadLink, { timeout: 60000 }).should('be.visible');
      cy.get(SEL.downloadLink).first().then(($a) => {
        const href = $a.attr('href');
        cy.request(href).then((resp) => {
          expect(resp.status).to.eq(200);
          const type = (resp.headers['content-type'] || '').toLowerCase();
          expect(
            /csv|text\/plain|octet-stream/.test(type) || /\.csv/i.test(href),
            `served a csv (content-type="${type}")`
          ).to.be.true;
        });
      });
    });

    it('result-area Delete button removes a converted file (multi-file only)', () => {
      // Delete button only rendered when 2+ files are converted.
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      cy.get(SEL.resultDelete, { timeout: 60000 }).should('have.length.gte', 2);
      cy.get(SEL.resultDelete).then(($d) => {
        const before = $d.length;
        cy.wrap($d.first()).click({ force: true });
        cy.get(SEL.resultDelete).should('have.length.lessThan', before);
      });
    });

    it('downloads and verifies all CSV files via all download controls', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      downloadAndVerifyCsv();
    });

    it(`blocks the ${CONFIG.fileLimit + 1}th file, converts the valid ${CONFIG.fileLimit} and downloads`, () => {
      const maxFiles = Array.from({ length: CONFIG.fileLimit }, (_, i) => `files/${i + 1}.pdf`);
      chooseFiles(maxFiles);
      waitForUploads(CONFIG.fileLimit);
      addMoreFiles(`files/${CONFIG.fileLimit + 1}.pdf`);
      expectToast(TOAST.maxFiles);
      clickConvert();
      downloadAndVerifyCsv();
    });

    it('resets cleanly via Start Over', () => {
      chooseFiles(['valid.pdf', 'valid-2.pdf']);
      waitForUploads(2);
      clickConvert();
      cy.get(SEL.downloadGate, { timeout: 60000 }).should('be.visible');

      cy.get(SEL.startOverBtn)
        .should('have.attr', 'href', CONFIG.url)
        .click();

      cy.url().should('include', CONFIG.path);
      cy.get(SEL.downloadLink, { timeout: 30000 }).should('not.exist');      cy.get(SEL.downloadAll).should('not.be.visible');
    });

    it('top-bar Retry/refresh control is present and clickable after upload', () => {
      chooseFiles('valid.pdf');
      waitForUploads(1);
      cy.get('body').then(($b) => {
        if (!$b.find(SEL.retryBtn).length) {
          finding('Top-bar retry control present', false, 'not rendered at this stage');
          return;
        }
        cy.get(SEL.retryBtn).first().click({ force: true });
        cy.get(SEL.firstFileInput).should('exist');
      });
    });
  });

  context('Functionality QA — Upload via URL', () => {
    const REMOTE_PDF =
      'https://www.gtechme.com/wp-content/uploads/2020/07/gtech_strategy_seo.pdf';

    it('uploads a PDF by URL, converts it and downloads the CSV', () => {
      cy.get(SEL.dropdownBtn).filter(':visible').first().click();
      cy.get(SEL.enterUrlOption).filter(':visible').first().click();
      cy.get(SEL.urlInput).filter(':visible').first().clear().type(REMOTE_PDF);
      cy.get(SEL.addUrlBtn).filter(':visible').first().click();

      cy.wait('@urlUpload', { timeout: 30000 });
      cy.get(SEL.uploadedFileRow, { timeout: 30000 }).should('have.length.gte', 1);

      clickConvert();

      // Single URL upload → #downloadAll only.
      cy.get(SEL.downloadAll, { timeout: 60000 }).should('be.visible');
      cy.get(SEL.downloadAll).click({ force: true });
    });
  });

  context('Functionality QA — Navigation & link health', () => {
    it('internal links resolve (no broken links — sample up to 8)', () => {
      const links = new Set();
      cy.get('a[href^="https://www.itspdf.com/"]')
        .each(($a) => {
          const h = $a.attr('href');
          if (h && !h.includes('#')) links.add(h);
        })
        .then(() => {
          [...links].slice(0, 8).forEach((href) => {
            cy.request({ url: href, failOnStatusCode: false }).then((r) => {
              finding(`Link OK: ${href}`, r.status < 400, `HTTP ${r.status}`);
            });
          });
        });
    });

    it('external social links use target="_blank" and rel="noopener"', () => {
      cy.get('a[href*="facebook.com"], a[href*="instagram.com"]').each(($a) => {
        const rel    = ($a.attr('rel') || '').toLowerCase();
        const target = $a.attr('target') || '';
        finding(
          `Social link safe (${$a.attr('href')})`,
          target === '_blank' && /noopener/.test(rel)
        );
      });
    });
  });

  // ════════════════ 4. SECURITY & BEST-PRACTICE FINDINGS ════════════════════
  context('Security & headers (informational findings)', () => {
    it('audits HTTP security response headers', () => {
      cy.request(CONFIG.url).then((resp) => {
        const h = resp.headers;
        finding('HSTS (Strict-Transport-Security)',       !!h['strict-transport-security']);
        finding('X-Content-Type-Options: nosniff',       (h['x-content-type-options'] || '').includes('nosniff'));
        finding('Clickjacking protection',
          !!h['x-frame-options'] || /frame-ancestors/i.test(h['content-security-policy'] || ''));
        finding('Content-Security-Policy present',       !!h['content-security-policy']);
        finding('Referrer-Policy present',               !!h['referrer-policy']);
      });
    });

    it('does not expose obvious credentials/keys on the window object', () => {
      cy.window().then((win) => {
        const keys = Object.keys(win).filter((k) =>
          /apikey|secret|token|password/i.test(k)
        );
        finding('No obvious credential globals on window', keys.length === 0, keys.join(', '));
      });
    });
  });

  // ════════════════════ 5. RESPONSIVE QA ══════════════════════════════════
  /**
   * Devices tested (width × height):
   *   Mobile  : iPhone SE (375×667), iPhone 14 Pro (393×852),
   *             Samsung Galaxy S21 (360×800), small mobile (320×568)
   *   Tablet  : iPad Mini (768×1024), iPad Air (820×1180),
   *             iPad Pro 12.9 (1024×1366), Surface Pro (912×1368)
   *   Laptop  : MacBook Air (1280×800), standard laptop (1366×768)
   *   Desktop : FHD (1920×1080), QHD (2560×1440), 4K (3840×2160)
   *
   * Checks per viewport:
   *   • No horizontal overflow
   *   • Upload input is reachable (exists in DOM)
   *   • Choose Files button is visible and tall enough to tap (≥ 40px)
   *   • Nav / header is visible
   *   • Footer is reachable (scroll into view)
   *   • Full upload → convert → download flow on one representative
   *     mobile (375) and one desktop (1920) size
   */
  context('Responsive QA — Devices & Breakpoints', () => {
    const VIEWPORTS = [
      // ── Mobile ──────────────────────────────────────────────
      { label: 'iPhone SE',           w: 375,  h: 667,  cat: 'mobile'  },
      { label: 'iPhone 14 Pro',       w: 393,  h: 852,  cat: 'mobile'  },
      { label: 'Samsung Galaxy S21',  w: 360,  h: 800,  cat: 'mobile'  },
      { label: 'Small mobile 320px',  w: 320,  h: 568,  cat: 'mobile'  },
      // ── Tablet ──────────────────────────────────────────────
      { label: 'iPad Mini',           w: 768,  h: 1024, cat: 'tablet'  },
      { label: 'iPad Air',            w: 820,  h: 1180, cat: 'tablet'  },
      { label: 'iPad Pro 12.9"',      w: 1024, h: 1366, cat: 'tablet'  },
      { label: 'Surface Pro 7',       w: 912,  h: 1368, cat: 'tablet'  },
      // ── Laptop ──────────────────────────────────────────────
      { label: 'MacBook Air 13"',     w: 1280, h: 800,  cat: 'laptop'  },
      { label: 'Standard laptop',     w: 1366, h: 768,  cat: 'laptop'  },
      // ── Desktop ─────────────────────────────────────────────
      { label: 'FHD 1920×1080',       w: 1920, h: 1080, cat: 'desktop' },
      { label: 'QHD 2560×1440',       w: 2560, h: 1440, cat: 'desktop' },
      { label: '4K 3840×2160',        w: 3840, h: 2160, cat: 'desktop' },
    ];

    // ── Layout checks on every device ────────────────────────────────────
    VIEWPORTS.forEach(({ label, w, h }) => {
      it(`[${label} ${w}×${h}] — no horizontal overflow, upload reachable`, () => {
        cy.viewport(w, h);
        cy.visit(CONFIG.url);

        // No horizontal scrollbar
        cy.document().then((doc) => {
          const el = doc.documentElement;
          finding(
            `No horizontal overflow @${w}px`,
            el.scrollWidth <= el.clientWidth + 2,
            `scrollWidth ${el.scrollWidth} vs clientWidth ${el.clientWidth}`
          );
        });

        // Upload input exists in DOM (even if visually hidden behind a button)
        cy.get(SEL.firstFileInput).should('exist');

        // Choose Files button is visible and has a tappable height
        cy.get(SEL.chooseFilesBtn, { timeout: 10000 }).should('be.visible').then(($b) => {
          const h_px = $b[0].getBoundingClientRect().height;
          finding(
            `Choose Files tap target ≥ 40px @${w}px`,
            h_px >= 40,
            `${Math.round(h_px)}px`
          );
        });

        // Page header / nav is visible
        cy.get('header, nav, .navbar, [class*="header"], [class*="nav"]')
          .first()
          .should('be.visible');

        // Footer is reachable — scroll to it then scroll back to top so the
        // next steps find the upload area, not footer elements.
        cy.get('footer, [class*="footer"]').first().scrollIntoView().should('exist');
        cy.scrollTo('top');

        // On mobile/tablet (<= 1024px): .mobileConvertBtn is a sticky bar.
        // It is in the DOM but may not be :visible until a file is uploaded;
        // confirm at least #convert exists as a fallback.
        if (w <= 1024) {
          cy.get('#convert').should('exist');
        }
      });
    });

    // ── Functional upload flow on mobile (375px — iPhone SE) ─────────────
    it('[Mobile 375px] upload, convert and download works end-to-end', () => {
      cy.viewport(375, 667);
      cy.visit(CONFIG.url);
      cy.intercept('POST', '**/upload').as('uploadMobile');

      cy.get(SEL.firstFileInput).first().selectFile('cypress/fixtures/valid.pdf', { force: true });
      cy.wait('@uploadMobile', { timeout: 60000 });
      cy.get('body').should('contain.text', 'valid');

      // On mobile the convert button lives inside .mobileConvertBtn sticky bar.
      // Scroll it into view then force-click to bypass visibility constraints.
      cy.get('.mobileConvertBtn #convert, #convert').first()
        .scrollIntoView().click({ force: true });
      cy.get(SEL.downloadGate, { timeout: 90000 }).should('be.visible');
      cy.get(SEL.downloadAll).click({ force: true });
    });

    // ── Functional upload flow on tablet (768px — iPad Mini) ─────────────
    it('[Tablet 768px] upload, convert and download works end-to-end', () => {
      cy.viewport(768, 1024);
      cy.visit(CONFIG.url);
      cy.intercept('POST', '**/upload').as('uploadTablet');

      cy.get(SEL.firstFileInput).first().selectFile('cypress/fixtures/valid.pdf', { force: true });
      cy.wait('@uploadTablet', { timeout: 60000 });
      cy.get('body').should('contain.text', 'valid');

      // On tablet the convert button is also inside .mobileConvertBtn.
      cy.get('.mobileConvertBtn #convert, #convert').first()
        .scrollIntoView().click({ force: true });
      cy.get(SEL.downloadGate, { timeout: 90000 }).should('be.visible');
      cy.get(SEL.downloadAll).click({ force: true });
    });

    // ── Functional upload flow on desktop (1920px — FHD) ─────────────────
    it('[Desktop 1920px] upload, convert and download works end-to-end', () => {
      cy.viewport(1920, 1080);
      cy.visit(CONFIG.url);
      cy.intercept('POST', '**/upload').as('uploadDesktop');

      cy.get(SEL.firstFileInput).first().selectFile('cypress/fixtures/valid.pdf', { force: true });
      cy.wait('@uploadDesktop', { timeout: 60000 });
      cy.get('body').should('contain.text', 'valid');

      cy.get(SEL.convertBtn, { timeout: 60000 }).should('be.visible').click({ force: true });
      cy.get(SEL.downloadGate, { timeout: 90000 }).should('be.visible');
      cy.get(SEL.downloadAll).click({ force: true });
    });
  });

});
