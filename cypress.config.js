const { defineConfig } = require('cypress');

module.exports = defineConfig({
  // Viewport dimensions — matches the 1920x1080 the app reports in its logs,
  // so responsive/desktop-only elements (e.g. the visible .Expand_menu copy)
  // render the way the tests expect.
  viewportWidth: 1920,
  viewportHeight: 1080,

  // Where Cypress drops downloaded files (the converter's ZIP, etc.).
  downloadsFolder: 'cypress/downloads',
  // Clear old downloads/screenshots/videos before each run so stale files
  // can't cause a false pass.
  trashAssetsBeforeRuns: true,

  // Capture a screenshot automatically when a test fails (embedded in report).
  screenshotOnRunFailure: true,
  video: false,

  // Retry flaky tests (e.g. a transient ETIMEDOUT on cy.visit) before failing.
  retries: {
    runMode: 2, // `cypress run` (CI)
    openMode: 0, // `cypress open` (interactive)
  },

  // ── Beautiful HTML report on every run ────────────────────────────────────
  // Produces a single self-contained HTML file with charts, per-test timing,
  // and failure screenshots embedded. Output: cypress/reports/html/
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'cypress/reports',
    reportPageTitle: 'PDF to JPG Converter — Test Report',
    reportFilename: 'report-[datetime]', // timestamped so runs don't overwrite
    timestamp: 'yyyy-mm-dd_HH-MM-ss',
    charts: true, // pass/fail donut + suite bars
    embeddedScreenshots: true, // screenshots inline in the HTML
    inlineAssets: true, // one portable .html file (no css/js sidecar)
    saveJson: true, // also keep the raw JSON
    overwrite: false,
    autoOpen: true, // set true to pop the report open after `cypress run`
  },

  e2e: {
    baseUrl: 'https://www.itspdf.com',
    // A bit more headroom than the 4s default for this network-heavy tool.
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 30000,
    pageLoadTimeout: 90000,
    setupNodeEvents(on, config) {
      // Registers the reporter's hooks (merging specs, generating the HTML).
      require('cypress-mochawesome-reporter/plugin')(on);
      return config;
    },
  },
});
