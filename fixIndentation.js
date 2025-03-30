const fs = require('fs');
const path = 'admin/public/js/main.js';

fs.readFile(path, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file ${path}:`, err);
    process.exit(1); // Exit with error code
  }

  // Simple indentation correction: Ensure indentation is multiple of 2 spaces
  // This is a basic approach and might not be perfect for all cases.
  const correctedData = data
    .split('\n')
    .map((line) => {
      const leadingWhitespace = line.match(/^\s+/);
      if (leadingWhitespace) {
        // Calculate nearest even number of spaces
        const currentIndent = leadingWhitespace[0].length;
        // Use 2 spaces per indent level as a common standard
        const newIndentLength = Math.round(currentIndent / 2) * 2;
        return ' '.repeat(newIndentLength) + line.trimStart();
      } else {
        return line;
      }
    })
    .join('\n');

  fs.writeFile(path, correctedData, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing corrected file ${path}:`, err);
      process.exit(1); // Exit with error code
    }
    console.log(`File indentation corrected successfully: ${path}`);
  });
});
