import type { CourseLesson } from '../../features/ai-generation/authoring/course-contracts.ts';

// Hand-authored contrasting teaching intents, not claims about real model output.
export const listeningLesson: CourseLesson = {
  title: 'Listen first', description: 'Elicit overlooked needs before proposing a community decision.', questions: [],
  pages: [
    { title: 'Find the missing perspective', subtitle: 'Separate needs from proposals', pageType: 'concept', blocks: [
      { blockType: 'text', payload: { heading: 'Ask before deciding', body: '<p>A request for evening meetings may hide a need to work during the day. Ask what makes attendance difficult, then restate the need and check your understanding.</p>' } },
      { blockType: 'callout', payload: { variant: 'tip', title: 'Check your interpretation', body: '<p>Try: You need a time that fits your shift. Have I understood correctly?</p>' } },
    ] },
    { title: 'A quiet neighbour', subtitle: 'Practice listening', pageType: 'scenario', blocks: [
      { blockType: 'text', payload: { heading: '', body: '<p>At a meeting, Ada stays silent while two neighbours argue for Saturday. Ask Ada which constraints matter before taking a vote. If she cares for a relative on Saturdays, compare another time rather than interpreting silence as agreement.</p>' } },
      { blockType: 'image', payload: { src: '', mediaIntent: { version: 1, kind: 'image', purpose: 'Show a community meeting with one quiet participant and two speaking participants; draw attention to whose perspective has not yet been heard, without implying silence means agreement.', aspectRatio: '16:9', required: false, style: 'inherit' } } },
    ] },
  ],
};
export const comparisonLesson: CourseLesson = {
  title: 'Choose fairly', description: 'Use the needs gathered earlier to compare tradeoffs and justify a decision.', questions: [],
  pages: [
    { title: 'Compare the consequences', subtitle: 'Apply the needs you elicited', pageType: 'concept', blocks: [
      { blockType: 'text', payload: { heading: '', body: '<p>Use the constraints collected in Listen first. Compare each option against the same needs, then explain who benefits and who still faces a barrier. A majority alone does not explain the tradeoff.</p>' } },
      { blockType: 'table', payload: { columns: ['Meeting option', 'Who can attend', 'Remaining barrier'], rows: [['Saturday morning', 'Day-shift workers', 'Family carers need cover'], ['Weekday evening', 'Family carers', 'Night-shift workers need an alternative']] } },
    ] },
    { title: 'Defend and revisit the choice', subtitle: '', pageType: 'reflection', blocks: [
      { blockType: 'callout', payload: { variant: 'key_point', title: 'Explain your tradeoff', body: '<p>Choose a meeting time from the comparison. Name the need it serves, the barrier it leaves, and one adjustment that reduces that barrier. What evidence after the first meeting would make you reconsider?</p>' } },
    ] },
  ],
};
