import { recordedCoverage } from '@/lib/coverage';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getPublicProfile } from '@/lib/publicProfile';
import { pillars } from '@/lib/registry';
import { toModelScore } from '@/lib/engine';
import { MODEL_VERSION } from '@/lib/model';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');
    const profile = username ? await getPublicProfile(username) : null;
    if (username && !profile) {
      return new Response('Profile not found', {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const s = profile?.summary;
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#0F0A18',
            color: '#FAFAFA',
            padding: '44px 56px',
            fontFamily: 'sans-serif',
            backgroundImage:
              'radial-gradient(ellipse at top left, rgba(89,185,249,.20), transparent 55%), radial-gradient(ellipse at bottom right, rgba(180,101,208,.18), transparent 55%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, letterSpacing: 3, color: '#59B9F9' }}>
              TOP1% · PERFORMANCE OS
            </div>
            <div
              style={{
                display: 'flex',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 30,
                padding: '10px 22px',
                fontSize: 17,
                color: '#C8C2D6',
              }}
            >
              {s ? `${recordedCoverage(s.measured).toFixed(1)}% COVERAGE` : 'SCIENTIFIC FITNESS & COACHING'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 50 }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: 580, gap: 18 }}>
              <span style={{ fontSize: 16, color: '#9CA3AF', letterSpacing: 2 }}>
                SCIENCE-BACKED BENCHMARKS &amp; ADAPTIVE COACHING
              </span>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  borderLeft: '5px solid #59B9F9',
                  paddingLeft: 24,
                }}
              >
                <span style={{ fontSize: 18, color: '#59B9F9', letterSpacing: 2, fontWeight: 800 }}>
                  TOP1% PERFORMANCE INDEX
                </span>
                <span style={{ fontSize: s?.ready ? 77 : 56, fontWeight: 900, letterSpacing: -2 }}>
                  {s?.ready ? s.modelScore.toFixed(1) : 'Train smarter. Rank higher.'}
                </span>
                {s?.ready && <span style={{ fontSize: 22, color: '#C8C2D6' }}>model points / 100</span>}
              </div>
              <span style={{ fontSize: 21, color: '#C8C2D6' }}>
                {profile
                  ? `@${profile.username} · ${profile.demographics.ageCohort}${profile.demographics.sex === 'unselected' ? '' : ` · ${profile.demographics.sex}`}`
                  : 'BodyMarkers · Strength · Recovery · 19-Muscle Physiology'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', width: 410, gap: 27 }}>
              {pillars.map((p) => {
                const z = s?.domains[p.id];
                const points = z === undefined ? undefined : toModelScore(z);
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22 }}>
                      <span>{p.name}</span>
                      <span style={{ color: p.color }}>
                        {points === undefined ? 'Ready' : `${points.toFixed(1)} pts`}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        width: '100%',
                        height: 11,
                        borderRadius: 7,
                        background: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          width: `${points ?? 78}%`,
                          height: '100%',
                          borderRadius: 7,
                          background:
                            p.id === 'bodymarkers'
                              ? 'linear-gradient(90deg,#59B9F9,#B465D0)'
                              : p.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 20,
              fontSize: 15,
              color: '#9CA3AF',
            }}
          >
            <span>
              {s && s.modelVersion !== MODEL_VERSION
                ? 'Signed historical snapshot · Self-reported metrics'
                : 'Self-reported benchmarks · Transparent scientific model · top1.fit'}
            </span>
            <span style={{ color: '#59B9F9', fontWeight: 700 }}>top1.fit →</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return new Response('Unable to render card', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
