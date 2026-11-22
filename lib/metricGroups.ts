import {gameLevels} from './gameLevels';
/** Three equipment levels, every active measurement exactly once. */
export const metricGroups=gameLevels.map(l=>({id:l.id,name:l.name[0],labels:l.name,icon:l.icon,metrics:l.ids,sections:l.sections}));
