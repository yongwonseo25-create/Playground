const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DEFAULT_TARGET_URL =
  'https://www.notion.so/Voice-OS-Master-Template-Official-v1';
const DEFAULT_LOGIN_URL = 'https://www.notion.so/login';
const AUTOMATION_PROFILE_DIR = path.join(
  process.cwd(),
  'chrome-automation-profile'
);
const DEFAULT_LOGIN_WAIT_MS = 180_000;
const DEFAULT_COMPLETION_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = current.slice(2).split('=');
    const nextValue = inlineValue ?? argv[index + 1];
    parsed[rawKey] = nextValue;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return parsed;
}

function buildConfig() {
  const args = parseArgs(process.argv.slice(2));

  return {
    targetUrl: args.url || process.env.NOTION_TEMPLATE_URL || DEFAULT_TARGET_URL,
    loginUrl: args['login-url'] || process.env.NOTION_LOGIN_URL || DEFAULT_LOGIN_URL,
    profileDir:
      args['profile-dir'] ||
      process.env.NOTION_AUTOMATION_PROFILE_DIR ||
      AUTOMATION_PROFILE_DIR,
    loginWaitMs: Number(
      args['login-wait-ms'] ||
        process.env.NOTION_LOGIN_WAIT_MS ||
        DEFAULT_LOGIN_WAIT_MS
    ),
    completionTimeoutMs: Number(
      args['completion-timeout-ms'] ||
        process.env.NOTION_COMPLETION_TIMEOUT_MS ||
        DEFAULT_COMPLETION_TIMEOUT_MS
    ),
  };
}

