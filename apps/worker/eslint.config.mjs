import tsParser from "@typescript-eslint/parser";

export default [{
  files: ["src/**/*.ts", "tests/**/*.ts"],
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: "latest", sourceType: "module" }
  },
  rules: {
    "no-console": "off",
    "no-empty": ["error", { allowEmptyCatch: true }]
  }
}];
