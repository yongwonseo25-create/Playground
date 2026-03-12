#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const chokidar = require('chokidar');

const ROOT_DIR = process.cwd();
const IDEAS_DIR = path.resolve(ROOT_DIR, 'docs/ideas');
const BLUEPRINTS_DIR = path.resolve(ROOT_DIR, 'docs/blueprints');
const GENERATED_DIR = path.resolve(ROOT_DIR, 'src/components/generated');
const ENV_FILES = [path.resolve(ROOT_DIR, '.env'), path.resolve(ROOT_DIR, '.env.local')];
const inFlight = new Set();

loadLocalEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function loadLocalEnv() {
  for (const envPath of ENV_FILES) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

async function ensureDirectories() {
  await fsp.mkdir(IDEAS_DIR, { recursive: true });
  await fsp.mkdir(BLUEPRINTS_DIR, { recursive: true });
  await fsp.mkdir(GENERATED_DIR, { recursive: true });
}

function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'design-brief';
}

function toPascalCase(input) {
  return slugify(input)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function extractTextBlock(responseText) {
  const match = responseText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : responseText.trim();
}

function getProviderConfig() {
  if (GEMINI_API_KEY) {
    return { provider: 'gemini', model: GEMINI_MODEL };
  }

  if (OPENAI_API_KEY) {
    return { provider: 'openai', model: OPENAI_MODEL };
  }

  throw new Error('Set GEMINI_API_KEY or OPENAI_API_KEY in .env or .env.local to enable remote generation');
}

async function callGemini({ model, system, prompt }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, topP: 0.9 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  if (!text) {
    throw new Error('Gemini API returned no text content');
  }

  return text;
}

async function callOpenAI({ model, system, prompt }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI API returned no text content');
  }

  return text;
}

async function callModel({ system, prompt }) {
  const config = getProviderConfig();
  if (config.provider === 'gemini') {
    return { text: await callGemini({ model: config.model, system, prompt }), provider: config.provider, model: config.model };
  }

  return { text: await callOpenAI({ model: config.model, system, prompt }), provider: config.provider, model: config.model };
}

function buildVisualPrdPrompt(brief, fileStem) {
  return [
    'Translate the idea into a structured Visual PRD before any drawing or coding.',
    'Use the S.T.R.U.C.T. framework with the exact headings: Screen Context, Tree Hierarchy, Relative Layout, Units & Spacing, Components, Theme & Style.',
    'Include the hallucination guard keywords when they fit: Flex Column/Row, Justify: Space-Between, Grid 12-column system, Aspect Ratio 16:9, Visual Hierarchy: High/Medium/Low, Negative Space 30%, Max-width: 1200px, Centered, Sticky/Fixed Position.',
    'Return markdown only.',
    `File stem: ${fileStem}`,
    `Brief:\n${brief}`,
  ].join('\n');
}

function buildSvgPrompt(visualPrd, fileStem) {
  return [
    'Create a single self-contained SVG blueprint from the Visual PRD below.',
    'Return SVG markup only.',
    'Honor the Visual PRD as the source of truth and avoid adding unrelated sections.',
    'Use structural annotation labels only when they reinforce the blueprint clarity.',
    `File stem: ${fileStem}`,
    'Visual PRD:',
    visualPrd,
  ].join('\n');
}

function buildReactPrompt({ componentName, visualPrd, svgMarkup }) {
  return [
    'Create a React + TypeScript component for a Next.js App Router project.',
    'Return TSX code only.',
    'Use Tailwind CSS classes and keep the component presentational except for an optional onOpenFreeTrial callback.',
    'Honor the Visual PRD and SVG as the source of truth.',
    'Do not add business logic that would conflict with existing reducer-driven state in Voxera.',
    `Component name: ${componentName}`,
    'Visual PRD:',
    visualPrd,
    'SVG Blueprint:',
    svgMarkup,
  ].join('\n');
}

function escapeForXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeForJs(text) {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function parseBriefTokens(brief) {
  const headline = brief.match(/- Copy: "([^"]+)"/)?.[1] || 'Voice-powered landing page';
  const cta = brief.match(/3\. Single CTA Button[\s\S]*?- Copy: "([^"]+)"/)?.[1] || 'Try now';
  const trust = brief.match(/4\. Trust Bar[\s\S]*?- Copy: "([^"]+)"/)?.[1] || 'Trusted by teams today';
  const description = brief.match(/- Target: (.+)/)?.[1] || 'Zero-touch generated landing page';
  return { headline, cta, trust, description };
}

function buildFallbackVisualPrd(brief) {
  const { headline, cta, trust, description } = parseBriefTokens(brief);
  return [
    '# Visual PRD',
    '',
    '## Screen Context',
    '- Theme: Dark',
    '- Surface: Mobile-first landing hero',
    '- Aspect Ratio 16:9 translated into a vertically centered mobile canvas',
    '- Visual Hierarchy: High headline, Medium CTA, Low trust bar',
    '',
    '## Tree Hierarchy',
    '- Root > Main Container > Section Wrapper > Headline',
    '- Root > Main Container > Section Wrapper > Interactive Mic Button',
    '- Root > Main Container > Section Wrapper > CTA Button',
    '- Root > Main Container > Section Wrapper > Trust Bar',
    '- Layout trigger: Flex Column/Row with a single centered column',
    '',
    '## Relative Layout',
    '- Center the entire content stack horizontally and vertically',
    '- Keep CTA flow in a single vertical axis rather than absolute positioning',
    '- Justify: Space-Between is not primary here; centered cluster is primary',
    '',
    '## Units & Spacing',
    '- Gap system: Tight between semantic label and headline, fixed gap 40px to mic, fixed gap 48px to CTA',
    '- Negative Space 30% around the main stack to reduce clutter',
    '- Max-width: 1200px, Centered at system level, with max-w-md enforced in the component',
    '',
    '## Components',
    `- Headline: ${headline}`,
    '- Mic Demo: circular button, 120px by 120px, hover glow, opens free trial modal',
    `- CTA Button: ${cta}`,
    `- Trust Bar: ${trust}`,
    `- Description intent: ${description}`,
    '',
    '## Theme & Style',
    '- Dark canvas with premium monochrome contrast',
    '- Sticky/Fixed Position is intentionally unused for the core landing stack',
    '- Tone: urgent, minimal, conversion-focused, no escape-link chrome',
  ].join('\n');
}

