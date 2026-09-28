CREATE TABLE "FantasyRoundScore" (
"id" TEXT NOT NULL,
"assetId" TEXT NOT NULL,
"grandPrixId" TEXT NOT NULL,
"points" DOUBLE PRECISION NOT NULL,
"source" TEXT NOT NULL,
"recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "FantasyRoundScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FantasyRoundScore_assetId_grandPrixId_key" ON "FantasyRoundScore"("assetId","grandPrixId");
CREATE INDEX "FantasyRoundScore_grandPrixId_idx" ON "FantasyRoundScore"("grandPrixId");
ALTER TABLE "FantasyRoundScore" ADD CONSTRAINT "FantasyRoundScore_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FantasyRoundScore" ADD CONSTRAINT "FantasyRoundScore_grandPrixId_fkey" FOREIGN KEY ("grandPrixId") REFERENCES "GrandPrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
