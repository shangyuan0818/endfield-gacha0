let appFontsPromise = null

export function registerAppFonts() {
  if (!appFontsPromise) {
    appFontsPromise = import('./assets/fonts/app-fonts.css')
  }

  return appFontsPromise
}

registerAppFonts()
