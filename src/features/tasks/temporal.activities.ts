import logger from '@/shared/utils/logger';
import { GmailService } from '@/features/emails/email.service';
import { embeddingService } from '@/features/embeddings';

export async function importGmail(
  token: string,
  userId: string
): Promise<string> {
  try {
    logger.info('Fetching and storing emails in the background...');
    const gmailService = new GmailService();
    await gmailService.initialize(token);
    const emailResponse = await gmailService.getEmails();
    const emails = emailResponse.messages;

    logger.info(`Fetched ${emails.length} emails`);
    if (emails && emails.length > 0) {
      const insertedEmails = await gmailService.batchInsertEmails(
        userId,
        emails
      );
      logger.info(
        `Successfully processed ${insertedEmails.length} emails in the background.`
      );

      const emailsForEmbedding = insertedEmails.map(e => ({
        id: e.id,
        fromAddress: e.fromAddress ?? undefined,
        subject: e.subject ?? undefined,
        body: e.body ?? undefined,
      }));

      await embeddingService.createEmbeddingsForEmails(
        userId,
        emailsForEmbedding
      );
      logger.info(
        `Successfully created embeddings for ${insertedEmails.length} emails.`
      );
    } else {
      logger.info('No new emails to process in the background.');
    }

    return 'imported';
  } catch (error) {
    logger.error('Error in importGmail activity', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });
    throw new Error('Failed to import Gmail');
  }
}
