/**
 * PrayerAttachment entity representing a file attachment for a prayer request
 */
export interface PrayerAttachment {
  id: string;
  prayerRequestId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  uploadedBy: string;
  createdAt: Date;
  deletedAt?: Date;
}

/**
 * Data required to create a new prayer attachment
 */
export interface CreateAttachmentInput {
  prayerRequestId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  uploadedBy: string;
}
