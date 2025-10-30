# Manual Verification Guide - Church Membership Sync

**Date:** 2025-10-30
**Feature:** Keycloak Church Membership Claim Sync
**Purpose:** Manual verification steps for testing with live Keycloak instance

## Prerequisites

### Required Infrastructure
- ✅ Keycloak instance running and accessible
- ✅ Redis instance running for BullMQ
- ✅ PostgreSQL database with church membership tables
- ✅ API server deployed and running
- ✅ Worker process deployed and running

### Environment Variables
```bash
# Keycloak Configuration
KEYCLOAK_URL=https://your-keycloak-instance.com/realms/your-realm
KEYCLOAK_REALM=your-realm
KEYCLOAK_CLIENT_ID=your-client-id
KEYCLOAK_CLIENT_SECRET=your-client-secret

# Redis Configuration (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/disciple_db
```

### Test User Accounts
Create at least 3 test users in Keycloak:
1. **User A** - Will create church (become Owner)
2. **User B** - Will accept invitation (become Member)
3. **User C** - Will be used for ownership transfer

## Manual Verification Steps

### Step 1: Verify Church Creation Flow

**Objective:** Verify owner-created event syncs to Keycloak

1. **Create a church as User A:**
   ```bash
   curl -X POST https://api.example.com/churches \
     -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Church Alpha",
       "description": "A test church for verification"
     }'
   ```

2. **Expected Behavior:**
   - API returns 201 Created with church data
   - Owner-created event emitted to outbox
   - BullMQ job enqueued
   - Worker processes job within 5 seconds
   - User A's JWT refreshed

3. **Verify in Keycloak:**
   - Navigate to Keycloak Admin Console
   - Go to Users → User A → Attributes
   - Verify `church_membership` attribute exists
   - Verify value: `[{"churchId": "church-id-here", "role": "Owner"}]`

4. **Verify in JWT Token:**
   ```bash
   # Get new JWT token for User A
   curl -X POST https://auth.example.com/token \
     -d "grant_type=refresh_token" \
     -d "refresh_token=<REFRESH_TOKEN>"

   # Decode JWT and verify church_membership claim
   # Expected: [{"churchId": "church-id-here", "role": "Owner"}]
   ```

**Success Criteria:**
- ✅ Church created successfully
- ✅ Event processed within 30 seconds
- ✅ Keycloak attribute updated
- ✅ JWT contains correct claim

---

### Step 2: Verify Invitation Acceptance Flow

**Objective:** Verify member-joined event syncs to Keycloak

1. **Invite User B to the church (as User A):**
   ```bash
   curl -X POST https://api.example.com/churches/<CHURCH_ID>/invitations \
     -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "userb@example.com",
       "role": "Member"
     }'
   ```

2. **Accept invitation (as User B):**
   ```bash
   curl -X POST https://api.example.com/churches/<CHURCH_ID>/invitations/accept \
     -H "Authorization: Bearer <USER_B_TOKEN>"
   ```

3. **Expected Behavior:**
   - API returns 200 OK with membership data
   - Member-joined event emitted to outbox
   - BullMQ job enqueued
   - Worker processes job within 5 seconds
   - User B's JWT refreshed

4. **Verify in Keycloak:**
   - Go to Users → User B → Attributes
   - Verify `church_membership` attribute exists
   - Verify value: `[{"churchId": "church-id-here", "role": "Member"}]`

5. **Verify in JWT Token:**
   ```bash
   # Get new JWT token for User B
   # Expected: [{"churchId": "church-id-here", "role": "Member"}]
   ```

**Success Criteria:**
- ✅ Invitation accepted successfully
- ✅ Event processed within 30 seconds
- ✅ Keycloak attribute updated
- ✅ JWT contains correct claim

---

### Step 3: Verify Leave Church Flow

**Objective:** Verify member-left event removes membership from Keycloak

1. **User B leaves the church:**
   ```bash
   curl -X DELETE https://api.example.com/churches/<CHURCH_ID>/membership \
     -H "Authorization: Bearer <USER_B_TOKEN>"
   ```

