import { createAnthropic } from '@ai-sdk/anthropic';
import dotenv from 'dotenv';
import readline from 'readline';
import { randomUUID } from 'crypto';
import { sendMessage } from '@messages/chat';
import { messageHistory } from '@messages/history';

// Load environment variables
dotenv.config();

// ANSI color codes for terminal formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';
const model = anthropic(MODEL);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `\n${colors.bold}${colors.cyan}🤖 You:${colors.reset} `,
});

// Generate unique user ID for this session
const userId = randomUUID();

console.log(
  `${colors.bold}${colors.green}🚀 Welcome to Interactive Claude Chat!${colors.reset}`
);
console.log(
  `${colors.yellow}💡 Type 'exit', 'quit', or press Ctrl+C to end the conversation${colors.reset}`
);
console.log(
  `${colors.yellow}🗑️  Type 'clear' to clear conversation history${colors.reset}`
);
console.log(
  `${colors.yellow}📊 Type 'history' to see conversation statistics${colors.reset}`
);
console.log('─'.repeat(60));

// Handle user input
rl.on('line', async input => {
  const userInput = input.trim();

  // Handle special commands
  if (
    userInput.toLowerCase() === 'exit' ||
    userInput.toLowerCase() === 'quit'
  ) {
    console.log(
      `\n${colors.bold}${colors.green}👋 Goodbye! Thanks for chatting!${colors.reset}`
    );
    rl.close();
    return;
  }

  if (userInput.toLowerCase() === 'clear') {
    messageHistory.clearHistory(userId);
    console.log(
      `\n${colors.bold}${colors.yellow}🗑️  Conversation history cleared!${colors.reset}`
    );
    rl.prompt();
    return;
  }

  if (userInput.toLowerCase() === 'history') {
    const pairCount = messageHistory.getMessagePairCount(userId);
    console.log(
      `\n${colors.bold}${colors.blue}📊 Conversation statistics:${colors.reset}`
    );
    console.log(`   • Message pairs: ${pairCount}`);
    console.log(
      `   • Total messages: ${messageHistory.getHistory(userId).length}`
    );
    rl.prompt();
    return;
  }

  if (!userInput) {
    rl.prompt();
    return;
  }

  try {
    process.stdout.write(
      `\n${colors.bold}${colors.magenta}🤖 Claude:${colors.reset}`
    );

    // Send message and stream response
    await sendMessage(model, userInput, userId);

    rl.prompt();
  } catch (error) {
    console.error(
      `\n${colors.bold}${colors.red}❌ Error:${colors.reset}`,
      error instanceof Error ? error.message : error
    );
    rl.prompt();
  }
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log(
    `\n\n${colors.bold}${colors.green}👋 Goodbye! Thanks for chatting!${colors.reset}`
  );
  process.exit(0);
});

// Start the conversation
rl.prompt();
