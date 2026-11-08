import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests/e2e",workers:1,timeout:60000,use:{baseURL:process.env.TEST_BASE_URL??"http://localhost:3001",channel:"chrome",headless:true,screenshot:"only-on-failure"},reporter:"list"});
