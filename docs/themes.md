# TrueSpend Multi-Theme & Architectural Design System

This document outlines the **12 curated themes** (6 Light + 6 Dark) and the **Architectural Style Engine** implemented in TrueSpend.

---

## 🎨 System Overview

TrueSpend's design architecture gives users full control over their visual workspace. Rather than a basic binary light/dark toggle, the app supports **12 deeply crafted aesthetic presets** spanning historical financial ledgers, quiet-luxury private wealth studios, high-contrast trading terminals, and modern neo-grotesque dashboards.

Each theme defines:
- **Color Palettes**: Hand-tuned 6-point swatches (Canvas, Surface, Border, Text, Primary Accent, Secondary Accent) + full Tailwind neutral & chromatic scale overrides.
- **Typography Pairings**: Tailored combinations of *Plus Jakarta Sans*, *Fraunces*, *Lora Serif*, *IBM Plex Mono*, *JetBrains Mono*, and *Outfit*.
- **Border Radii**: Scaled from razor-sharp architectural edges (`2px–4px`) to balanced cards (`8px–12px`) and soft pill finishes (`14px–16px`).
- **Surface Textures**: Custom SVG grids, archival ruled ledger lines, and ambient glow backdrops.

In addition, users can independently override **Corner Radius**, **Typography Engine**, and **Surface Texture** on top of any theme.

---

## ☀️ Light Themes (6 Presets)

### 1. Swiss Alabaster (`light`)
- **Tagline**: *Clean Daylight Ledger*
- **Aesthetic**: Modern Neo-Grotesque / Swiss International Style
- **Typography**: Plus Jakarta Sans (UI & Display), JetBrains Mono (Data)
- **Default Radius**: Balanced (`12px`)
- **Description**: Crisp alabaster daylight canvas with subtle slate hairline borders and royal indigo accents. Engineered for high daylight contrast and effortless financial clarity.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#f8fafc` | Main application background (Slate-50) |
| **Surface** | `#ffffff` | Cards, modals, sidebars, sheets |
| **Border** | `#e2e8f0` | Hairline dividers, card outlines (Slate-200) |
| **Text** | `#0f172a` | Primary numbers, headers, and body (Slate-900) |
| **Primary Accent** | `#4f46e5` | Interactive buttons, active tabs, charts (Indigo-600) |
| **Secondary Accent** | `#0d9488` | Positive balances, inflows, savings badges (Teal-600) |

---

### 2. Vintage Ledger (`vintage`)
- **Tagline**: *1920s Archival Paper & Sepia Ink*
- **Aesthetic**: Archival Broadsheet & Hand-Bound Financial Book
- **Typography**: Lora Serif (Body), Fraunces (Headings & Display), IBM Plex Mono (Tabular)
- **Default Radius**: Architectural Sharp (`4px`)
- **Visual Texture**: Subtle ruled ledger lines (`repeating-linear-gradient` with 28px horizontal line spacing)
- **Description**: Warm cotton ledger parchment, deep fountain-pen sepia ink, aged brass and copper-rust accents, ruled ledger guidelines, and classic serif editorial typography.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#f3ebd9` | Warm archival cotton parchment |
| **Surface** | `#fbf7ee` | Cream paper ledger sheets |
| **Border** | `#d5c5a7` | Weathered brass & parchment borders |
| **Text** | `#2b2015` | Deep fountain-pen sepia ink |
| **Primary Accent** | `#9a4422` | Terracotta wax seal & copper-rust |
| **Secondary Accent** | `#2f5d46` | Old bank vault forest green |

---

### 3. Travertine & Espresso (`espresso`)
- **Tagline**: *Quiet Luxury Private Wealth*
- **Aesthetic**: High-End Architectural Stone & Bespoke Tailoring
- **Typography**: Plus Jakarta Sans (Body), Fraunces (Headings), IBM Plex Mono (Tabular)
- **Default Radius**: Tailored (`10px`)
- **Description**: Warm limestone and honed travertine surfaces paired with deep roasted espresso typography and burnished bronze-taupe accents. Inspired by private wealth advisory salons.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#f4f0ea` | Honed limestone / travertine background |
| **Surface** | `#fcfaf7` | Warm chalk and pale alabaster cards |
| **Border** | `#e2d9cc` | Soft sand & warm stone hairline borders |
| **Text** | `#1f1a17` | Deep dark roast espresso |
| **Primary Accent** | `#7c5333` | Burnished bronze & saddle leather |
| **Secondary Accent** | `#3d6352` | Muted alpine sage & olive |

