# SVG Assets — UST Alumni Portal

Source files live in `docs/svgs/`. When components are built, these will be copied into `force-app/main/default/staticresources/` for use via `@salesforce/resourceUrl`.

---

## Brand Logos

| File | Description | Use Cases |
|------|-------------|-----------|
| `ust-logo.svg` | Full UST wordmark + shield (default) | Site header, email templates |
| `ust-logo-purple.svg` | Full UST wordmark — solid dark purple version | Header on white/light backgrounds |
| `ust-logo-purple-gold.svg` | Full UST wordmark — purple + gold two-color | Preferred on white; hero areas |
| `logo-shield.svg` | Academic shield only (no wordmark) | Favicon, compact spaces, icon-level usage |

> The solid purple (`#510c76` / Pantone 2607) logo version was added in the 2025 brand refresh.  
> Use stacked lockup formats where space allows (brand preference since 2025).

---

## Social Media Icons

| File | Platform | Notes |
|------|----------|-------|
| `facebook-icon.svg` | Facebook | |
| `instagram-icon.svg` | Instagram | |
| `linkedin-icon.svg` | LinkedIn | |
| `tiktok-icon.svg` | TikTok | |
| `x-icon.svg` | X (Twitter) | |
| `youtube-icon.svg` | YouTube | |

---

## UI / Utility Icons

| File | Description | Use Cases |
|------|-------------|-----------|
| `search.svg` | Search (simple) | Search input button |
| `search-icon.svg` | Search (outline variant) | Navigation search |
| `menu.svg` | Hamburger menu | Mobile nav toggle |
| `close.svg` | × close / dismiss | Modals, toasts, tags |
| `caret-down.svg` | Filled caret down | Dropdowns, accordions |
| `caret-down-outline.svg` | Outline caret down | Secondary dropdowns |
| `heart.svg` | Heart / favorite | Save/bookmark actions |
| `info.svg` | Info circle | Help tooltips, notices |
| `speech-bubble-icon.svg` | Speech bubble | Messages, comments, feedback |

---

## Usage in LWC

```html
<!-- Via static resource (recommended) -->
<img src={logoUrl} alt="University of St. Thomas" />
```

```javascript
import UST_LOGO from '@salesforce/resourceUrl/ustLogo';
// logoUrl = UST_LOGO  (in getter or connectedCallback)
```

Or inline as `<lightning-icon>` alternatives where SLDS icons don't match the brand need.

---

## Favicons

Source files live in `docs/fav-icons/`. These will be referenced in the Experience Cloud site head markup or uploaded via Experience Builder site settings.

| File | Size | Use |
|------|------|-----|
| `favicon-16x16.png` | 16×16 | Browser tab (standard) |
| `favicon-32x32.png` | 32×32 | Browser tab (hi-DPI / taskbar) |
| `apple-touch-icon.png` | 180×180 (standard) | iOS home screen / bookmark icon |

**Deployment:** In LWR Experience Cloud sites, favicons are set under **Experience Builder → Settings → Advanced → Favicon**. Upload `favicon-32x32.png` there. The `apple-touch-icon.png` may need to be added via a custom `<head>` markup injection or a static resource reference in the site's head template if Experience Builder doesn't expose it directly.

---

## What We May Still Need

Let the team know when any of these come up during widget builds:

- [x] Favicon / PWA icon set — ✅ `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`
- [ ] Tommie the Tomcat mascot asset (athletics widget)
- [ ] Giving / heart-with-dollar accent icon (Give widget)
- [ ] Volunteer hands icon (Engagement Summary)
- [ ] "Tommie Give Day" campaign badge/lockup
- [ ] College/school-specific sub-brand lockups (Law, Engineering, etc.)

