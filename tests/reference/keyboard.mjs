const q='qwertyuiopasdfghjkl;zxcvbnm', c='qwfpgjluy;arstdhneiozxcvbkm';
export const colemak=s=>[...s].map(x=>{let i=q.indexOf(x.toLowerCase());return i<0?x:(/[A-Z]/.test(x)?c[i].toUpperCase():c[i])}).join('');
export const encode=s=>[...s].map(x=>q[c.indexOf(x)]||x).join('');
// Normalize hardware positions before the language-specific layout mapping.
export function physicalKey(event) {
 if(event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return null;
 const code=event.code || '';
 if(/^Key[A-Z]$/.test(code)) {
  const letter=code.slice(3).toLowerCase();
  return Boolean(event.shiftKey)!==Boolean(event.getModifierState?.('CapsLock')) ? letter.toUpperCase() : letter;
 }
 if(/^Digit[0-9]$/.test(code)) return event.shiftKey ? ')!@#$%^&*('[Number(code.slice(5))] : code.slice(5);
 const punctuation={Space:[' ',' '],Semicolon:[';',':'],Quote:["'",'"'],Comma:[',','<'],Period:['.','>'],Slash:['/','?'],Backslash:['\\','|'],BracketLeft:['[','{'],BracketRight:[']','}'],Minus:['-','_'],Equal:['=','+'],Backquote:['`','~']};
 return punctuation[code]?.[event.shiftKey?1:0] ?? null;
}
