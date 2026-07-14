import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import ArticleEditor from '@/components/admin/ArticleEditor'

// ArticleEditor doesn't expose its `editor` instance, so Finding 1 (duplicate Link
// extension) is verified with a standalone probe editor built from the exact same
// extensions array as ArticleEditor, inspecting `extensionManager.extensions`.

import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

function ProbeEditor({ onReady }: { onReady: (editor: any) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content: '<p>hi</p>',
    immediatelyRender: false,
  })
  React.useEffect(() => {
    if (editor) onReady(editor)
  }, [editor])
  return null
}

describe('ArticleEditor extension dedupe (Finding 1)', () => {
  it('registers exactly one Link extension when StarterKit link is disabled', async () => {
    let captured: any = null
    render(<ProbeEditor onReady={(e) => (captured = e)} />)
    await act(async () => {})
    expect(captured).toBeTruthy()
    const linkExtensions = captured.extensionManager.extensions.filter((e: any) => e.name === 'link')
    expect(linkExtensions).toHaveLength(1)
    expect(linkExtensions[0].options.openOnClick).toBe(false)
  })

  it('sanity check: WITHOUT the fix, two link extensions would register', async () => {
    let captured: any = null
    function BuggyProbe({ onReady }: { onReady: (editor: any) => void }) {
      const editor = useEditor({
        extensions: [
          StarterKit, // not configured to disable link
          Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
        ],
        content: '<p>hi</p>',
        immediatelyRender: false,
      })
      React.useEffect(() => {
        if (editor) onReady(editor)
      }, [editor])
      return null
    }
    render(<BuggyProbe onReady={(e) => (captured = e)} />)
    await act(async () => {})
    const linkExtensions = captured.extensionManager.extensions.filter((e: any) => e.name === 'link')
    expect(linkExtensions.length).toBe(2)
    // the first (StarterKit default) still has openOnClick true — the bug
    expect(linkExtensions[0].options.openOnClick).toBe(true)
  })
})

describe('ArticleEditor controlled value resync (Finding 2)', () => {
  it('renders initial value', async () => {
    let onChangeCalls = 0
    render(
      <ArticleEditor
        value="<p>Initial</p>"
        onChange={() => {
          onChangeCalls++
        }}
        userId="test-user-id"
      />
    )
    await act(async () => {})
    expect(screen.getByText('Initial')).toBeTruthy()
    // initial mount should not call onChange
    expect(onChangeCalls).toBe(0)
  })

  it('re-syncs editor content when value changes externally (e.g. async data load)', async () => {
    let onChangeCalls = 0
    const { rerender } = render(
      <ArticleEditor
        value=""
        onChange={() => {
          onChangeCalls++
        }}
        userId="test-user-id"
      />
    )
    await act(async () => {})

    // simulate parent fetching article data after mount
    rerender(
      <ArticleEditor
        value="<p>Loaded from server</p>"
        onChange={() => {
          onChangeCalls++
        }}
        userId="test-user-id"
      />
    )
    await act(async () => {})

    expect(screen.getByText('Loaded from server')).toBeTruthy()
    // setContent with emitUpdate:false must NOT trigger onUpdate -> onChange loop
    expect(onChangeCalls).toBe(0)
  })
})
