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
  // El CSS del panel se importa como texto y se inyecta dentro del ShadowRoot.
  { ...jsBase, entryPoints: ['src/content/index.js'],         outfile: 'dist/content.js', loader: { '.css': 'text' } },
  { ...jsBase, entryPoints: ['src/background/background.js'], outfile: 'dist/background.js' },
  { ...jsBase, entryPoints: ['inject/pageScript.js'],         outfile: 'dist/inject/pageScript.js' },
  // Solo los estilos que se aplican a elementos de la página (highlights).
  {             entryPoints: ['src/styles/page.css'],          outfile: 'dist/content.css', bundle: true },
];

if (isWatch) {
  const ctx = await esbuild.context(buildTargets[0]);
  await ctx.watch();
  console.log('Watching src/content/ …');
} else {
  await Promise.all(buildTargets.map(c => esbuild.build(c)));
  console.log('✓ Build complete → dist/');
}
