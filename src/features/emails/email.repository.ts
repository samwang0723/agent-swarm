import { query } from '@/shared/infrastructure/database';
import { GmailMessage } from './email.dto';

export const insertEmails = async (emails: Partial<GmailMessage>[]) => {
  if (emails.length === 0) {
    return;
  }

  const values = emails.map(email => [
    email.userId,
    email.messageId,
    email.threadId,
    email.subject,
    email.body,
    email.receivedTime,
    email.isUnread,
    email.importance,
    email.fromAddress,
  ]);

  const text = `
    INSERT INTO emails (user_id, message_id, thread_id, subject, body, received_time, is_unread, importance, from_address)
    SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[], $7::bool[], $8::bool[], $9::text[])
    ON CONFLICT (user_id, message_id) DO NOTHING
  `;

  // pg-node does not support array of arrays directly, need to format it.
  const formattedValues = values[0].map((_, colIndex) =>
    values.map(row => row[colIndex])
  );

  await query(text, formattedValues);
};
