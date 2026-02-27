// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');
sharp('dt-logo.png')
  .trim({ background: { r: 255, g: 255, b: 255, alpha: 1 }, threshold: 25 })
  .resize(180, 180)
  .png({ compressionLevel: 9, quality: 80 })
  .toFile('src/app/apple-icon.png')
  .then(info => console.log('Apple icon created:', info))
  .catch(err => console.error('Error cropping:', err));
