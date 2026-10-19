// Jest stand-in for the CSS-only module c/ustSharedStyles.
// LWC compiles `@import 'c/ustSharedStyles'` into a JS import of a stylesheet list; in the platform that
// list is built from ustSharedStyles.css, but Jest has no CSS-only module resolver. An empty list is a
// valid value, so components render exactly as before. Never deployed (lives outside force-app).
export default [];
