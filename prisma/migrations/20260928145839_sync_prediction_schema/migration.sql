-- AlterTable
ALTER TABLE "AssetPrediction" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "probabilityFall" DOUBLE PRECISION,
ADD COLUMN     "probabilityFlat" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT;
