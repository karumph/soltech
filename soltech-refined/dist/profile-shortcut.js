import {PROFILE_KEY} from './profile-store.js';
import {renderProfileAvatar} from './profile.js';

export function createProfileShortcut({element,store,eventTarget=globalThis.window}) {
 let disposed=false,rendered='',lastPhoto='',failedPhoto='';
 let localStorage;
 try{localStorage=eventTarget?.localStorage;}catch{}

 function refresh({retry=false}={}) {
  if(disposed||!element)return;
  if(retry)store.retry();
  const profile=store.value;
  if(profile.photo!==lastPhoto){lastPhoto=profile.photo;failedPhoto='';}
  const visible={...profile,photo:profile.photo===failedPhoto?'':profile.photo};
  const signature=JSON.stringify([visible.color,visible.photo]);
  if(signature===rendered)return;
  rendered=signature;
  element.innerHTML=renderProfileAvatar(visible,{idPrefix:'header-profile'});
 }

 function onPhotoError(event) {
  const image=element.querySelector('img');
  if(!image||event.target!==image)return;
  const photo=store.value.photo;
  if(!photo||image.getAttribute('src')!==photo)return;
  failedPhoto=photo;
  refresh();
 }

 function onStorage(event) {
  if(event.key!==PROFILE_KEY&&event.key!==null)return;
  if(event.storageArea&&localStorage&&event.storageArea!==localStorage)return;
  refresh({retry:true});
 }

 if(element){
  element.setAttribute('aria-label','Profile and settings');
  element.setAttribute('title','Profile and settings');
  element.addEventListener('error',onPhotoError,true);
  eventTarget?.addEventListener('storage',onStorage);
  refresh();
 }
 return {refresh,dispose(){
  if(disposed)return;
  disposed=true;
  element?.removeEventListener('error',onPhotoError,true);
  eventTarget?.removeEventListener('storage',onStorage);
 }};
}
