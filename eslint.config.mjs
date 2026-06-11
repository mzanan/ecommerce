import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import unusedImports from 'eslint-plugin-unused-imports';
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    ignores: ["node_modules/", ".next/", "dist/", "build/", "docs/"]
  },
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|a)$/] JSXAttribute[name.name='className'] Literal[value=/rounded-full/][value=/bg-white(?!\\S)/]",
          message:
            "Inline solid button/anchor styling: reuse <Pill variant=\"solid\"> (@/components/ui/Pill) instead of hand-written bg-white rounded-full classes.",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, 
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': pluginReactConfig, 
      'unused-imports': unusedImports,
      '@next/next': nextPlugin, 
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...pluginReactConfig.configs?.recommended?.rules, 
      ...nextPlugin.configs?.recommended?.rules, 
      ...nextPlugin.configs?.['core-web-vitals']?.rules, 

      "no-unused-vars": "off", 
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          "vars": "all",
          "varsIgnorePattern": "^_",
          "args": "after-used",
          "argsIgnorePattern": "^_",
        },
      ],

      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off", 
    },
    settings: {
        react: {
            version: "detect", 
        },
    },
  },
];