---

### 4. Sahara & Terracotta (`sahara-dune`)
- **Tagline**: *Moroccan Saffron & Desert Clay*
- **Aesthetic**: Warm Maghrebian Architecture & Marrakech Terracotta
- **Typography**: Fraunces (Headings), Plus Jakarta Sans (Body), IBM Plex Mono (Numbers)
- **Default Radius**: Balanced (`10px`)
- **Description**: Warm terracotta clay and desert dune canvas inspired by Moroccan heritage, paired with rich saffron ochre, warm ceramic tiles, and oasis palm green.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#faf4eb` | Warm desert sand |
| **Surface** | `#fffdf9` | Sun-bleached chalk card background |
| **Border** | `#e6d7c3` | Sun-baked adobe clay borders |
| **Text** | `#2b221a` | Dark cedarwood charcoal |
| **Primary Accent** | `#c85a2b` | Moroccan terracotta & saffron |
| **Secondary Accent** | `#2a6349` | Oasis palm green |

---

### 5. Kyoto Bamboo & Matcha (`kyoto-zen`)
- **Tagline**: *Washi Paper & Ceremonial Matcha*
- **Aesthetic**: Zen Botanical & Japanese Minimalist Craft
- **Typography**: Plus Jakarta Sans (UI), Lora Serif (Editorial), IBM Plex Mono (Data)
- **Default Radius**: Soft (`14px`)
- **Description**: Calming Japanese washi paper canvas with pale hinoki surfaces, deep sumi-e ink typography, ceremonial matcha green accents, and warm bamboo ochre highlights.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#f5f7f2` | Herbal washi paper |
| **Surface** | `#fcfffa` | Pale hinoki cypress cards |
| **Border** | `#d2ded0` | Bamboo reed & dried sage borders |
| **Text** | `#1c241e` | Deep Japanese sumi-e charcoal ink |
| **Primary Accent** | `#2d6a4f` | Ceremonial Uji matcha green |
| **Secondary Accent** | `#b47834` | Warm bamboo ochre |

---

### 6. Rose Gold & Champagne (`rose-atelier`)
- **Tagline**: *Cashmere Ivory & Rose Gold*
- **Aesthetic**: Parisian Haute Joaillerie & High Boutique Finance
- **Typography**: Fraunces (Display), Lora (Serif Details), Plus Jakarta (UI)
- **Default Radius**: Soft (`16px`)
- **Description**: Soft cashmere ivory canvas paired with polished porcelain surfaces, warm antique rose gold accents, and deep charcoal-plum typography.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#faf5f2` | Soft cashmere ivory |
| **Surface** | `#fffcfb` | Polished porcelain cards |
| **Border** | `#ebd8d0` | Antique rose hairline borders |
| **Text** | `#2b1d22` | Deep charcoal plum ink |
| **Primary Accent** | `#b35d6b` | Burnished rose gold |
| **Secondary Accent** | `#4a6b5d` | Antique bronze patina green |

---

## 🌙 Dark Themes (6 Presets)

### 7. Midnight Obsidian (`dark`)
- **Tagline**: *Deep Carbon Studio*
- **Aesthetic**: Modern Carbon Dark Mode
- **Typography**: Plus Jakarta Sans (UI), JetBrains Mono (Data)
- **Default Radius**: Balanced (`12px`)
- **Description**: Low-glare obsidian slate surfaces with luminous indigo and mint emerald highlights. Engineered for long evening sessions and multi-monitor setups.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#030712` | Pure pitch obsidian slate (Gray-950) |
| **Surface** | `#111827` | Deep carbon cards (Gray-900) |
| **Border** | `#1f2937` | Subtle dark graphite borders (Gray-800) |
| **Text** | `#f9fafb` | Crisp high-legibility silver (Gray-50) |
| **Primary Accent** | `#6366f1` | Luminous electric indigo (Indigo-500) |
| **Secondary Accent** | `#10b981` | Vibrant emerald mint (Emerald-500) |

