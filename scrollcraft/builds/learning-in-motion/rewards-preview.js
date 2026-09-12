/* Illustrative XP only. The connected product must award and claim XP on the server. */
(() => {
  const xpPerQuestion = 10;
  const earnedTopics = new Set(PreviewSession.read().topics);
  const result = document.querySelector('#xp-result');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const balance = () => earnedTopics.size * xpPerQuestion;

  window.LearningRewards = {
    balance,
    resetQuestion() { result.hidden = true; },
    answer(topic, isCorrect) {
      if (!isCorrect) { result.hidden = true; return; }
      const alreadyEarned = earnedTopics.has(topic);
      earnedTopics.add(topic);
      PreviewSession.setTopics([...earnedTopics]);
      document.querySelector('#xp-award').textContent = alreadyEarned ? "Lesson XP already earned" : `+${xpPerQuestion} XP`;
      document.querySelector('#xp-balance').textContent = `${balance()} XP`;
      document.querySelector('#xp-heading').textContent = alreadyEarned
        ? "Keep building on this idea." : "You’ve put a new idea to the test.";
      result.hidden = false;
      // Focus and scroll belong to the revealed result, not the button left above it.
      requestAnimationFrame(() => {
        document.querySelector('#xp-heading').focus({ preventScroll: true });
        result.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
      });
    }
  };
})();
