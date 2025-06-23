/**
 * This is the main entry point for the test.
 * It initializes the environment and runs the conditional logging test once.
 */
import 'dotenv/config';
import { runConditionalLoggingTest } from './logging';

async function runTest() {
  console.log('🧠 Braintrust Conditional Logging Test');
  console.log('=====================================\n');

  try {
    const result = await runConditionalLoggingTest();
    console.log('\n📋 Final Result:', result.success ? 'SUCCESS' : 'FAILURE');
    console.log('Message:', result.message);
  } catch (error) {
    console.error('❌ A critical error occurred:', error);
    process.exit(1);
  }
}

runTest(); 