---

### 8. Nordic Private Bank (`emerald-night`)
- **Tagline**: *Botanical Pine & Bullion Gold*
- **Aesthetic**: Institutional Swiss/Nordic Wealth Vault
- **Typography**: Outfit (Headers), JetBrains Mono (Monospace Data)
- **Default Radius**: Balanced (`12px`)
- **Description**: Deep pine-charcoal surfaces inspired by private wealth vaults, accented with emerald jade, bullion gold metrics, and dark forest undertones.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#06110e` | Deep Nordic spruce & night charcoal |
| **Surface** | `#0c1d18` | Dark emerald vault cards |
| **Border** | `#19352c` | Oxidized copper & pine borders |
| **Text** | `#ecfdf5` | Crisp mint-tinged silver |
| **Primary Accent** | `#10b981` | Brilliant Nordic emerald |
| **Secondary Accent** | `#d4af37` | Bullion gold & brass metrics |

---

### 9. Amber Desk Terminal (`terminal`)
- **Tagline**: *Institutional Quant Console*
- **Aesthetic**: Retro Bloomberg Terminal / Monospace Financial Workstation
- **Typography**: IBM Plex Mono (Everywhere)
- **Default Radius**: Sharp (`2px`)
- **Visual Texture**: CRT subtle matrix grid background
- **Description**: High-contrast matte carbon workspace with phosphor amber-gold accents, razor-sharp borders, and monospace precision designed for pure data density.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#08090c` | Matte carbon console |
| **Surface** | `#101217` | High-density terminal cards |
| **Border** | `#242936` | Strict technical steel borders |
| **Text** | `#f5f3ef` | High-contrast phosphor silver |
| **Primary Accent** | `#f59e0b` | Cathode-ray phosphor amber |
| **Secondary Accent** | `#22d3ee` | Cyan command prompt highlight |

---

### 10. Neo-Tokyo Cyber (`tokyo-night`)
- **Tagline**: *Midnight Neon & Cyan Matrix*
- **Aesthetic**: Cyberpunk High-Tech / Shinjuku Nightfall
- **Typography**: Outfit (Headings), JetBrains Mono (Data)
- **Default Radius**: Sharp (`4px`)
- **Description**: Deep midnight navy-black canvas with hyper-clean titanium surfaces, luminous electric cyan, and neon magenta accents.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#0b0e17` | Midnight Tokyo asphalt |
| **Surface** | `#121826` | Dark titanium matrix cards |
| **Border** | `#1f293d` | Deep cobalt slate borders |
| **Text** | `#f1f5f9` | Luminous white-silver |
| **Primary Accent** | `#06b6d4` | Electric cyan laser |
| **Secondary Accent** | `#d946ef` | Neon Shinjuku magenta |

---

### 11. Blue Chip Wall Street (`wall-street`)
- **Tagline**: *Deep Harbor Navy & Gold*
- **Aesthetic**: New York Institutional Trading Floor
- **Typography**: Plus Jakarta Sans (UI), IBM Plex Mono (Financial Tables)
- **Default Radius**: Balanced (`8px`)
- **Description**: Classic institutional trading desk navy with crisp harbor steel surfaces, authoritative cobalt blue accents, and bullion gold metrics.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#08101e` | Deep Manhattan harbor navy |
| **Surface** | `#0f1c30` | Dark blue chip institutional cards |
| **Border** | `#1c3252` | Harbor slate & steel borders |
| **Text** | `#f0f6fc` | Clean ice-white |
| **Primary Accent** | `#2563eb` | Authoritative Wall Street cobalt |
| **Secondary Accent** | `#f59e0b` | Treasury bullion gold |

---

### 12. Mariana Oceanic Abyss (`deep-abyss`)
- **Tagline**: *Bioluminescent Mariana Trench*
- **Aesthetic**: Subsea Benthic Research & Bioluminescent Depth
- **Typography**: JetBrains Mono (Data), Outfit (Headers)
- **Default Radius**: Sharp (`4px`)
- **Description**: Subsea abyss deep black-navy canvas, high-pressure submarine steel surfaces, and bioluminescent aquamarine and teal phosphor highlights.

