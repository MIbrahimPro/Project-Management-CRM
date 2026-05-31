/**
 * Socket Integration Test
 * Verifies:
 * 1. Server auto-joins users to project:<id> rooms
 * 2. Events emitted to project:<id> reach all project members
 * 3. User-specific notifications work via user:<id> rooms
 * 4. Multiple project rooms per user work correctly
 */

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as SocketIOClient } from "socket.io-client";
import type { Socket as ClientSocket } from "socket.io-client";

const PORT = 9999;
const TEST_TIMEOUT = 10000;

let server: ReturnType<typeof createServer>;
let io: SocketIOServer;

let results = {
  passed: 0,
  failed: 0,
  tests: [] as string[],
};

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    results.passed++;
    results.tests.push(`✅ PASS: ${name}`);
    console.log(`✅ PASS: ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    results.failed++;
    results.tests.push(`❌ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    console.error(`❌ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function setupServer() {
  return new Promise<void>((resolve) => {
    server = createServer();
    io = new SocketIOServer(server, {
      cors: { origin: "*" },
      transports: ["websocket"],
    });

    // Simplified auth + auto-join mimicking our socket-server.ts
    io.use((socket, next) => {
      const userId = (socket.handshake.auth?.userId as string) || "unknown";
      const role = (socket.handshake.auth?.role as string) || "DEVELOPER";
      socket.data.userId = userId;
      socket.data.role = role;
      next();
    });

    io.on("connection", (socket) => {
      const userId = socket.data.userId as string;
      const role = socket.data.role as string;

      // Auto-join user room for notifications
      socket.join(`user:${userId}`);

      // Auto-join project rooms (simulating DB lookup)
      // Admins/managers get ALL projects; others only their own
      const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(role);
      const allProjects = ["proj-1", "proj-2", "proj-store", "proj-alpha", "proj-beta", "proj-mixed"];
      const userProjects = isManager
        ? allProjects
        : (socket.handshake.auth?.projects as string[]) || [];
      for (const pid of userProjects) {
        socket.join(`project:${pid}`);
      }
    });

    server.listen(PORT, () => {
      console.log(`[Test] Server listening on ${PORT}`);
      resolve();
    });
  });
}

function createClient(userId: string, role: string, projects: string[]): ClientSocket {
  return SocketIOClient(`http://localhost:${PORT}`, {
    transports: ["websocket"],
    auth: { userId, role, projects },
  });
}

