'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

type ArticleEditorProps = {
  value: string
  onChange: (html: string) => void
}

export default function ArticleEditor({ value, onChange }: ArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  const setLink = () => {
    const url = window.prompt('Link URL:', editor.getAttributes('link').href ?? '')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <>
      <style>{`
        .tiptap-toolbar {
          display: flex; flex-wrap: wrap; gap: 4px;
          padding: 8px; border: 1px solid rgba(59,130,246,0.2);
          border-bottom: none; border-radius: 8px 8px 0 0;
          background: rgba(10,22,40,0.6);
        }
        .tiptap-btn {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          padding: 6px 10px; border-radius: 6px; border: 1px solid transparent;
          background: transparent; color: rgba(147,197,253,0.7); cursor: pointer;
          transition: all 0.15s;
        }
        .tiptap-btn:hover { background: rgba(59,130,246,0.12); color: #93c5fd; }
        .tiptap-btn.is-active { background: rgba(59,130,246,0.2); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
        .tiptap-content {
          border: 1px solid rgba(59,130,246,0.2); border-radius: 0 0 8px 8px;
          background: rgba(10,22,40,0.6); padding: 14px; min-height: 360px;
          color: #e2eeff; font-family: 'Outfit', sans-serif; font-size: 14px; line-height: 1.7;
        }
        .tiptap-content .ProseMirror { outline: none; min-height: 340px; }
        .tiptap-content p { margin: 0 0 1em 0; }
        .tiptap-content h2, .tiptap-content h3 { font-family: 'Syne', sans-serif; color: #f0f8ff; margin: 1em 0 0.5em; }
        .tiptap-content a { color: #38bdf8; }
      `}</style>
      <div className="tiptap-toolbar">
        <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`} onClick={setLink}>Link</button>
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </>
  )
}
