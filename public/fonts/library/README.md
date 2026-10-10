# Font library

129 font families for video typography, from the Google Fonts collection via
Fontsource (npm `@fontsource-variable/*`, `@fontsource/*`). Each folder holds
the woff2 files (variable `wght` where available, else weights 400 and 700;
Latin subset, plus Bengali for the `bangla` fonts) and the family's licence.
All are OFL-1.1 or Apache-2.0 (see `catalog.json` and each `LICENSE.txt`).

`catalog.json`: family, slug, category (sans, display, serif, mono, script,
bangla), variable, license, files, weights.

The mono fonts have no ৳ glyph: pair them with a Bangla font for Taka.
