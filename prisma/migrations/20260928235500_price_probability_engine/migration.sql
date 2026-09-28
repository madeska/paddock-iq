ALTER TABLE "AssetPrediction"
ADD COLUMN "probabilityMaxRise" DOUBLE PRECISION,
ADD COLUMN "probabilitySmallRise" DOUBLE PRECISION,
ADD COLUMN "probabilitySmallFall" DOUBLE PRECISION,
ADD COLUMN "probabilityMaxFall" DOUBLE PRECISION,
ADD COLUMN "requiredPointsMaxRise" DOUBLE PRECISION,
ADD COLUMN "requiredPointsSmallRise" DOUBLE PRECISION,
ADD COLUMN "requiredPointsAvoidMaxFall" DOUBLE PRECISION;
