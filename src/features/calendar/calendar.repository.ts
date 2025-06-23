import { query } from '@/shared/infrastructure/database';
import { CalendarEvent } from './calendar.dto';

export const insertCalendarEvents = async (
  events: Partial<CalendarEvent>[]
): Promise<{ id: string; google_event_id: string }[]> => {
  if (events.length === 0) {
    return [];
  }

  const values = events.map(event => [
    event.userId,
    event.googleEventId,
    event.title,
    event.description,
    event.startTime,
    event.endTime,
    event.location,
    JSON.stringify(event.attendees || null),
    JSON.stringify(event.organizer || null),
    event.status,
    event.htmlLink,
  ]);

  const text = `
    WITH input_rows (user_id, google_event_id, title, description, start_time, end_time, location, attendees, organizer, status, html_link) AS (
      SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::timestamptz[], $7::text[], $8::jsonb[], $9::jsonb[], $10::text[], $11::text[])
    ),
    inserted AS (
        INSERT INTO calendar_events (user_id, google_event_id, title, description, start_time, end_time, location, attendees, organizer, status, html_link)
        SELECT * FROM input_rows
        ON CONFLICT (user_id, google_event_id, start_time) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            location = EXCLUDED.location,
            attendees = EXCLUDED.attendees,
            organizer = EXCLUDED.organizer,
            status = EXCLUDED.status,
            html_link = EXCLUDED.html_link
        RETURNING id, google_event_id
    )
    SELECT id, google_event_id FROM inserted
    UNION ALL
    SELECT ce.id, ce.google_event_id FROM calendar_events ce
    JOIN input_rows i ON ce.user_id = i.user_id AND ce.google_event_id = i.google_event_id AND ce.start_time = i.start_time;
  `;

  const formattedValues = values[0].map((_, colIndex) =>
    values.map(row => row[colIndex])
  );

  const result = await query(text, formattedValues);
  return result.rows as { id: string; google_event_id: string }[];
};
