'use client';
import {useTranslations} from './providers/LocaleProvider';
export default function PotentialComingSoon(){const {locale}=useTranslations();return <section className="potential-teaser" aria-label="My Potential coming soon"><div className="goal-orbit" aria-hidden="true"><i/><i/><i/><span>↗</span></div><p className="soon-label">{locale==='fr'?'Bientôt':locale==='ar'?'قريبًا':'Coming soon'}</p><h2>A New Way<br/>To Set <em>GOALS</em></h2><div className="teaser-line" aria-hidden="true"><span/></div></section>;}
