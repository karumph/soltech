import {library} from './data.js';
import {scannerIcons} from './scanner-icons.js';
const outline=paths=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
export const badgeIcons={...scannerIcons,coin:outline('<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5h-4a1.75 1.75 0 0 0 0 3.5h3a1.75 1.75 0 0 1 0 3.5h-4M12 6.5v11"/>'),scan:outline('<path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4M4 12h16"/>')};
export const badgeSymbols={publicPosts:'People',launch:'Rocket',coin:'Coin',scan:'Scan'};
export const badgeColors={mint:'Blue',peach:'Purple',teal:'Teal',silver:'Silver'};
export function cleanAppearance(value){return {...(Object.hasOwn(badgeSymbols,value?.badgeSymbol)?{badgeSymbol:value.badgeSymbol}:{}),...(Object.hasOwn(badgeColors,value?.badgeColor)?{badgeColor:value.badgeColor}:{})};}
export function scannerAppearance(s){
 const type=s.filters?.type||'market';const source=library.find(item=>item.id===s.sourceId);const icon=s.icon||source?.icon,tone=s.tone||source?.tone;
 return {symbol:s.badgeSymbol||(Object.hasOwn(badgeIcons,icon)?icon:({public:'publicPosts',projects:'launch',market:'scan'}[type])),color:s.badgeColor||(Object.hasOwn(badgeColors,tone)?tone:({public:'mint',projects:'peach',market:'teal'}[type]))};
}
export function scannerBadge(s){const {symbol,color}=scannerAppearance(s);return `<span class="scanner-mark scanner-identity ${color}" aria-hidden="true">${badgeIcons[symbol]}</span>`;}
