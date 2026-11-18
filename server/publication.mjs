import {latestDue,windowFor} from './domain.mjs';

// Every scheduled invocation can recover the morning run, even if its cron was lost.
export function collectionScope(state,now){
 const date=latestDue(now);
 const completed=state.lastFullCollection?.businessDate===date&&state.lastFullCollection.finishedAt;
 return completed||state.runs?.some(r=>r.scope==='full'&&r.businessDate===date&&r.finishedAt)?'news':'full';
}

export function assertCurrentPublication(view,now,{collectedAfter=null}={}){
 const date=latestDue(now),issue=view.digests?.[date],coverage=windowFor(date);
 if(!issue||issue.date!==date||issue.coverage?.start!==coverage.start||issue.coverage?.end!==coverage.end)throw Error(`Missing current News issue: ${date}`);
 if(issue.status==='unavailable')throw Error(`No healthy news sources for ${date}`);
 if(!view.tldrIssues?.[date])throw Error(`Missing current TLDR issue: ${date}`);
 if(!Number.isFinite(Date.parse(view.updatedAt))||Date.parse(view.updatedAt)<Date.parse(coverage.end))throw Error('Content predates the current 08:00 cutoff');
 if(collectedAfter&&Date.parse(view.updatedAt)<Date.parse(collectedAfter))throw Error('Live site still serves an older collection');
 return {date,newsItems:issue.items.length,tldrItems:view.tldrIssues[date].items.length,status:issue.status,updatedAt:view.updatedAt};
}
