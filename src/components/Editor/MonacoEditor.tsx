import React, { useEffect, useRef } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Ensure @monaco-editor/react uses the same monaco instance that we register
// completion providers against, instead of loading a separate one from CDN.
loader.config({ monaco });

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  onFormat?: () => void;
  language?: string;
  schemaTables?: { name: string; columns: string[] }[];
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'TABLE', 'DATABASE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'LIMIT',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'ASC', 'DESC', 'DISTINCT', 'COUNT', 'SUM',
  'AVG', 'MAX', 'MIN', 'AS', 'VALUES', 'SET', 'INTO', 'TRUNCATE', 'WITH', 'UNION',
  'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'IFNULL',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'NOT NULL', 'DEFAULT',
];

const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'LENGTH', 'UPPER', 'LOWER', 'SUBSTRING',
  'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'CONCAT', 'COALESCE', 'NULLIF', 'ROUND',
  'ABS', 'FLOOR', 'CEILING', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'NOW', 'DATE_FORMAT', 'EXTRACT', 'STRFTIME', 'TO_CHAR', 'TO_DATE',
];

const SNIPPETS = [
  { label: 'select-all', insertText: 'SELECT *\nFROM ${1:table_name};', detail: 'SELECT all columns' },
  { label: 'select-where', insertText: 'SELECT *\nFROM ${1:table_name}\nWHERE ${2:condition};', detail: 'SELECT with WHERE' },
  { label: 'insert', insertText: 'INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values});', detail: 'INSERT INTO' },
  { label: 'update', insertText: 'UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};', detail: 'UPDATE' },
  { label: 'delete', insertText: 'DELETE FROM ${1:table_name}\nWHERE ${2:condition};', detail: 'DELETE' },
];

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  onExecute,
  onFormat,
  language = 'sql',
  schemaTables = [],
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const schemaTablesRef = useRef(schemaTables);

  useEffect(() => {
    schemaTablesRef.current = schemaTables;
  }, [schemaTables]);

  useEffect(() => {
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: monaco.languages.CompletionItem[] = [];
        const tables = schemaTablesRef.current;

        const lineContent = model.getLineContent(position.lineNumber);
        const charBefore = lineContent[position.column - 2];
        const isAfterDot = charBefore === '.';

        let previousWord = '';
        if (isAfterDot) {
          const textBefore = lineContent.substring(0, position.column - 2);
          const match = textBefore.match(/(\w+)(?:\s*\.\s*)?$/);
          previousWord = match ? match[1] : '';
        }

        if (isAfterDot) {
          const matchedTable = tables.find(
            (t) => t.name.toLowerCase() === previousWord.toLowerCase()
          );
          const targetTables = matchedTable ? [matchedTable] : tables;

          targetTables.forEach((table) => {
            table.columns.forEach((col) => {
              suggestions.push({
                label: col,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col,
                detail: `Column: ${col} (${table.name})`,
                sortText: `b_${col}`,
                range,
              });
            });
          });

          return { suggestions };
        }

        SQL_KEYWORDS.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            sortText: `c_${kw}`,
            range,
          });
        });

        SQL_FUNCTIONS.forEach((fn) => {
          suggestions.push({
            label: fn,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${fn}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `Function: ${fn}`,
            sortText: `d_${fn}`,
            range,
          });
        });

        SNIPPETS.forEach((snippet) => {
          suggestions.push({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snippet.detail,
            sortText: `e_${snippet.label}`,
            range,
          });
        });

        tables.forEach((table) => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table.name,
            detail: `Table: ${table.name}`,
            sortText: `a_${table.name}`,
            range,
          });

          table.columns.forEach((col) => {
            const fullLabel = `${table.name}.${col}`;
            suggestions.push({
              label: fullLabel,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: fullLabel,
              detail: `Column: ${col} (${table.name})`,
              sortText: `b_${fullLabel}`,
              range,
            });
          });
        });

        return { suggestions };
      },
    });

    return () => disposable.dispose();
  }, [language]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute?.();
    });
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        onFormat?.();
      }
    );
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
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
        suggest: {
          showKeywords: true,
          showSnippets: true,
          showFunctions: true,
          showClasses: true,
          showFields: true,
          filterGraceful: true,
          localityBonus: true,
        },
      }}
    />
  );
};
