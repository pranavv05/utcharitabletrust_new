import {PageIntro,JoinBanner} from '@/components/shared';
import {Gallery} from '@/components/gallery';
export const metadata={title:'Our gallery'};
export default function GalleryPage(){return <><PageIntro eyebrow="Our gallery" title="Real people. Meaningful moments." description="A window into our community, our volunteers, and the everyday acts of care that bring us together."/><section className="page-content"><div className="container"><Gallery/></div></section><JoinBanner/></>}
