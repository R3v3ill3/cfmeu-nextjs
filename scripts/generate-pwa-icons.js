#!/usr/bin/env node

/**
 * Generate PWA icons from existing favicon.svg or apple-touch-icon.png
 * 
 * This script requires sharp to be installed:
 * npm install --save-dev sharp
 * 
 * Usage: node scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
const sourceIcon = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
const sourceSvg = path.join(__dirname, '..', 'public', 'favicon.svg');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp is not installed.');
  console.error('Please install it with: npm install --save-dev sharp');
  console.error('\nFor now, creating placeholder files. You can generate proper icons later.');
  
  // Create placeholder files
  iconSizes.forEach(size => {
    const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    if (!fs.existsSync(iconPath)) {
      // Create a minimal 1x1 PNG as placeholder
      const placeholder = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(iconPath, placeholder);
      console.log(`Created placeholder: icon-${size}x${size}.png`);
    }
  });
  process.exit(0);
}

// Generate icons from source
async function generateIcons() {
  let source;
  
  // Prefer PNG source if available
  if (fs.existsSync(sourceIcon)) {
    source = sourceIcon;
    console.log(`Using source: ${sourceIcon}`);
  } else if (fs.existsSync(sourceSvg)) {
    source = sourceSvg;
    console.log(`Using source: ${sourceSvg}`);
  } else {
    console.error('No source icon found. Please ensure apple-touch-icon.png or favicon.svg exists.');
    process.exit(1);
  }

  for (const size of iconSizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(source)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}x${size}.png:`, error.message);
    }
  }
  
  console.log('\n✓ All icons generated successfully!');
}

generateIcons().catch(console.error);

