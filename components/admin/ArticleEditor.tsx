'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { supabase } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/images/resize'
import { uploadNewsImage } from '@/lib/supabase/storage'

const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes: { align?: string }) => ({
          'data-align': attributes.align,
          class: `article-img align-${attributes.align ?? 'center'}`,
        }),
      },
    }
  },
})

type ArticleEditorProps = {
  value: string
  onChange: (html: string) => void
  userId: string
}

async function insertImageFile(editor: Editor, file: File, userId: string) {
  if (!file.type.startsWith('image/')) return
  let blob: Blob
  try {
    blob = await resizeImageFile(file)
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'Image processing failed.')
    return
  }
  const { url, error } = await uploadNewsImage(supabase, blob, userId, 'jpg')
  if (error || !url) { window.alert(`Image upload failed: ${error ?? 'unknown error'}`); return }
  editor.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run()
}

export default function ArticleEditor({ value, onChange, userId }: ArticleEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // editorProps callbacks are created once by Tiptap, before `editor` exists —
  // a ref lets them reach the current editor instance without stale closures.
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      AlignableImage,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0]
        if (!file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        insertImageFile(editorRef.current!, file, userId)
        return true
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.items ?? [])
          .find(item => item.type.startsWith('image/'))
          ?.getAsFile()
        if (!file) return false
        insertImageFile(editorRef.current!, file, userId)
        return true
      },
    },
  })

  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  const onPickImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file && editor) insertImageFile(editor, file, userId)
  }, [editor, userId])

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
        .tiptap-content img.article-img { max-width: 100%; border-radius: 8px; display: block; }
        .tiptap-content img.align-left { float: left; margin: 0 16px 12px 0; max-width: 45%; }
        .tiptap-content img.align-right { float: right; margin: 0 0 12px 16px; max-width: 45%; }
        .tiptap-content img.align-center { margin: 12px auto; }
        .tiptap-content img.align-full { width: 100%; margin: 12px 0; }
      `}</style>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
      <div className="tiptap-toolbar">
        <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`} onClick={setLink}>Link</button>
        <button type="button" className="tiptap-btn" onClick={() => fileInputRef.current?.click()}>🖼 Image</button>
        {editor.isActive('image') && (
          <>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()}>⯇ Left</button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()}>▬ Center</button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()}>⯈ Right</button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'full' }).run()}>⬛ Full</button>
          </>
        )}
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </>
  )
}
