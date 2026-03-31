CREATE TABLE "NotionOAuthConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "workspaceName" TEXT,
  "workspaceIcon" TEXT,
  "duplicatedTemplateId" TEXT,
  "ownerJson" JSONB,
  "encryptedAccessToken" TEXT NOT NULL,
  "encryptionIv" TEXT NOT NULL,
  "encryptionTag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotionOAuthConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotionOAuthConnection_workspaceId_key"
  ON "NotionOAuthConnection"("workspaceId");

CREATE UNIQUE INDEX "NotionOAuthConnection_botId_key"
  ON "NotionOAuthConnection"("botId");
