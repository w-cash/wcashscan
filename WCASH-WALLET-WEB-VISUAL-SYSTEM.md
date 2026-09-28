# Wcash Wallet web visual system

This note records the design evidence used for the Wcash Wallet website. It keeps future website work aligned with the wallet applications.

## Source authority

- Desktop: `/Users/rustdev/Documents/Codex/2026-09-12/weh/work/Wcash/wallet-desktop-mainnet`
- Mobile for Android and iOS: `/Users/rustdev/Documents/Codex/2026-09-12/weh/work/Wcash/wallet-mobile-mainnet`
- Desktop branch and revision: `wcash/mainnet-wallet` at `07b188cc3b43d2dde8f18cb08359e42932950072`
- Mobile branch and revision: `wcash/mainnet-mobile` at `969701cfbf37f2196a2c9b790e9ad440b6009378`

The Android and iOS apps use one React Native interface. Native Kotlin and Swift files provide platform bindings and launch surfaces. The shared React Native theme controls the visible wallet interface.

## Typography

The desktop wallet bundles Roboto through `typeface-roboto`. Its global CSS uses Roboto first, followed by Arial and Helvetica. The React Native wallet sets no custom family for regular interface text. Android therefore uses its system Roboto. iOS uses its system San Francisco face. Monospace appears only for addresses and technical identifiers.

The website self-hosts the same Roboto web files as the desktop wallet. The fallback stack uses the platform system face for iOS and other environments where the web font cannot load.

The wallet source uses these practical text levels:

| Role | Wallet evidence | Website rule |
| --- | --- | --- |
| Regular interface text | 15px at weight 400 on mobile | 16px at weight 400 for public web reading |
| Labels and compact controls | 14px is common on mobile and desktop | 14px minimum for repeated controls |
| Buttons | 16px at weight 600 on mobile | 16px at weight 700, with a 48px minimum height |
| Strong text | 16px bold on mobile | 16px at weight 700 |
| Metadata | 12px in the desktop wallet | 12px minimum |
| Wallet display values | 32px and larger | Roboto at weight 400 |

The marketing headings retain their existing positions and responsive scale. They use Roboto at weight 500. Green emphasis uses weight 700. This removes the thin editorial type that had no counterpart in the wallet.

## Semantic colors

The mobile theme defines the primary semantic values. The desktop wallet confirms the same dark and green direction.

| Role | Value | Source |
| --- | --- | --- |
| Canvas | `#060B12` | Mobile `bgCanvas` |
| Surface | `#05101E` | Mobile `bgSurface` |
| Chrome | `#040C17` | Mobile `bgChrome`; desktop background dark |
| Desktop panel | `#06172D` | Desktop background |
| Default text | `#C0CBDC` | Mobile `fgDefault` |
| Muted text | `#7C8494` | Mobile `fgMuted`; desktop legacy neutral |
| Primary accent | `#43A637` | Mobile and desktop primary |
| Disabled accent | `#23692F` | Mobile and desktop disabled primary |
| Border | `#05234C` | Mobile bottom-sheet border |
| Logo field | `#7CFF6B` | Wcash mark SVG and mobile icon |
| Logo ink | `#08210D` | Wcash mark SVG and mobile icon |

The bright logo lime belongs to the logo. The interface uses `#43A637` for controls, selected states, and emphasized text.

## Contrast rules

- `#C0CBDC` on the dark wallet backgrounds ranges from 10.97:1 to 12.04:1.
- `#7C8494` on the dark wallet backgrounds ranges from 4.78:1 to 5.25:1.
- `#43A637` on the dark wallet backgrounds ranges from 5.78:1 to 6.34:1.
- `#08210D` on the primary green is 5.47:1.
- `#08210D` on the logo lime is 13.27:1.

Primary green buttons use dark text. Muted text appears only on dark backgrounds. The disabled green is reserved for disabled decoration and controls, not body text.

## Form and surface geometry

- The desktop wallet uses 4px button radii and compact rectangular controls.
- The mobile wallet uses 24px button radii, 48px minimum button height, and a 40px sheet radius.
- The website demo represents the desktop wallet, so its controls use the desktop 4px radius and the mobile 48px touch height.
- Cards and framing keep the existing website dimensions and positions. Their borders use the wallet theme rather than the earlier cobalt palette.

## Website composition

The approved public flow is the launch and interactive wallet demo, the four-part green principles bar, and then the five-platform download section. The manifesto, Wcash network story, FAQ, closing, and footer follow. The principles bar uses four plain labels without decorative star separators.

The closing uses the exact wallet mark inside a restrained circular security motif. It contains “Zingo’s wallet foundation. Your Wcash. Your keys.” near the bottom of the page and must not return to an oversized `w.cash` wordmark.

Typography, colors, borders, geometry, control positions inside the interactive demo, and demo interactions remain aligned with the wallet sources documented above.
