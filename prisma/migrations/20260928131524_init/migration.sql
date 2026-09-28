-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('DRIVER', 'CONSTRUCTOR');

-- CreateEnum
CREATE TYPE "ChipStatus" AS ENUM ('AVAILABLE', 'USED', 'LOCKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StrategyMode" AS ENUM ('POINTS', 'BALANCED', 'BUDGET', 'CUSTOM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyTeam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "FantasyTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrandPrix" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),

    CONSTRAINT "GrandPrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSnapshot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "grandPrixId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "squadValue" DECIMAL(8,2),
    "bankValue" DECIMAL(8,2),
    "cashBalance" DECIMAL(8,2),
    "freeTransfers" INTEGER,
    "totalPoints" INTEGER,

    CONSTRAINT "TeamSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSlot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "isDoubled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "outId" TEXT NOT NULL,
    "inId" TEXT NOT NULL,
    "penaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChipUsage" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "grandPrixId" TEXT,
    "chipCode" TEXT NOT NULL,
    "status" "ChipStatus" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "ChipUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "grandPrixId" TEXT NOT NULL,
    "price" DECIMAL(8,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPrediction" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "grandPrixId" TEXT NOT NULL,
    "expectedPoints" DOUBLE PRECISION,
    "expectedPriceDelta" DOUBLE PRECISION,
    "probabilityRise" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyScenario" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "grandPrixId" TEXT NOT NULL,
    "mode" "StrategyMode" NOT NULL,
    "pointsWeight" DOUBLE PRECISION NOT NULL,
    "budgetWeight" DOUBLE PRECISION NOT NULL,
    "projectedPoints" DOUBLE PRECISION,
    "projectedValueDelta" DOUBLE PRECISION,
    "transfersJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeam_userId_season_name_key" ON "FantasyTeam"("userId", "season", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_season_code_type_key" ON "Asset"("season", "code", "type");

-- CreateIndex
CREATE UNIQUE INDEX "GrandPrix_season_round_key" ON "GrandPrix"("season", "round");

-- CreateIndex
CREATE INDEX "TeamSnapshot_teamId_grandPrixId_idx" ON "TeamSnapshot"("teamId", "grandPrixId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSlot_snapshotId_assetId_key" ON "TeamSlot"("snapshotId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ChipUsage_teamId_chipCode_key" ON "ChipUsage"("teamId", "chipCode");

-- CreateIndex
CREATE INDEX "PriceHistory_assetId_recordedAt_idx" ON "PriceHistory"("assetId", "recordedAt");

-- CreateIndex
CREATE INDEX "AssetPrediction_assetId_grandPrixId_idx" ON "AssetPrediction"("assetId", "grandPrixId");

-- AddForeignKey
ALTER TABLE "FantasyTeam" ADD CONSTRAINT "FantasyTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSnapshot" ADD CONSTRAINT "TeamSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSnapshot" ADD CONSTRAINT "TeamSnapshot_grandPrixId_fkey" FOREIGN KEY ("grandPrixId") REFERENCES "GrandPrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeamSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeamSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_outId_fkey" FOREIGN KEY ("outId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_inId_fkey" FOREIGN KEY ("inId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipUsage" ADD CONSTRAINT "ChipUsage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipUsage" ADD CONSTRAINT "ChipUsage_grandPrixId_fkey" FOREIGN KEY ("grandPrixId") REFERENCES "GrandPrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_grandPrixId_fkey" FOREIGN KEY ("grandPrixId") REFERENCES "GrandPrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPrediction" ADD CONSTRAINT "AssetPrediction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPrediction" ADD CONSTRAINT "AssetPrediction_grandPrixId_fkey" FOREIGN KEY ("grandPrixId") REFERENCES "GrandPrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyScenario" ADD CONSTRAINT "StrategyScenario_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyScenario" ADD CONSTRAINT "StrategyScenario_grandPrixId_fkey" FOREIGN KEY ("grandPrixId") REFERENCES "GrandPrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
