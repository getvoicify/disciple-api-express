-- Create outbox_events table for reliable event processing
CREATE TABLE IF NOT EXISTS outbox_events
(
    id              VARCHAR(255) PRIMARY KEY,
    entity_type     VARCHAR(100)             NOT NULL,
    entity_id       VARCHAR(255)             NOT NULL,
    operation       VARCHAR(20)              NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    status          VARCHAR(20)              NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'failed', 'succeeded', 'dead_letter')),
    attempt         INTEGER                  NOT NULL DEFAULT 0,
    payload         JSONB,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_attempt_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events (status);
CREATE INDEX IF NOT EXISTS idx_outbox_events_entity ON outbox_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_next_attempt ON outbox_events (next_attempt_at) WHERE next_attempt_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_events_due ON outbox_events (status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed');

-- Create dead letter table for failed events
CREATE TABLE IF NOT EXISTS outbox_dead_letter
(
    id          VARCHAR(255) PRIMARY KEY,
    entity_type VARCHAR(100)             NOT NULL,
    entity_id   VARCHAR(255)             NOT NULL,
    operation   VARCHAR(20)              NOT NULL,
    status      VARCHAR(20)              NOT NULL,
    attempt     INTEGER                  NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    failed_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for dead letter queries
CREATE INDEX IF NOT EXISTS idx_outbox_dead_letter_entity ON outbox_dead_letter (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_outbox_dead_letter_failed_at ON outbox_dead_letter (failed_at);