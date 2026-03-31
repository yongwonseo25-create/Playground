-- CreateTable
CREATE TABLE "ExecutionBillingLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "audio_duration" DOUBLE PRECISION NOT NULL,
    "destination_type" TEXT NOT NULL,
    "execution_attempted" BOOLEAN NOT NULL,
    "destination_delivered" BOOLEAN NOT NULL,
    "billed_transcription_unit" INTEGER NOT NULL,
    "billed_execution_unit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionBillingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionBillingLog_user_id_createdAt_idx"
ON "ExecutionBillingLog"("user_id", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionBillingLog_session_id_createdAt_idx"
ON "ExecutionBillingLog"("session_id", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionBillingLog_destination_type_destination_delivered_cre_idx"
ON "ExecutionBillingLog"("destination_type", "destination_delivered", "createdAt");