2. **Expected Behavior:**
   - API returns 204 No Content
   - Member-left event emitted to outbox
   - BullMQ job enqueued
   - Worker processes job within 5 seconds
   - User B's JWT refreshed

3. **Verify in Keycloak:**
   - Go to Users → User B → Attributes
   - Verify `church_membership` attribute is `[]` or removed

4. **Verify in JWT Token:**
   ```bash
   # Get new JWT token for User B
   # Expected: [] (empty array)
   ```

**Success Criteria:**
- ✅ User left church successfully
- ✅ Event processed within 30 seconds
- ✅ Keycloak attribute cleared
- ✅ JWT no longer contains church membership

---

### Step 4: Verify Ownership Transfer Flow (if endpoint exists)

**Objective:** Verify ownership-transferred event updates both users atomically

**NOTE:** This flow requires an ownership transfer endpoint, which does not exist in the current codebase. This verification is for future implementation.

1. **Transfer ownership from User A to User C:**
   ```bash
   curl -X POST https://api.example.com/churches/<CHURCH_ID>/transfer-ownership \
     -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "newOwnerId": "<USER_C_ID>",
       "previousOwnerRole": "Manager"
     }'
   ```

2. **Expected Behavior:**
   - API returns 200 OK
   - Ownership-transferred event emitted to outbox
   - BullMQ job enqueued
   - Worker processes job and updates BOTH users atomically
   - Both users' JWTs refreshed

3. **Verify in Keycloak:**
   - **User A (previous owner):**
     - `church_membership`: `[{"churchId": "...", "role": "Manager"}]`
   - **User C (new owner):**
     - `church_membership`: `[{"churchId": "...", "role": "Owner"}]`

4. **Verify in JWT Tokens:**
   ```bash
   # User A token: role changed to Manager
   # User C token: role changed to Owner
   ```

**Success Criteria:**
- ✅ Ownership transferred successfully
- ✅ Event processed within 30 seconds
- ✅ Both users' Keycloak attributes updated
- ✅ Both JWTs reflect new roles

---

### Step 5: Verify Migration Script

**Objective:** Verify migration script syncs existing memberships to Keycloak

1. **Run migration script:**
   ```bash
   npm run migrate:church-memberships

   # Or with dry-run flag
   npm run migrate:church-memberships -- --dry-run
   ```

2. **Expected Behavior:**
   - Script queries all users with church memberships
   - Processes users in batches of 100
   - Updates Keycloak attributes for each user
   - Logs progress every 100 users
   - Completes with success/failure statistics

3. **Monitor Script Output:**
   ```
   Starting church membership migration...
   Total users to process: 250
   Processing batch 1 (users 1-100)...
   Progress: 100/250 users processed (40.0%)
   Processing batch 2 (users 101-200)...
   Progress: 200/250 users processed (80.0%)
   Processing batch 3 (users 201-250)...
   Progress: 250/250 users processed (100.0%)

   Migration completed successfully!
   Total users: 250
   Successful: 245
   Failed: 2
   Skipped: 3
   Unchanged: 15
   ```

4. **Verify Sample Users:**
   - Pick 5-10 random users from database
   - Check Keycloak attributes for each
   - Verify `church_membership` matches database state

**Success Criteria:**
- ✅ Script runs without crashing
- ✅ All users processed
- ✅ Success rate >95%
- ✅ Sample users verified in Keycloak

---

### Step 6: Verify Retry Logic

**Objective:** Verify jobs retry on Keycloak API failures

1. **Simulate Keycloak API failure:**
   - Temporarily make Keycloak unreachable (firewall rule or network issue)
   - OR use API rate limiting to trigger failures

2. **Trigger a church membership change:**
   ```bash
   curl -X POST https://api.example.com/churches \
     -H "Authorization: Bearer <USER_TOKEN>" \
     -d '{"name": "Test Church for Retry"}'
   ```

3. **Monitor BullMQ Dashboard or Logs:**
   - Job should enter "delayed" state
   - Job should retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
   - After 5 attempts, job moves to failed queue

4. **Restore Keycloak connectivity:**
   - Re-enable network access
   - If job still has retries left, it should succeed
   - If job exhausted retries, verify it's in dead letter queue

