import type {Job} from 'bullmq';
import type {ChurchMembershipSyncJobData} from './church-membership-sync.types';
import type {ChurchMembershipHandlerRegistry} from './handlers/handler-registry';
import {logger} from '../logging';
import {safeExecute} from "../utils/handle-async";

/**
 * Processor for church membership sync jobs
 * Delegates to registered event handlers based on event type
 */
export class ChurchMembershipSyncProcessor {
	constructor(private readonly handlerRegistry: ChurchMembershipHandlerRegistry) {
	}

	/**
	 * Process a church membership sync job
	 * Delegates to the appropriate event handler based on event type
	 * @param job - The BullMQ job containing sync event data
	 */
	async process(job: Job<ChurchMembershipSyncJobData>): Promise<void> {
		const {eventType, churchId} = job.data;

		logger.info(
			{jobId: job.id, eventType, churchId},
			'Processing church membership sync job'
		);

		const handler = this.handlerRegistry.getHandler(eventType);
		const [error] = await safeExecute(handler.handle(job));

		if (error) {
			logger.error(
				{jobId: job.id, eventType, churchId, error},
				'Failed to process church membership sync job'
			);
			throw error;
		}
		logger.info(
			{jobId: job.id, eventType, churchId},
			'Church membership sync job completed successfully'
		);
	}

}
