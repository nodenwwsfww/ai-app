module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier" // Uses eslint-config-prettier to disable ESLint rules that conflict with Prettier
  ],
  settings: {
    react: {
      version: "detect" // Automatically detect the React version
    }
  },
  env: {
    browser: true, // Add browser globals like 'window' and 'document'
    webextensions: true, // Add webextension globals like 'chrome'
    es2021: true, // Allows modern ECMAScript features
    node: true // Allows Node.js global variables and Node.js scoping (for config file itself)
  },
  rules: {
    // Customize rules here if needed
    "react/react-in-jsx-scope": "off", // Not needed with React 17+ JSX transform
    "react/prop-types": "off", // We use TypeScript for prop types
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] // Warn about unused vars, except those starting with _
    // Add any other specific rules you want
  },
  ignorePatterns: [
    ".plasmo/",
    "build/",
    "node_modules/",
    "dist/",
    ".eslintrc.cjs" // Ignore this config file itself
  ]
}
