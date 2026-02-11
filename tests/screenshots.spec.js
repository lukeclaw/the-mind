const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const shotDir = path.join(process.cwd(), 'artifacts', 'screenshots', 'latest');

function resetShotDir() {
    fs.rmSync(shotDir, { recursive: true, force: true });
    fs.mkdirSync(shotDir, { recursive: true });
}

async function saveShot(page, name) {
    await page.screenshot({
        path: path.join(shotDir, `${name}.png`),
        fullPage: true
    });
}

async function joinRoomAsPlayer(browser, roomCode, playerName) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await page.goto(`/?join=${roomCode}`);
    await expect(page.getByText('Join Game')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('Required to join...').fill(playerName);
    await page.getByRole('button', { name: 'Join Room' }).click();
    await expect(page.getByText('Game Lobby')).toBeVisible({ timeout: 15_000 });
    return { context, page };
}

async function openBetDrawer(page) {
    const openPanel = page.locator('.blackjack-bet-dock.open .blackjack-bet-panel');
    if (await openPanel.isVisible().catch(() => false)) {
        return;
    }

    const betToggle = page.locator('.blackjack-bet-toggle').first();
    await expect(betToggle).toBeVisible({ timeout: 15_000 });
    await betToggle.click();
    await expect(openPanel).toBeVisible({ timeout: 15_000 });
}

async function placeBet(page, amount) {
    await openBetDrawer(page);
    const panel = page.locator('.blackjack-bet-dock.open .blackjack-bet-panel');
    await panel.locator('input[type="number"]').fill(String(amount));
    await panel.getByRole('button', { name: 'Confirm' }).click();
}

test.describe('UI screenshot pipeline', () => {
    test.beforeAll(() => {
        resetShotDir();
    });

    test('captures lobby and blackjack multiplayer card flow', async ({ page, browser }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByText('The Mind')).toBeVisible();
        await saveShot(page, '01-lobby-desktop');

        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await expect(page.getByText('The Mind')).toBeVisible();
        await saveShot(page, '02-lobby-mobile');

        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await page.getByPlaceholder('Enter your name...').fill('Snapshot Bot');

        const createNewGame = page.getByRole('button', { name: 'Create New Game' });
        await expect(createNewGame).toBeEnabled({ timeout: 15_000 });
        await createNewGame.click();

        await page.getByRole('button', { name: 'Blackjack' }).click();
        await page.getByRole('button', { name: 'Create Room' }).click();

        await expect(page.getByText('Game Lobby')).toBeVisible({ timeout: 15_000 });
        await saveShot(page, '03-waiting-room-blackjack-host');

        const roomCode = (await page.locator('.room-code').innerText()).trim();
        const playerTwo = await joinRoomAsPlayer(browser, roomCode, 'Snapshot Ally');
        const playerThree = await joinRoomAsPlayer(browser, roomCode, 'Snapshot Third');

        await expect(page.getByText('Players (3/4)')).toBeVisible({ timeout: 15_000 });
        await saveShot(page, '04-waiting-room-blackjack-3players');

        const startGameButton = page.getByRole('button', { name: /Start Game/i });
        await expect(startGameButton).toBeEnabled({ timeout: 15_000 });
        await startGameButton.click();

        await expect(page.locator('.blackjack-bet-toggle')).toBeVisible({ timeout: 15_000 });
        await expect(playerTwo.page.locator('.blackjack-bet-toggle')).toBeVisible({ timeout: 15_000 });
        await expect(playerThree.page.locator('.blackjack-bet-toggle')).toBeVisible({ timeout: 15_000 });
        await saveShot(page, '05-blackjack-table-pre-bet-host');

        await openBetDrawer(page);
        await saveShot(page, '06-blackjack-bet-drawer-host-open');

        await placeBet(page, 100);
        await placeBet(playerTwo.page, 50);
        await placeBet(playerThree.page, 25);

        await expect(page.locator('.local-lane .playing-card')).toHaveCount(2, { timeout: 15_000 });
        await expect(page.locator('.opponents-zone .playing-card')).toHaveCount(4, { timeout: 15_000 });
        await saveShot(page, '07-blackjack-multiplayer-cards-host');

        await saveShot(playerTwo.page, '08-blackjack-multiplayer-cards-player2');

        await page.setViewportSize({ width: 390, height: 844 });
        await saveShot(page, '09-blackjack-mobile-host');

        await playerTwo.context.close();
        await playerThree.context.close();
    });

    test('captures blackjack round-over result card state', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await page.getByPlaceholder('Enter your name...').fill('Result Bot');

        const createNewGame = page.getByRole('button', { name: 'Create New Game' });
        await expect(createNewGame).toBeEnabled({ timeout: 15_000 });
        await createNewGame.click();

        await page.getByRole('button', { name: 'Blackjack' }).click();
        await page.getByRole('button', { name: 'Create Room' }).click();

        await expect(page.getByText('Game Lobby')).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: /Start Game/i }).click();

        await expect(page.locator('.blackjack-bet-toggle')).toBeVisible({ timeout: 15_000 });
        await placeBet(page, 100);

        const resultCard = page.locator('.blackjack-result-card');
        const standButton = page.getByRole('button', { name: 'STAND' });

        // If the hand did not auto-resolve from naturals, force progression with stand.
        if (!await resultCard.isVisible().catch(() => false)) {
            await expect(standButton).toBeEnabled({ timeout: 15_000 });
            await standButton.click();
        }

        await expect(resultCard).toBeVisible({ timeout: 25_000 });
        await saveShot(page, '10-blackjack-round-over-result-card');
    });
});
