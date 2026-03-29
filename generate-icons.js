const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcons() {
  const iconsDir = path.join(__dirname, 'assets', 'icons');
  
  const sizes = [
    { name: 'icon16.svg', size: 16 },
    { name: 'icon48.svg', size: 48 },
    { name: 'icon128.svg', size: 128 },
  ];
  
  for (const { name, size } of sizes) {
    const svgPath = path.join(iconsDir, name);
    const pngPath = path.join(iconsDir, name.replace('.svg', '.png'));
    
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`Created ${pngPath}`);
  }
}

convertIcons().catch(console.error);
