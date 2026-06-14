import {
  DEFAULT_FONT_PRESET,
  DEFAULT_THEME_PRESET,
  FONT_PRESETS,
  THEME_PRESETS,
} from "./themes";

import {
  DEFAULT_NAVBAR_LAYOUT,
  NAVBAR_LAYOUT_STORAGE_KEY,
} from "./uiPreferences";

const THEME_STORAGE_KEY = "playcrew-theme-preset";
const FONT_STORAGE_KEY = "playcrew-font-preset";

export const uiBootstrapScript = `
(() => {
  try {
    const themeKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const fontKey = ${JSON.stringify(FONT_STORAGE_KEY)};
    const navbarKey = ${JSON.stringify(NAVBAR_LAYOUT_STORAGE_KEY)};
    const defaultTheme = ${JSON.stringify(DEFAULT_THEME_PRESET)};
    const defaultFont = ${JSON.stringify(DEFAULT_FONT_PRESET)};
    const defaultNavbarLayout = ${JSON.stringify(DEFAULT_NAVBAR_LAYOUT)};
    const themePresets = ${JSON.stringify(THEME_PRESETS.map(({ id }) => id))};
    const fontPresets = ${JSON.stringify(
      FONT_PRESETS.map(
        ({
          id,
          fontFamily,
          buttonScale,
          buttonLetterSpacing,
          buttonLineHeight,
        }) => ({
          id,
          fontFamily,
          buttonScale,
          buttonLetterSpacing,
          buttonLineHeight,
        }),
      ),
    )};

    const storedTheme = window.localStorage.getItem(themeKey);
    const storedFont = window.localStorage.getItem(fontKey);
    const storedNavbarLayout = window.localStorage.getItem(navbarKey);

    const nextTheme = themePresets.includes(storedTheme ?? "")
      ? storedTheme
      : defaultTheme;

    const nextFont = fontPresets.some(
      (preset) => preset.id === storedFont,
    )
      ? storedFont
      : defaultFont;

    const nextNavbarLayout =
      storedNavbarLayout === "top" ||
      storedNavbarLayout === "sidebar"
        ? storedNavbarLayout
        : defaultNavbarLayout;

    const selectedFont =
      fontPresets.find((preset) => preset.id === nextFont) ??
      fontPresets[0];

    document.documentElement.dataset.appTheme = nextTheme;
    document.documentElement.dataset.appFont = nextFont;
    document.documentElement.dataset.navbarLayout =
      nextNavbarLayout;

    document.documentElement.style.setProperty(
      "--app-font",
      selectedFont.fontFamily,
    );

    document.documentElement.style.setProperty(
      "--app-button-font-scale",
      selectedFont.buttonScale,
    );

    document.documentElement.style.setProperty(
      "--app-button-letter-spacing",
      selectedFont.buttonLetterSpacing,
    );

    document.documentElement.style.setProperty(
      "--app-button-line-height",
      selectedFont.buttonLineHeight,
    );
  } catch {
    // noop
  }
})();
`;
