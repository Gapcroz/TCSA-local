// esbuild.config.js
const esbuild = require('esbuild');
const fs = require('fs-extra'); // For file system operations

const outdir = 'dist';
const srcdir = 'src';

const commonBuildOptions = {
  bundle: true,
  minify: false, // Set to true for production build
  sourcemap: true, // Generate sourcemaps for debugging
  platform: 'browser',
  logLevel: 'info',
  // You might need to adjust entry points based on your specific needs
  // For this setup, we'll create separate bundles for each HTML page's JS and CSS
  entryPoints: [
    `${srcdir}/js/login.js`,
    `${srcdir}/js/register.js`,
    `${srcdir}/js/dashboard.js`,
    `${srcdir}/js/file-conversion.js`,
    `${srcdir}/js/admin-dashboard.js`,
    `${srcdir}/css/main.css`,
    `${srcdir}/css/login.css`,
    `${srcdir}/css/register.css`,
    `${srcdir}/css/dashboard.css`,
    `${srcdir}/css/file-conversion.css`,
    `${srcdir}/css/admin.css`,
    `${srcdir}/css/login-failure.css`,
    `${srcdir}/css/access-pending.css`,
  ],
  outdir: outdir,
  // Ensure that .html files don't reference a full path to .js but just 'main.js' or similar
  // esbuild will hash the filenames by default, so we might need to be careful with hardcoded paths.
  // We'll rely on esbuild's default output and update HTML src/hrefs with `esbuild --serve` or by copying.
  // For this setup, the HTML files *directly reference* the source files, and esbuild generates the bundle beside them.
  // The crucial part is that the `dist` directory mirrors `src/html`, but with bundled assets.
  // A simpler way for a "multi-page" setup is to just copy HTML after bundling JS/CSS.
  // Or, use an esbuild plugin to inject hash names if complexity scales.
  // For now, let's assume `src/html` links correctly to `../js/<name>.js` and `../css/<name>.css`
  // and we will ensure the dist directory has the necessary structure.
};

// Function to copy HTML files to dist
async function copyHtmlFiles() {
  const htmlFiles = await fs.readdir(`${srcdir}/html`);
  for (const file of htmlFiles) {
    if (file.endsWith('.html')) {
      await fs.copy(`${srcdir}/html/${file}`, `${outdir}/${file}`);
      console.log(`Copied ${file} to ${outdir}/`);
    }
  }
}

async function build() {
  // Clear the dist directory
  await fs.emptyDir(outdir);
  console.log(`Cleaned ${outdir}/`);

  // Copy HTML files first
  await copyHtmlFiles();

  // Run esbuild to bundle JS and CSS
  await esbuild.build({
    ...commonBuildOptions,
    minify: true, // Minify for production build
  }).catch(() => process.exit(1));

  console.log('Frontend build complete.');
}

async function dev() {
  // Clear the dist directory
  await fs.emptyDir(outdir);
  console.log(`Cleaned ${outdir}/`);

  // Copy HTML files first
  await copyHtmlFiles();

  // Start esbuild in watch mode
  const ctx = await esbuild.context({
    ...commonBuildOptions,
    minify: false, // Don't minify in development
  });

  await ctx.watch();
  console.log('esbuild is watching for changes...');
}

const command = process.argv[2]; // Get the command argument (e.g., 'build' or 'dev')

if (command === 'build') {
  build();
} else if (command === 'dev') {
  dev();
} else {
  console.error('Unknown command. Use "build" or "dev".');
  process.exit(1);
}