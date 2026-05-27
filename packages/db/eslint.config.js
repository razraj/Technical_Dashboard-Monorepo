import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
const config = [
    ...baseConfig,
    {
        ignores: ["src/generated/**"]
    },
    {
        rules: {
            "turbo/no-undeclared-env-vars": ["error", { allowList: ["NODE_ENV"] }]
        }
    }
];

export default config;