#### Color Palette
| Token | Hex | Role |
| :--- | :--- | :--- |
| **Canvas** | `#030a10` | Benthic trench pitch black-navy |
| **Surface** | `#081622` | Submarine hull steel cards |
| **Border** | `#0f2b40` | Deep ocean trench borders |
| **Text** | `#ecfeff` | Bioluminescent white-cyan |
| **Primary Accent** | `#14b8a6` | Luminescent sea teal |
| **Secondary Accent** | `#38bdf8` | Deep ocean azure sky |

---

## 📊 Master Color Palette Matrix

| Preset ID | Theme Name | Mode | Canvas | Surface | Border | Text | Accent | Sec. Accent |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `light` | **Swiss Alabaster** | Light | `#f8fafc` | `#ffffff` | `#e2e8f0` | `#0f172a` | `#4f46e5` | `#0d9488` |
| `vintage` | **Vintage Ledger** | Light | `#f3ebd9` | `#fbf7ee` | `#d5c5a7` | `#2b2015` | `#9a4422` | `#2f5d46` |
| `espresso` | **Travertine & Espresso** | Light | `#f4f0ea` | `#fcfaf7` | `#e2d9cc` | `#1f1a17` | `#7c5333` | `#3d6352` |
| `sahara-dune` | **Sahara & Terracotta** | Light | `#faf4eb` | `#fffdf9` | `#e6d7c3` | `#2b221a` | `#c85a2b` | `#2a6349` |
| `kyoto-zen` | **Kyoto Bamboo & Matcha**| Light | `#f5f7f2` | `#fcfffa` | `#d2ded0` | `#1c241e` | `#2d6a4f` | `#b47834` |
| `rose-atelier` | **Rose Gold & Champagne**| Light | `#faf5f2` | `#fffcfb` | `#ebd8d0` | `#2b1d22` | `#b35d6b` | `#4a6b5d` |
| `dark` | **Midnight Obsidian** | Dark | `#030712` | `#111827` | `#1f2937` | `#f9fafb` | `#6366f1` | `#10b981` |
| `emerald-night`| **Nordic Private Bank** | Dark | `#06110e` | `#0c1d18` | `#19352c` | `#ecfdf5` | `#10b981` | `#d4af37` |
| `terminal` | **Amber Desk Terminal** | Dark | `#08090c` | `#101217` | `#242936` | `#f5f3ef` | `#f59e0b` | `#22d3ee` |
| `tokyo-night` | **Neo-Tokyo Cyber** | Dark | `#0b0e17` | `#121826` | `#1f293d` | `#f1f5f9` | `#06b6d4` | `#d946ef` |
| `wall-street` | **Blue Chip Wall Street**| Dark | `#08101e` | `#0f1c30` | `#1c3252` | `#f0f6fc` | `#2563eb` | `#f59e0b` |
| `deep-abyss` | **Mariana Oceanic Abyss** | Dark | `#030a10` | `#081622` | `#0f2b40` | `#ecfeff` | `#14b8a6` | `#38bdf8` |

---

## 📐 Architectural Style Overrides

In addition to picking a theme preset, users can customize three independent architectural axes in **Settings ➔ Appearance / Themes**:

### 1. Corner Radius Overrides
- **Theme Default**: Uses the era-appropriate radius assigned to the preset.
- **Sharp (`sharp`)**: Strict 2px–4px rectangular corners for high-density financial consoles.
- **Balanced (`balanced`)**: Versatile 8px–12px curves for modern dashboards.
- **Soft (`soft`)**: Expressive 16px–20px gentle radii for relaxed reading.

### 2. Typography Engine Overrides
- **Theme Default**: Uses the preset's native font pairing.
- **Clean Sans (`sans`)**: Plus Jakarta Sans for UI, headers, and body.
- **Archival Editorial (`editorial`)**: Fraunces display serif headers paired with Lora body text.
- **Quant Technical (`technical`)**: IBM Plex Mono & JetBrains Mono for full tabular and terminal discipline.

