import { LanguageModelUsage, ToolCall, ToolResult } from 'ai';
import { ClientLocation, LoggableEvent, TimeRange } from './conversation.dto';
import { calculateCost } from '../../shared/utils/costs';
import { getCurrentModelInfo } from '../../shared/config/models';
import logger from '../../shared/utils/logger';

export const sessionCostCache = new Map<string, number>();

// Helper function to check if a tool is detected in the intent result
export const isToolDetected = (
  detectedTools: string[] | undefined,
  toolName: string
): boolean => {
  return detectedTools ? detectedTools.includes(toolName) : false;
};

// Maps detected intent tools to a specific agent ID
export const mapIntentToAgent = (
  detectedTools: string[]
): string | undefined => {
  if (isToolDetected(detectedTools, 'email')) {
    return 'google_assistant';
  }
  if (isToolDetected(detectedTools, 'calendar')) {
    return 'google_assistant';
  }
  if (isToolDetected(detectedTools, 'restaurant')) {
    return 'restaurant_recommendation';
  }
  if (isToolDetected(detectedTools, 'websearch')) {
    return 'web_search';
  }
  if (isToolDetected(detectedTools, 'confluence')) {
    return 'atlassian';
  }
  if (isToolDetected(detectedTools, 'jira')) {
    return 'atlassian';
  }
  return undefined;
};

// Extract client IP from request headers
export const extractClientIP = (
  headers: Record<string, string | string[] | undefined>
): string | null => {
  // Try various headers in order of preference
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  for (const header of ipHeaders) {
    const value = headers[header];
    if (value) {
      const ip = Array.isArray(value) ? value[0] : value;
      // X-Forwarded-For can contain multiple IPs, take the first one
      const firstIP = ip.split(',')[0].trim();
      if (firstIP && firstIP !== '127.0.0.1' && firstIP !== '::1') {
        return firstIP;
      }
    }
  }

  return null;
};

