# Braintrust Conditional Logging Demo

A simple test to understand how Braintrust handles conditional logging with user feedback.

## What This Tests

This project tests whether you can log AI interactions to Braintrust **only when users provide feedback**, rather than logging everything automatically.

## What We Learned

### ❌ The Problem
- **Braintrust's `wrapOpenAI()` function automatically logs ALL requests** to Braintrust
- **No way to disable this automatic logging** while keeping the wrapper's metrics
- **Using the Braintrust AI proxy URL also forces automatic logging**

### ✅ The Solution
Make the API call **first**, then ask for user feedback, then:
- **If user gives feedback**: Initialize Braintrust and log the interaction manually
- **If user skips feedback**: Don't initialize Braintrust at all

## Quick Start

1. **Install**: `pnpm install`
2. **Set keys**: 
   ```bash
   export BRAINTRUST_API_KEY="your_key"
   export OPENAI_API_KEY="your_key"
   ```
3. **Run test**: `pnpm test`

## How It Works

```typescript
// 1. Make API call FIRST (no Braintrust involved)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.chat.completions.create({...});

// 2. Show response to user and ask for feedback
const userFeedback = await waitForUserThumbsUp();

// 3. Only initialize Braintrust if user gives feedback
if (userFeedback) {
  const logger = initLogger({
    projectName: "limitless-repro",
    apiKey: process.env.BRAINTRUST_API_KEY,
    asyncFlush: false,
  });

  await logger.traced(async (parent) => {
    parent.log({ input: messages, output: response, ... });
    await parent.flush();
  });
}
```

## Test Modes

- **Single test**: `pnpm test` - One interaction with feedback prompt

## User Feedback Options

When prompted, you can:
- **1** - 👍 Thumbs up (logs to Braintrust)
- **2** - 👎 Thumbs down (logs to Braintrust)  
- **3** - 💬 Add comment + thumbs up (logs to Braintrust)
- **4** - 💬 Add comment + thumbs down (logs to Braintrust)
- **Enter** - Skip feedback (no logging)

## What Gets Logged

When user provides feedback, the following is logged to Braintrust:
- **Input**: The prompt sent to OpenAI
- **Output**: The response from OpenAI
- **Metadata**: Model info, parameters, timestamps
- **Metrics**: Token usage, timing, latency
- **User Feedback**: Quality score (0 or 1), comment

## Key Takeaway

**Braintrust's automatic logging cannot be disabled.** The only way to conditionally log is to:
1. Make API calls first (without Braintrust)
2. Ask for feedback after showing the response
3. Only initialize Braintrust when you want to log

This approach gives you complete control over what gets logged while avoiding any automatic logging.

## Files

- `src/test.ts` - Main entry point
- `src/logging.ts` - Core test logic and feedback collection
- `package.json` - Dependencies and scripts

## Dependencies

- **braintrust**: For conditional logging
- **openai**: For API calls
- **dotenv**: For environment variables
- **typescript**: For type safety 