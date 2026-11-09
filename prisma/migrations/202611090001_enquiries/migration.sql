-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notificationId" TEXT,
    "notificationSentAt" TIMESTAMP(3),
    "notificationLeaseUntil" TIMESTAMP(3),
    "notificationAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_requestId_key" ON "Enquiry"("requestId");

-- CreateIndex
CREATE INDEX "Enquiry_notificationStatus_createdAt_idx" ON "Enquiry"("notificationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
