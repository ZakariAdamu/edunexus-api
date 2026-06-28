// commitlint.config.ts
import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],

  rules: {
    // Type must be one of these
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation changes
        "style", // Code style / formatting
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Adding or updating tests
        "build", // Build system changes
        "ci", // CI/CD changes
        "chore", // Maintenance / other
        "revert", // Revert previous commit
      ],
    ],

    // Subject (commit message) should not be empty
    "subject-empty": [2, "never"],

    // Header (first line) max length
    "header-max-length": [2, "always", 100],

    // Body and footer should have a leading blank line
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"],

    // Scope should be in kebab-case (optional)
    "scope-case": [2, "always", "kebab-case"],
  },

  // Optional: Help with better commit messages
  helpUrl:
    "https://github.com/conventional-changelog/commitlint/#what-is-commitlint",
};

export default config;
