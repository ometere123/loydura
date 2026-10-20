import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [".next/**", "out/**", "node_modules/**"],
  },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {jsx: true},
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
