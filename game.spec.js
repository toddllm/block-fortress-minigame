const { test, expect } = require('@playwright/test');

test('game loads and menu is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#ui')).toContainText('Block Fortress');
});

test('game starts on click and loop runs', async ({ page }) => {
  await page.goto('/');
  // Click to start
  await page.click('canvas#game');
  // Wait a moment for the loop to run
  await page.waitForTimeout(500);
  // Verify game state
  const state = await page.evaluate(() => ({
    state, wave, aliveN, frameN,
    enemyArrayExists: Array.isArray(enemies),
    baseBlockCount: baseBlocks.length,
  }));
  expect(state.state).toBe('playing');
  expect(state.wave).toBe(1);
  expect(state.aliveN).toBe(81);
  expect(state.frameN).toBeGreaterThan(0);
  expect(state.baseBlockCount).toBe(81);
});

test('enemies spawn after wave timer', async ({ page }) => {
  await page.goto('/');
  await page.click('canvas#game');
  // Fast-forward the game
  const result = await page.evaluate(() => {
    for (let i = 0; i < 600; i++) update();
    return { wave, waveELeft, enemyCount: enemies.length, frameN, score };
  });
  expect(result.frameN).toBeGreaterThan(0);
  expect(result.enemyCount).toBeGreaterThan(0);
});

test('no JS errors on page load and game start', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await page.click('canvas#game');
  await page.waitForTimeout(1000);
  // Also force some game frames
  await page.evaluate(() => { for (let i = 0; i < 300; i++) { update(); draw(); } });
  expect(errors).toEqual([]);
});

test('planet progression returns valid planet for all waves', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const results = [];
    for (let w = 0; w <= 20; w++) {
      const p = getPlanetForWave(w);
      results.push({ wave: w, name: p.name, hasBg: !!p.bg, hasPlanet: !!p.planet });
    }
    return results;
  });
  for (const r of result) {
    expect(r.hasBg).toBe(true);
    expect(r.hasPlanet).toBe(true);
    expect(r.name).toBeTruthy();
  }
});

test('Simon attack system has 187+ attack definitions', async ({ page }) => {
  await page.goto('/');
  const count = await page.evaluate(() => {
    return typeof SIMON_TOTAL_ATTACKS !== 'undefined' ? SIMON_TOTAL_ATTACKS : 0;
  });
  expect(count).toBeGreaterThanOrEqual(187);
});

test('base blocks regen between waves', async ({ page }) => {
  await page.goto('/');
  await page.click('canvas#game');
  const result = await page.evaluate(() => {
    startGame();
    // Destroy some blocks
    for (let i = 0; i < 10; i++) destroyBlk(baseBlocks[i]);
    const before = baseBlocks.filter(b => b.alive).length;
    // Force next wave
    wave = 1; enemies = []; waveELeft = 0; waveTimer = 0;
    for (let i = 0; i < 5; i++) update();
    const after = baseBlocks.filter(b => b.alive).length;
    return { before, after };
  });
  expect(result.before).toBe(71);
  expect(result.after).toBe(81);
});

test('Mercy Button skips to Simon wave', async ({ page }) => {
  await page.goto('/');
  await page.click('canvas#game');
  const result = await page.evaluate(() => {
    startGame();
    // Verify we're on wave 1
    const waveBefore = wave;
    // Press Mercy Button
    useMercyButton();
    return { waveBefore, waveAfter: wave, mercyUsed, enemyCount: enemies.length, aliveN };
  });
  expect(result.waveBefore).toBe(1);
  expect(result.waveAfter).toBe(70); // jumps straight to Simon wave
  expect(result.mercyUsed).toBe(false); // reset so wave advancement works
  expect(result.enemyCount).toBe(0); // all enemies cleared
  expect(result.aliveN).toBe(81); // base fully restored
});
