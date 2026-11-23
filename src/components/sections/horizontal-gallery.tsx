import Link from 'next/link';
import {getSiteContent} from '@/lib/site-content';
import {uniquePeople} from '@/lib/media';
import {MomentsReel, type Moment} from './moments-reel';

/**
 * "People. Not just pictures.": every gallery photograph, with the real numbers of the people behind the
 * work slipped in. The data is picked here, on the server, so the browser only receives what the row shows.
 */
export async function HorizontalGallery() {
  const {gallery, team, colleges, partners} = await getSiteContent();
  const moments: Moment[] = gallery.map((photo, i) => ({
    type: 'photo',
    key: 'photo-' + i,
    photo: {src: photo.src, caption: photo.caption, category: photo.category, year: photo.year},
  }));
  const stats: Moment[] = [];
  const people = uniquePeople(team).length;
  if (people)
    stats.push({
      type: 'stat',
      key: 'stat-team',
      figure: people,
      label: people === 1 ? 'Trust member' : 'Trust members',
      detail: 'who guide the work',
      href: '/team',
      cta: 'Meet the team',
    });
  const interns = colleges.reduce((sum, c) => sum + c.interns, 0);
  if (interns)
    stats.push({
      type: 'stat',
      key: 'stat-interns',
      figure: interns,
      label: interns === 1 ? 'Intern' : 'Interns',
      detail: `from ${colleges.length} ${colleges.length === 1 ? 'college' : 'colleges'}`,
      href: '/interns',
      cta: 'See where they study',
    });
  if (partners.length)
    stats.push({
      type: 'stat',
      key: 'stat-partners',
      figure: partners.length,
      label: partners.length === 1 ? 'Partner' : 'Partners',
      detail: 'who stand with us',
      href: '/partners',
      cta: 'Meet our partners',
    });
  // The people counts go a quarter, half and three quarters of the way along.
  stats.forEach((stat, i) =>
    moments.splice(Math.round((moments.length * (i + 1)) / (stats.length + 1)) + i, 0, stat),
  );
  return (
    <section id="moments" className="chapter horizontal-chapter photo-moments">
      <div className="experience-container gallery-chapter-head">
        <div>
          <span className="chapter-tag">THROUGH OUR LENS</span>
          <h2>
            People.
            <br />
            <em>Not just pictures.</em>
          </h2>
          <p className="moments-lead">Moments from our work and the people who make it happen.</p>
        </div>
        <Link href="/gallery" className="outlined-link">
          Explore gallery
        </Link>
      </div>
      <MomentsReel moments={moments} />
    </section>
  );
}
