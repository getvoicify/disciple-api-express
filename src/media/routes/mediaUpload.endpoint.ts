import express from 'express';
import multer from 'multer';
import { MediaUploadService } from '../media-upload-service';
import { safeExecute } from '../../utils/handle-async';

// Configure multer with environment-specific storage strategy
const upload = multer({
  storage: process.env.NODE_ENV === 'development'
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: '/tmp',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
          cb(null, `upload-${uniqueSuffix}-${file.originalname}`);
        }
      }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * @openapi
 * /media/upload:
 *   post:
 *     summary: Upload media file
 *     description: Upload a media file (image, document, etc.) and store metadata
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *             required:
 *               - file
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 media:
 *                   $ref: '#/components/schemas/Media'
 *                 message:
 *                   type: string
 *                   example: "File uploaded successfully"
 *       400:
 *         description: Invalid file or upload error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
export const mediaUploadEndpoint = (uploadService: MediaUploadService) => [
    upload.single('file'),
    async (req: express.Request, res: express.Response) => {
        // Extract user ID from authenticated token
        const uploadedBy = req['user']?.[1].payload?.sub || '';
        if (!uploadedBy) {
            res.status(401).json({
                error: 'User authentication required',
                success: false,
            });
            return;
        }

        // Check if file was uploaded
        if (!req.file) {
            res.status(400).json({
                error: 'No file provided',
                success: false,
            });
            return;
        }

        // Prepare file upload object - handle both memory and disk storage
        let buffer = req.file.buffer;

        if (!buffer && req.file.path) {
            const [readError, fileBuffer] = await safeExecute(() =>
                import('fs').then(fs => fs.readFileSync(req.file.path))
            );

            if (readError) {
                console.error('Failed to read uploaded file:', readError);
                res.status(500).json({
                    error: 'Failed to process uploaded file',
                    success: false,
                });
                return;
            }
            buffer = fileBuffer;
        }

        const fileUpload = {
            buffer,
            originalFilename: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size
        };

        // Clean up temporary file if using disk storage
        if (req.file.path) {
            const [cleanupError] = await safeExecute(() =>
                import('fs').then(fs => fs.unlinkSync(req.file.path))
            );
            if (cleanupError) {
                console.warn('Failed to cleanup temp file:', req.file.path, cleanupError);
            }
        }

        // Upload file using safeExecute
        const [uploadError, result] = await safeExecute(uploadService.uploadFile(fileUpload, uploadedBy));

        if (uploadError) {
            console.error('Media upload error:', uploadError);
            res.status(500).json({
                error: 'Internal server error',
                success: false,
            });
            return;
        }

        if (result.success) {
            res.status(201).json({
                success: true,
                media: result.media,
                message: 'File uploaded successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    }
];