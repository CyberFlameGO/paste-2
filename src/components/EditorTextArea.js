import React, { useCallback, useEffect, useRef, useState } from 'react';
import history from 'history/browser';
import Editor from '@monaco-editor/react';
import styled from 'styled-components';
import themes, { makeMonacoTheme } from '../style/themes';

export default function EditorTextArea({
  forcedContent,
  actualContent,
  setActualContent,
  theme,
  language,
  fontSize,
  readOnly,
}) {
  const [editor, setEditor] = useState();
  const [monaco, setMonaco] = useState();
  const [selected, toggleSelected] = useSelectedLine();
  const editorAreaRef = useRef();
  useLineNumberMagic(
    editorAreaRef,
    selected,
    toggleSelected,
    forcedContent,
    editor,
    monaco
  );
  usePlaceholderText(actualContent, editor, monaco);

  function beforeMount(monaco) {
    for (const [id, theme] of Object.entries(themes)) {
      monaco.editor.defineTheme(id, makeMonacoTheme(theme));
    }

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  }

  function onMount(editor, monaco) {
    editor.addAction({
      id: 'search',
      label: 'Search with Google',
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 5,
      run: (editor) => {
        const selection = editor.getSelection()
        if (!selection.isEmpty()) {
          const query = editor.getModel().getValueInRange(selection);
          window.open('https://www.google.com/search?q=' + query, '_blank');
        }
      }
    })

    setEditor(editor);
    setMonaco(monaco);

    editor.focus();
  }

  const onChange = useCallback(
    value => {
      setActualContent(value);
    },
    [setActualContent]
  );

  // detect indentation whenever new forced content is set
  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.getModel().detectIndentation(true, 2);
  }, [editor, forcedContent])

  return (
    <EditorArea ref={editorAreaRef}>
      <Editor
        theme={theme.id}
        language={language === 'plain' ? 'plaintext' : language}
        options={{
          fontFamily: 'JetBrains Mono',
          fontSize: fontSize,
          fontLigatures: true,
          wordWrap: true,
          renderLineHighlight: 'none',
          renderValidationDecorations: false,
          readOnly,
          domReadOnly: readOnly,
        }}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={onChange}
        value={forcedContent}
      />
    </EditorArea>
  );
}

const EditorArea = styled.main`
  margin-top: 2.5em;
  height: 100%;

  .line-numbers {
    cursor: pointer !important;
  }

  .highlighted-line + div {
    color: ${props => props.theme.editor.lineNumberHl};
    background-color: ${props => props.theme.editor.lineNumberHlBackground};
    font-weight: bold;
  }

  .placeholder-text {
    position: absolute;
    opacity: 0.5;
    font-weight: lighter;

    &::after {
      content: 'Paste (or type) some code...';
    }
  }
`;

function usePlaceholderText(actualContent, editor, monaco) {
  useEffect(() => {
    if (!editor || !monaco || actualContent) {
      return;
    }
    const decoration = {
      range: new monaco.Range(1, 1, 1, 1),
      options: {
        after: {
          content: '\u200B',
          inlineClassName: 'placeholder-text',
        },
      },
    };
    const decorations = editor.deltaDecorations([], [decoration]);

    return () => {
      editor.deltaDecorations(decorations, []);
    };
  }, [editor, monaco, actualContent]);
}

function useLineNumberMagic(
  editorAreaRef,
  selected,
  toggleSelected,
  forcedContent,
  editor,
  monaco
) {
  // add an event listener for clicking on line numbers
  useEffect(() => {
    const node = editorAreaRef.current;
    if (!node) {
      return;
    }

    const handler = click => {
      const target = click?.target;
      if (target && target.classList.contains('line-numbers')) {
        toggleSelected(parseInt(target.textContent), click);
      }
    };

    node.addEventListener('click', handler);
    return () => node.removeEventListener('click', handler);
  }, [editorAreaRef, toggleSelected]);

  // apply a 'highlighed' decoration to the selected lines
  // and scroll them into view if not already
  useEffect(() => {
    if (!editor || !monaco || selected[0] === -1) {
      return;
    }

    // apply a decoration
    const newDecorations = [
      {
        range: new monaco.Range(selected[0], 1, selected[1], 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: 'highlighted-line',
        },
      },
    ];
    const decorations = editor.deltaDecorations([], newDecorations);

    // scroll the selected line into view
    if (selected[0] === selected[1]) {
      editor.revealLineInCenterIfOutsideViewport(selected[0]);
    } else {
      editor.revealLinesInCenterIfOutsideViewport(selected[0], selected[1]);
    }

    // cleanup by removing the decorations
    return () => {
      editor.deltaDecorations(decorations, []);
    };
  }, [editor, monaco, selected, forcedContent]);
}

function useSelectedLine() {
  // extract highlighted lines from window hash
  const [selected, setSelected] = useState(() => {
    const hash = window.location.hash;
    if (/^#L\d+(-\d+)?$/.test(hash)) {
      const [start, end] = hash.substring(2).split('-').map(Number);
      return [start, isNaN(end) ? start : end];
    } else {
      return [-1, -1];
    }
  });

  // update window hash when a new line is highlighted
  useEffect(() => {
    let hash = '';

    if (selected[0] !== -1) {
      if (selected[1] !== selected[0]) {
        const start = Math.min(...selected);
        const end = Math.max(...selected);
        hash = `#L${start}-${end}`;
      } else {
        hash = `#L${selected[0]}`;
      }
    }

    history.replace({ hash });
  }, [selected]);

  // toggle the highlighting for a given line
  function toggleSelected(lineNo, e) {
    const shift = e.shiftKey;
    if (selected[0] === lineNo && selected[1] === lineNo) {
      setSelected([-1, -1]);
    } else if (selected[0] === -1 || !shift) {
      setSelected([lineNo, lineNo]);
    } else {
      setSelected([selected[0], lineNo]);
    }
  }

  return [selected, toggleSelected];
}
