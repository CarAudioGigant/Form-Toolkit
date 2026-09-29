/*
  Warnings:

  - You are about to drop the `FormSubmission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FormSubmissionFile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "FormSubmission";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "FormSubmissionFile";
PRAGMA foreign_keys=on;
