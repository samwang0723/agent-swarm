import * as calendarRepo from './calendar.repository';
import {
  GoogleCalendarEvent,
  CalendarEvent,
  GoogleCalendarListResponse,
} from './calendar.dto';
import logger from '@/shared/utils/logger';
import { McpClient } from '@/features/mcp/mcp.service';
import { mcpServers } from '@/shared/config/mcp';

export class CalendarService {
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
      logger.error('Error initializing Calendar service', { error });
      throw new Error('Failed to initialize Calendar service.');
    }
  }

  public async getCalendarEvents(): Promise<GoogleCalendarListResponse> {
    if (!this.client) {
      throw new Error('Calendar service not initialized.');
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.

    const startOfWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - dayOfWeek
    );

    const endOfNextWeek = new Date(startOfWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 14); // Two weeks from start of week
    endOfNextWeek.setMilliseconds(-1); // End of the day before

    const response = await this.client.callTool('gcalendar_list_events', {
      timeMin: startOfWeek.toISOString(),
      timeMax: endOfNextWeek.toISOString(),
      maxResults: 50,
    });
    return response as GoogleCalendarListResponse;
  }

  private parseEventTime(eventTime: {
    date?: string;
    dateTime?: string;
  }): Date {
    return new Date(eventTime.dateTime || eventTime.date!);
  }

  public async batchInsertCalendarEvents(
    userId: string,
    events: GoogleCalendarEvent[]
  ): Promise<(CalendarEvent & { id: string })[]> {
    if (events.length === 0) {
      logger.info('No calendar events to insert.');
      return [];
    }

    const formattedEvents: CalendarEvent[] = events.map(event => ({
      userId,
      googleEventId: event.id,
      title: event.summary,
      description: event.description,
      startTime: this.parseEventTime(event.start),
      endTime: this.parseEventTime(event.end),
      location: event.location,
      attendees: event.attendees,
      organizer: event.organizer,
      status: event.status,
      htmlLink: event.htmlLink,
    }));

    try {
      const inserted = await calendarRepo.insertCalendarEvents(formattedEvents);

      const fullInsertedEvents = formattedEvents
        .map(formattedEvent => {
          const dbRecord = inserted.find(
            i => i.google_event_id === formattedEvent.googleEventId
          );
          return {
            ...formattedEvent,
            id: dbRecord?.id,
          };
        })
        .filter((e): e is CalendarEvent & { id: string } => !!e.id);

      return fullInsertedEvents;
    } catch (error) {
      logger.error('Error inserting calendar events into database', {
        error,
        count: events.length,
      });
      throw new Error('Failed to insert calendar events.');
    }
  }
}

export default new CalendarService();
