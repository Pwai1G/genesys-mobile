/*
  Genesys Cloud OAuth configuration

  1) Create an OAuth client in Genesys Cloud.
  2) Use Token Implicit Grant (browser / SPA).
  3) Add your exact GitHub Pages URL as an Authorized Redirect URI.
  4) Replace CLIENT_ID below.

  Example Redirect URI:
  https://YOUR_GITHUB_USERNAME.github.io/genesys-mobile/
*/
window.GENESYS_CONFIG = {
  CLIENT_ID: "tqFQFBnfCl3AJXmD-7hhz-Akh2V1lLbpD7LPXEbL9UlYMkVZ7FHoQquPCNOvWKZh2x6lFMa3eSU8XenBphSBvg",
  LOGIN_HOST: "https://login.mypurecloud.jp",
  API_HOST: "https://api.mypurecloud.jp",

  // Uses the current GitHub Pages folder automatically.
  REDIRECT_URI: window.location.origin + window.location.pathname.replace(/index\.html$/i, "")
};
