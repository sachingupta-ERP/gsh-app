-- Additive production auth/version history tables.
-- Existing User, Permission, Session, and business tables are preserved.

ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "UserRoles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRoles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "loggedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "UserSessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetRequests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "temporaryHash" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "PasswordResetRequests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VersionHistory" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery" TEXT NOT NULL,
    "developer" TEXT NOT NULL,
    "releaseNotes" TEXT NOT NULL,
    CONSTRAINT "VersionHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserRoles_userId_role_key" ON "UserRoles"("userId", "role");
CREATE UNIQUE INDEX "UserSessions_token_key" ON "UserSessions"("token");
CREATE INDEX "VersionHistory_date_idx" ON "VersionHistory"("date");

ALTER TABLE "UserRoles"
  ADD CONSTRAINT "UserRoles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserSessions"
  ADD CONSTRAINT "UserSessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PasswordResetRequests"
  ADD CONSTRAINT "PasswordResetRequests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
