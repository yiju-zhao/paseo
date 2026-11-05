import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "../support/fixtures";
import {
  expectContentColumnWidth,
  expectCustomContentWidthSetting,
  expectDefaultContentWidthSetting,
  openAppearanceSettings,
  resetContentWidth,
  setContentWidth,
} from "../support/helpers/content-width";
import { openFileExplorer, openFileFromExplorer } from "../support/helpers/file-explorer";
import { openAgentRoute, seedMockAgentWorkspace } from "../support/helpers/mock-agent";

const ULTRAWIDE_VIEWPORT = { width: 2560, height: 1080 };

test("Markdown file prose reflows to the chosen width while explicit breaks and code stay intact", async ({
  page,
  withWorkspace,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("@paseo:app-settings", JSON.stringify({ contentMaxWidth: 1600 }));
  });
  const workspace = await withWorkspace({ prefix: "markdown-prose-width-" });
  await writeFile(
    path.join(workspace.repoPath, "report.md"),
    [
      "---",
      "title: Company report",
      "source: https://example.com/reports/annual-report.pdf",
      "---",
      "",
      "# Company report",
      "",
      "公司的业务通过直营门店与线上渠道运营，",
      "这段正文在源文件里手动分行，",
      "预览时应该按阅读区域的宽度连续排版。",
      "",
      "Explicit first line  ",
      "Explicit second line\\",
      "Explicit third line",
      "",
      "```yaml",
      "revenue: 100",
      "margin: 20%",
      "```",
      "",
    ].join("\n"),
  );
  await page.setViewportSize(ULTRAWIDE_VIEWPORT);
  await workspace.navigateTo();
  await openFileExplorer(page);
  await openFileFromExplorer(page, "report.md");

  const preview = page.getByTestId("markdown-preview-frame");
  await expectContentColumnWidth(preview, { min: 1200, max: 1600 });
  const prose = preview.locator("p").filter({ hasText: "公司的业务" });
  await expect(prose).toBeVisible();
  await expect(prose.locator("br")).toHaveCount(0);
  await expect(
    preview.locator("p").filter({ hasText: "Explicit first line" }).locator("br"),
  ).toHaveCount(2);
  await expect(preview.locator('[data-paseo-markdown-tag="code"]')).toHaveText(
    "revenue: 100\nmargin: 20%",
    { useInnerText: false },
  );
  await page.screenshot({ path: testInfo.outputPath("markdown-wide-prose.png") });

  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(prose.locator("br")).toHaveCount(0);
  await expect
    .poll(() => preview.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
});

test("widens chat and Markdown files to the chosen content width and resets to the default", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const agent = await seedMockAgentWorkspace({
    repoPrefix: "content-width-",
    title: "Content width",
    initialPrompt: "Write a long paragraph.",
  });

  try {
    await agent.client.waitForFinish(agent.agentId, 30_000);
    await page.setViewportSize(ULTRAWIDE_VIEWPORT);
    const assistantMessage = page.getByTestId("assistant-message").first();
    const markdownPreview = page.getByTestId("markdown-preview-frame").first();

    await test.step("chat starts at the default width", async () => {
      await openAgentRoute(page, agent);
      await expectContentColumnWidth(assistantMessage, { max: 820 });
    });

    await test.step("settings show the default without a reset", async () => {
      await openAppearanceSettings(page);
      await expectDefaultContentWidthSetting(page, 820);
    });

    await test.step("a custom width is saved and offers a reset", async () => {
      await setContentWidth(page, 1600);
      await expectCustomContentWidthSetting(page, 1600);
      await page.screenshot({ path: testInfo.outputPath("settings-custom-width.png") });
    });

    await test.step("chat and Markdown files use the custom width", async () => {
      await openAgentRoute(page, agent);
      await expectContentColumnWidth(assistantMessage, { min: 1200, max: 1600 });
      await page.screenshot({ path: testInfo.outputPath("chat-custom-width.png") });

      await openFileExplorer(page);
      await openFileFromExplorer(page, "README.md");
      await expectContentColumnWidth(markdownPreview, { min: 1200, max: 1600 });
      await page.screenshot({ path: testInfo.outputPath("markdown-custom-width.png") });
    });

    await test.step("reset returns to the default without storing it", async () => {
      await openAppearanceSettings(page);
      await resetContentWidth(page);
      await expectDefaultContentWidthSetting(page, 820);

      await openAgentRoute(page, agent);
      await expectContentColumnWidth(assistantMessage, { max: 820 });
      await page.screenshot({ path: testInfo.outputPath("chat-default-width.png") });
    });
  } finally {
    await agent.cleanup();
  }
});
