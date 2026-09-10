import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const API_BASE = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("public/screenshots");

async function getAdminTokens() {
  const res = await fetch(`${API_BASE}/api/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "admin12345" }),
  });
  const data = await res.json();
  if (!data.data?.accessToken) {
    throw new Error("Failed to log in as admin: " + JSON.stringify(data));
  }
  return data.data;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("1. Authenticating as Admin...");
  const tokens = await getAdminTokens();
  console.log("   Authenticated successfully.");

  console.log("2. Launching headless Chrome...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1540,980",
    ],
    defaultViewport: {
      width: 1540,
      height: 980,
      deviceScaleFactor: 2,
    },
  });

  const page = await browser.newPage();

  // Inject token & dark mode
  await page.goto(`${API_BASE}/admin`, { waitUntil: "networkidle2" });
  await page.evaluate((t) => {
    localStorage.setItem("adminAccessToken", t.accessToken);
    localStorage.setItem("adminRefreshToken", t.refreshToken);
    localStorage.setItem("adminTheme", "dark");
    document.documentElement.classList.add("dark");
  }, tokens);

  // 1. System Telemetry
  console.log("3. Capturing 01-system-telemetry.png...");
  await page.goto(`${API_BASE}/admin/system`, { waitUntil: "networkidle2" });
  await sleep(1800);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "01-system-telemetry.png"),
  });

  // 2. Real-time Stream
  console.log("4. Capturing 02-realtime-stream.png...");
  await page.goto(`${API_BASE}/admin/stream`, { waitUntil: "networkidle2" });
  await sleep(1800);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "02-realtime-stream.png"),
  });

  // 3. HTTP Requests Table
  console.log("5. Capturing 03-http-request-logs.png...");
  await page.goto(`${API_BASE}/admin/db-requests`, { waitUntil: "networkidle2" });
  await sleep(2000);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "03-http-request-logs.png"),
  });

  // 4. Confidential Field Decryption Modal
  console.log("6. Filtering for login request with encrypted credentials...");
  await page.evaluate(() => {
    const input = document.querySelector("input[placeholder*='Search']");
    if (input) {
      input.value = "login";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const form = document.querySelector("form");
    if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await sleep(1500);

  // Click Inspect on the login request
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    for (const row of rows) {
      if (row.innerText.includes("login") || row.innerText.includes("POST")) {
        const btn = row.querySelector("button");
        if (btn) {
          btn.click();
          return;
        }
      }
    }
    // Fallback to first inspect button
    const firstBtn = document.querySelector("tbody tr button");
    if (firstBtn) firstBtn.click();
  });
  await sleep(1200);

  // Inside the inspect modal, click "Decrypt Confidential Fields (Master Key)"
  console.log("   Opening Authorize & Decrypt reason modal...");
  const openedDecrypt = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const authBtn = buttons.find((b) => b.innerText.includes("Decrypt Confidential") || b.innerText.includes("Master Key"));
    if (authBtn) {
      authBtn.click();
      return true;
    }
    return false;
  });

  if (openedDecrypt) {
    await sleep(800);
    // Fill in justification reason
    await page.evaluate(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) {
        textarea.value = "Auditing authentication credentials and verifying token entropy for SOC2 compliance.";
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await sleep(600);

    // Capture the Authorization Modal screenshot showing field badges & justification input
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "04-confidential-field-decryption.png"),
    });
    console.log("   Saved 04-confidential-field-decryption.png");

    // Click the final "Authorize & Decrypt" submit button to execute decryption and generate audit entry
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const submitBtn = buttons.find(
        (b) => b.innerText.includes("Authorize & Decrypt") && !b.disabled
      );
      if (submitBtn) submitBtn.click();
    });
    await sleep(2000);

    // Close any open modals
    await page.keyboard.press("Escape");
    await sleep(400);
    await page.keyboard.press("Escape");
    await sleep(500);
  } else {
    console.log("   (Authorize button not found in inspect modal)");
    await page.keyboard.press("Escape");
  }

  // 5. Decryption Audit Trail Modal
  console.log("7. Capturing 05-decryption-audit-trail.png...");
  await page.goto(`${API_BASE}/admin/db-requests`, { waitUntil: "networkidle2" });
  await sleep(1500);
  const openedAudits = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const auditBtn = buttons.find((b) => b.innerText.includes("Decryption Audits"));
    if (auditBtn) {
      auditBtn.click();
      return true;
    }
    return false;
  });

  if (openedAudits) {
    await sleep(2000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "05-decryption-audit-trail.png"),
    });
    console.log("   Saved 05-decryption-audit-trail.png");
    await page.keyboard.press("Escape");
    await sleep(400);
  }

  // 6. User Management & Sessions Modal
  console.log("8. Capturing 06-user-management-sessions.png...");
  await page.goto(`${API_BASE}/admin/users`, { waitUntil: "networkidle2" });
  await sleep(2000);
  const openedSessions = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const sessionsBtn = buttons.find(
      (b) => b.innerText.includes("Sessions") || b.innerText.includes("active")
    );
    if (sessionsBtn) {
      sessionsBtn.click();
      return true;
    }
    return false;
  });

  if (openedSessions) {
    await sleep(1500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "06-user-management-sessions.png"),
    });
    console.log("   Saved 06-user-management-sessions.png");
  }

  // 7. Time Machine / Versioning
  console.log("9. Capturing 07-versioning-time-machine.png...");
  await page.goto(`${API_BASE}/admin/versions`, { waitUntil: "networkidle2" });
  await sleep(2000);
  const openedRevisions = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const revBtn = buttons.find((b) => b.innerText.includes("Revisions"));
    if (revBtn) {
      revBtn.click();
      return true;
    }
    return false;
  });

  if (openedRevisions) {
    await sleep(1500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "07-versioning-time-machine.png"),
    });
    console.log("   Saved 07-versioning-time-machine.png");
  }

  // 8. Database Audit Trail
  console.log("10. Capturing 08-database-audit-logs.png...");
  await page.goto(`${API_BASE}/admin/db-audits`, { waitUntil: "networkidle2" });
  await sleep(2000);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "08-database-audit-logs.png"),
  });
  console.log("   Saved 08-database-audit-logs.png");

  await browser.close();
  console.log("\n All screenshots captured successfully in " + OUTPUT_DIR);
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
