'use client';

import {useState} from 'react';
import Link from 'next/link';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Flame,
  LogIn,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Watch,
} from 'lucide-react';
import {Top1AthleteAvatar, Top1CoachMascot} from './Top1CoachMascot';
import {useTranslations} from './providers/LocaleProvider';
import s from './WelcomeGateway.module.css';

type Props = {
  onStartAssessment: () => void;
  onExploreAsGuest: () => void;
};

export default function WelcomeGateway({onStartAssessment, onExploreAsGuest}: Props) {
  const {locale} = useTranslations();
  const reducedMotion = useReducedMotion();
  const l = (en: string, fr: string, ar: string) =>
    locale === 'fr' ? fr : locale === 'ar' ? ar : en;

  const [slide, setSlide] = useState<0 | 1 | 2>(0);

  const slides = [
    {
      tab: l('Coach', 'Coach', 'المدرب'),
      speech: l(
        'Only have 20 minutes or no barbell today? I adapt your exact workout in one tap.',
        'Tu n’as que 20 minutes ou pas de barre aujourd’hui ? J’adapte ta séance en un geste.',
        'لديك 20 دقيقة فقط أو لا يتوفر بار اليوم؟ أعدّل حصتك فورًا بضغطة واحدة.',
      ),
      title: l('Your adaptive training game', 'Ton jeu d’entraînement adaptatif', 'تجربتك التدريبية التفاعلية'),
      desc: l(
        'Log sets, earn mastery, and let the engine adapt every session to your real week, equipment, and goals.',
        'Enregistre tes séances, progresse et laisse le moteur adapter chaque entraînement à ton emploi du temps.',
        'سجّل تمارينك وتابع تقدمك بينما يكيّف المحرك كل حصة مع وقتك ومعداتك وأهدافك.',
      ),
    },
    {
      tab: l('Body Map', 'Corps', 'العضلات'),
      speech: l(
        'Real 19-muscle recovery & strength — never inflated by junk sets.',
        'Récupération et force sur 19 muscles — jamais gonflées par du volume inutile.',
        'تعافٍ وقوة حقيقية لـ 19 عضلة — بدون تضخيم وهمي للرتب.',
      ),
      title: l('Smart physiology & watch sync', 'Physiologie réelle & montre connectée', 'فيزيولوجيا ذكية ومزامنة الساعة'),
      desc: l(
        'Tracks fractional sets, push:pull balance, and smartwatch HRV/sleep baselines so you push when fresh and protect recovery.',
        'Suit les séries fractionnées, l’équilibre poussée/tirage et ta VFC/sommeil pour pousser au bon moment.',
        'يتتبع حجم التمرين وتوازن العضلات ومؤشرات الساعة الذكية لحماية تعافيك وتطورك.',
      ),
    },
    {
      tab: l('Forecast', 'Prévision', 'التوقعات'),
      speech: l(
        'Rest days never break your streak. Your forecast updates from real results.',
        'Les jours de repos ne cassent jamais ta série. Tes prévisions suivent tes vrais résultats.',
        'أيام الراحة لا تكسر سلسلتك أبدًا، وتوقعاتك تتحدث وفق نتائجك الفعلية.',
      ),
      title: l('Honest odds & rest-safe streaks', 'Probabilités honnêtes & séries durables', 'توقعات صادقة وسلاسل تحمي الراحة'),
      desc: l(
        'See both what happens if you follow the plan and at your recent pace — with automatic maintenance once you reach your target.',
        'Compare ton rythme réel au plan prévu — avec maintien automatique dès que l’objectif est atteint.',
        'قارن بين مسار الخطة ووتيرتك الحالية مع انتقال تلقائي لخطة الحفاظ بعد تحقيق الهدف.',
      ),
    },
  ] as const;

  const renderSlideVisual = (activeIndex: number) => {
    if (activeIndex === 0) {
      return (
        <>
          <Top1CoachMascot mood="greet" theme="neutral" size={88} />
          <div className={s.speechBubble}>{slides[0].speech}</div>
          <div className={s.previewCard}>
            <div className={s.metricRow}>
              <strong>{l('Tuesday · Bench Press', 'Mardi · Développé couché', 'الثلاثاء · ضغط الصدر')}</strong>
              <span className={`${s.metricTag} ${s.tagBoost}`}>20 min</span>
            </div>
            <div className={s.metricRow} style={{color: 'var(--gw-muted)'}}>
              <span>{l('Adapted 45m → 18m · 2 heavy sets kept', 'Adapté 45m → 18m · 2 séries clés gardées', 'تعديل 45د ← 18د · الحفاظ على المجموعات الأساسية')}</span>
            </div>
          </div>
        </>
      );
    }
    if (activeIndex === 1) {
      return (
        <>
          <Top1AthleteAvatar age={30} theme="neutral" pose="wave" size={112} />
          <div className={s.previewCard}>
            <div className={s.metricRow}>
              <span>{l('Mid Chest · Recovery', 'Pectoraux · Récupération', 'الصدر · التعافي')}</span>
              <span className={`${s.metricTag} ${s.tagFresh}`}>94% {l('Fresh', 'Prêt', 'جاهز')}</span>
            </div>
            <div className={s.barTrack}><div className={s.barFill} style={{width: '94%'}} /></div>
            <div className={s.metricRow}>
              <span>{l('Upper Back · Balance', 'Haut du dos · Équilibre', 'أعلى الظهر · التوازن')}</span>
              <span className={`${s.metricTag} ${s.tagBoost}`}>{l('Priority +25', 'Priorité +25', 'أولوية +25')}</span>
            </div>
            <div className={s.metricRow} style={{color: 'var(--gw-muted)'}}>
              <span>{l('Watch HRV & Sleep Ready', 'VFC & sommeil montre prêts', 'جاهز لبيانات الساعة والنوم')}</span>
              <span>RMSSD</span>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <Top1AthleteAvatar age={30} theme="neutral" pose="celebrate" size={112} />
        <div className={s.previewCard}>
          <div className={s.metricRow}>
            <strong>{l('Bench 80 → 100 kg', 'Développé 80 → 100 kg', 'ضغط الصدر 80 ← 100 كغ')}</strong>
            <span className={`${s.metricTag} ${s.tagFresh}`}>76% {l('on plan', 'selon le plan', 'وفق الخطة')}</span>
          </div>
          <div className={s.metricRow}>
            <span>{l('Weekly Streak (2 days/wk)', 'Série hebdo (2 j/sem)', 'السلسلة الأسبوعية')}</span>
            <span className={`${s.metricTag} ${s.tagAmber}`}>
              <Flame size={12} style={{display: 'inline', verticalAlign: '-2px'}} /> 4 wks · {l('Rest safe', 'Repos protégé', 'الراحة محمية')}
            </span>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className={s.gateway}>
      {/* === MOBILE FULL-SCREEN GAME INTRO WORKFLOW (< 900px) === */}
      <section className={s.mobileFlow} aria-label={l('Welcome to TOP1', 'Bienvenue sur TOP1', 'مرحبًا بك في TOP1')}>
        <header className={s.mobileTopBar}>
          <span className={s.brandMark} dir="ltr">
            <span className={s.brandBars} aria-hidden="true"><i /><i /><i /></span>
            TOP1<span className={s.brandPct}>%</span>
          </span>
          <Link href="/sign-in" className={s.signInPill}>
            <LogIn size={14} aria-hidden="true" />
            {l('Sign in', 'Connexion', 'تسجيل الدخول')}
          </Link>
        </header>

        <div className={s.progressPills} role="tablist" aria-label={l('Intro steps', 'Étapes', 'الخطوات')}>
          {[0, 1, 2].map(idx => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={slide === idx}
              aria-label={`Slide ${idx + 1}`}
              className={s.progressPill}
              data-active={slide === idx}
              data-done={slide > idx}
              onClick={() => setSlide(idx as 0 | 1 | 2)}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`mob-${slide}`}
            className={s.mobileStage}
            initial={reducedMotion ? false : {opacity: 0, x: 24}}
            animate={{opacity: 1, x: 0}}
            exit={reducedMotion ? undefined : {opacity: 0, x: -24}}
            transition={{duration: 0.22}}
          >
            {renderSlideVisual(slide)}
            <h1 className={s.slideTitle}>{slides[slide].title}</h1>
            <p className={s.slideDesc}>{slides[slide].desc}</p>
          </motion.div>
        </AnimatePresence>

        <div className={s.ctaStack}>
          {slide < 2 ? (
            <>
              <button
                type="button"
                className={s.primary3d}
                onClick={() => setSlide((slide + 1) as 0 | 1 | 2)}
              >
                {l('Next', 'Suivant', 'التالي')} <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button type="button" className={s.secondaryBtn} onClick={onStartAssessment}>
                <Sparkles size={16} aria-hidden="true" />
                {l('Start assessment now', 'Démarrer le bilan', 'ابدأ التقييم الآن')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={s.primary3d} onClick={onStartAssessment}>
                <Sparkles size={17} aria-hidden="true" />
                {l('Start my assessment', 'Démarrer mon bilan', 'ابدأ تقييمي الآن')}
              </button>
              <Link href="/sign-in" className={s.secondaryBtn}>
                <LogIn size={16} aria-hidden="true" />
                {l('I already have an account — Sign in', 'J’ai déjà un compte — Connexion', 'لدي حساب بالفعل — تسجيل الدخول')}
              </Link>
            </>
          )}
          <button type="button" className={s.ghostLink} onClick={onExploreAsGuest}>
            {l('Explore tracker without setup →', 'Explorer sans bilan →', 'تصفح التطبيق مباشرة ←')}
          </button>
        </div>
      </section>

      {/* === DESKTOP HOMEPAGE WITH FULL WEB LOGIN (>= 900px) === */}
      <div className={s.desktopSite}>
        <header className={s.desktopNav}>
          <span className={s.brandMark} dir="ltr">
            <span className={s.brandBars} aria-hidden="true"><i /><i /><i /></span>
            TOP1<span className={s.brandPct}>%</span>
          </span>
          <nav className={s.navLinks} aria-label={l('Primary links', 'Navigation', 'التنقل')}>
            <Link href="/about" className={s.navLink}>{l('Science & Methodology', 'Science & Méthode', 'العلم والمنهجية')}</Link>
            <button type="button" className={s.navLink} onClick={onExploreAsGuest}>
              {l('Web Dashboard', 'Tableau de bord Web', 'لوحة الويب')}
            </button>
            <Link href="/privacy" className={s.navLink}>{l('Privacy', 'Confidentialité', 'الخصوصية')}</Link>
          </nav>
          <div className={s.navActions}>
            <Link href="/sign-in" className={s.desktopLoginBtn}>
              <LogIn size={15} aria-hidden="true" />
              {l('Log in', 'Connexion', 'تسجيل الدخول')}
            </Link>
            <button type="button" className={s.desktopStartBtn} onClick={onStartAssessment}>
              {l('Get started', 'Commencer', 'ابدأ الآن')} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className={s.heroGrid}>
          <div className={s.heroCopy}>
            <span className={s.eyebrow}>
              <Smartphone size={14} aria-hidden="true" />
              {l('Mobile game feel · Full desktop web access', 'Expérience mobile ludique · Accès web complet', 'تجربة هاتف ممتعة · وصول كامل عبر الحاسوب')}
            </span>
            <h1 className={s.heroTitle}>
              {l(
                'Adaptive training that fits your real week — and proves what works.',
                'Un coaching adaptatif calé sur ta vraie semaine — basé sur des preuves.',
                'تدريب ذكي يتكيف مع أسبوعك الحقيقي ويثبت ما ينجح فعليًا.',
              )}
            </h1>
            <p className={s.heroSubtitle}>
              {l(
                'Log and level up seamlessly on your phone, or sign in right here on desktop to review your 19-muscle recovery map, customize exercises, sync smartwatch readiness, and inspect honest goal forecasts.',
                'Enregistre tes séances sur mobile ou connecte-toi sur ordinateur pour suivre tes 19 groupes musculaires, synchroniser ta montre et piloter tes prévisions.',
                'سجّل تمارينك بمتعة على الهاتف أو سجّل دخولك هنا على الحاسوب لمتابعة خريطة تعافي 19 عضلة وبيانات الساعة وتوقعات أهدافك.',
              )}
            </p>
            <div className={s.heroCtaRow}>
              <button
                type="button"
                className={`${s.primary3d} ${s.heroPrimaryBtn}`}
                onClick={onStartAssessment}
              >
                <Sparkles size={17} aria-hidden="true" />
                {l('Start 90-second assessment', 'Démarrer le bilan (90 s)', 'ابدأ التقييم (90 ثانية)')}
              </button>
              <Link href="/sign-in" className={`${s.secondaryBtn} ${s.heroSecondaryBtn}`}>
                <LogIn size={16} aria-hidden="true" />
                {l('Log in on desktop', 'Connexion ordinateur', 'تسجيل الدخول عبر الويب')}
              </Link>
            </div>
            <div className={s.trustRow}>
              <span className={s.trustItem}><CheckCircle2 size={15} color="#34d399" /> {l('19-muscle recovery & balance', 'Récupération sur 19 muscles', 'تعافي وتوازن 19 عضلة')}</span>
              <span className={s.trustItem}><CheckCircle2 size={15} color="#34d399" /> {l('Smartwatch HRV & sleep ready', 'VFC & sommeil montre prêts', 'متوافق مع الساعة الذكية')}</span>
              <span className={s.trustItem}><CheckCircle2 size={15} color="#34d399" /> {l('Rest days protect your streak', 'Repos protégés dans la série', 'الراحة تحمي سلسلتك')}</span>
            </div>
          </div>

          <div className={s.phoneFrameWrap}>
            <div className={s.phoneFrame}>
              <div className={s.phoneNotch} aria-hidden="true" />
              <div className={s.phoneTabs} role="tablist">
                {slides.map((item, idx) => (
                  <button
                    key={item.tab}
                    type="button"
                    role="tab"
                    aria-selected={slide === idx}
                    className={s.phoneTab}
                    data-active={slide === idx}
                    onClick={() => setSlide(idx as 0 | 1 | 2)}
                  >
                    {item.tab}
                  </button>
                ))}
              </div>
              <div className={s.phoneStage}>
                {renderSlideVisual(slide)}
              </div>
              <button type="button" className={s.primary3d} onClick={onStartAssessment}>
                {l('Try interactive onboarding', 'Essayer le bilan interactif', 'جرّب التقييم التفاعلي')}
              </button>
            </div>
            <button type="button" className={s.ghostLink} onClick={onExploreAsGuest}>
              {l('Or open the desktop web dashboard as a guest →', 'Ou ouvrir le tableau de bord en invité →', 'أو افتح لوحة الويب كضيف ←')}
            </button>
          </div>
        </main>

        <section className={s.featureGrid} aria-label={l('Engine highlights', 'Points forts du moteur', 'مزايا المحرك')}>
          <article className={s.featureCard}>
            <span className={s.featureIcon}><Activity size={20} /></span>
            <h2>{l('Real Physiology, Not Junk-Volume Ranks', 'Physiologie réelle, pas du volume gonflé', 'فيزيولوجيا حقيقية لا رتبًا وهمية')}</h2>
            <p>
              {l(
                'Separates allometric strength capability from local muscle recovery, counts fractional sets (1.0 / 0.5 / 0.25), enforces MEV–MRV ceilings, and catches push:pull imbalances.',
                'Sépare la force allométrique de la récupération locale, compte les séries fractionnées et détecte les déséquilibres poussée/tirage.',
                'يفصل القوة الحقيقية عن التعافي الموضعي، ويحسب المجموعات الجزئية، ويكتشف اختلالات التوازن العضلي.',
              )}
            </p>
          </article>
          <article className={s.featureCard}>
            <span className={s.featureIcon}><Watch size={20} /></span>
            <h2>{l('Self-Optimizing & Smartwatch Ready', 'Auto-optimisé & prêt pour votre montre', 'ذاتي التحسين وجاهز للساعة الذكية')}</h2>
            <p>
              {l(
                'Learns your personal recovery speed and volume ceiling from logged performance drop-offs, while fusing personal RMSSD HRV, resting HR, and sleep baselines.',
                'Apprend votre vitesse de récupération personnelle et fusionne vos bases VFC RMSSD, FC au repos et sommeil.',
                'يتعلم سرعة تعافيك وحد الحجم الخاص بك، ويدمج مؤشرات HRV والنوم والنبض من الساعة الذكية.',
              )}
            </p>
          </article>
          <article className={s.featureCard}>
            <span className={s.featureIcon}><ShieldCheck size={20} /></span>
            <h2>{l('Log on Mobile, Manage on Desktop', 'Enregistrez sur mobile, gérez sur ordinateur', 'سجّل على الهاتف وتابع على الحاسوب')}</h2>
            <p>
              {l(
                'One synced account across mobile and desktop web. Create custom exercises, check in offline, correct mistakes cleanly, and keep full control of your data.',
                'Un compte synchronisé mobile + ordinateur. Créez vos exercices, validez vos séances hors-ligne et gardez le contrôle total.',
                'حساب واحد متزامن بين الهاتف والويب مع إمكانية إضافة تمارين مخصصة والتحكم الكامل ببياناتك.',
              )}
            </p>
          </article>
        </section>

        <footer className={s.desktopFooter}>
          <span>TOP1% — {l('Evidence-grounded adaptive training', 'Entraînement adaptatif fondé sur les preuves', 'تدريب تكيفي قائم على الأدلة')}</span>
          <div className={s.footerLinks}>
            <Link href="/sign-in">{l('Log in', 'Connexion', 'تسجيل الدخول')}</Link>
            <Link href="/about">{l('About', 'À propos', 'حول')}</Link>
            <Link href="/privacy">{l('Privacy', 'Confidentialité', 'الخصوصية')}</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
