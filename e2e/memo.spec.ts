import { test, expect } from '@playwright/test'

test('memo 扩展端到端：加载 + 视图 tab + 增删改', async ({ page }) => {
  await page.goto('/')

  // onboarding：默认 2000-01-01 / 80 岁，直接开始
  await page.getByRole('button', { name: '开始这一生' }).click()

  // SideNav 出现"备忘" tab（证明扩展已加载注册）
  const memoTab = page.getByRole('button', { name: '备忘' })
  await expect(memoTab).toBeVisible()

  // 进入备忘视图，动态加载 MemoView 组件
  await memoTab.click()
  await expect(page.getByText('还没有备忘')).toBeVisible()

  // 新建 + 编辑
  await page.getByRole('button', { name: '新建' }).click()
  await page.getByPlaceholder('记点什么…').fill('端到端测试备忘')
  await page.getByRole('button', { name: '完成' }).click()
  await expect(page.getByText('端到端测试备忘')).toBeVisible()

  // 删除（删除按钮 hover 才显示，force click）
  await page.getByRole('button', { name: '删除' }).click({ force: true })
  await expect(page.getByText('还没有备忘')).toBeVisible()
})
