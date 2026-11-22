import {getSiteContent} from '@/lib/site-content';
import {ProgrammeSlider} from './programme-slider';
export async function Programmes(){const {programmes}=await getSiteContent();return <section id="our-work" className="chapter programmes-chapter"><div className="experience-container"><div className="chapter-heading" data-reveal><div><span className="chapter-tag">OUR WORK</span><h2>Care takes<br/><em>many forms.</em></h2></div><p>Different needs. One shared purpose.<br/>Discover how we stand with our community.</p></div><ProgrammeSlider programmes={programmes}/></div></section>}
