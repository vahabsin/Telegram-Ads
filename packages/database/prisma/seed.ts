import { PrismaClient } from "../generated/client";

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

  // NOTE: PlatformSetting (coinToTomanRate, platformCommissionPercent, minPayoutAmount, ...)
  // is intentionally NOT seeded here. These are real-money decisions per CLAUDE.md section 2
  // item 3 and must be confirmed with the user before any value is stored. See docs/ROADMAP.md
  // phase 1 and docs/DECISIONS.md.
  console.log(
    "Skipped PlatformSetting seed: coinToTomanRate/platformCommissionPercent/minPayoutAmount " +
      "require a real-money decision from the user before they can be set (see docs/DECISIONS.md).",
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
