import { JSX } from 'react/jsx-runtime';

// CHANGE THIS to a real file on your machine.
const TEST_PATH = 'C:\\test.mp3';

function toMediaUrl(absPath: string): string {
  return `media://file/${encodeURIComponent(absPath)}`;
}

export default function App(): JSX.Element {


  return (
    <div>Audio Player</div>
  );
}