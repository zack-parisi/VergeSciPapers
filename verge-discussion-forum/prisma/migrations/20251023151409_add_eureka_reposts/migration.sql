/*
  Warnings:

  - You are about to drop the column `aiResponse` on the `EurekaRepost` table. All the data in the column will be lost.
  - You are about to drop the column `mode` on the `EurekaRepost` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `EurekaRepost` table. All the data in the column will be lost.
  - You are about to drop the column `papers` on the `EurekaRepost` table. All the data in the column will be lost.
  - You are about to drop the column `query` on the `EurekaRepost` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `EurekaRepost` table. All the data in the column will be lost.
  - Added the required column `eurekaData` to the `EurekaRepost` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EurekaRepost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "content" TEXT,
    "eurekaData" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EurekaRepost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EurekaRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EurekaRepost" ("content", "createdAt", "id", "postId", "userId") SELECT "content", "createdAt", "id", "postId", "userId" FROM "EurekaRepost";
DROP TABLE "EurekaRepost";
ALTER TABLE "new_EurekaRepost" RENAME TO "EurekaRepost";
CREATE UNIQUE INDEX "EurekaRepost_postId_key" ON "EurekaRepost"("postId");
CREATE TABLE "new_EurekaRepostLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "eurekaRepostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EurekaRepostLike_eurekaRepostId_fkey" FOREIGN KEY ("eurekaRepostId") REFERENCES "EurekaRepost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EurekaRepostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EurekaRepostLike" ("createdAt", "eurekaRepostId", "id", "userId") SELECT "createdAt", "eurekaRepostId", "id", "userId" FROM "EurekaRepostLike";
DROP TABLE "EurekaRepostLike";
ALTER TABLE "new_EurekaRepostLike" RENAME TO "EurekaRepostLike";
CREATE UNIQUE INDEX "EurekaRepostLike_userId_eurekaRepostId_key" ON "EurekaRepostLike"("userId", "eurekaRepostId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
