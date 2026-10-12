import { JSX, useEffect, useState } from 'react';
import type { Note } from '../../shared/api';

export default function App(): JSX.Element {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    window.api.notes.list().then(setNotes);
  }, []);

  async function add(): Promise<void> {
    if (!text.trim()) return;
    const updated = await window.api.notes.add(text);
    setNotes(updated);
    setText('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') void add();
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Notes spike</h1>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a note and press Enter"
        style={{ padding: 8, width: 320 }}
      />
      <button onClick={add} style={{ padding: 8, marginLeft: 8 }}>
        Add
      </button>
      <ul style={{ marginTop: 16 }}>
        {notes.map((n) => (
          <li key={n.id}>{n.text}</li>
        ))}
      </ul>
    </div>
  );
}