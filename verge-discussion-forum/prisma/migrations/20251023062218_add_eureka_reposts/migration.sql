-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "canInteract" BOOLEAN NOT NULL DEFAULT false,
    "school" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "education" TEXT,
    "degree" TEXT,
    "undergraduateStudent" BOOLEAN,
    "graduateStudent" BOOLEAN,
    "researchTechnician" BOOLEAN,
    "postdoctoralScholar" BOOLEAN,
    "principalInvestigator" BOOLEAN,
    "industryProfessional" BOOLEAN,
    "medicalStudent" BOOLEAN,
    "resident" BOOLEAN,
    "physician" BOOLEAN,
    "clinician" BOOLEAN,
    "otherRole" TEXT,
    "intendedDegree" TEXT,
    "about" TEXT,
    "labAffiliation" TEXT,
    "currentProjects" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bypass2FA" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorCode" TEXT,
    "twoFactorCodeExpires" DATETIME,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "postId" INTEGER,
    "staffPostId" INTEGER,
    "grantId" INTEGER,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Repost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "staffPostId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Repost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repost_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Repost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EurekaRepost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "content" TEXT,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'investigate',
    "aiResponse" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "papers" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EurekaRepost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EurekaRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subfield" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "StaffPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publicationDate" DATETIME NOT NULL,
    "citedByCount" INTEGER NOT NULL,
    "abstract" TEXT NOT NULL,
    "doi" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "citation" TEXT NOT NULL DEFAULT '',
    "relevanceScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffPostAuthor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "staffPostId" INTEGER NOT NULL,
    CONSTRAINT "StaffPostAuthor_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "postId" INTEGER,
    "staffPostId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedCategoryStaffPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "staffPostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedCategoryStaffPost_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedCategoryStaffPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SavedCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedCategoryPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedCategoryPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedCategoryPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SavedCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedCategoryGrant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "grantId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedCategoryGrant_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedCategoryGrant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SavedCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedCategoryNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedCategoryNote_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SavedCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedPostNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedPostNote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedPostNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedStaffPostNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "staffPostId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedStaffPostNote_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedStaffPostNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedGrantNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "grantId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedGrantNote_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedGrantNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentUpvote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "commentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentUpvote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommentUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffPostLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "staffPostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffPostLike_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepostLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "repostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepostLike_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Repost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RepostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subfield" TEXT,
    "eligibility" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "fundingAmount" TEXT NOT NULL,
    "grantWebsiteUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'private',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Grant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrantBookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "grantId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrantBookmark_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GrantBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrantLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "grantId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrantLike_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GrantLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffPostSubfield" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "staffPostId" INTEGER NOT NULL,
    CONSTRAINT "StaffPostSubfield_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSubfield" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "subfieldId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSubfield_subfieldId_fkey" FOREIGN KEY ("subfieldId") REFERENCES "Subfield" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSubfield_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "ConnectionRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConnectionRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CitationUpdateMetadata" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffPostId" INTEGER NOT NULL,
    "lastUpdateTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextScheduledUpdate" DATETIME NOT NULL,
    "priorityScore" REAL NOT NULL DEFAULT 0.0,
    "updateFrequencyTier" TEXT NOT NULL DEFAULT 'low',
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "citationVelocity" REAL NOT NULL DEFAULT 0.0,
    "lastCitationCount" INTEGER NOT NULL DEFAULT 0,
    "lastVelocityCalculation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CitationUpdateMetadata_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CitationUpdateQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffPostId" INTEGER NOT NULL,
    "priorityScore" REAL NOT NULL DEFAULT 0.0,
    "scheduledTime" DATETIME NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CitationUpdateQueue_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CitationUpdateHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffPostId" INTEGER NOT NULL,
    "oldCitationCount" INTEGER NOT NULL,
    "newCitationCount" INTEGER NOT NULL,
    "citationDelta" INTEGER NOT NULL,
    "velocityCalculated" REAL NOT NULL DEFAULT 0.0,
    "updateTrigger" TEXT NOT NULL DEFAULT 'scheduled',
    "processingTimeMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CitationUpdateHistory_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffPostUserActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffPostId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentMs" INTEGER,
    "scrollPercentage" REAL,
    "hasInteracted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StaffPostUserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffPostUserActivity_staffPostId_fkey" FOREIGN KEY ("staffPostId") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MongoDBPaperLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MongoDBPaperLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MongoDBPaperBookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MongoDBPaperBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EurekaRepostLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "eurekaRepostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EurekaRepostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EurekaRepostLike_eurekaRepostId_fkey" FOREIGN KEY ("eurekaRepostId") REFERENCES "EurekaRepost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_StaffPostSubfields" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_StaffPostSubfields_A_fkey" FOREIGN KEY ("A") REFERENCES "StaffPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_StaffPostSubfields_B_fkey" FOREIGN KEY ("B") REFERENCES "Subfield" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_GrantSubfields" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_GrantSubfields_A_fkey" FOREIGN KEY ("A") REFERENCES "Grant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GrantSubfields_B_fkey" FOREIGN KEY ("B") REFERENCES "Subfield" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Repost_postId_key" ON "Repost"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "EurekaRepost_postId_key" ON "EurekaRepost"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Subfield_name_key" ON "Subfield"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_postId_key" ON "Bookmark"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_staffPostId_key" ON "Bookmark"("userId", "staffPostId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCategoryStaffPost_categoryId_staffPostId_key" ON "SavedCategoryStaffPost"("categoryId", "staffPostId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCategoryPost_categoryId_postId_key" ON "SavedCategoryPost"("categoryId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCategoryGrant_categoryId_grantId_key" ON "SavedCategoryGrant"("categoryId", "grantId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCategoryNote_categoryId_key" ON "SavedCategoryNote"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPostNote_userId_postId_key" ON "SavedPostNote"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedStaffPostNote_userId_staffPostId_key" ON "SavedStaffPostNote"("userId", "staffPostId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedGrantNote_userId_grantId_key" ON "SavedGrantNote"("userId", "grantId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentUpvote_userId_commentId_key" ON "CommentUpvote"("userId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPostLike_userId_staffPostId_key" ON "StaffPostLike"("userId", "staffPostId");

