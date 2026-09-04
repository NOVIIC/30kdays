import { expect, test, type Page } from '@playwright/test'

/**
 * 备忘扩展 e2e：新建 → 防抖自动保存 → 刷新仍在；二次确认删除。
 * 每个用例独立浏览器上下文，OPFS 存储互不影响。
 */

/** 完成 Onboarding 并进入备忘视图。 */
async function enterMemoView(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '开始这一生' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: '备忘', exact: true }).click()
  await expect(page.getByRole('button', { name: '新建备忘' })).toBeVisible()
}

test('新建备忘输入后自动保存，刷新后仍在', async ({ page }) => {
  await enterMemoView(page)

  await page.getByRole('button', { name: '新建备忘' }).click()
  const editor = page.getByPlaceholder('写点什么……')
  await expect(editor).toBeFocused()
  await editor.fill('e2e 备忘：记得带伞。')

  // 等防抖自动保存落盘后刷新，内容仍在
  await page.waitForTimeout(1200)
  await page.reload()
  await page.getByRole('button', { name: '备忘', exact: true }).click()
  await expect(page.getByPlaceholder('写点什么……')).toHaveValue('e2e 备忘：记得带伞。')
})

test('删除需二次确认，删除后刷新不再出现', async ({ page }) => {
  await enterMemoView(page)

  await page.getByRole('button', { name: '新建备忘' }).click()
  const editor = page.getByPlaceholder('写点什么……')
  await editor.fill('待删除的备忘')
  await page.waitForTimeout(1200)

  // 先失焦（点标题），再点删除：第一次进入确认态，第二次真删
  await page.getByRole('heading', { name: '备忘', exact: true }).click()
  const deleteButton = page.getByRole('button', { name: '删除' })
  await deleteButton.click()
  await expect(page.getByRole('button', { name: '确认删除？' })).toBeVisible()
  await page.getByRole('button', { name: '确认删除？' }).click()
  await expect(page.getByPlaceholder('写点什么……')).toHaveCount(0)

  await page.reload()
  await page.getByRole('button', { name: '备忘', exact: true }).click()
  await expect(page.getByText('还没有备忘')).toBeVisible()
})
