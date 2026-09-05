// This spec is run out-of-band via `npm run test:e2e`, not by vitest.
import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { fileURLToPath } from 'url'

const here = fileURLToPath(new URL('.', import.meta.url))
// Isolated userData so the e2e never touches the real dash.db
// (main/index.ts honors DASH_USER_DATA); one dir per run so the
// second launch sees the first launch's data.
const userDataDir = mkdtempSync(join(tmpdir(), 'dash-e2e-'))

async function launchApp() {
  const app = await electron.launch({
    args: [join(here, '../out/main/index.js')],
    env: { ...process.env, DASH_USER_DATA: userDataDir }
  })
  const page = await app.firstWindow()
  return { app, page }
}

test('quick-add and persistence', async () => {
  // Launch app
  const { app, page } = await launchApp()
  
  // Wait for window to load
  await page.waitForLoadState('domcontentloaded')
  
  // Open quick-add
  await page.keyboard.press('q')
  await expect(page.locator('[data-testid="quick-add-input"]')).toBeVisible()
  
  // Type task
  await page.locator('[data-testid="quick-add-input"]').fill('Water plants tomorrow p2 @light')
  
  // Expect chips to be visible
  await expect(page.locator('[data-testid="qa-chip-date"]')).toBeVisible()
  await expect(page.locator('[data-testid="qa-chip-priority"]')).toBeVisible()
  await expect(page.locator('[data-testid="qa-chip-label"]')).toBeVisible()
  
  // Submit task
  await page.keyboard.press('Enter')
  
  // Expect task row to be visible
  await expect(page.locator('text=Water plants')).toBeVisible()
  
  // Close app
  await app.close()
  
  // Relaunch and verify persistence
  const { app: app2, page: page2 } = await launchApp()
  
  // Wait for window to load
  await page2.waitForLoadState('domcontentloaded')
  
  // Expect the task row to still be visible (persistence across restart)
  await expect(page2.locator('text=Water plants')).toBeVisible()
  
  // Complete the task by clicking the check button
  const taskRow = page2.locator('text=Water plants').first().locator('../../..')
  await taskRow.locator('button[aria-label="Complete task"]').click()
  
  // Expect the row to disappear
  await expect(page2.locator('text=Water plants')).not.toBeVisible()
  
  // Close app
  await app2.close()
})