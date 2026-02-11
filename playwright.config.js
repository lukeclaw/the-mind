const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 90_000,
    fullyParallel: false,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5173',
        trace: 'off',
        screenshot: 'off',
        video: 'off'
    },
    webServer: [
        {
            command: 'npm --prefix server start',
            url: 'http://127.0.0.1:3002/health',
            env: {
                PORT: '3002',
                CLIENT_URL: 'http://127.0.0.1:5173'
            },
            reuseExistingServer: true,
            timeout: 60_000
        },
        {
            command: 'npm --prefix client run dev -- --host 127.0.0.1 --port 5173',
            url: 'http://127.0.0.1:5173',
            env: {
                VITE_SERVER_URL: 'http://127.0.0.1:3002'
            },
            reuseExistingServer: true,
            timeout: 60_000
        }
    ]
});
