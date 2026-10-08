import { Goal } from '../types/index.js';

export interface LifeEvent {
  id: string;
  title: string;
  date: Date;
  estimatedCost: number;
  linkedGoalId?: string;
}

export function evaluateLifeEventsImpact(events: LifeEvent[], goals: Goal[]) {
  const impacts = events.map(event => {
    let fundingGap = event.estimatedCost;
    if (event.linkedGoalId) {
      const goal = goals.find(g => g.id === event.linkedGoalId);
      if (goal) {
        fundingGap = Math.max(0, event.estimatedCost - Number(goal.currentAmount));
      }
    }
    return {
      eventId: event.id,
      title: event.title,
      fundingGap,
      isFunded: fundingGap === 0
    };
  });
  return impacts;
}
