import type { FeedIssue, FixOperation, ParsedWorkbook } from './model';
import { checkedZip, xmlEscape } from './workbook';
export function buildFixPlan(issues:FeedIssue[]):FixOperation[] {
 const seen=new Set<string>();
 return issues.filter(i=>i.resolution==='AUTO_FIX').map(i=>{
  if(!i.sheet||!i.cell||!i.ruleId||typeof i.proposedValue!=='string')throw new Error('Incomplete automatic fix.');
  const key=i.sheet+'!'+i.cell;if(seen.has(key))throw new Error('Conflicting automatic fixes.');seen.add(key);
  return {issueId:i.id,sheet:i.sheet,cell:i.cell,before:i.originalValue,after:i.proposedValue,ruleId:i.ruleId};
 });
}
export function applyApprovedAutomaticFixes(workbook:ParsedWorkbook,plan:FixOperation[]):Buffer {
 const zip=checkedZip(workbook.original),seen=new Set<string>(),changed=new Map<string,string>();
 for(const op of plan){
  const sheet=workbook.sheets.find(s=>s.name===op.sheet),cell=sheet?.cells.get(op.cell),key=op.sheet+'!'+op.cell;
  if(!sheet||!cell?.safe||cell.value!==op.before||typeof op.after!=='string'||seen.has(key))throw new Error('Fix precondition failed. Analyze the original file again.');seen.add(key);
  const attrs=cell.raw.match(/^<c\b([^>]*)>/)![1].replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/,'').replace(/\/$/,'');
  const replacement=`<c${attrs} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(op.after)}</t></is></c>`;
  changed.set(sheet.path,(changed.get(sheet.path)??sheet.xml).replace(cell.raw,replacement));
 }
 for(const [p,xml]of changed)zip.updateFile(p,Buffer.from(xml));
 return zip.toBuffer();
}
export function generateReport(plan:FixOperation[],issues:FeedIssue[]) {return JSON.stringify({format:'feedfix-changes-v1',notice:'Only listed automatic changes were applied. Walmart acceptance is not guaranteed.',changes:plan,remainingIssues:issues.filter(i=>i.resolution!=='AUTO_FIX')},null,2);}
