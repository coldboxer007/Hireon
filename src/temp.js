import * as fs from 'fs';
import * as path from 'path';

const dtsPath = path.resolve('node_modules/@google/genai/dist/genai.d.ts');
const content = fs.readFileSync(dtsPath, 'utf-8');

const lines = content.split('\n');
let inClass = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Transcription {')) {
    inClass = true;
  }
  if (inClass) {
    console.log(lines[i]);
    if (lines[i].startsWith('}')) {
      inClass = false;
      break;
    }
  }
}
