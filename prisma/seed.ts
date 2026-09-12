import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import resourcesData from "../data/resources.json";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@avanse-sec.demo";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-me";

  await prisma.agentUser.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      displayName: "SEC Admin",
      role: "ADMIN",
    },
    update: {},
  });

  await prisma.agentUser.upsert({
    where: { email: "counsellor@avanse-sec.demo" },
    create: {
      email: "counsellor@avanse-sec.demo",
      passwordHash: await bcrypt.hash("change-me", 10),
      displayName: "Demo Counsellor",
      role: "COUNSELLOR_AGENT",
    },
    update: {},
  });

  const ambassador = await prisma.ambassador.upsert({
    where: { id: "demo-ambassador-1" },
    create: { id: "demo-ambassador-1", name: "Riya Sharma", collegeName: "VIT Vellore", phone: "+919800000001" },
    update: {},
  });

  const demoAssets = [
    { code: "p04c2", channel: "poster", collegeName: "VIT Vellore", spotLabel: "Canteen board 2", journeyHint: null },
    { code: "p07k9", channel: "poster", collegeName: "SRM Chennai", spotLabel: "Library entrance", journeyHint: null },
    { code: "a2m5q", channel: "ambassador", collegeName: "VIT Vellore", spotLabel: null, journeyHint: null, ambassadorId: ambassador.id },
    { code: "e9x3r", channel: "event", collegeName: "Chandigarh University", spotLabel: "Career fair booth", journeyHint: "DOMESTIC" as const },
  ];

  for (const asset of demoAssets) {
    await prisma.asset.upsert({ where: { code: asset.code }, create: asset, update: {} });
  }

  const templates = [
    { name: "welcome_nurture_v1", category: "MARKETING" as const, bodyText: "Still exploring options? I'm here whenever you're ready to continue.", metaApprovalState: "approved" },
    { name: "document_reminder_v1", category: "UTILITY" as const, bodyText: "Reminder: please upload your pending documents to continue your application.", metaApprovalState: "approved" },
    { name: "sanction_update_v1", category: "UTILITY" as const, bodyText: "Update: your application status has changed. Open the app for details.", metaApprovalState: "approved" },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.upsert({ where: { name: t.name }, create: t, update: {} });
  }

  for (const item of resourcesData.items) {
    const existing = await prisma.resourceItem.findFirst({ where: { title: item.title } });
    if (!existing) {
      await prisma.resourceItem.create({
        data: { category: item.category, title: item.title, url: item.url, journey: (item.journey as "INTERNATIONAL" | "DOMESTIC" | null) ?? undefined },
      });
    }
  }

  const alumni = [
    { name: "Ankit Verma", destinationCountry: "USA", institution: "Arizona State University", collegeName: "VIT Vellore" },
    { name: "Priya Nair", destinationCountry: "Germany", institution: "TU Munich", collegeName: "SRM Chennai" },
    { name: "Rahul Mehta", courseCategory: "PG", institution: "IIM Indore (Executive)", collegeName: "VIT Vellore" },
  ];
  for (const a of alumni) {
    const existing = await prisma.alumniProfile.findFirst({ where: { name: a.name } });
    if (!existing) await prisma.alumniProfile.create({ data: a });
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / (SEED_ADMIN_PASSWORD)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
