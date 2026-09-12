/* Study A lineage only. Native vector studies, not final production masters. */
const inheritedA = 'M49 6L83 29L67 43L48 30L27 48L49 70L72 48L87 60L49 92L5 48Z';
const angularA = 'M49 6L79 26L70 42L49 29L27 48L49 73L74 52L85 65L49 92L5 48Z';
const masterA = 'M47 7Q50 5 54 8L79 26L70 42L52 31Q49 29 46 31L30 44Q26 48 29 52L45 69Q49 73 54 70L74 52L85 65L57 87Q49 94 40 86L12 58Q3 49 12 40Z';
const opticalA = {
 16:'M8 1L13 4L12 7L9 5Q8 4 7 5L5 7Q4 8 5 9L7 11Q8 12 9 11L12 9L14 11L9 15Q8 16 6 14L2 10Q0 8 2 6Z',
 24:'M12 2Q13 1 14 2L20 7L18 11L13 8Q12 7 11 8L7 11Q6 12 7 13L11 17Q12 18 14 17L19 13L22 17L14 23Q12 24 10 22L3 15Q1 12 3 10Z'
};
function symbol(size=48, path=masterA, optical=false) {
 const box=optical&&opticalA[size]?size:96;
 return `<svg width="${size}" height="${size}" viewBox="0 0 ${box} ${box}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${box===96?path:opticalA[size]}"/></svg>`;
}
