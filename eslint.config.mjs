// Lightweight ESLint flat config.
// Next build skips linting for this legacy app (see next.config.ts), but keeping
// this dependency-free config prevents editor/CI crashes if ESLint is run.

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
      "examples/**",
      "skills/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
];

export default eslintConfig;
