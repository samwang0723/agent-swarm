import logger from '@/shared/utils/logger';
import { GmailService } from '@/features/emails/email.service';

// Start background job to fetch and store emails without blocking the response
export const fetchAndStoreEmails = async (token: string, userId: string) => {
  try {
    logger.info('Fetching and storing emails in the background...');
    const gmailService = new GmailService();
    await gmailService.initialize(token);
    const emailResponse = await gmailService.getEmails();
    const emails = emailResponse.messages;

    logger.info(`Fetched ${emails.length} emails`);
    if (emails && emails.length > 0) {
      await gmailService.batchInsertEmails(userId, emails);
      logger.info(
        `Successfully processed ${emails.length} emails in the background.`
      );
    } else {
      logger.info('No new emails to process in the background.');
    }
  } catch (error) {
    logger.error('Error processing emails in background', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};
