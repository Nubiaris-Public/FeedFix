import AdmZip from 'adm-zip';
import { inflateRawSync } from 'node:zlib';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import path from 'node:path';
import type { ParsedWorkbook, ParsedCell } from './model';
const parser = new XMLParser({ignoreAttributes:false, parseTagValue:false, trimValues:false, processEntities:true});
export const xmlEscape = (s:string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function xmlParse(s:string) {
 if(/<!DOCTYPE|<!ENTITY/i.test(s) || XMLValidator.validate(s)!==true) throw new Error('This workbook contains unsupported or invalid XML. Export a fresh XLSX.');
 return parser.parse(s);
}
export function list<T>(x:T|T[]|undefined):T[] { return x===undefined?[]:Array.isArray(x)?x:[x]; }
export function checkedZip(buffer:Buffer) {
 if(buffer.length>25*1024*1024 || buffer.readUInt32LE(0)!==0x04034b50) throw new Error('Upload a valid XLSX file under the size limit.');
 const zip=new AdmZip(buffer); const entries=zip.getEntries(); let total=0; const names=new Set<string>();
 if(entries.length>2000) throw new Error('This workbook has too many archive entries.');
 for(const e of entries) {
  const n=e.entryName;
  if(names.has(n) || n.startsWith('/') || n.includes('\\') || n.split('/').includes('..') || /[:\x00]/.test(n)) throw new Error('This workbook contains unsafe archive paths.');
  names.add(n); total+=e.header.size;
  if(e.header.flags&1 || ![0,8].includes(e.header.method) || e.header.size>16*1024*1024 || total>64*1024*1024 || (e.header.size>1024*1024 && e.header.size/Math.max(1,e.header.compressedSize)>200)) throw new Error('This workbook exceeds safe decompression limits.');
  if(/vbaProject|externalLinks\/|embeddings\/|activeX\/|_xmlsignatures\//i.test(n)) throw new Error('Macros, external links and embedded objects are not supported. Save a plain XLSX.');
  if(!e.isDirectory) {
   const compressed=e.getCompressedData();
   const data=e.header.method===8?inflateRawSync(compressed,{maxOutputLength:Math.min(e.header.size+1,16*1024*1024+1)}):compressed;
   if(data.length!==e.header.size) throw new Error('This workbook has inconsistent archive sizes.');
   if(/\.xml$|\.rels$/i.test(n)) {
    const s=data.toString('utf8'); xmlParse(s);
    if(/macroEnabled|TargetMode\s*=\s*["']External["']/i.test(s)) throw new Error('External workbook relationships are not supported. Remove links and retry.');
   }
  }
 }
 for(const required of ['[Content_Types].xml','xl/workbook.xml','xl/_rels/workbook.xml.rels']) if(!zip.getEntry(required)) throw new Error("We couldn't read this workbook. Upload the original XLSX file.");
 return zip;
}
function textValue(v:unknown):string {
 if(v===undefined || v===null) return '';
 if(typeof v==='object') return String((v as Record<string,unknown>)['#text']??'');
 return String(v);
}
export function parseWorkbook(original:Buffer):ParsedWorkbook {
 const zip=checkedZip(original);
 const book=xmlParse(zip.readAsText('xl/workbook.xml'));
 const rels=list<Record<string,string>>(xmlParse(zip.readAsText('xl/_rels/workbook.xml.rels')).Relationships.Relationship);
 const shared=list<Record<string,unknown>>(zip.getEntry('xl/sharedStrings.xml')?xmlParse(zip.readAsText('xl/sharedStrings.xml')).sst?.si:undefined);
 let cellCount=0;
 const sheets=list<Record<string,string>>(book.workbook?.sheets?.sheet).map(s=>{
  const rel=rels.find(r=>r['@_Id']===s['@_r:id']);
  if(!rel) throw new Error('Workbook sheet relationship is missing.');
  const target=rel['@_Target']; const member=target.startsWith('/')?target.slice(1):path.posix.normalize('xl/'+target);
  if(!member.startsWith('xl/') || !zip.getEntry(member)) throw new Error('Workbook sheet path is invalid.');
  const xml=zip.readAsText(member); const cells=new Map<string,ParsedCell>();
  const merges=list<Record<string,string>>(xmlParse(xml).worksheet?.mergeCells?.mergeCell).map(m=>m['@_ref']);
  for(const match of xml.matchAll(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)) {
   if(++cellCount>150000) throw new Error('This workbook exceeds the 150,000-cell processing limit.');
   const raw=match[0], c=xmlParse(raw).c, address=c['@_r'];
   if(typeof address!=='string' || !/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(address) || cells.has(address)) throw new Error('Invalid or duplicate cell reference.');
   const kind=c['@_t']??'n'; const si=kind==='s'?shared[Number(c.v)]:undefined;
   const value=kind==='s'?(si?.r?list<Record<string,unknown>>(si.r as Record<string,unknown>[]).map(r=>textValue(r.t)).join(''):textValue(si?.t)):kind==='inlineStr'?textValue(c.is?.t):textValue(c.v);
   const formula=c.f!==undefined;
   if(formula && /(?:WEBSERVICE|HYPERLINK|DDE|RTD|CALL|EXEC|REGISTER|\[|\|)/i.test(textValue(c.f))) throw new Error('This workbook contains external or unsafe formulas. Remove them before uploading.');
   const merged=merges.some(range=>inRange(address,range));
   cells.set(address,{address,value,kind,formula,raw,safe:!formula&&!merged&&!si?.r&&['s','inlineStr'].includes(kind)&&!c.is?.r});
  }
  return {name:s['@_name'],path:member,xml,cells};
 });
 if(!sheets.length || sheets.length>30) throw new Error('This workbook must have between 1 and 30 worksheets.');
 return {original,sheets};
}
function coords(a:string) { const m=/^([A-Z]+)(\d+)$/.exec(a)!;return [Array.from(m[1]).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),Number(m[2])]; }
function inRange(a:string,range:string) {const [start,end=start]=range.split(':');const [x,y]=coords(a),[x1,y1]=coords(start),[x2,y2]=coords(end);return x>=x1&&x<=x2&&y>=y1&&y<=y2;}
export function columnLetter(n:number):string {let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
