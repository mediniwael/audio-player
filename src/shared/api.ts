/* eslint-disable prettier/prettier */
export interface AppApi {
  ping: () => Promise<string>;
  notes: {
    list: () => Promise<Note[]>;
    add: (text: string) => Promise<Note[]>;
  };
}

export interface Note {
  id: number;
  text: string;
}