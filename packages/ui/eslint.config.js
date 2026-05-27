import { config as reactInternalConfig } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config[]} */
const config = [
    ...reactInternalConfig,
    {
        rules: {
            "turbo/no-undeclared-env-vars": [
                "error",
                {
                    allowList: ["NODE_ENV"]
                }
            ]
        }
    }
];

export default config;