// Get timezone from IP using a free geolocation service
export const getTimezoneFromIP = async (
  ip: string
): Promise<ClientLocation | null> => {
  try {
    // Using ipapi.co as it's free and doesn't require API key for basic usage
    const response = await fetch(`https://ipapi.co/${ip}/json/`);

    if (!response.ok) {
      logger.warn(`Failed to get location from IP ${ip}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      timezone?: string;
      country_name?: string;
      city?: string;
      error?: boolean;
    };

    if (data.timezone && !data.error) {
      return {
        timezone: data.timezone,
        country: data.country_name,
        city: data.city,
      };
    }

    return null;
  } catch (error) {
    logger.warn('Error fetching timezone from IP:', error);
    return null;
  }
};

// Helper function to detect client timezone from request headers
export const detectClientTimezone = async (
  headers: Record<string, string | string[] | undefined>
): Promise<string> => {
  // Try to get timezone from client IP first
  const clientIP = extractClientIP(headers);

  if (clientIP) {
    logger.info(`Detected client IP: ${clientIP}`);
    const location = await getTimezoneFromIP(clientIP);

    if (location?.timezone) {
      logger.info(
        `Detected timezone from IP: ${location.timezone} (${location.city}, ${location.country})`
      );
      return location.timezone;
    }
  }

  // Fallback to client-provided timezone header
  const clientTimezoneHeader = headers['x-client-timezone'];
  if (clientTimezoneHeader) {
    const timezone = Array.isArray(clientTimezoneHeader)
      ? clientTimezoneHeader[0]
      : clientTimezoneHeader;

    // Validate that it's a valid timezone string
    try {
      // Test if the timezone is valid by trying to use it
      new Date().toLocaleString('en-US', { timeZone: timezone });
      logger.info(`Using client-provided timezone from header: ${timezone}`);
      return timezone;
    } catch (error) {
      logger.warn(`Invalid timezone provided in header: ${timezone}`);
    }
  }

  // Final fallback to UTC if we can't determine timezone
  logger.info('Could not determine client timezone, falling back to UTC');
  return 'UTC';
};

// Helper function to extract client datetime from request headers
export const extractClientDateTime = (
  headers: Record<string, string | string[] | undefined>
): string | null => {
  const clientDateTimeHeader = headers['x-client-datetime'];
  if (clientDateTimeHeader) {
    const datetime = Array.isArray(clientDateTimeHeader)
      ? clientDateTimeHeader[0]
      : clientDateTimeHeader;

    // Validate that it's a valid ISO datetime string
    try {
      const parsedDate = new Date(datetime);
      if (!isNaN(parsedDate.getTime())) {
        logger.info(`Using client-provided datetime from header: ${datetime}`);
        return datetime;
      }
    } catch (error) {
      logger.warn(`Invalid datetime provided in header: ${datetime}`);
    }
  }

  // Return null if no valid datetime found
  logger.debug('No valid client datetime found in headers');
  return null;
};

export const extractTimeRange = (
  message: string,
  timezone: string = 'UTC'
): TimeRange | null => {
  const lowerCaseMessage = message.toLowerCase();

  // Helper function to get start and end of day in the specified timezone
  const getStartOfDay = (date: Date): string => {
    const start = new Date(
      date.toLocaleString('en-US', { timeZone: timezone })
    );
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  };

  const getEndOfDay = (date: Date): string => {
    const end = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  };

  // Get current date in the user's timezone
  const now = new Date();
  const nowInTimezone = new Date(
    now.toLocaleString('en-US', { timeZone: timezone })
  );

  // Check for relative dates
  if (lowerCaseMessage.includes('today')) {
    return {
      from: getStartOfDay(nowInTimezone),
      to: getEndOfDay(nowInTimezone),
    };
  }

  if (lowerCaseMessage.includes('yesterday')) {
    const yesterday = new Date(nowInTimezone);
    yesterday.setDate(nowInTimezone.getDate() - 1);
    return {
      from: getStartOfDay(yesterday),
      to: getEndOfDay(yesterday),
    };
  }

  if (lowerCaseMessage.includes('tomorrow')) {
    const tomorrow = new Date(nowInTimezone);
    tomorrow.setDate(nowInTimezone.getDate() + 1);
    return {
      from: getStartOfDay(tomorrow),
      to: getEndOfDay(tomorrow),
    };
  }

  // Check for specific date patterns
  const datePatterns = [
    // YYYY-MM-DD
    /(\d{4}-\d{1,2}-\d{1,2})/g,
    // MM/DD/YYYY or DD/MM/YYYY
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // Month DD, YYYY (e.g., "January 15, 2024")
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi,
    // DD Month YYYY (e.g., "15 January 2024")
    /\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi,
    // Month DD (current year assumed, e.g., "January 15")
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
  ];

  for (const pattern of datePatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      try {
        const dateStr = matches[0];
        let parsedDate: Date;

        // Handle different date formats
        if (dateStr.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
          // YYYY-MM-DD format
          parsedDate = new Date(dateStr);
        } else if (dateStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          // MM/DD/YYYY format (assuming US format)
          parsedDate = new Date(dateStr);
        } else {
          // Natural language dates
          parsedDate = new Date(dateStr);
          // If no year specified, assume current year
          if (
            dateStr.match(
              /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}$/i
            )
          ) {
            parsedDate.setFullYear(nowInTimezone.getFullYear());
          }
        }

        if (!isNaN(parsedDate.getTime())) {
          // Convert the parsed date to the user's timezone
          const dateInTimezone = new Date(
            parsedDate.toLocaleString('en-US', { timeZone: timezone })
          );
          return {
            from: getStartOfDay(dateInTimezone),
            to: getEndOfDay(dateInTimezone),
          };
        }
      } catch (error) {
        logger.warn(`Failed to parse date string: ${matches[0]}`, error);
        // Continue to next pattern
      }
    }
  }

  // Fallback if no specific date found
  return null;
};

export function logTokenUsage(
  sessionId: string,
  { promptTokens, completionTokens, totalTokens }: LanguageModelUsage
) {
  const modelInfo = getCurrentModelInfo();
  const cost = calculateCost(
    modelInfo.modelName,
    promptTokens,
    completionTokens
  );

  const currentCost = sessionCostCache.get(sessionId) || 0;
  if (cost) {
    sessionCostCache.set(sessionId, currentCost + cost);
  }

  logger.info({
    message: 'Token Usage',
    sessionId,
    promptTokens,
    completionTokens,
    totalTokens,
    cost: `$${cost?.toFixed(6)}`,
    totalCost: `$${(currentCost + (cost || 0)).toFixed(6)}`,
  });
}

// Placeholder for tool logging
// Helper function for safe object-to-string conversion with truncation
export function safeStringify(
  value: unknown,
  maxLength: number = 1000
): string {
  try {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    let stringified: string;
    if (typeof value === 'string') {
      stringified = value;
    } else if (typeof value === 'object') {
      stringified = JSON.stringify(value);
    } else {
      stringified = String(value);
    }

    return stringified.length > maxLength
      ? stringified.substring(0, maxLength) + '...'
      : stringified;
  } catch (error) {
    // Fallback for circular references or other JSON.stringify errors
    return `[Object: ${typeof value}]`;
  }
}

// Safe preview utility that handles string operations on unknown types
export function safePreview(
  value: unknown,
  maxLength: number = 100
): { preview: string; originalLength: number } {
  if (typeof value === 'string') {
    return {
      preview:
        value.length > maxLength
          ? value.substring(0, maxLength) + '...'
          : value,
      originalLength: value.length,
    };
  }

  // For non-string values, convert to safe string representation
  const stringified = safeStringify(value, maxLength * 2); // Allow more room for conversion
  const preview =
    stringified.length > maxLength
      ? stringified.substring(0, maxLength) + '...'
      : stringified;

  return {
    preview,
    originalLength: stringified.length,
  };
}

export function logToolInformation(sessionId: string, event: LoggableEvent) {
  logTokenUsage(sessionId, event.usage as LanguageModelUsage);
  logger.info(
    `Step finished - Type: ${event.stepType}, Tools: ${
      event.toolCalls?.length || 0
    }, Results: ${event.toolResults?.length || 0}`
  );

  if (event.toolCalls && event.toolCalls.length > 0) {
    logger.info(
      'Tool calls:',
      event.toolCalls.map(
        (tc: ToolCall<string, unknown>) =>
          `${tc.toolName}(${JSON.stringify(tc.args)})`
      )
    );
  }

  if (event.toolResults && event.toolResults.length > 0) {
    logger.info(
      'Tool results:',
      event.toolResults.map((tr: ToolResult<string, unknown, unknown>) => {
        const jsonStr = JSON.stringify(tr.result);
        const truncated =
          jsonStr.length > 100 ? jsonStr.slice(0, 300) + '...' : jsonStr;
        return `${tr.toolName}: ${truncated}`;
      })
    );
  }
}
