import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...nextJsConfig,
    {
        rules: {
            "turbo/no-undeclared-env-vars": [
                "error",
                {
                    allowList: ["NODE_ENV", "WEB_URL", "PW_SKIP_WEBSERVER", "E2E_EMAIL", "E2E_PASSWORD"]
                }
            ]
        }
    }
];
