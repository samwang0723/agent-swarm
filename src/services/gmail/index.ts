import * as emailRepo from '@/repository/email';
import { RawGmailMessage, GmailMessage, GmailListResponse } from './types';
import logger from '../../utils/logger';
import { McpClient } from '@/tools/mcp-client';
import { mcpServers } from '@/config/mcp';

export class GmailService {
  private client: McpClient | null = null;

  public async initialize(token: string): Promise<void> {
    try {
      const googleAssistantConfig = mcpServers.find(
        server => server.name === 'google-assistant'
      );

      if (!googleAssistantConfig) {
        throw new Error('Google Assistant MCP server configuration not found.');
      }
      this.client = new McpClient(googleAssistantConfig, 'anthropic');
      this.client.setAccessToken(token);
      await this.client.initialize();
    } catch (error) {
      logger.error('Error initializing Gmail service', { error });
      throw new Error('Failed to initialize Gmail service.');
    }
  }

  public async getEmails(): Promise<GmailListResponse> {
    const response = await this.client?.callTool('gmail_list_emails', {
      maxResults: 10,
      query:
        'in:inbox is:unread newer_than:3d -category:promotions -category:social -category:forums',
    });
    return response;
  }

  public async batchInsertEmails(
    userId: string,
    messages: RawGmailMessage[]
  ): Promise<void> {
    if (messages.length === 0) {
      logger.info('No emails to insert.');
      return;
    }

    const formattedEmails: GmailMessage[] = messages.map(message => {
      const headers = message.headers.reduce(
        (acc, header) => {
          acc[header.name.toLowerCase()] = header.value;
          return acc;
        },
        {} as Record<string, string>
      );

      return {
        userId,
        messageId: message.id,
        threadId: message.threadId,
        subject: headers['subject'],
        body: message.textBody,
        receivedTime: new Date(parseInt(message.internalDate, 10)),
        isUnread: true, // Based on the query in getEmails
        importance: false, // Cannot determine from info, default to false
        fromAddress: headers['from'],
      };
    });

    try {
      await emailRepo.insertEmails(formattedEmails);
      logger.info(
        `Successfully processed ${formattedEmails.length} emails for potential insertion.`
      );
    } catch (error) {
      logger.error('Error inserting emails into database', {
        error,
        count: messages.length,
      });
      throw new Error('Failed to insert emails.');
    }
  }
}

export default new GmailService();
