import Link from 'next/link';
export default function NotFound(){return <section className="error-page"><div className="eyebrow" style={{justifyContent:'center'}}>A little off the path</div><h1>Page not found.</h1><p>Let’s get you back to the community.</p><Link className="button" href="/">Back to home</Link></section>}
