import { expect, type APIRequestContext } from "@playwright/test";
import type { Account } from "../../shared/accounts";

// The Playwright server uses an isolated in-memory database and this explicit test-only bootstrap.
export const TEST_OWNER = { username: "TestOwner", password: "browser fixture password only" };
export async function loginTestOwner(request: APIRequestContext): Promise<Account> {
  let response = await request.post("/api/account/login", { data: TEST_OWNER });
  if (response.status() === 401) response = await request.post("/api/account/register", { data: {
    ...TEST_OWNER, invitation: "browser-test-admin-invite-only-for-ephemeral-test-server"
  } });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).account;
}
