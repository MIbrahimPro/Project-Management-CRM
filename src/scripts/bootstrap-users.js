/**
 * bootstrap-users.js
 *
 * Usage:
 *   node src/scripts/bootstrap-users.js            # upsert SUPER_ADMIN + ADMIN
 *   node src/scripts/bootstrap-users.js --reset    # delete ALL users first, then upsert SUPER_ADMIN + ADMIN
 *   node src/scripts/bootstrap-users.js --all      # upsert SUPER_ADMIN + ADMIN + one user per remaining role
 *   node src/scripts/bootstrap-users.js --reset --all  # both combined
 *
 * The --all flag writes a test-accounts.json in the project root with all credentials.
 * REMOVE this script and test-accounts.json before going to production.
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const doReset = args.includes("--reset");
const doAll = args.includes("--all");

// ── Privileged accounts (read from .env or fall back to defaults) ──────────

function normalizeEmail(v) { return v.trim().toLowerCase(); }
function requirePassword(v, label) {
  if (v.length < 8) throw new Error(`${label} must be at least 8 characters.`);
  return v;
}

function getPrivilegedAccounts() {
  return [
    {
      email: normalizeEmail(process.env.SUPER_ADMIN_EMAIL || "superadmin@devrolin.local"),
      password: requirePassword(process.env.SUPER_ADMIN_PASSWORD || "ChangeMe!123", "SUPER_ADMIN_PASSWORD"),
      name: (process.env.SUPER_ADMIN_NAME || "Super Admin").trim(),
      role: UserRole.SUPER_ADMIN,
    },
    {
      email: normalizeEmail(process.env.ADMIN_EMAIL || "admin@devrolin.local"),
      password: requirePassword(process.env.ADMIN_PASSWORD || "ChangeMe!123", "ADMIN_PASSWORD"),
      name: (process.env.ADMIN_NAME || "Admin").trim(),
      role: UserRole.ADMIN,
    },
  ];
}

// ── Hardcoded test accounts (one per remaining role) ─────────────────────

const TEST_ACCOUNTS = [
  { role: UserRole.PROJECT_MANAGER, name: "Patricia Manager",    email: "pm@devrolin.local",          password: "TestPass!1", statedRole: "Project Manager", workMode: "REMOTE" },
  { role: UserRole.DEVELOPER,       name: "Dave Developer",      email: "dev@devrolin.local",          password: "TestPass!1", statedRole: "Senior Developer",workMode: "HYBRID" },
  { role: UserRole.DESIGNER,        name: "Diana Designer",      email: "designer@devrolin.local",     password: "TestPass!1", statedRole: "UI/UX Designer",  workMode: "REMOTE" },
  { role: UserRole.HR,              name: "Hannah HR",           email: "hr@devrolin.local",           password: "TestPass!1", statedRole: "HR Manager",      workMode: "ONSITE" },
  { role: UserRole.ACCOUNTANT,      name: "Alan Accountant",     email: "accountant@devrolin.local",   password: "TestPass!1", statedRole: "Senior Accountant",workMode:"ONSITE" },
  { role: UserRole.SALES,           name: "Sam Sales",           email: "sales@devrolin.local",        password: "TestPass!1", statedRole: "Sales Executive",  workMode: "REMOTE" },
  { role: UserRole.CLIENT,          name: "Carl Client",         email: "client@devrolin.local",       password: "TestPass!1", statedRole: null,              workMode: "REMOTE" },
];

// ── Helpers ───────────────────────────────────────────────────────────────

async function upsertUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, role: input.role, isActive: true, passwordHash },
    create: {
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: true,
      passwordHash,
      ...(input.statedRole ? { statedRole: input.statedRole } : {}),
      ...(input.workMode   ? { workMode: input.workMode }       : {}),
    },
  });
}

async function ensureNotifPreference(email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (doReset) {
    console.log("⚠️  --reset: deleting all users and related data...");
    // Delete in dependency order
    await prisma.session.deleteMany({});
    await prisma.notificationPreference.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    console.log("  ✓ All users deleted.\n");
  }

  const privileged = getPrivilegedAccounts();
  console.log("Bootstrapping privileged accounts...");
  for (const u of privileged) {
    await upsertUser(u);
    await ensureNotifPreference(u.email);
    console.log(`  ✓ ${u.role}: ${u.email}  (password: ${u.password})`);
  }

  if (doAll) {
    console.log("\nCreating test accounts for all roles...");
    for (const u of TEST_ACCOUNTS) {
      await upsertUser(u);
      await ensureNotifPreference(u.email);
      console.log(`  ✓ ${u.role}: ${u.email}  (password: ${u.password})`);
    }

    const allAccounts = [
      ...privileged.map(u => ({ role: u.role, email: u.email, password: u.password, name: u.name })),
      ...TEST_ACCOUNTS.map(u => ({ role: u.role, email: u.email, password: u.password, name: u.name })),
    ];

    const outPath = path.join(__dirname, "../../test-accounts.json");
    fs.writeFileSync(outPath, JSON.stringify(allAccounts, null, 2));
    console.log(`\n📄 Credentials saved to: test-accounts.json`);
    console.log("   DELETE this file before deploying to production!\n");
  }

  console.log("\nBootstrap complete.");
  if (!doAll) {
    console.log("If you used defaults, change these passwords immediately.");
  }
}

main()
  .catch((error) => {
    console.error("[bootstrap-users] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