function buildFallbackSvg(fileStem, brief, visualPrd) {
  const { headline, cta, trust } = parseBriefTokens(brief);
  const notes = visualPrd.split(/\r?\n/).filter(Boolean).slice(0, 10);
  const noteText = notes.map((line, index) => `<text x="52" y="${220 + index * 26}" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="15">${escapeForXml(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" fill="none">
  <rect width="1080" height="1350" fill="#0A0A0A" />
  <rect x="210" y="96" width="660" height="1158" rx="44" fill="#101010" stroke="#2A2A2A" stroke-width="2" />
  <text x="540" y="170" text-anchor="middle" fill="#FAFAFA" font-family="Arial, sans-serif" font-size="36" font-weight="700">${escapeForXml(fileStem)}</text>
  <text x="540" y="334" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="54" font-weight="700">${escapeForXml(headline)}</text>
  <circle cx="540" cy="610" r="118" fill="#18181B" stroke="#3F3F46" stroke-width="2" />
  <circle cx="540" cy="610" r="56" fill="#27272A" />
  <path d="M540 566a28 28 0 0 1 28 28v28a28 28 0 1 1-56 0v-28a28 28 0 0 1 28-28Z" fill="#FAFAFA" />
  <path d="M502 620a38 38 0 0 0 76 0" stroke="#FAFAFA" stroke-width="10" stroke-linecap="round" />
  <path d="M540 656v30" stroke="#FAFAFA" stroke-width="10" stroke-linecap="round" />
  <path d="M514 686h52" stroke="#FAFAFA" stroke-width="10" stroke-linecap="round" />
  <rect x="322" y="808" width="436" height="92" rx="46" fill="#FAFAFA" />
  <text x="540" y="864" text-anchor="middle" fill="#09090B" font-family="Arial, sans-serif" font-size="30" font-weight="700">${escapeForXml(cta)}</text>
  <text x="540" y="962" text-anchor="middle" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">${escapeForXml(trust)}</text>
  <text x="52" y="188" fill="#71717A" font-family="Arial, sans-serif" font-size="16">Visual PRD snapshot</text>
  ${noteText}
</svg>`;
}

function buildFallbackComponent(componentName, brief) {
  const { headline, cta, trust, description } = parseBriefTokens(brief);
  return `'use client';\n\nimport { Mic } from 'lucide-react';\n\nexport type ${componentName}Props = {\n  onOpenFreeTrial?: () => void;\n};\n\nexport function ${componentName}({ onOpenFreeTrial }: ${componentName}Props) {\n  return (\n    <main className="w-full min-h-screen bg-[#0A0A0A]">\n      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6">\n        <div className="flex w-full flex-col items-center justify-center text-center">\n          <p className="sr-only">{"${escapeForJs(description)}"}</p>\n          <h1 className="text-4xl font-bold tracking-tight text-white text-center text-balance break-keep">\n            ${escapeForJs(headline)}\n          </h1>\n          <button\n            type="button"\n            onClick={() => onOpenFreeTrial?.()}\n            aria-label="${escapeForJs(cta.replace(/[\[\]]/g, ''))}"\n            className="mt-10 flex h-[120px] w-[120px] cursor-pointer items-center justify-center rounded-full bg-zinc-900 text-white transition duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"\n          >\n            <Mic className="h-12 w-12" strokeWidth={2.2} />\n          </button>\n          <button\n            type="button"\n            onClick={() => onOpenFreeTrial?.()}\n            className="mt-12 rounded-full bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"\n          >\n            ${escapeForJs(cta)}\n          </button>\n          <p className="mt-8 text-sm font-medium tracking-[0.2em] text-zinc-400">${escapeForJs(trust)}</p>\n        </div>\n      </section>\n    </main>\n  );\n}\n\nexport default ${componentName};`;
}

async function generateWithFallback({ brief, fileStem, componentName }) {
  let generationMode = 'remote';
  let provider = null;
  let model = null;
  let visualPrd;
  let svgMarkup;
  let componentCode;

  try {
    console.log(`[auto-design] Generating Visual PRD for ${fileStem}`);
    const prdResult = await callModel({
      system: 'You are a product design strategist. You must translate vague landing page ideas into rigorous S.T.R.U.C.T. Visual PRDs before any visual rendering begins.',
      prompt: buildVisualPrdPrompt(brief, fileStem),
    });
    visualPrd = extractTextBlock(prdResult.text);
    provider = prdResult.provider;
    model = prdResult.model;

    console.log(`[auto-design] Generating SVG blueprint for ${fileStem}`);
    const svgResult = await callModel({
      system: 'You are a senior product designer. Use the provided Visual PRD as the sole source of truth and return a valid standalone SVG.',
      prompt: buildSvgPrompt(visualPrd, fileStem),
    });
    svgMarkup = extractTextBlock(svgResult.text);
    provider = svgResult.provider;
    model = svgResult.model;

    console.log(`[auto-design] Generating React component for ${fileStem}`);
    const reactResult = await callModel({
      system: 'You are a senior front-end engineer. Use the provided Visual PRD and SVG as the sole source of truth and return production-grade React TSX.',
      prompt: buildReactPrompt({ componentName, visualPrd, svgMarkup }),
    });
    componentCode = extractTextBlock(reactResult.text);
    provider = reactResult.provider;
    model = reactResult.model;
  } catch (error) {
    generationMode = 'fallback';
    console.warn(`[auto-design] Remote generation unavailable for ${fileStem}`);
    console.warn(error instanceof Error ? error.message : error);
    console.warn('[auto-design] Using deterministic local fallback Visual PRD, blueprint, and component');
    visualPrd = buildFallbackVisualPrd(brief);
    svgMarkup = buildFallbackSvg(fileStem, brief, visualPrd);
    componentCode = buildFallbackComponent(componentName, brief);
    provider = 'local-fallback';
    model = 'deterministic-generator';
  }

  return { generationMode, provider, model, visualPrd, svgMarkup, componentCode };
}

async function processIdea(filePath) {
  if (!filePath.endsWith('.txt')) {
    return;
  }

  const absolutePath = path.resolve(filePath);
  if (inFlight.has(absolutePath)) {
    return;
  }

  inFlight.add(absolutePath);

  try {
    const brief = (await fsp.readFile(absolutePath, 'utf8')).trim();
    if (!brief) {
      console.warn(`[auto-design] Skipping empty brief: ${absolutePath}`);
      return;
    }

    const fileStem = path.basename(absolutePath, '.txt');
    const safeStem = slugify(fileStem);
    const componentName = `${toPascalCase(fileStem)}Generated`;
    const prdTarget = path.join(BLUEPRINTS_DIR, `${safeStem}.visual-prd.md`);
    const svgTarget = path.join(BLUEPRINTS_DIR, `${safeStem}.svg`);
    const componentTarget = path.join(GENERATED_DIR, `${componentName}.tsx`);
    const metadataTarget = path.join(BLUEPRINTS_DIR, `${safeStem}.json`);

    const result = await generateWithFallback({ brief, fileStem: safeStem, componentName });

    await fsp.writeFile(prdTarget, `${result.visualPrd}\n`, 'utf8');
    await fsp.writeFile(svgTarget, `${result.svgMarkup}\n`, 'utf8');
    await fsp.writeFile(componentTarget, `${result.componentCode}\n`, 'utf8');

    const metadata = {
      source: path.relative(ROOT_DIR, absolutePath),
      visualPrd: path.relative(ROOT_DIR, prdTarget),
      blueprint: path.relative(ROOT_DIR, svgTarget),
      component: path.relative(ROOT_DIR, componentTarget),
      componentName,
      provider: result.provider,
      model: result.model,
      generationMode: result.generationMode,
      generatedAt: new Date().toISOString(),
    };
    await fsp.writeFile(metadataTarget, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

    console.log(`[auto-design] Completed ${fileStem}`);
    console.log(`[auto-design] Provider: ${result.provider}`);
    console.log(`[auto-design] Visual PRD: ${path.relative(ROOT_DIR, prdTarget)}`);
    console.log(`[auto-design] Blueprint: ${path.relative(ROOT_DIR, svgTarget)}`);
    console.log(`[auto-design] Component: ${path.relative(ROOT_DIR, componentTarget)}`);
  } catch (error) {
    console.error(`[auto-design] Failed for ${filePath}`);
    console.error(error instanceof Error ? error.message : error);
  } finally {
    inFlight.delete(absolutePath);
  }
}

async function main() {
  await ensureDirectories();
  console.log('[auto-design] Watching docs/ideas for new .txt briefs');
  console.log('[auto-design] Remote mode uses GEMINI_API_KEY first, then OPENAI_API_KEY if Gemini is absent');

  const watcher = chokidar.watch(IDEAS_DIR, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });

  watcher.on('add', processIdea);
  watcher.on('change', processIdea);
  watcher.on('error', (error) => {
    console.error('[auto-design] Watcher error');
    console.error(error instanceof Error ? error.message : error);
  });
}

main().catch((error) => {
  console.error('[auto-design] Fatal error');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});