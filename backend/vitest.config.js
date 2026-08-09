import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        env: {
            NODE_ENV: "test",
            JWT_AUTH_KEY: "test-auth-key",
            JWT_REFRESH_KEY: "test-refresh-key",
            JWT_ACCESS_EXPIRES_IN: "5m",
            JWT_REFRESH_EXPIRES_IN: "15m",
            ALLOWED_ORIGINS: "https://allowed.example.com,https://app.example.com",
            LOGIN_RATE_LIMIT: "1000",
            API_RATE_LIMIT: "1000",
        },
        globalSetup: ["tests/global-setup.js"],
        include: ["tests/**/*.test.js"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.js"],
            exclude: ["src/index.js"],
        },
    },
});
