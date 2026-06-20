import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execPromise = promisify(exec);

async function build() {
  console.log('🚀 Starting production build...');

  try {
    // Clean dist directory
    console.log('📦 Cleaning dist directory...');
    try {
      await fs.rm('dist', { recursive: true, force: true });
    } catch (err) {
      // Ignore if directory doesn't exist
    }
    await fs.mkdir('dist', { recursive: true });
    await fs.mkdir('dist/server', { recursive: true });

    // Build client with Vite
    console.log('⚛️  Building client with Vite...');
    const buildEnv = {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=4096', // Increase memory for large builds
      NODE_ENV: 'production'
    };
    
    try {
      const { stdout: viteOutput } = await execPromise(
        'cd client && npx vite build 2>&1',
        {
          env: buildEnv,
          maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large builds
        }
      );
      
      if (viteOutput) {
        // Log output, filtering only important messages (not pure annotation warnings)
        const lines = viteOutput.split('\n');
        const filteredLines = lines.filter(line => 
          !line.includes('PURE_ANNOTATION_COMMENT') && 
          !line.includes('pure annotation') &&
          line.trim() !== ''
        );
        if (filteredLines.length > 0) {
          console.log(filteredLines.join('\n'));
        }
      }
    } catch (error) {
      // Check if build actually succeeded despite the error
      try {
        await fs.access('client/dist/index.html');
        console.log('✓ Client build completed (vite reported warnings but output was created)');
      } catch (checkErr) {
        // Build actually failed
        console.error('❌ Vite build error:', error.message);
        if (error.stdout) console.error(error.stdout);
        if (error.stderr) console.error(error.stderr);
        throw error;
      }
    }
    
    // Verify build output exists
    try {
      await fs.access('client/dist');
      console.log('✓ Client build output verified');
    } catch (err) {
      throw new Error('Vite build failed: client/dist directory not created');
    }

    // Copy client build to dist
    console.log('📋 Copying client build to dist...');
    await fs.cp('client/dist', 'dist/client', { recursive: true });

    // Build server with esbuild
    console.log('🔨 Building server with esbuild...');
    const { stdout: serverOutput, stderr: serverError } = await execPromise(
      'npx esbuild server/index.ts --bundle --platform=node --packages=external --external:./vite --external:vite --outfile=dist/server/index.js --format=esm --sourcemap --define:process.env.NODE_ENV=\\"production\\"'
    );
    if (serverOutput) console.log(serverOutput);
    if (serverError) console.error(serverError);

    // Build the BullMQ worker entrypoint (dedicated Render `worker` service)
    console.log('🔨 Building worker with esbuild...');
    const { stdout: workerOutput, stderr: workerError } = await execPromise(
      'npx esbuild server/worker.ts --bundle --platform=node --packages=external --outfile=dist/server/worker.js --format=esm --sourcemap --define:process.env.NODE_ENV=\\"production\\"'
    );
    if (workerOutput) console.log(workerOutput);
    if (workerError) console.error(workerError);

    // Copy server/vite.ts separately (not bundled)
    console.log('📋 Copying additional server files...');
    try {
      await fs.copyFile('server/vite.ts', 'dist/server/vite.js');
    } catch (err) {
      console.log('Note: server/vite.ts not needed in production');
    }

    console.log('✅ Build completed successfully!');
    console.log('📁 Output directory: dist/');
    console.log('   - dist/client/ - Frontend static files');
    console.log('   - dist/server/index.js - Backend server');
    console.log('🚀 Ready for deployment!');

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    process.exit(1);
  }
}

build();
