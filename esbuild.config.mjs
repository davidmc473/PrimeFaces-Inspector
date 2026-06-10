import * as esbuild from 'esbuild';
import fs from 'fs';

const isWatch = process.argv.includes('--watch');

fs.mkdirSync('dist/inject', { recursive: true });

const jsBase = {
  bundle: true,
  sourcemap: false,
  target: ['chrome110'],
  platform: 'browser',
  format: 'iife',
};

const buildTargets = [
  { ...jsBase, entryPoints: ['src/content/index.js'],         outfile: 'dist/content.js' },
  { ...jsBase, entryPoints: ['src/background/background.js'], outfile: 'dist/background.js' },
  { ...jsBase, entryPoints: ['inject/pageScript.js'],         outfile: 'dist/inject/pageScript.js' },
  {             entryPoints: ['src/styles/content.css'],       outfile: 'dist/content.css', bundle: true },
];

if (isWatch) {
  const ctx = await esbuild.context(buildTargets[0]);
  await ctx.watch();
  console.log('Watching src/content/ …');
} else {
  await Promise.all(buildTargets.map(c => esbuild.build(c)));
  console.log('✓ Build complete → dist/');
}
