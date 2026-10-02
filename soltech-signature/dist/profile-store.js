import {exportPhotoCrop} from './photo-crop.js';
export const PROFILE_KEY = 'soltech.signature.profile.v1';
export const avatarColors = {sky:'Sky',violet:'Violet',mint:'Mint',graphite:'Graphite'};
export const defaultProfile = () => ({schemaVersion:1,name:'',color:'sky',photo:'',notifications:{newFinds:false,scanners:{}}});
const copy = value => JSON.parse(JSON.stringify(value));
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const identity = value => ({name:value.name,color:value.color,photo:value.photo});
export function validStoredPhoto(photo) {
 if(!photo)return photo==='';
 if(typeof photo!=='string'||photo.length>220000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))return false;
 try{const encoded=photo.slice(23),bytes=atob(encoded);return btoa(bytes)===encoded&&bytes.length>4&&bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255&&bytes.charCodeAt(bytes.length-2)===255&&bytes.charCodeAt(bytes.length-1)===217;}catch{return false;}
}
export function validateProfile(value) {
 if(!record(value)||value.schemaVersion!==1) throw Error('Profile format is not supported.');
 if(typeof value.name!=='string'||value.name.length>40) throw Error('Use a name with 40 characters or fewer.');
 if(!Object.hasOwn(avatarColors,value.color)) throw Error('Choose an avatar color.');
 if(!validStoredPhoto(value.photo)) throw Error('This profile photo could not be saved.');
 if(!record(value.notifications)||typeof value.notifications.newFinds!=='boolean'||!record(value.notifications.scanners)) throw Error('Notification preferences could not be read.');
 const scanners={};
 for(const [id,enabled] of Object.entries(value.notifications.scanners)) {
  if(!/^[a-z0-9-]{1,90}$/.test(id)||typeof enabled!=='boolean'||Object.keys(scanners).length>=500) throw Error('Scanner preferences could not be read.');
  scanners[id]=enabled;
 }
 return {schemaVersion:1,name:value.name.trim(),color:value.color,photo:value.photo,notifications:{newFinds:value.notifications.newFinds,scanners}};
}
export function createProfileStore(storage) {
 let value=defaultProfile(),issue=null;
 const read=()=>{try{const raw=storage.getItem(PROFILE_KEY);value=raw?validateProfile(JSON.parse(raw)):defaultProfile();issue=null;return true;}catch{issue='read';return false;}};
 read();
 return {
  get value(){return copy(value);},get issue(){return issue;},retry:read,
  save(candidate){
   if(issue==='read') return {ok:false,error:'Your saved profile could not be read. Try loading it again first.'};
   let next;try{next=validateProfile(candidate);}catch(error){return {ok:false,error:error.message};}
   try{storage.setItem(PROFILE_KEY,JSON.stringify(next));value=next;issue=null;return {ok:true};}
   catch{issue='write';return {ok:false,error:'Couldn’t save on this device. Your changes are still here—try again, or use a smaller photo.'};}
  },
  saveSection(section,changes,base){
   if(!['identity','notifications'].includes(section))return {ok:false,error:'This setting could not be saved.'};
   if(!read())return {ok:false,error:'Your saved profile could not be read. Try loading it again first.'};
   const current=section==='identity'?identity(value):value.notifications;
   if(JSON.stringify(current)!==JSON.stringify(base))return {ok:false,conflict:true,error:'This was changed in another tab. Load the saved version before editing again.'};
   return this.save(section==='identity'?{...value,...identity(changes)}:{...value,notifications:changes});
  }
 };
}
export function validatePhotoFile(file) {
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Choose a JPG, PNG, or WebP photo.');
 if(!file.size||file.size>6*1024*1024) throw Error('Choose a photo smaller than 6 MB.');
}
export function loadProfilePhoto(file,{signal}={}) {
 validatePhotoFile(file);
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),image=new Image();let timer,settled=false,released=false;
  const dispose=()=>{if(released)return;released=true;image.src='';URL.revokeObjectURL(url);};
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;if(error){dispose();reject(error);}else resolve(result);};
  const abort=()=>finish(new DOMException('Cancelled','AbortError'));
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  image.onerror=()=>finish(Error('This photo couldn’t open. Try a different image.'));
  image.onload=()=>{
   try{
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!w||!h||w*h>64000000)throw Error('Choose a smaller photo.');
    finish(null,{image,width:w,height:h,dispose});
   }catch(error){finish(error);}
  };
  timer=setTimeout(()=>finish(Error('This photo took too long to open. Try another image.')),12000);
  image.src=url;
 });
}

export async function prepareProfilePhoto(file,{signal}={}) {
 const source=await loadProfilePhoto(file,{signal});
 try{return exportPhotoCrop(source);}finally{source.dispose();}
}
