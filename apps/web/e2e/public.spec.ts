import { test, expect } from "@playwright/test";
test("public app has five navigable workflows",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");
  await expect(page.getByRole("heading",{name:/Commerce meets commitment/i})).toBeVisible();
  await expect(page.getByRole("link",{name:"Creator Studio"})).toHaveAttribute("href","/studio");
  await page.goto("/studio",{waitUntil:"commit",timeout:60000});
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading",{name:/Launch your utility/i})).toBeVisible({timeout:30000});
  await expect(page.getByRole("heading",{name:"Create creator storefront"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Fund loyalty campaign"})).toBeVisible();
  await expect(page.getByRole("link",{name:"My Dashboard"})).toHaveAttribute("href","/me");
  await page.goto("/me",{waitUntil:"commit",timeout:60000});
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading",{name:"My Loydura"})).toBeVisible();
});
