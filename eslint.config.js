// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	// Ignore folders
	{
		ignores: [
			"dist",
			"node_modules",
			"coverage",
			"scripts/**",
			"openapi/**",
			"*.config.js",
			"*.config.ts",
		],
	},

	// Base recommended configs
	js.configs.recommended,
	...tseslint.configs.recommended,

	{
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},

		rules: {
			// TypeScript specific rules
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/no-floating-promises": "warn",
			"@typescript-eslint/consistent-type-imports": "error",

			// General rules
			"no-console": ["warn", { allow: ["log", "warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
			eqeqeq: "error",
		},
	},
);