function ensureDirectoryExists(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeUrl(rawUrl) {
  return rawUrl.replace(/[?#].*$/, '').replace(/\/$/, '');
}

function isSameUrl(left, right) {
  return normalizeUrl(left) === normalizeUrl(right);
}

function isTemplateMarketplaceUrl(url) {
  return /notion\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?templates/i.test(url);
}

function isTemplatePreviewUrl(url) {
  return /notion-templates\.notion\.site/i.test(url);
}

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function waitForVisibleLocator(page, locators, timeoutMs, pollMs = 500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const locator of locators) {
      if (await isVisible(locator)) {
        return locator;
      }
    }

    await page.waitForTimeout(pollMs);
  }

  return null;
}

function duplicateButtonLocators(page) {
  return [
    page.getByRole('button', { name: /^Get template$/i }).first(),
    page.getByRole('link', { name: /^Get template$/i }).first(),
    page.getByText(/^Get template$/i).first(),
    page.getByRole('button', { name: /^View template$/i }).first(),
    page.getByRole('link', { name: /^View template$/i }).first(),
    page.getByText(/^View template$/i).first(),
    page.getByRole('button', { name: /^Use template$/i }).first(),
    page.getByRole('link', { name: /^Use template$/i }).first(),
    page.getByText(/^Use template$/i).first(),
    page.getByRole('button', { name: /^Start with this template$/i }).first(),
    page.getByRole('link', { name: /^Start with this template$/i }).first(),
    page
      .getByRole('button', {
        name: /^\uC774 \uD15C\uD50C\uB9BF\uC73C\uB85C \uC2DC\uC791$/,
      })
      .first(),
    page
      .getByRole('link', {
        name: /^\uC774 \uD15C\uD50C\uB9BF\uC73C\uB85C \uC2DC\uC791$/,
      })
      .first(),
    page.getByRole('button', { name: /^Duplicate$/i }).first(),
    page.getByRole('button', { name: /^Duplicate page$/i }).first(),
    page.getByRole('button', { name: /^Duplicate template$/i }).first(),
    page.getByRole('button', { name: /^\uBCF5\uC81C$/ }).first(),
    page
      .getByRole('button', { name: /^\uD398\uC774\uC9C0 \uBCF5\uC81C$/ })
      .first(),
    page
      .getByRole('button', { name: /^\uD15C\uD50C\uB9BF \uBCF5\uC81C$/ })
      .first(),
    page.getByRole('link', { name: /^Duplicate$/i }).first(),
    page.getByRole('link', { name: /^Duplicate page$/i }).first(),
    page.getByRole('link', { name: /^Duplicate template$/i }).first(),
    page.getByRole('link', { name: /^\uBCF5\uC81C$/ }).first(),
    page
      .getByRole('link', { name: /^\uD398\uC774\uC9C0 \uBCF5\uC81C$/ })
      .first(),
    page.locator('button[aria-label="Duplicate"]').first(),
  ];
}

function loginIndicators(page) {
  return [
    page.locator('input[type="email"]').first(),
    page.locator('input[name="email"]').first(),
    page.locator('input[type="password"]').first(),
  ];
}

async function pageNeedsLogin(page) {
  if (/\/login|\/auth|\/signin/i.test(page.url())) {
    return true;
  }

  const pageTitle = await page.title().catch(() => '');
  if (/log in|login|\uB85C\uADF8\uC778/i.test(pageTitle)) {
    return true;
  }

  for (const indicator of loginIndicators(page)) {
    if (await isVisible(indicator)) {
      return true;
    }
  }

  return false;
}

async function maybeSelectWorkspace(page) {
  const dialog = page.locator('[role="dialog"]').last();
  if (!(await isVisible(dialog))) {
    return false;
  }

  const preferredButtons = [
    dialog.getByRole('button', { name: /add to private/i }).first(),
    dialog.getByRole('button', { name: /my private/i }).first(),
    dialog.getByRole('button', { name: /private/i }).first(),
    dialog
      .getByRole('button', {
        name: /\uAC1C\uC778 \uD398\uC774\uC9C0\uC5D0 \uCD94\uAC00/,
      })
      .first(),
    dialog.getByRole('button', { name: /\uAC1C\uC778/ }).first(),
    dialog
      .getByRole('button', { name: /\uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4/ })
      .first(),
  ];

  for (const locator of preferredButtons) {
    if (await isVisible(locator)) {
      await locator.click();
      return true;
    }
  }

  const genericButtons = dialog.locator('button');
  const buttonCount = await genericButtons.count();
  for (let index = 0; index < buttonCount; index += 1) {
    const button = genericButtons.nth(index);
    const label = (await button.innerText().catch(() => '')).trim();
    if (!label || /cancel|\uCDE8\uC18C|close|\uB2EB\uAE30/i.test(label)) {
      continue;
    }

    await button.click().catch(() => {});
    return true;
  }

  const genericOptions = dialog.locator('[role="option"]');
  if ((await genericOptions.count()) > 0) {
    await genericOptions.first().click().catch(() => {});
    return true;
  }

  return false;
}

async function waitForManualLogin(page, config) {
  console.log(
    `Notion login required. Waiting up to ${Math.round(config.loginWaitMs / 1000)}s for manual login in the isolated automation window...`
  );
  console.log('Complete the login in the isolated Chrome window. The bot will resume automatically.');

  const deadline = Date.now() + config.loginWaitMs;

  while (Date.now() < deadline) {
    if (!(await pageNeedsLogin(page))) {
      return true;
    }

    await page.waitForTimeout(1_000);
  }

  return false;
}

async function waitForCloneCompletion(page, sourceUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (
      !isSameUrl(page.url(), sourceUrl) &&
      !/\/login|\/auth|\/signin/i.test(page.url()) &&
      !isTemplateMarketplaceUrl(page.url()) &&
      !isTemplatePreviewUrl(page.url())
    ) {
      return page;
    }

    const workspaceSelected = await maybeSelectWorkspace(page);
    if (workspaceSelected) {
      await page.waitForTimeout(1_500);
      continue;
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error('Clone completion timeout exceeded.');
}

async function clickTemplateFlow(page, context) {
  const currentUrl = page.url();

  if (!isTemplateMarketplaceUrl(currentUrl)) {
    return page;
  }

  const viewTemplateButton = await waitForVisibleLocator(
    page,
    [
      page.getByRole('button', { name: /^View template$/i }).first(),
      page.getByRole('link', { name: /^View template$/i }).first(),
      page.getByText(/^View template$/i).first(),
    ],
    20_000
  );

  if (!viewTemplateButton) {
    return page;
  }

  const popupPromise = context
    .waitForEvent('page', { timeout: 15_000 })
    .catch(() => null);

  await viewTemplateButton.click();

  const popupPage = await popupPromise;
  const templatePage = popupPage ?? page;
  await templatePage.waitForLoadState('domcontentloaded').catch(() => {});

  const startTemplateButton = await waitForVisibleLocator(
    templatePage,
    [
      templatePage
        .getByRole('button', { name: /^Start with this template$/i })
        .first(),
      templatePage
        .getByRole('link', { name: /^Start with this template$/i })
        .first(),
      templatePage
        .getByRole('button', {
          name: /^\uC774 \uD15C\uD50C\uB9BF\uC73C\uB85C \uC2DC\uC791$/,
        })
        .first(),
      templatePage
        .getByRole('link', {
          name: /^\uC774 \uD15C\uD50C\uB9BF\uC73C\uB85C \uC2DC\uC791$/,
        })
        .first(),
    ],
    20_000
  );

  if (!startTemplateButton) {
    return templatePage;
  }

  const appPopupPromise = context
    .waitForEvent('page', { timeout: 15_000 })
    .catch(() => null);

  await startTemplateButton.click();

  const appPopupPage = await appPopupPromise;
  const activePage = appPopupPage ?? templatePage;
  await activePage.waitForLoadState('domcontentloaded').catch(() => {});
  return activePage;
}

function isCompletedTemplateRedirect(page, sourceUrl) {
  const currentUrl = page.url();
  return (
    !isSameUrl(currentUrl, sourceUrl) &&
    !/\/login|\/auth|\/signin/i.test(currentUrl) &&
    !isTemplateMarketplaceUrl(currentUrl) &&
    !isTemplatePreviewUrl(currentUrl)
  );
}

async function addStealthScript(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    Object.defineProperty(window, 'chrome', {
      get: () => ({ runtime: {} }),
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });
}

async function openIsolatedContext(config) {
  ensureDirectoryExists(config.profileDir);

  return chromium.launchPersistentContext(config.profileDir, {
    channel: 'chrome',
    headless: false,
    noDefaultViewport: true,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

async function resolveDuplicateButton(page, config) {
  let duplicateButton = await waitForVisibleLocator(
    page,
    duplicateButtonLocators(page),
    15_000
  );

  if (duplicateButton) {
    return duplicateButton;
  }

  if (await pageNeedsLogin(page)) {
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
    const loginCompleted = await waitForManualLogin(page, config);

    if (!loginCompleted) {
      throw new Error('Manual login timeout exceeded before a Notion session was created.');
    }
  }

  await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });
  duplicateButton = await waitForVisibleLocator(
    page,
    duplicateButtonLocators(page),
    20_000
  );

  if (!duplicateButton) {
    throw new Error('Duplicate button was not found on the target page after login.');
  }

  return duplicateButton;
}

async function main() {
  const config = buildConfig();

  console.log(`Target URL: ${config.targetUrl}`);
  console.log(`Isolated automation profile: ${config.profileDir}`);

  const context = await openIsolatedContext(config);

  try {
    await addStealthScript(context);

    const page = context.pages()[0] ?? (await context.newPage());
    await page.bringToFront();
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });

    const templateFlowPage = await clickTemplateFlow(page, context);

    if (isCompletedTemplateRedirect(templateFlowPage, config.targetUrl)) {
      console.log(`Cloned page URL: ${templateFlowPage.url()}`);
      return;
    }

    const duplicateButton = await resolveDuplicateButton(templateFlowPage, config);
    const popupPromise = context
      .waitForEvent('page', { timeout: 15_000 })
      .catch(() => null);

    await duplicateButton.click();

    const popupPage = await popupPromise;
    const activePage = popupPage ?? page;
    await activePage.waitForLoadState('domcontentloaded').catch(() => {});

    if (await pageNeedsLogin(activePage)) {
      const loginCompleted = await waitForManualLogin(activePage, config);

      if (!loginCompleted) {
        throw new Error('Manual login timeout exceeded before template duplication could continue.');
      }
    }

    const clonedPage = await waitForCloneCompletion(
      activePage,
      config.targetUrl,
      config.completionTimeoutMs
    );

    console.log(`Cloned page URL: ${clonedPage.url()}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