-- CreateIndex
CREATE UNIQUE INDEX "RepostLike_userId_repostId_key" ON "RepostLike"("userId", "repostId");

-- CreateIndex
CREATE UNIQUE INDEX "GrantBookmark_userId_grantId_key" ON "GrantBookmark"("userId", "grantId");

-- CreateIndex
CREATE UNIQUE INDEX "GrantLike_userId_grantId_key" ON "GrantLike"("userId", "grantId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubfield_userId_subfieldId_key" ON "UserSubfield"("userId", "subfieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRequest_fromUserId_toUserId_key" ON "ConnectionRequest"("fromUserId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_userId_connectionId_key" ON "Connection"("userId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CitationUpdateMetadata_staffPostId_key" ON "CitationUpdateMetadata"("staffPostId");

-- CreateIndex
CREATE INDEX "CitationUpdateMetadata_priorityScore_idx" ON "CitationUpdateMetadata"("priorityScore");

-- CreateIndex
CREATE INDEX "CitationUpdateMetadata_nextScheduledUpdate_idx" ON "CitationUpdateMetadata"("nextScheduledUpdate");

-- CreateIndex
CREATE INDEX "CitationUpdateMetadata_updateFrequencyTier_idx" ON "CitationUpdateMetadata"("updateFrequencyTier");

-- CreateIndex
CREATE INDEX "CitationUpdateQueue_priorityScore_scheduledTime_idx" ON "CitationUpdateQueue"("priorityScore", "scheduledTime");

-- CreateIndex
CREATE INDEX "CitationUpdateQueue_status_idx" ON "CitationUpdateQueue"("status");

-- CreateIndex
CREATE INDEX "CitationUpdateHistory_staffPostId_createdAt_idx" ON "CitationUpdateHistory"("staffPostId", "createdAt");

-- CreateIndex
CREATE INDEX "CitationUpdateHistory_updateTrigger_idx" ON "CitationUpdateHistory"("updateTrigger");

-- CreateIndex
CREATE INDEX "CitationUpdateHistory_success_idx" ON "CitationUpdateHistory"("success");

-- CreateIndex
CREATE INDEX "StaffPostUserActivity_staffPostId_activityTimestamp_idx" ON "StaffPostUserActivity"("staffPostId", "activityTimestamp");

-- CreateIndex
CREATE INDEX "StaffPostUserActivity_userId_activityTimestamp_idx" ON "StaffPostUserActivity"("userId", "activityTimestamp");

-- CreateIndex
CREATE INDEX "StaffPostUserActivity_activityType_idx" ON "StaffPostUserActivity"("activityType");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPostUserActivity_staffPostId_userId_activityType_key" ON "StaffPostUserActivity"("staffPostId", "userId", "activityType");

-- CreateIndex
CREATE INDEX "MongoDBPaperLike_paperId_idx" ON "MongoDBPaperLike"("paperId");

-- CreateIndex
CREATE INDEX "MongoDBPaperLike_userId_idx" ON "MongoDBPaperLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MongoDBPaperLike_userId_paperId_key" ON "MongoDBPaperLike"("userId", "paperId");

-- CreateIndex
CREATE INDEX "MongoDBPaperBookmark_paperId_idx" ON "MongoDBPaperBookmark"("paperId");

-- CreateIndex
CREATE INDEX "MongoDBPaperBookmark_userId_idx" ON "MongoDBPaperBookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MongoDBPaperBookmark_userId_paperId_key" ON "MongoDBPaperBookmark"("userId", "paperId");

-- CreateIndex
CREATE INDEX "EurekaRepostLike_eurekaRepostId_idx" ON "EurekaRepostLike"("eurekaRepostId");

-- CreateIndex
CREATE INDEX "EurekaRepostLike_userId_idx" ON "EurekaRepostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EurekaRepostLike_userId_eurekaRepostId_key" ON "EurekaRepostLike"("userId", "eurekaRepostId");

-- CreateIndex
CREATE UNIQUE INDEX "_StaffPostSubfields_AB_unique" ON "_StaffPostSubfields"("A", "B");

-- CreateIndex
CREATE INDEX "_StaffPostSubfields_B_index" ON "_StaffPostSubfields"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GrantSubfields_AB_unique" ON "_GrantSubfields"("A", "B");

-- CreateIndex
CREATE INDEX "_GrantSubfields_B_index" ON "_GrantSubfields"("B");
