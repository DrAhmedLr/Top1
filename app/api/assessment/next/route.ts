import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {
  ASSESSMENT_GRAPH_VERSION,
  evaluateAssessmentStep,
  QUESTION_CATALOGUE,
  type AssessmentAnswers,
  type QuestionNodeId,
} from '@/lib/assessmentGraph';
import {readAccountCoachDecision} from '@/lib/coachServer';
import {validApiOrigin} from '@/lib/nativeApi';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

export async function GET() {
  return reply({
    graphVersion: ASSESSMENT_GRAPH_VERSION,
    catalogue: QUESTION_CATALOGUE,
  });
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  try {
    const raw = await request.text();
    if (raw.length > 16384) return reply({error: 'Request too large.'}, 413);
    const body = JSON.parse(raw) as {
      answers?: AssessmentAnswers;
      cursorNode?: QuestionNodeId;
      timeZone?: string;
    };
    const answers = body.answers ?? {};
    const client = await getSupabaseServer();
    let existingDossier = null;
    if (client) {
      const user = await currentAccount(client, request).catch(() => null);
      if (user) {
        const snap = await readAccountCoachDecision(client, user.id).catch(() => null);
        existingDossier = snap?.dossier ?? null;
      }
    }
    const evaluation = evaluateAssessmentStep(answers, {
      existingDossier,
      cursorNode: body.cursorNode,
      timeZone: body.timeZone,
    });
    return reply(evaluation);
  } catch {
    return reply({error: 'Invalid assessment input.'}, 400);
  }
}
