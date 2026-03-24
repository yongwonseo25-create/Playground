#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function toTarget(input) {
  if (!input) {
    return 'http://localhost:3000';
  }

  if (/^https?:\/\//i.test(input) || /^file:\/\//i.test(input)) {
    return input;
  }

  const absolutePath = path.resolve(process.cwd(), input);
  if (fs.existsSync(absolutePath)) {
    return pathToFileURL(absolutePath).href;
  }

  return input;
}

async function main() {
  const rawTargets = process.argv.slice(2);
  const targets = rawTargets.length > 0 ? rawTargets : ['http://localhost:3000'];
  const { default: open, apps } = await import('open');

  await Promise.all(
    targets.map(async (rawTarget) => {
      const target = toTarget(rawTarget);
      await open(target, {
        app: {
          name: apps.browser,
        },
        wait: false,
        newInstance: true,
        background: false,
      });

      process.stdout.write(`${target}\n`);
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
