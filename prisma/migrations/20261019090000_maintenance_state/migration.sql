CREATE TABLE "MaintenanceState" (
  "id" TEXT NOT NULL,
  "token" TEXT,
  "leaseUntil" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01'::timestamp,
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "lastStartedAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "forecastRound" INTEGER,
  "forecastAt" TIMESTAMP(3),
  "forecastContext" JSONB,
  CONSTRAINT "MaintenanceState_pkey" PRIMARY KEY ("id")
);
