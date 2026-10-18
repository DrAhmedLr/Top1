'use client';
import {useEffect,useState} from 'react';
import {useAuth} from './providers/AuthProvider';
import {useTranslations} from './providers/LocaleProvider';
import {MetricIcon} from './MetricIcon';
import {normalizeGoalBoard,objectiveFor,type GoalBoardState} from '@/lib/potentialGoals';
import type {Values,Demographics} from '@/lib/registry';
export default function TodayMission({onOpen,values,demographics}:{onOpen:()=>void;values:Values;demographics:Demographics}){
 const auth=useAuth(),{t}=useTranslations(),owner=auth.user?.id??'guest';
 const [saved,setSaved]=useState<{owner:string;board:GoalBoardState}|null>(null);
 useEffect(()=>{setSaved(null);if(!auth.ready)return;try{const board=normalizeGoalBoard(JSON.parse(localStorage.getItem(`top1-goal-board-v1-${owner}`)??'null'));if(board)setSaved({owner,board});}catch{}},[auth.ready,owner]);
 if(!saved||saved.owner!==owner)return null;const board=saved.board;
 return <section className="card today-mission"><div><span className="eyebrow">{t('Your active mission')}</span><strong>{t('Top')} <bdi>{board.targetTop}%</bdi></strong><h2>{t('Your goals')}</h2><ul>{board.ids.map(id=>{const goal=objectiveFor(id,values,demographics,board.targetTop,board.targets[id]);return goal?<li key={id}><span className="metric-title"><MetricIcon id={id}/>{t(goal.metric.name)}</span> · {goal.targetTop?<>{t('Top')} <bdi>{goal.targetTop}</bdi></>:t('Record baseline')}</li>:null;})}</ul></div><button className="primary-button" onClick={onOpen}>{t('View my goals')}</button></section>;
}
