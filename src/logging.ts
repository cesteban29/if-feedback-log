/**
 * This file contains the core logic for testing Braintrust's conditional logging.
 * It demonstrates a flow where an LLM call is made first, its response is shown
 * to a user, and only after the user provides feedback is the entire interaction
 * logged to Braintrust. This prevents logging events that do not receive feedback.
 */
import { initLogger } from 'braintrust';
import OpenAI from 'openai';
import * as readline from 'readline';

// Defines the structure for user feedback.
interface UserFeedback {
  thumbsUp: boolean;
  comment?: string;
}

// Defines the structure for the overall test result object.
interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  response?: string;
  userFeedback?: UserFeedback;
}

/**
 * Prompts the user for feedback via the command line.
 * It presents a menu of options (thumbs up/down, with or without comment)
 * and waits for the user's selection.
 * @returns A Promise that resolves with a UserFeedback object, or undefined if the user skips.
 */
async function waitForUserThumbsUp(): Promise<UserFeedback | undefined> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n🤔 How was this response?');
    console.log('1. 👍 Thumbs up (good response)');
    console.log('2. 👎 Thumbs down (bad response)');
    console.log('3. 💬 Add comment and thumbs up');
    console.log('4. 💬 Add comment and thumbs down');
    console.log('Press Enter to skip feedback.');
    
    rl.question('Enter your choice (1-4, or Enter to skip): ', (choice) => {
      switch (choice.trim()) {
        case '1':
          rl.close();
          resolve({ thumbsUp: true });
          break;
        case '2':
          rl.close();
          resolve({ thumbsUp: false });
          break;
        case '3':
          rl.question('Enter your comment: ', (comment) => {
            rl.close();
            resolve({ thumbsUp: true, comment });
          });
          break;
        case '4':
          rl.question('Enter your comment: ', (comment) => {
            rl.close();
            resolve({ thumbsUp: false, comment });
          });
          break;
        case '':
          rl.close();
          resolve(undefined); // No feedback was provided.
          break;
        default:
          console.log('Invalid choice, skipping feedback.');
          rl.close();
          resolve(undefined);
      }
    });
  });
}

/**
 * The main test function. It follows a specific sequence:
 * 1. Make an API call to OpenAI directly, without any Braintrust wrappers.
 * 2. Display the response to the user.
 * 3. Ask the user for feedback on the response.
 * 4. If and only if the user provides feedback, initialize Braintrust and log
 *    the entire interaction, including input, output, metrics, and feedback.
 * @returns A Promise that resolves with a TestResult object.
 */
export async function runConditionalLoggingTest(): Promise<TestResult> {
  try {
    // Ensure the necessary API key is set in the environment.
    if (!process.env.BRAINTRUST_API_KEY) {
      throw new Error('BRAINTRUST_API_KEY environment variable is required');
    }

    console.log('🚀 Starting Braintrust conditional logging test...');

    // Define the prompt and message structure for the LLM call.
    const prompt = "Explain quantum computing in simple terms for a 10-year-old.";
    const messages = [{ role: "user" as const, content: prompt }];

    console.log(`🤖 Sending prompt to OpenAI: "${prompt}"`);

    // STEP 1: Make the API call FIRST using OpenAI directly.
    // This is crucial to avoid any automatic logging from Braintrust wrappers
    // before we know if the user will provide feedback.
    console.log('📡 Making OpenAI API call...');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Time the API call to capture latency.
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 300,
      temperature: 0.7,
    });
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // duration in seconds

    // Extract the response content.
    const response = completion.choices[0]?.message?.content || 'No response received';

    // STEP 2: Display the response to the user.
    console.log(`📤 OpenAI response: "${response}"`);
    console.log(`⏱️ LLM call took ${duration} seconds.`);

    // STEP 3: Ask for user feedback.
    console.log('\n⏳ Waiting for user feedback...');
    const userFeedback = await waitForUserThumbsUp();

    // STEP 4: Conditionally log to Braintrust based on feedback.
    if (userFeedback) {
      // User provided feedback, so proceed with Braintrust logging.
      console.log('✅ User provided feedback - logging to Braintrust...');
      
      const logger = initLogger({
        projectName: "limitless-repro",
        apiKey: process.env.BRAINTRUST_API_KEY,
        asyncFlush: false, // We will manually flush the logs.
      });

      console.log('✅ Logger initialized with asyncFlush: false');

      // Use logger.traced to create a span. We specify the type as 'llm'
      // to ensure Braintrust recognizes it correctly and populates LLM-specific fields.
      await logger.traced(async (parent) => {
        console.log('📝 Logging interaction to Braintrust...');

        // Log all relevant data in a single, structured call.
        parent.log({
          input: messages, // The full message payload.
          output: response, // The string response.
          metadata: {
            model: "gpt-4o-mini",
            temperature: 0.7,
            max_tokens: 300,
            timestamp: new Date().toISOString()
          },
          // Provide metrics, including the exact start and end times for accurate duration.
          metrics: {
            start: startTime / 1000,
            end: endTime / 1000,
            prompt_tokens: completion.usage?.prompt_tokens,
            completion_tokens: completion.usage?.completion_tokens,
            total_tokens: completion.usage?.total_tokens,
          }
        });

        console.log('📊 Logged input/output/metrics to Braintrust (buffered)');
        
        // Log the structured user feedback.
        logger.logFeedback({
          id: parent.id,
          scores: {
            quality: userFeedback.thumbsUp ? 1 : 0,
          },
          comment: userFeedback.comment,
          metadata: {
            timestamp: new Date().toISOString()
          }
        });

        console.log(`👤 User feedback logged: ${userFeedback.thumbsUp ? '👍' : '👎'}${userFeedback.comment ? ` - "${userFeedback.comment}"` : ''}`);
        
        // Manually flush the logs to send them to the Braintrust server.
        console.log('🚀 User provided feedback - flushing data to Braintrust...');
        await parent.flush();
        console.log('✅ Data successfully flushed to Braintrust!');
      }, { name: "Manual LLM Call", type: "llm" });

      return {
        success: true,
        message: 'Data logged and flushed successfully',
        response,
        userFeedback
      };

    } else {
      // No feedback was provided, so no Braintrust interaction occurs.
      console.log('⚠️ No user feedback provided. No logs sent to Braintrust.');
      
      return {
        success: false,
        message: 'No user feedback provided. No data logged to Braintrust.',
        response
      };
    }

  } catch (error) {
    console.error('❌ Error during Braintrust logging test:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: error
    };
  }
}

// Export for use in other files
export { waitForUserThumbsUp };