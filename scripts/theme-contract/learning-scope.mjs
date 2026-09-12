// G4 ownership is structural, so a new registry row cannot relabel a learner
// consumer as B5 and keep a compatibility token alive.
const roots = [
  'components/course/', 'components/lesson/', 'components/quiz/',
  'components/missions/', 'components/rewards/', 'components/profile/',
  'components/organizations/', 'components/navigation/', 'features/rewards/learner/',
  'app/dashboard/', 'app/courses/', 'app/lessons/', 'app/quiz/', 'app/results/',
  'app/missions/', 'app/profile/', 'app/notifications/', 'app/xp-store/', 'app/o/', 'app/org/',
];
export function ownsLearningPresentation(entry) {
  return roots.some(root => entry.file.startsWith(root))
    || entry.file === 'features/learning/application/lesson-delivery-page.tsx'
    || entry.file === 'app/styles/learning.css'
    || (entry.file === 'components/admin/AdminShell.tsx'
      && /^(?:OrgWorkspaceIdentity|OrgTopBar)\//.test(entry.context))
    || (entry.file === 'app/globals.css'
      && /(?:^| > )\.(?:learner-compact-shell|mobile-shell)$/.test(entry.scope ?? ''));
}
