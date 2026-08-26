import { Prisma, PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// Initial category taxonomy per docs/PRD.md section 2.3 step 3 ("مثل: تکنولوژی، سرگرمی، اخبار،
// کریپتو، آموزش..."). Editable later via the admin panel (docs/ROADMAP.md phase 6).
const categories = [
  { slug: "technology", nameFa: "تکنولوژی", nameEn: "Technology", nameAr: "التكنولوجيا" },
  { slug: "entertainment", nameFa: "سرگرمی", nameEn: "Entertainment", nameAr: "ترفيه" },
  { slug: "news", nameFa: "اخبار", nameEn: "News", nameAr: "أخبار" },
  { slug: "crypto", nameFa: "کریپتو", nameEn: "Crypto", nameAr: "العملات المشفرة" },
  { slug: "education", nameFa: "آموزش", nameEn: "Education", nameAr: "تعليم" },
  { slug: "business", nameFa: "کسب‌وکار", nameEn: "Business", nameAr: "الأعمال" },
  { slug: "health", nameFa: "سلامت", nameEn: "Health", nameAr: "الصحة" },
  { slug: "sports", nameFa: "ورزش", nameEn: "Sports", nameAr: "رياضة" },
  { slug: "gaming", nameFa: "بازی", nameEn: "Gaming", nameAr: "ألعاب" },
  { slug: "music", nameFa: "موسیقی", nameEn: "Music", nameAr: "موسيقى" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
  console.log(`Seeded ${categories.length} categories.`);

  // Launch-default PlatformSetting values. platformCommissionPercent=20 was explicitly set by
  // the user. Every other value here is a reasonable-default engineering decision, NOT a final
  // business decision - each is logged with rationale in docs/DECISIONS.md ADR-005, and the
  // TODO markers below flag which ones must be replaced with real figures before real money
  // moves through them (see docs/ROADMAP.md phases 6/8).
  const platformSettings: Array<{ key: string; value: unknown }> = [
    { key: "platformCommissionPercent", value: 20 },
    // TODO(real-money): confirm final coin<->Toman rate with the user before phase 8 (Rial gateway).
    { key: "coinToTomanRate", value: 1 },
    // TODO(real-money): confirm minimum payout amount with the user before phase 7/8 go live.
    { key: "minPayoutAmount", value: 100000 },
    { key: "minCpm", value: 1000 },
    { key: "maxCpm", value: 1000000 },
    // TODO(compliance): legal/compliance should review this list before launch, not just engineering.
    { key: "restrictedCountries", value: ["KP", "SY", "CU"] },
  ];

  for (const setting of platformSettings) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value as Prisma.InputJsonValue },
      create: { key: setting.key, value: setting.value as Prisma.InputJsonValue },
    });
  }
  console.log(
    `Seeded ${platformSettings.length} platform settings (see docs/DECISIONS.md ADR-005).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
