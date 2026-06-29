import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export type EditorStatus = {
  label: string;
  publishedAt?: string;
  viewCount?: number;
  progress?: number;
  words?: number;
  readingMinutes?: number;
  language?: string;
};

export const EditorStatusContext = createContext<Dispatch<SetStateAction<EditorStatus>>>(() => undefined);

export function useSetEditorStatus() {
  return useContext(EditorStatusContext);
}
