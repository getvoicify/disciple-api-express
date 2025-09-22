import { interval, from, EMPTY } from 'rxjs';
import { mergeMap, catchError, tap } from 'rxjs/operators';
import { OutboxSingleton, processOutboxEvents } from '../outbox-singleton';

/**
 * Worker that processes outbox events every minute
 * This ensures that any pending Keycloak synchronization events are processed
 */
const outboxProcessorWorker$ = interval(0).pipe(
	tap(() => console.log('[OutboxProcessor] Starting outbox processing...')),
	mergeMap(() =>
		from(processOutboxEvents(10)).pipe(
			tap(() => console.log('[OutboxProcessor] Outbox processing completed')),
			catchError((error) => {
				console.error('[OutboxProcessor] Error processing outbox events:', error);
				// Return empty to continue the stream
				return EMPTY;
			})
		)
	)
);

export default outboxProcessorWorker$;