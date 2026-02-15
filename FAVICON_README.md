# Favicon and App Icons Setup

## Files Created

1. **favicon.svg** - Modern SVG favicon (works in all modern browsers)
2. **site.webmanifest** - Web app manifest for PWA support

## Required Image Files

To complete the favicon setup, you need to create the following image files:

### Favicon Files
- `favicon.ico` - Traditional favicon (16x16, 32x32, 48x48 combined)
- `favicon-16x16.png` - 16x16 PNG favicon
- `favicon-32x32.png` - 32x32 PNG favicon

### Apple Touch Icons
- `apple-touch-icon.png` - 180x180 PNG (for iOS home screen)

### Web Manifest Icons
- `favicon-192x192.png` - 192x192 PNG (for Android)
- `favicon-512x512.png` - 512x512 PNG (for Android)

## How to Create These Files

### Option 1: Online Favicon Generator
1. Visit https://realfavicongenerator.net/ or https://favicon.io/
2. Upload your logo or design
3. Generate all required sizes
4. Download and place files in the root directory

### Option 2: Convert SVG to PNG/ICO
1. Use an image editor (GIMP, Photoshop, or online tools)
2. Open `favicon.svg`
3. Export at the required sizes:
   - 16x16, 32x32, 48x48 → Combine into `favicon.ico`
   - 16x16 → `favicon-16x16.png`
   - 32x32 → `favicon-32x32.png`
   - 180x180 → `apple-touch-icon.png`
   - 192x192 → `favicon-192x192.png`
   - 512x512 → `favicon-512x512.png`

### Option 3: Use Command Line Tools
If you have ImageMagick installed:
```bash
# Convert SVG to PNG at different sizes
magick favicon.svg -resize 16x16 favicon-16x16.png
magick favicon.svg -resize 32x32 favicon-32x32.png
magick favicon.svg -resize 180x180 apple-touch-icon.png
magick favicon.svg -resize 192x192 favicon-192x192.png
magick favicon.svg -resize 512x512 favicon-512x512.png

# Create ICO file (combines multiple sizes)
magick favicon.svg -define icon:auto-resize=16,32,48 favicon.ico
```

## Current Status

✅ SVG favicon created (`favicon.svg`)
✅ Web manifest created (`site.webmanifest`)
✅ All HTML files updated with favicon links
⏳ PNG/ICO image files need to be created (see above)

## Testing

After creating the image files:
1. Clear browser cache
2. Check browser tab shows favicon
3. Test on mobile devices (iOS/Android)
4. Verify "Add to Home Screen" shows correct icon
