// Explicit migrations of Roman colon spans in frozen development evidence.
// The JSON snapshots stay byte-for-byte historical; this is not a user-file adapter.
const colonRows=new Set(['mixed-02-colemak-all','mixed-02-colemak-en-jp',
 'diversity-mixed-meeting-colemak-all','diversity-mixed-meeting-colemak-en-jp']);
export const currentRaw=row=>colonRows.has(row.id)?row.raw.replaceAll(':','P'):row.raw;
