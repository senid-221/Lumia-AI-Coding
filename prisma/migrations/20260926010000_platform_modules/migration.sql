-- Lumia platform expansion

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId","userId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

CREATE TABLE "ProjectSettings" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "settings" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectSettings_projectId_key" ON "ProjectSettings"("projectId");

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "mimeType" TEXT,
  "size" INTEGER,
  "url" TEXT,
  "storageKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");

CREATE TABLE "ExecutionEvent" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "data" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExecutionEvent_executionId_createdAt_idx" ON "ExecutionEvent"("executionId","createdAt");

CREATE TABLE "ToolCall" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "tool" TEXT NOT NULL,
  "input" TEXT,
  "output" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ToolCall_executionId_startedAt_idx" ON "ToolCall"("executionId","startedAt");

CREATE TABLE "AIProvider" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIProvider_key_key" ON "AIProvider"("key");

CREATE TABLE "AIModel" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "contextSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIModel_providerId_key_key" ON "AIModel"("providerId","key");

CREATE TABLE "ProviderUsage" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cost" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderUsage_providerId_createdAt_idx" ON "ProviderUsage"("providerId","createdAt");
CREATE INDEX "ProviderUsage_userId_createdAt_idx" ON "ProviderUsage"("userId","createdAt");
CREATE INDEX "ProviderUsage_projectId_createdAt_idx" ON "ProviderUsage"("projectId","createdAt");

CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_userId_createdAt_idx" ON "ApiKey"("userId","createdAt");

CREATE TABLE "Integration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "config" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Integration_userId_provider_idx" ON "Integration"("userId","provider");

CREATE TABLE "GitRepository" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'github',
  "owner" TEXT,
  "name" TEXT NOT NULL,
  "url" TEXT,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitRepository_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitRepository_projectId_provider_name_key" ON "GitRepository"("projectId","provider","name");

CREATE TABLE "GitBranch" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sha" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitBranch_repositoryId_name_key" ON "GitBranch"("repositoryId","name");

CREATE TABLE "GitCommit" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "sha" TEXT NOT NULL,
  "message" TEXT,
  "author" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GitCommit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitCommit_repositoryId_sha_key" ON "GitCommit"("repositoryId","sha");
CREATE INDEX "GitCommit_repositoryId_createdAt_idx" ON "GitCommit"("repositoryId","createdAt");

CREATE TABLE "AgentTask" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "conversationId" TEXT,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'coding',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "prompt" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgentTask_status_priority_idx" ON "AgentTask"("status","priority");
CREATE INDEX "AgentTask_userId_createdAt_idx" ON "AgentTask"("userId","createdAt");

CREATE TABLE "TaskRun" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "executionId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskRun_taskId_startedAt_idx" ON "TaskRun"("taskId","startedAt");

CREATE TABLE "HackingLabTarget" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "authorized" BOOLEAN NOT NULL DEFAULT false,
  "labMode" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HackingLabTarget_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HackingLabTarget_projectId_createdAt_idx" ON "HackingLabTarget"("projectId","createdAt");

CREATE TABLE "SecurityFinding" (
  "id" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "evidence" TEXT,
  "remediation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityFinding_targetId_severity_idx" ON "SecurityFinding"("targetId","severity");

CREATE TABLE "LabReport" (
  "id" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LabReport_targetId_createdAt_idx" ON "LabReport"("targetId","createdAt");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId","readAt","createdAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "resourceId" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId","createdAt");
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId","createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action","createdAt");

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutionEvent" ADD CONSTRAINT "ExecutionEvent_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIModel" ADD CONSTRAINT "AIModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderUsage" ADD CONSTRAINT "ProviderUsage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderUsage" ADD CONSTRAINT "ProviderUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderUsage" ADD CONSTRAINT "ProviderUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitRepository" ADD CONSTRAINT "GitRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitBranch" ADD CONSTRAINT "GitBranch_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitCommit" ADD CONSTRAINT "GitCommit_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HackingLabTarget" ADD CONSTRAINT "HackingLabTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "HackingLabTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "HackingLabTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "legacyAttachmentMigrationNote" TEXT;
