import { expect, test } from "./fixtures";

// The server's daily check is stood in for: the site's answer is given a
// newer release, as one that found it would.
test("a newer Kite is told once, and stays on the deploy page", async ({ page }) => {
  await page.route("**/api/v1/site", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.kite = {
      ...json.kite,
      running: "0.1.12",
      latest: "9.9.9",
      latest_url: "https://github.com/kite-plus/kite/releases/tag/v9.9.9",
    };
    await route.fulfill({ response, json });
  });

  await page.goto("/admin/deploy");
  const notifications = page.getByRole("region", { name: /^Notifications/ });
  await expect(notifications.getByText("Kite 9.9.9 is out")).toBeVisible();
  await expect(notifications.getByText("This is 0.1.12")).toBeVisible();

  await page.reload();
  const row = page.getByRole("button", { name: "Kite 9.9.9 is out" });
  await expect(row).toBeVisible();
  await expect(notifications.getByText("Kite 9.9.9 is out")).toBeHidden();

  await row.click();
  await expect(page.getByText(/^This is 0\.1\.12\. Download the new release/)).toBeVisible();
  await expect(page.getByRole("link", { name: "What's new" })).toHaveAttribute("href", /\/v9\.9\.9$/);
});
