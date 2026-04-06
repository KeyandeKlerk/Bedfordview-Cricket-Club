/*
 * TO REPLACE PLACEHOLDERS WITH REAL PHOTOS:
 * 1. Place images in /public/gallery/ (e.g. match-day-1.jpg)
 * 2. import Image from 'next/image'
 * 3. Replace .gallery-item-inner div with:
 *    <Image src="/gallery/match-day-1.jpg" alt="Match Day" fill
 *           className="gallery-img" sizes="25vw" />
 *    Add CSS: .gallery-img { object-fit: cover; }
 */

type GalleryItem = {
  id: number
  label: string
  sublabel: string
  gradient: string
  tall: boolean
}

const GALLERY_ITEMS: GalleryItem[] = [
  { id: 1,  label: 'Match Day',        sublabel: 'vs Eastern Suburbs',      gradient: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', tall: true  },
  { id: 2,  label: 'Training',         sublabel: 'Pre-season nets',          gradient: 'linear-gradient(135deg, #0f2044, #1d4ed8)', tall: false },
  { id: 3,  label: 'Club Day',         sublabel: 'Season opener celebrations', gradient: 'linear-gradient(135deg, #0369a1, #2563eb)', tall: false },
  { id: 4,  label: 'Awards Night',     sublabel: 'End of season dinner',     gradient: 'linear-gradient(135deg, #1e3a5f, #0ea5e9)', tall: true  },
  { id: 5,  label: 'Junior Nets',      sublabel: 'Development programme',    gradient: 'linear-gradient(135deg, #172554, #3b82f6)', tall: false },
  { id: 6,  label: 'Finals Day',       sublabel: 'Easterns League Final',    gradient: 'linear-gradient(135deg, #0c4a6e, #38bdf8)', tall: true  },
  { id: 7,  label: 'Ground Setup',     sublabel: 'Van Buuren Rd ground',     gradient: 'linear-gradient(135deg, #1e40af, #0284c7)', tall: false },
  { id: 8,  label: 'Team Photo',       sublabel: '2024/25 Season squad',     gradient: 'linear-gradient(135deg, #0f172a, #1d4ed8)', tall: true  },
  { id: 9,  label: 'Batting Practice', sublabel: 'Pre-match warm-up',        gradient: 'linear-gradient(135deg, #1e3a5f, #0369a1)', tall: false },
  { id: 10, label: 'Post-Match',       sublabel: 'Celebrations after win',   gradient: 'linear-gradient(135deg, #0f2044, #0ea5e9)', tall: false },
  { id: 11, label: 'Community Day',    sublabel: 'Club open day',            gradient: 'linear-gradient(135deg, #1d4ed8, #6366f1)', tall: true  },
  { id: 12, label: 'Trophy',           sublabel: 'League champions',         gradient: 'linear-gradient(135deg, #0c4a6e, #2563eb)', tall: false },
]

export default function GalleryPage() {
  return (
    <>
      <style>{`
        .page-hero {
          padding: calc(var(--nav-h) + 60px) 0 60px;
          text-align: center;
        }
        .page-hero h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.03em;
          margin: 12px 0 16px;
        }
        .page-hero-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 17px;
          color: rgba(147,197,253,0.6);
          max-width: 480px;
          margin: 0 auto;
          line-height: 1.65;
        }
        @media (max-width: 768px) {
          .page-hero { padding-top: calc(var(--nav-h) + 36px); }
          .page-hero-sub { font-size: 15px; }
        }
        .gallery-masonry {
          columns: 2;
          column-gap: 16px;
          padding: 48px 0 80px;
        }
        @media (min-width: 640px)  { .gallery-masonry { columns: 3; } }
        @media (min-width: 900px)  { .gallery-masonry { columns: 4; } }

        .gallery-item {
          break-inside: avoid;
          margin-bottom: 16px;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(59,130,246,0.12);
          transition: border-color 0.2s, transform 0.2s;
          cursor: pointer;
        }
        .gallery-item:hover {
          border-color: rgba(96,165,250,0.3);
          transform: translateY(-2px);
        }
        .gallery-item-inner {
          width: 100%;
        }
        .gallery-item-inner.tall  { height: 300px; }
        .gallery-item-inner.short { height: 200px; }
        .gallery-item-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 32px 14px 14px;
          background: linear-gradient(0deg, rgba(5,12,26,0.85) 0%, transparent 100%);
        }
        .gallery-item-label {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 800;
          color: #e2eeff;
          letter-spacing: -0.01em;
          margin-bottom: 2px;
        }
        .gallery-item-sublabel {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          color: rgba(147,197,253,0.6);
        }
      `}</style>

      <div className="page-hero">
        <div className="container">
          <div className="section-label">Club Photos</div>
          <h1>Gallery</h1>
          <p className="page-hero-sub">
            Moments from the field, training ground, and club events.
          </p>
        </div>
      </div>

      <div className="container">
        <div className="gallery-masonry">
          {GALLERY_ITEMS.map(item => (
            <div key={item.id} className="gallery-item">
              <div
                className={`gallery-item-inner ${item.tall ? 'tall' : 'short'}`}
                style={{ background: item.gradient }}
              />
              <div className="gallery-item-overlay">
                <div className="gallery-item-label">{item.label}</div>
                <div className="gallery-item-sublabel">{item.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
