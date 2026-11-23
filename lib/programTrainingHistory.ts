import {dayInZone} from './adaptiveProgram';
import type {TrainingContext} from './personalWorkspace';
import {latestTraining,type TrainingEvent,type Workout} from './training';

// Plan from sessions the athlete actually finished when availability is unspecified.
// Overlapping workout logs on one local day count their shared time only once.
export function programContextFromHistory(context:TrainingContext,events:TrainingEvent[],now=new Date()):TrainingContext {
  if (context.days!==undefined && context.minutes!==undefined) return context;
  const end=now.getTime(), dayMs=86_400_000, zone=context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today=Date.parse(dayInZone(now,zone));
  const visits=new Map<string, {start:number;end:number}[]>();
  for(const event of latestTraining(events.filter(e=>Date.parse(e.recordedAt)<=end))) {
    if(event.kind!=='workout'||event.deleted) continue;
    const workout=event.data as Workout;
    const finish=Date.parse(workout.endedAt??''),start=Date.parse(workout.startedAt);
    if(workout.status!=='completed'||!Number.isFinite(start)||!Number.isFinite(finish)||finish>end||finish<=start||finish-start>4*3600_000) continue;
    const day=dayInZone(new Date(finish),zone),age=(today-Date.parse(day))/dayMs;
    if(age<1||age>56) continue;
    const slots=visits.get(day)??[];
    slots.push({start,end:finish}); visits.set(day,slots);
  }
  const weekVisits=new Map<number,number>(), durations:number[]=[];
  for(const [day,slots] of visits) {
    const week=Math.floor(((today-Date.parse(day))/dayMs-1)/7);
    weekVisits.set(week,(weekVisits.get(week)??0)+1);
    let last=0,minutes=0;
    for(const slot of slots.sort((a,b)=>a.start-b.start)) {
      minutes+=Math.max(0,slot.end-Math.max(slot.start,last))/60_000;
      last=Math.max(last,slot.end);
    }
    durations.push(minutes);
  }
  if(weekVisits.size<3||durations.length<4) return context;
  function median(values:number[]) {
    values.sort((a,b)=>a-b);
    const middle=Math.floor(values.length/2);
    return values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
  }
  return {...context,days:context.days??Math.max(1,Math.min(3,Math.round(median([...weekVisits.values()])))),
    minutes:context.minutes??Math.max(10,Math.min(120,5*Math.round(median(durations)/5)))};
}