**Success Criteria:**
- ✅ Job retries on failure
- ✅ Exponential backoff observed
- ✅ Job succeeds after retry (if API restored)
- ✅ Job moves to DLQ after max retries (if API down)

---

### Step 7: Verify Worker Graceful Shutdown

**Objective:** Verify worker waits for in-flight jobs before closing

1. **Start worker process:**
   ```bash
   npm run worker
   ```

2. **Trigger multiple church membership changes:**
   ```bash
   # Create multiple churches quickly
   for i in {1..5}; do
     curl -X POST https://api.example.com/churches \
       -H "Authorization: Bearer <TOKEN>" \
       -d "{\"name\": \"Church $i\"}" &
   done
   ```

3. **Send SIGTERM to worker process:**
   ```bash
   kill -SIGTERM <WORKER_PID>
   ```

4. **Expected Behavior:**
   - Worker logs: "Received SIGTERM, starting graceful shutdown"
   - Worker waits for in-flight jobs to complete
   - Worker logs: "All jobs completed, closing worker"
   - Worker exits with code 0

5. **Verify in BullMQ:**
   - No jobs left in "active" state
   - All jobs either completed or moved to delayed/failed

**Success Criteria:**
- ✅ Worker waits for in-flight jobs
- ✅ No jobs dropped
- ✅ Clean shutdown with exit code 0

---

### Step 8: Verify Multi-Church Memberships

**Objective:** Verify users with multiple church memberships sync correctly

1. **Create multiple churches with same user:**
   ```bash
   # User A creates Church 1
   curl -X POST https://api.example.com/churches \
     -H "Authorization: Bearer <USER_A_TOKEN>" \
     -d '{"name": "Church Alpha"}'

   # User A creates Church 2
   curl -X POST https://api.example.com/churches \
     -H "Authorization: Bearer <USER_A_TOKEN>" \
     -d '{"name": "Church Beta"}'
   ```

2. **Invite User A to Church 3 (created by someone else):**
   ```bash
   # User B creates Church 3
   # User B invites User A
   # User A accepts invitation
   ```

3. **Verify in Keycloak:**
   - Go to Users → User A → Attributes
   - Verify `church_membership` contains ALL three churches:
   ```json
   [
     {"churchId": "church-1-id", "role": "Owner"},
     {"churchId": "church-2-id", "role": "Owner"},
     {"churchId": "church-3-id", "role": "Member"}
   ]
   ```

4. **Verify in JWT Token:**
   ```bash
   # Decode JWT
   # Expected: Array with all 3 churches and correct roles
   ```

**Success Criteria:**
- ✅ All memberships appear in Keycloak
- ✅ Roles are correct for each church
- ✅ JWT contains all memberships

---

### Step 9: Verify Dead Letter Queue

**Objective:** Verify permanently failed jobs move to DLQ

1. **Force a permanent failure:**
   - Delete a user from Keycloak but NOT from database
   - OR make Keycloak API permanently unavailable

2. **Trigger a membership change for that user:**
   ```bash
   curl -X POST https://api.example.com/churches/<CHURCH_ID>/invitations/accept \
     -H "Authorization: Bearer <DELETED_USER_TOKEN>"
   ```

3. **Monitor BullMQ:**
   - Job should retry 5 times
   - After 5 failures, job moves to failed queue (DLQ)

4. **Verify in BullMQ Dashboard:**
   - Go to Failed Jobs
   - Find the job
   - Verify error message indicates reason for failure

5. **Manual Recovery (if needed):**
   - Fix the underlying issue (restore user in Keycloak)
   - Retry the job from DLQ
   - Verify job succeeds on retry

**Success Criteria:**
- ✅ Job retries 5 times
- ✅ Job moves to DLQ after exhaustion
- ✅ Error message is clear
- ✅ Manual retry works after fix

---

### Step 10: Performance Verification

**Objective:** Verify system handles load and processes jobs efficiently

1. **Create 100 churches rapidly:**
   ```bash
   for i in {1..100}; do
     curl -X POST https://api.example.com/churches \
       -H "Authorization: Bearer <TOKEN>" \
       -d "{\"name\": \"Perf Test Church $i\"}" &
   done
   ```

