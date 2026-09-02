import { expect, test, type Page } from '@playwright/test'

/**
 * 核心闭环 e2e：Onboarding → 写日记 → 刷新仍在 → 深链。
 * 每个用例独立浏览器上下文，OPFS 存储互不影响。
 */

/** 完成 Onboarding（默认生日 2000-01-01、寿命 80），进入日历。 */
async function finishOnboarding(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '三万天' })).toBeVisible()
  await page.getByRole('button', { name: '开始这一生' }).click()
  await expect(page.locator('canvas')).toBeVisible()
}

test('首次访问进 Onboarding，提交后进入日历', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '三万天' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).toHaveValue('2000-01-01')

  await page.getByRole('button', { name: '开始这一生' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  // 日历视图不再显示 Onboarding 表单
  await expect(page.getByRole('heading', { name: '三万天' })).toBeHidden()
})

test('Onboarding 完成后刷新不再回到 Onboarding', async ({ page }) => {
  await finishOnboarding(page)

  await page.reload()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('input[type="date"]')).toBeHidden()
})

test('点格写日记，防抖保存后刷新内容仍在', async ({ page }) => {
  await finishOnboarding(page)

  // 点击画布中心命中某日格子，打开编辑器（深链带 ?d=<index>）
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\?d=\d+/)

  // 输入并等待防抖自动保存完成
  const text = 'e2e 闭环验证：这一天值得记住。'
  await dialog.locator('textarea').fill(text)
  await expect(dialog.getByText('已保存')).toBeVisible()

  // 刷新后通过同一深链重新打开，内容仍在
  const url = page.url()
  await page.reload()
  await page.goto(url)
  await expect(dialog.locator('textarea')).toHaveValue(text)
})

test('?d=<index> 深链直接打开编辑器，history 返回关闭', async ({ page }) => {
  await finishOnboarding(page)

  await page.goto('/?d=5')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('第 6 天')).toBeVisible()

  await page.goBack()
  await expect(dialog).toBeHidden()
  await expect(page).not.toHaveURL(/\?d=/)
})
