import {validMint} from './dist/coin-checker-data.js';

const MAX_TEXT=50000,MAX_EXCERPT=220;
const unavailable=()=>({text:'No text excerpt is available for this post.',status:'unavailable'});
const sentences=new Intl.Segmenter(undefined,{granularity:'sentence'});
const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
const urls=/\b(?:https?:\/\/|www\.)[^\s<>"'\u0000-\u001f]+/giu;
const addresses=/(?<![\p{L}\p{N}_])(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?![\p{L}\p{N}_])/gu;

function replaceURL(value){
 // Preserve sentence punctuation outside a URL. No URL is followed or fetched.
 let suffix='';
 while(/[.,!?;:\u3002\uff01\uff1f]$/u.test(value)){suffix=value.slice(-1)+suffix;value=value.slice(0,-1);}
 while(value.endsWith(')')&&(value.match(/\)/g)||[]).length>(value.match(/\(/g)||[]).length){suffix=')'+suffix;value=value.slice(0,-1);}
 return '[link]'+suffix;
}

function remainingText(value){
 return value.replace(/\[(?:link|address)\]/g,'').trim();
}

function clutterOnly(value){
 const rest=remainingText(value).replace(/^[\s<>()\[\]{}:;,./|\-–—]+|[\s<>()\[\]{}:;,./|\-–—]+$/gu,'');
 const label=/^(?:ca|contract(?: address)?|mint(?: address)?|address|links?)$/iu.test(rest);
 return !rest||label&&(/\[(?:link|address)\]/.test(value)||/:\s*$/.test(value));
}

function hasContent(value){
 // A repost header, mentions, or an address label alone is not a summary.
 const rest=remainingText(value).replace(/^RT\s+(?=@)/iu,'').replace(/(?<![\p{L}\p{N}_])@[A-Za-z0-9_]{1,15}\b/gu,'');
 return !clutterOnly(value)&&/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(rest);
}

function prefixWithin(value,limit){
 let prefix='';
 for(const {segment} of graphemes.segment(value)){
  if(prefix.length+segment.length>limit)break;
  prefix+=segment;
 }
 // Prefer a complete word when there is one. For CJK or a single long word,
 // the grapheme boundary still prevents broken Unicode characters.
 const wordEnd=prefix.search(/\s+\S*$/u);
 if(prefix.length<value.length&&wordEnd>0&&!/\s$/u.test(prefix)&&!/^\s/u.test(value.slice(prefix.length)))prefix=prefix.slice(0,wordEnd);
 // An omission marker must never be clipped into a misleading partial word.
 const marker=prefix.lastIndexOf('[');
 if(marker>=0&&['[link]','[address]'].some(label=>label.startsWith(prefix.slice(marker))&&label!==prefix.slice(marker)))prefix=prefix.slice(0,marker);
 return prefix.trimEnd();
}

/**
 * A bounded excerpt, not generated analysis. Callers must label status=excerpt
 * as source wording, render text as text, and retain the full original beside it.
 * Only this post's primary text is read; replies, quoted objects and media do not
 * supply words or an inferred description.
 */
export function summarizeScannerPost(post){
 if(!post||typeof post.text!=='string'||post.text.length>MAX_TEXT)return unavailable();
 const source=post.text.toWellFormed().replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ');
 const replaced=source.replace(urls,replaceURL).replace(addresses,value=>/^0x/.test(value)||validMint(value)?'[address]':value)
  .replace(/[\t\f\v ]+/g,' ').replace(/ *\n */g,'\n').trim();
 const lines=replaced.split('\n');
 // Keep interior placeholders and paragraph boundaries: removing them could
 // join unrelated clauses or detach a qualifier from the address it describes.
 while(lines.length&&clutterOnly(lines[0]))lines.shift();
 while(lines.length&&clutterOnly(lines.at(-1)))lines.pop();
 const text=lines.join('\n').trim();
 if(!hasContent(text))return unavailable();
 if(text.length<=MAX_EXCERPT)return {text,status:'excerpt'};
 let whole='';
 for(const {segment} of sentences.segment(text)){
  if((whole+segment).trimEnd().length>MAX_EXCERPT-1)break;
  whole+=segment;
 }
 const excerpt=whole.trimEnd()||prefixWithin(text,MAX_EXCERPT-1);
 return excerpt?{text:excerpt+'…',status:'excerpt'}:unavailable();
}
