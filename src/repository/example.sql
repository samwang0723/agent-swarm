-- Find overlapping/conflict meetings
SELECT *
FROM calendar_events a
JOIN calendar_events b
  ON a.user_id = b.user_id AND a.id != b.id
WHERE a.user_id = $1
  AND a.start_time < b.end_time
  AND a.end_time > b.start_time;

-- Summarize unread important emails
SELECT subject, body
FROM emails
WHERE user_id = $1 AND is_unread = TRUE AND importance = 'high'
ORDER BY received_time DESC
LIMIT 10;

-- Find user’s next meeting
SELECT *
FROM calendar_events
WHERE user_id = $1 AND start_time > NOW()
ORDER BY start_time
LIMIT 1;