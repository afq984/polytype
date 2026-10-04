// Normalize hardware positions before the language-specific layout mapping.
export function physicalKey(event, layout='colemak') {
 if(event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return null;
 const code=event.code || '';
 if(/^Key[A-Z]$/.test(code)) {
  const letter=code.slice(3).toLowerCase();
  // Colemak P is a punctuation key: preserve its existing CapsLock behavior.
  const caps=layout==='colemak'&&code==='KeyP'?false:Boolean(event.getModifierState?.('CapsLock'));
  return Boolean(event.shiftKey)!==caps ? letter.toUpperCase() : letter;
 }
 if(/^Digit[0-9]$/.test(code)) return event.shiftKey ? ')!@#$%^&*('[Number(code.slice(5))] : code.slice(5);
 const punctuation={Space:[' ',' '],Semicolon:[';',':'],Quote:["'",'"'],Comma:[',','<'],Period:['.','>'],Slash:['/','?'],Backslash:['\\','|'],BracketLeft:['[','{'],BracketRight:[']','}'],Minus:['-','_'],Equal:['=','+'],Backquote:['`','~']};
 return punctuation[code]?.[event.shiftKey?1:0] ?? null;
}
