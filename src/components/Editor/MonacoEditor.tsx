import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  language?: string;
  schemaTables?: { name: string; columns: string[] }[];
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  onExecute,
  language = 'sql',
  schemaTables = [],
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current && schemaTables.length > 0) {
      const disposable = monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions: monaco.languages.CompletionItem[] = [];

          // SQL keywords
          const keywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
            'TABLE', 'DATABASE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
            'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'LIMIT',
            'ORDER', 'BY', 'GROUP', 'HAVING', 'ASC', 'DESC', 'DISTINCT', 'COUNT', 'SUM',
            'AVG', 'MAX', 'MIN', 'AS', 'VALUES', 'SET', 'INTO', 'WHERE', 'TRUNCATE',
          ];
          keywords.forEach((kw) => {
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              range,
            });
          });

          // Schema tables
          schemaTables.forEach((table) => {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              detail: `Table: ${table.name}`,
              range,
            });

            table.columns.forEach((col) => {
              suggestions.push({
                label: `${table.name}.${col}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col,
                detail: `Column: ${col} (${table.name})`,
                range,
              });
            });
          });

          return { suggestions };
        },
      });

      return () => disposable.dispose();
    }
  }, [schemaTables]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute?.();
    });
  };

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={(v) => onChange(v || '')}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
};
