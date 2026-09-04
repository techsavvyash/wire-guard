import { expect, test } from "@playwright/test"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const appFilePath = path.resolve("examples/react-vite/src/App.tsx")
let baselineSource = ""

test.beforeAll(async () => {
  baselineSource = await readFile(appFilePath, "utf8")
})

test.afterEach(async () => {
  await writeFile(appFilePath, baselineSource)
})

async function enableEditing(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Edit" }).click()
}

async function deleteSelected(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Delete selected component" }).click()
}

test("deletes an ordinary React JSX child through Vite", async ({ page }) => {
  await enableEditing(page)

  const card = page.getByText("Plain deletable component")
  await expect(card).toHaveAttribute("data-wg-file", "src/App.tsx")
  await card.click()
  await deleteSelected(page)

  await expect(card).toBeHidden()
  await expect.poll(() => readFile(appFilePath, "utf8")).not.toContain(
    "Plain deletable component"
  )
})

test("deletes a logical conditional without leaving broken JSX", async ({
  page
}) => {
  await enableEditing(page)

  const card = page.getByText("Conditional component")
  await card.click()
  await deleteSelected(page)

  await expect(card).toBeHidden()
  await expect.poll(() => readFile(appFilePath, "utf8")).not.toContain(
    "showBanner &&"
  )
})

test("deletes a filtered map render as one shared template", async ({ page }) => {
  await enableEditing(page)

  const card = page.getByText("Visible mapped card")
  await card.click()
  await deleteSelected(page)

  await expect(card).toBeHidden()
  await expect.poll(() => readFile(appFilePath, "utf8")).not.toContain(".map(")
  await expect.poll(() => readFile(appFilePath, "utf8")).not.toContain(
    ".filter("
  )
})
