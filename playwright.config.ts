import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/browser",timeout:60000,fullyParallel:false,workers:1,
  use:{baseURL:"http://127.0.0.1:4177",headless:true,launchOptions:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"],...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})},trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[{name:"phone",use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},{name:"desktop",use:{viewport:{width:1280,height:900}},
    // Inselparty, Roll It Up! und alle Minispiele sind nur für Smartphones vorgesehen (keine PC-Tests).
    testIgnore:[/party[^/]*\.spec\.ts$/,/roll-it-up\.spec\.ts$/,/island-rules\.spec\.ts$/,/minigame-modes\.spec\.ts$/,/match-games\.spec\.ts$/]}],
  webServer:{command:"npm start",url:"http://127.0.0.1:4177/api/health",env:{PORT:"4177",GSG_DATABASE_FILE:":memory:",TURSO_DATABASE_URL:"",TURSO_AUTH_TOKEN:"",RENDER:"true",GSG_ADMIN_INVITE:"browser-test-admin-invite-only-for-ephemeral-test-server"},reuseExistingServer:false,timeout:30000}
});
