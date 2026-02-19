#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running pre-deployment checks...\n');

let hasErrors = false;

// Function to run a command and handle errors
function runCommand(command, description) {
  console.log(`${description}...`);
  try {
    const result = execSync(command, { 
      stdio: 'pipe', 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    console.log(`${description} - PASSED\n`);
    return true;
  } catch (error) {
    console.log(`${description} - FAILED`);
    console.log(error.stdout || error.message);
    console.log('');
    hasErrors = true;
    return false;
  }
}

// Check 1: TypeScript compilation with strict mode
runCommand('npx tsc --noEmit --strict', 'TypeScript strict type checking');

// Check 2: ESLint
runCommand('npm run lint', 'ESLint code quality check');

// Check 3: Next.js build (dry run)
runCommand('npm run build', 'Next.js production build');

// Check 4: Check for common deployment issues
console.log('Checking for common deployment issues...');

// Check if vercel.json exists
if (!fs.existsSync('vercel.json')) {
  console.log('vercel.json not found - deployment may fail');
  hasErrors = true;
} else {
  console.log('vercel.json found');
}

// Check if .vercelignore exists
if (!fs.existsSync('.vercelignore')) {
  console.log('.vercelignore not found - large files may be deployed');
  hasErrors = true;
} else {
  console.log('.vercelignore found');
}

// Check package.json for required scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.scripts.build) {
  console.log('build script missing from package.json');
  hasErrors = true;
} else {
  console.log('build script found in package.json');
}

console.log('');

// Final result
if (hasErrors) {
  console.log('Pre-deployment checks FAILED');
  console.log('Please fix the errors above before deploying to Vercel.');
  process.exit(1);
} else {
  console.log('All pre-deployment checks PASSED!');
  console.log('Your codebase is ready for Vercel deployment.');
  process.exit(0);
}