2. **Monitor Metrics:**
   - Job queue length (should not grow unbounded)
   - Job processing time (should be <5s per job)
   - Worker CPU/memory usage (should be stable)
   - Keycloak API response times

3. **Verify Results:**
   - All 100 jobs processed successfully
   - No jobs stuck in "active" state
   - No memory leaks in worker process

**Success Criteria:**
- ✅ All jobs processed within 5 minutes
- ✅ Average job processing time <5s
- ✅ No jobs stuck or failed
- ✅ System remains stable under load

---

## Verification Checklist

Use this checklist to track verification progress:

### Core Flows
- [ ] Church creation flow verified (Step 1)
- [ ] Invitation acceptance flow verified (Step 2)
- [ ] Leave church flow verified (Step 3)
- [ ] Ownership transfer flow verified (Step 4) - OPTIONAL (endpoint doesn't exist yet)

### Migration
- [ ] Migration script executed successfully (Step 5)
- [ ] Sample users verified in Keycloak (Step 5)

### Error Handling
- [ ] Retry logic verified (Step 6)
- [ ] Worker graceful shutdown verified (Step 7)
- [ ] Dead letter queue verified (Step 9)

### Complex Scenarios
- [ ] Multi-church memberships verified (Step 8)
- [ ] Performance under load verified (Step 10)

### JWT Verification
- [ ] Owner role appears in JWT
- [ ] Member role appears in JWT
- [ ] Empty array for users without memberships
- [ ] Multiple churches appear correctly

---

## Troubleshooting

### Issue: Events not processing
**Symptoms:** Jobs stuck in queue, no Keycloak updates
**Solutions:**
1. Verify worker process is running
2. Check Redis connectivity
3. Check worker logs for errors
4. Verify Keycloak API credentials

### Issue: JWT doesn't contain church_membership claim
**Symptoms:** Keycloak attribute updated but JWT missing claim
**Solutions:**
1. Verify `church_membership` scope exists in Keycloak
2. Verify scope is included in token request
3. Force token refresh (logout/login)
4. Check Keycloak mappers configuration

### Issue: Migration script fails
**Symptoms:** Script crashes or reports high failure rate
**Solutions:**
1. Check database connectivity
2. Check Keycloak API credentials
3. Review failed user IDs in logs
4. Verify users exist in Keycloak
5. Run with `--dry-run` to test first

### Issue: Jobs failing repeatedly
**Symptoms:** All jobs moving to DLQ
**Solutions:**
1. Check Keycloak API health
2. Verify Keycloak credentials are valid
3. Check network connectivity
4. Review error messages in logs
5. Verify user attributes permissions

---

## Success Criteria Summary

**All verification steps must pass for production readiness:**

| Step | Criterion | Status |
|------|-----------|--------|
| 1 | Church creation syncs to Keycloak | ⬜ |
| 2 | Invitation acceptance syncs to Keycloak | ⬜ |
| 3 | Leave church removes from Keycloak | ⬜ |
| 4 | Ownership transfer updates both users | ⬜ (Optional) |
| 5 | Migration script completes successfully | ⬜ |
| 6 | Retry logic works on failures | ⬜ |
| 7 | Worker graceful shutdown works | ⬜ |
| 8 | Multi-church memberships sync correctly | ⬜ |
| 9 | DLQ captures permanent failures | ⬜ |
| 10 | System handles load efficiently | ⬜ |

**Legend:**
- ⬜ Not verified
- ✅ Verified and passing
- ❌ Verified and failing

---

## Conclusion

Complete all verification steps above before deploying to production. Document any issues found and their resolutions. Update this guide with any lessons learned during verification.

**Estimated Verification Time:** 2-4 hours (depending on infrastructure setup)

**Recommended Approach:**
1. Set up test environment with Keycloak, Redis, and Database
2. Complete Steps 1-5 (core flows and migration)
3. Complete Steps 6-9 (error handling)
4. Complete Step 10 (performance)
5. Document results and any issues found
6. Sign off on verification before production deployment