### 3. Surface & Elevation Overrides
- **Theme Default**: Uses the preset's native elevation and shadow styling.
- **Flat & Minimalist (`flat`)**: Zero shadows, crisp hairline borders, pure flat planes.
- **Elevated Glass (`elevated`)**: Multi-layered drop shadows, subtle backdrop blur, and elevated card floating.
- **Textured Grain (`textured`)**: Subtle archival grain, linen texture, or quant dot grid background.

---

## 💻 Technical Architecture

### Context & State Management
- Managed by `src/context/ThemeContext.tsx` via `ThemeProvider`.
- Synchronized to browser storage under:
  - `truespend_theme`: Selected Theme ID (`'light' | 'vintage' | ... | 'system'`).
  - `truespend_radius_style`: Corner style override.
  - `truespend_font_style`: Font override.
  - `truespend_surface_style`: Surface override.

### DOM Attributes
The active theme is applied to `document.documentElement` (`<html>` element) using attributes:
- `data-theme="vintage"` (or any of the 12 theme IDs)
- `class="dark"` (when a dark theme is active or when system dark mode is detected)
- `data-radius="sharp | balanced | soft"`
- `data-font="sans | editorial | technical"`
- `data-surface="flat | elevated | textured"`

### Styling Layer
- Implemented in `src/index.css` via Tailwind CSS v4 variables:
  - Overrides standard Tailwind color tokens (`--color-white`, `--color-gray-*`, `--color-indigo-*`, `--color-emerald-*`, etc.) per theme selector.
  - Overrides standard radius tokens (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`).
  - Sets custom canvas patterns (`--ts-canvas-pattern`) and card drop shadows (`--ts-card-shadow`).

---

## 🤖 Theme-Matched Spex 3D Avatars (`SpexAvatar.tsx`)

TrueSpend automatically adapts the **Spex AI character avatar** (`760×760` transparent RGBA PNGs in `src/assets/`) to match the active theme palette across the Navigation Bar, AI Chat, Predictive Forecast, and Theme Studio preview cards:

| Transparent PNG Asset | Edition Name | Visual Styling | Matched Themes |
| :--- | :--- | :--- | :--- |
| `src/assets/spex-light.png` | **Swiss Alabaster Spex** | Clean alabaster armor, royal indigo (`#4f46e5`) & teal (`#0d9488`) accents, mint visor glow | `light` *(Swiss Alabaster)*, `rose-atelier` *(Rose Gold & Champagne)* |
| `src/assets/spex-vintage.png` | **1920s Clockwork Ledger Spex** | Archival parchment armor, serif `SPEX` engraving, brass clockwork chest dial, terracotta & forest green trim | `vintage` *(Vintage Ledger)*, `espresso` *(Travertine & Espresso)*, `sahara-dune` *(Sahara & Terracotta)* |
| `src/assets/spex-kyoto.png` | **Kyoto Matcha & Hinoki Spex** | Washi paper armor, ceremonial matcha green (`#2d6a4f`) wings/shoulders, warm hinoki wood grain trim | `kyoto-zen` *(Kyoto Bamboo & Matcha)* |
| `src/assets/spex-dark.png` | **Midnight Carbon Obsidian Spex** | Carbon-fiber obsidian armor, electric indigo (`#6366f1`) & mint emerald (`#10b981`) luminous rings | `dark` *(Midnight Obsidian)*, `emerald-night` *(Nordic Private Bank)*, `deep-abyss` *(Mariana Oceanic Abyss)* |
| `src/assets/spex-terminal.png` | **Amber Quant Radar Spex** | Matte carbon armor, phosphor amber (`#f59e0b`) radar chest console & HUD visor, cyan (`#22d3ee`) telemetry | `terminal` *(Amber Desk Terminal)*, `wall-street` *(Blue Chip Wall Street)* |
| `src/assets/spex-tokyo.png` | **Neo-Tokyo Cyber Neon Spex** | Midnight navy-black armor, neon magenta (`#d946ef`) holographic visor & wings, electric cyan (`#06b6d4`) circuit traces | `tokyo-night` *(Neo-Tokyo Cyber)* |

