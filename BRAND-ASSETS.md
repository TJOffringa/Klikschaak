# Klikschaak Brand Assets

**Design Style:** Gradient Border (Optie 4)  
**Generated:** 28 januari 2026  
**Based on:** Live game screenshot

## 📁 Generated Files

### Essential Favicons (Production)
- `favicon-32x32.png` - Browser tab icon (most important!)
- `favicon-192x192.png` - Android home screen
- `apple-touch-icon-180x180.png` - iOS home screen

### Logo
- `logo-200x200.png` - General purpose logo

### Social Media
- `social-preview-1200x630.png` - Open Graph / Twitter Card

### Optional (Future/PWA)
- `favicon-16x16.png` - Legacy browsers (rarely used)
- `icon-512x512.png` - PWA manifest (not needed for MVP)

## 🎨 Design Details

**Border Style:**
- Gradient from `#b58863` (light brown) to `#8b6f47` (dark brown)
- Creates depth and premium feel
- Border width scales with image size

**Rounded Corners:**
- Outer radius: ~20% of image size
- Inner radius: slightly smaller for clean edge
- Smooth, modern appearance

**Shadow:**
- Subtle drop shadow for depth
- Gaussian blur for soft effect
- Black with 40% opacity

## 💻 Implementation

### Add to HTML `<head>`

```html
<!-- Favicon (essentials only) -->
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
<link rel="icon" type="image/png" sizes="192x192" href="favicon-192x192.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon-180x180.png">

<!-- Open Graph (Facebook, LinkedIn, Discord) -->
<meta property="og:title" content="Klikschaak">
<meta property="og:description" content="Combineer schaakstukken voor strategische dominantie">
<meta property="og:image" content="https://tjoffringa.github.io/Klikschaak/social-preview-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://tjoffringa.github.io/Klikschaak/">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Klikschaak">
<meta name="twitter:description" content="Combineer schaakstukken voor strategische dominantie">
<meta name="twitter:image" content="https://tjoffringa.github.io/Klikschaak/social-preview-1200x630.png">
```

**Why these sizes?**
- **32x32**: Most important! Used in 99% of browser tabs
- **192x192**: Android "Add to Home Screen"
- **180x180**: iOS "Add to Home Screen"

**Skipped:**
- ~~16x16~~: Too small, legacy only (pre-2015 browsers)
- ~~512x512~~: Only needed for PWA (future feature)

### PWA Manifest (`manifest.json`)

**Not needed for MVP!** Add this later when implementing multiplayer PWA:

```json
{
  "name": "Klikschaak",
  "short_name": "Klikschaak",
  "description": "Combineer schaakstukken voor strategische dominantie",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#f0d9b5",
  "background_color": "#1e293b",
  "icons": [
    {
      "src": "favicon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

Note: Create `icon-512x512.png` when adding PWA support.

Link in HTML:
```html
<link rel="manifest" href="manifest.json">
```

## 🚀 GitHub Setup

### 1. Upload Files
```bash
git add favicon-*.png apple-touch-icon-*.png icon-*.png logo-*.png social-preview-*.png
git commit -m "Add brand assets with gradient border style"
git push origin main
```

### 2. Set GitHub Social Preview
1. Go to: https://github.com/TJOffringa/Klikschaak/settings
2. Scroll to "Social preview"
3. Click "Edit"
4. Upload: `social-preview-1200x630.png`
5. Save

Now your repository will look professional when shared!

### 3. Update klikschaak.html
Add the favicon links to the `<head>` section of your HTML file.

## 🧪 Testing

### Favicon
- Open site in browser, check tab icon
- Test in different browsers (Chrome, Firefox, Safari)
- Test on mobile devices

### Social Preview
Test how your link looks when shared:

**Facebook Debugger:**
https://developers.facebook.com/tools/debug/

**Twitter Card Validator:**
https://cards-dev.twitter.com/validator

**LinkedIn Inspector:**
https://www.linkedin.com/post-inspector/

Enter: `https://tjoffringa.github.io/Klikschaak/`

## 📱 Mobile Testing

### iOS
1. Open Safari
2. Navigate to your site
3. Tap Share → "Add to Home Screen"
4. Check icon appearance

### Android
1. Open Chrome
2. Navigate to your site  
3. Menu → "Add to Home screen"
4. Check icon appearance

## ✅ Checklist

- [ ] All PNG files generated
- [ ] Files uploaded to GitHub
- [ ] Favicon added to HTML `<head>`
- [ ] Open Graph tags added
- [ ] GitHub social preview uploaded
- [ ] Tested in multiple browsers
- [ ] Tested on mobile devices
- [ ] Shared link tested (Facebook/Twitter/Discord)

## 🎯 Future Assets

When needed for multiplayer:
- [ ] Loading animation
- [ ] Tutorial graphics  
- [ ] Achievement badges
- [ ] Rank icons

## 📝 Notes

- All assets use EXACT screenshot from game
- No modifications to piece size or position
- Only border/shadow effects added
- Maintains authentic game appearance
- Gradient border = Premium look

---

**Questions?** Open an issue on GitHub!
