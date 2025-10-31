import type {Job} from 'bullmq';
import type {JobDataMapper} from './types';
import type {JobHandlerRegistry} from './handler-registry';
import {logger} from '../../logging';
import {safeExecute} from "../../utils/handle-async";

/**
 * Processor for sync jobs
 * Delegates to registered event handlers based on an event type
 */
export class SyncProcessor<T> {
	constructor(
		private readonly handlerRegistry: JobHandlerRegistry<T>,
		private readonly mapper: JobDataMapper<T>
	) {
	}

	/**
	 * Process a sync job
	 * Delegates to the appropriate event handler based on event type
	 * @param job - The BullMQ job containing sync event data
	 */
	async process(job: Job<T>): Promise<void> {
		const [mapError, {eventType, entityId}] = await safeExecute(() => this.mapper(job.data));
		if (mapError) {
			logger.error(
				{jobId: job.id, error: mapError},
				'Failed to map sync job data'
			);
			throw mapError;
		}
		logger.info(
			{jobId: job.id, eventType, entityId},
			'Processing sync job'
		);

		const handler = this.handlerRegistry.getHandler(eventType);
		const [error] = await safeExecute(handler.handle(job));

		if (error) {
			logger.error(
				{jobId: job.id, eventType, entityId, error},
				'Failed to process sync job'
			);
			throw error;
		}
		logger.info(
			{jobId: job.id, eventType, entityId},
			'Sync job completed successfully'
		);
	}

}