async function waitForEvent(client: ClientSocket, event: string, timeout = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    client.once(event, (data: unknown) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runTests() {
  console.log("\n========================================");
  console.log("  Socket Integration Test Suite");
  console.log("========================================\n");

  await setupServer();

  // ─── TEST 1: Auto-join project rooms ───
  console.log("\n--- Test 1: Auto-join project rooms ---");
  {
    const clientA = createClient("user-a", "DEVELOPER", ["proj-1"]);
    await waitForEvent(clientA, "connect");
    await wait(100);

    // Emit to project:proj-1 — clientA should receive it
    let received = false;
    clientA.on("ping_test", () => { received = true; });
    io.to("project:proj-1").emit("ping_test", {});
    await wait(200);

    assert("User auto-joined project room", received, "client should receive event from project:proj-1");

    clientA.disconnect();
  }

  // ─── TEST 2: Events only reach project members ───
  console.log("\n--- Test 2: Scoped broadcast ---");
  {
    const clientA = createClient("user-a", "DEVELOPER", ["proj-1"]);
    const clientB = createClient("user-b", "DEVELOPER", ["proj-2"]);
    await waitForEvent(clientA, "connect");
    await waitForEvent(clientB, "connect");
    await wait(100);

    let aReceived = false;
    let bReceived = false;
    clientA.on("scoped_event", () => { aReceived = true; });
    clientB.on("scoped_event", () => { bReceived = true; });

    io.to("project:proj-1").emit("scoped_event", {});
    await wait(200);

    assert("Member A receives project event", aReceived);
    assert("Non-member B does NOT receive project event", !bReceived, "clientB not in proj-1");

    clientA.disconnect();
    clientB.disconnect();
  }

  // ─── TEST 3: Multiple projects per user ───
  console.log("\n--- Test 3: User in multiple projects ---");
  {
    const client = createClient("user-multi", "ADMIN", ["proj-alpha", "proj-beta"]);
    await waitForEvent(client, "connect");
    await wait(100);

    let alphaCount = 0;
    let betaCount = 0;
    client.on("alpha_event", () => alphaCount++);
    client.on("beta_event", () => betaCount++);

    io.to("project:proj-alpha").emit("alpha_event", {});
    io.to("project:proj-beta").emit("beta_event", {});
    await wait(200);

    assert("User receives events from project alpha", alphaCount === 1);
    assert("User receives events from project beta", betaCount === 1);

    client.disconnect();
  }

  // ─── TEST 3b: Admin receives events even without explicit membership ───
  console.log("\n--- Test 3b: Admin auto-join all projects ---");
  {
    const admin = createClient("admin-1", "ADMIN", []); // empty project list
    await waitForEvent(admin, "connect");
    await wait(100);

    let received = false;
    admin.on("admin_test_event", () => { received = true; });

    io.to("project:proj-1").emit("admin_test_event", {});
    await wait(200);

    assert("Admin receives event from project they are not member of", received, "admin should be auto-joined to all projects");

    admin.disconnect();
  }

  // ─── TEST 4: Direct user notification room ───
  console.log("\n--- Test 4: User-specific notifications ---");
  {
    const client = createClient("user-notify", "CLIENT", ["proj-1"]);
    await waitForEvent(client, "connect");
    await wait(100);

    let notifReceived = false;
    client.on("new_notification", () => { notifReceived = true; });

    io.to("user:user-notify").emit("new_notification", { title: "Hello" });
    await wait(200);

    assert("User receives direct notification", notifReceived);

    // Another user should NOT receive it
    const otherClient = createClient("user-other", "CLIENT", ["proj-1"]);
    await waitForEvent(otherClient, "connect");
    await wait(100);

    let otherReceived = false;
    otherClient.on("new_notification", () => { otherReceived = true; });

    io.to("user:user-notify").emit("new_notification", { title: "Again" });
    await wait(200);

    assert("Other user does NOT receive targeted notification", !otherReceived);

    client.disconnect();
    otherClient.disconnect();
  }

  // ─── TEST 5: Asset event broadcast to all project members ───
  console.log("\n--- Test 5: Asset event broadcast ---");
  {
    const manager = createClient("mgr-1", "ADMIN", ["proj-store"]);
    const dev = createClient("dev-1", "DEVELOPER", ["proj-store"]);
    const client = createClient("cli-1", "CLIENT", ["proj-store"]);

    await Promise.all([
      waitForEvent(manager, "connect"),
      waitForEvent(dev, "connect"),
      waitForEvent(client, "connect"),
    ]);
    await wait(100);

    const receivedBy: string[] = [];
    manager.on("asset_created", () => receivedBy.push("manager"));
    dev.on("asset_created", () => receivedBy.push("dev"));
    client.on("asset_created", () => receivedBy.push("client"));

    io.to("project:proj-store").emit("asset_created", {
      asset: { id: "asset-1", name: "test.pdf" },
    });
    await wait(200);

    assert("All 3 members receive asset_created", receivedBy.length === 3,
      `received by: ${receivedBy.join(", ") || "none"}`);
    assert("Manager receives asset_created", receivedBy.includes("manager"));
    assert("Developer receives asset_created", receivedBy.includes("dev"));
    assert("Client receives asset_created", receivedBy.includes("client"));

    manager.disconnect();
    dev.disconnect();
    client.disconnect();
  }

  // ─── TEST 6: Vault + Question events in same project room ───
  console.log("\n--- Test 6: Multiple event types, one room ---");
  {
    const user = createClient("u1", "DEVELOPER", ["proj-mixed"]);
    await waitForEvent(user, "connect");
    await wait(100);

    const events: string[] = [];
    user.on("vault_secret_saved", () => events.push("vault_secret_saved"));
    user.on("vault_secret_deleted", () => events.push("vault_secret_deleted"));
    user.on("question_added", () => events.push("question_added"));
    user.on("asset_updated", () => events.push("asset_updated"));

    io.to("project:proj-mixed").emit("vault_secret_saved", { id: "s1" });
    io.to("project:proj-mixed").emit("question_added", { id: "q1" });
    io.to("project:proj-mixed").emit("asset_updated", { id: "a1" });
    await wait(200);

    assert("All 3 event types received on single room", events.length === 3,
      `received: ${events.join(", ") || "none"}`);

    user.disconnect();
  }

  // ─── Cleanup ───
  console.log("\n--- Cleanup ---");
  io.close();
  server.close();

  // ─── Summary ───
  console.log("\n========================================");
  console.log(`  Results: ${results.passed} passed, ${results.failed} failed`);
  console.log("========================================\n");

  if (results.failed > 0) {
    console.log("Failed tests:");
    results.tests.filter((t) => t.startsWith("❌")).forEach((t) => console.log("  " + t));
    process.exit(1);
  } else {
    console.log("All socket integration tests passed! ✅");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
