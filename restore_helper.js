const fs = require('fs');
const path = require('path');

const targetConvs = [
  '170db463-3302-4e8f-acb9-0aa623f6c11f', // Styling page, StylingPreview, cashback_notification
  '3aaae9a7-7cd1-4933-aa6a-dda646f5a858', // cashback_notification updates
  'fab17e29-3747-4178-9712-a3815217e85d'  // customer-account-ui files
];

targetConvs.forEach(convId => {
  const logPath = `C:\\Users\\aarti\\.gemini\\antigravity\\brain\\${convId}\\.system_generated\\logs\\overview.txt`;
  console.log(`--- Checking ${convId} at ${logPath} ---`);
  if (!fs.existsSync(logPath)) {
    console.log(`Log file not found for ${convId}`);
    return;
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);

  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      // Let's print type and check for tool_calls or content changes
      let found = false;
      if (parsed.tool_calls) {
        parsed.tool_calls.forEach(tc => {
          if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            console.log(`Line ${idx + 1}: Tool Call: ${tc.name}`);
            if (tc.args) {
              const file = tc.args.TargetFile || tc.args.Targetfile || tc.args.targetFile;
              console.log(`   Target: ${file}`);
            }
          }
        });
      }
      if (parsed.content && parsed.content.includes('write_to_file')) {
        console.log(`Line ${idx + 1}: Mentions write_to_file in content`);
      }
    } catch (e) {
      // Not JSON or parse error
    }
  });
});
