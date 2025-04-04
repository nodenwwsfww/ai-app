module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier", // Uses eslint-config-prettier to disable ESLint rules that conflict with Prettier
  ],
  env: {
    es2021: true, // Allows modern ECMAScript features
    node: true, // Allows Node.js global variables and Node.js scoping
  },
  rules: {
    // Customize rules here if needed
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // Warn about unused vars, except those starting with _
    // Add any other specific rules you want
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    ".eslintrc.cjs", // Ignore this config file itself
  ],
};
