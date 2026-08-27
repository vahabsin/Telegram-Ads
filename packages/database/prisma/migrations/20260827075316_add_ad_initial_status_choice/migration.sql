-- CreateEnum
CREATE TYPE "AdInitialStatusChoice" AS ENUM ('ACTIVE', 'PAUSED');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "initialStatusChoice" "AdInitialStatusChoice" NOT NULL DEFAULT 'ACTIVE';
