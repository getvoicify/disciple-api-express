We're continuing our implementation of Prayer Wall Foundation by implementing task group number 20:

## Implement this task and its sub-tasks:

### Task Group 20: File Attachments - Upload & Storage
**Phase:** 3
**Dependencies:** Task Group 19
**Estimated Time:** 4 hours

- [ ] 20.0 Implement file attachment support
  - [ ] 20.1 Write 2-8 focused tests for file attachments
    - Test file upload with valid types (images, PDFs, docs)
    - Test file size validation (10MB max)
    - Test file type validation
    - Test attachment linking to prayer
    - Test signed URL generation
  - [ ] 20.2 Create file upload handler
    - Reuse existing S3/R2 upload infrastructure from `/src/media/` or `/src/gallery/`
    - Validate file type (images, PDFs, documents)
    - Validate file size (10MB max)
    - Generate storage key: `prayer-attachments/{wallId}/{prayerId}/{filename}`
  - [ ] 20.3 Implement POST /api/prayer-walls/:wallId/prayers/upload endpoint
    - Use multer for multipart/form-data
    - Upload to S3/R2
    - Create PrayerAttachment record
    - Return attachment metadata (id, file_name, file_size, storage_key)
  - [ ] 20.4 Implement GET /api/prayer-walls/:wallId/prayers/attachments/:attachmentId endpoint
    - Generate signed URL for download
    - Validate user has access to wall
    - Set appropriate expiration time
  - [ ] 20.5 Update prayer creation to support attachments
    - Accept attachment_ids in POST /prayers
    - Link attachments to prayer_request_id
  - [ ] 20.6 Add cleanup job for unused attachments
    - Delete attachments uploaded but not linked to prayer after 24 hours
  - [ ] 20.7 Ensure attachment tests pass
    - Run ONLY the 2-8 tests written in 20.1

**Acceptance Criteria:**
- File uploads work for images, PDFs, docs
- 10MB size limit enforced
- The 2-8 tests written in 20.1 pass
- Signed URLs generated correctly

## Understand the context

Read @agent-os/specs/2025-10-24-prayer-wall-foundation/spec.md to understand the context for this spec and where the current task fits into it.

Also read these for further context and reference:
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/requirements.md
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/visuals

## Perform the implementation

Implement all tasks assigned to you and ONLY those task(s) that have been assigned to you.

### Implementation process:

1. Analyze the provided spec.md, requirements.md, and visuals (if any)
2. Analyze patterns in the codebase according to its built-in workflow
3. Implement the assigned task group according to requirements and standards
4. Update `agent-os/specs/2025-10-24-prayer-wall-foundation/tasks.md` to update the tasks you've implemented to mark them as done by updating their checkbox to checked state: `- [x]`

### Guide your implementation using:
- **The existing patterns** that you've found and analyzed in the codebase
- **User Standards & Preferences** defined in CLAUDE.md files

### Self-verify and test your work by:
- Running ONLY the tests you've written (if any) and ensuring those tests pass
- IF your task involves user-facing UI, and IF you have access to browser testing tools, open a browser and use the feature you've implemented as if you are a user to ensure a user can use the feature in the intended way
