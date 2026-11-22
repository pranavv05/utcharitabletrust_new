'use client';
import {useState} from 'react';
import {Play} from 'lucide-react';
import {videoEmbed} from '@/lib/media';

/**
 * A YouTube/Vimeo link or an uploaded video. Third-party players load only after the visitor
 * presses play, which keeps pages fast and avoids tracking visitors who never watch.
 */
export function VideoEmbed({
  url,
  file,
  title,
  poster,
}: {
  url?: string;
  file?: string;
  title: string;
  poster?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const embed = videoEmbed(url);
  if (file)
    return (
      <video className="sx-video" controls preload="metadata" poster={poster || undefined} aria-label={title}>
        <source src={file} />
        Your browser cannot play this video.
      </video>
    );
  if (!embed) return null;
  return (
    <div className="sx-video">
      {playing ? (
        <iframe
          src={embed + (embed.includes('?') ? '&' : '?') + 'autoplay=1'}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="sx-video-play" onClick={() => setPlaying(true)}>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" />
          )}
          <span className="sx-video-icon">
            <Play size={28} fill="currentColor" />
          </span>
          <span className="sx-video-label">Play video: {title}</span>
        </button>
      )}
    </div>
  );
}
