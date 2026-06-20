const fs = require('fs');
let s = fs.readFileSync('client/src/pages/spotify.tsx', 'utf8');

// Find the closing of the isFreePlan block and the next </div>
const marker = '                  )}';
const closingDiv = '\n                </div>';
const nextLine = '\n              </div>';
const afterTarget = '\n              <div className="w-full lg:w-[300px]';

// Normalize to \n for matching
const norm = s.replace(/\r\n/g, '\n');

const searchStr = marker + closingDiv + nextLine + afterTarget;
if (norm.includes(searchStr)) {
  const badge = '\n                  <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">Limited Time Offer (Apr 2026)</span>';
  const replaceStr = marker + badge + closingDiv + nextLine + afterTarget;
  const updated = norm.replace(searchStr, replaceStr);
  // Restore CRLF if original had it
  const finalContent = s.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
  fs.writeFileSync('client/src/pages/spotify.tsx', finalContent);
  console.log('Badge added successfully');
} else {
  console.log('Target pattern not found');
  // Debug: show surrounding content
  const idx = norm.indexOf('isFreePlan');
  if (idx > 0) {
    const chunk = norm.substring(idx, idx + 500);
    console.log('Context around isFreePlan:', JSON.stringify(chunk));
  }
}
