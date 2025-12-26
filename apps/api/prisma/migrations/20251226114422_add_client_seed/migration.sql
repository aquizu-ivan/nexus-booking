/*
  Warnings:

  - A unique constraint covering the columns `[clientSeed]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "clientSeed" TEXT,
ALTER COLUMN "contact" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_clientSeed_key" ON "users"("clientSeed");
