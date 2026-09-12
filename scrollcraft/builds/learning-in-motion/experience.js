/* Page-local sample interaction. No authentication, progress or XP writes. */
(() => {
  const topics = window.WelcomeTopics = {
  "listen": {
    "title": "Who hasn’t had a say?",
    "category": "Listening",
    "lessonTitle": "Silence is not the same as agreement.",
    "lessonBody": "Someone who is quiet might agree, need more time or struggle to find a gap. Silence alone does not tell you which. Listening means creating room for another perspective, without making anyone feel they have to speak.",
    "lessonExample": "Your group is ready to choose a plan. Two people have done most of the talking. Try: “Before we decide, is there anything we have missed?” Pause, give others time, and leave room to pass.",
    "takeaway": "Create an opening. Leave a choice. Give the next voice your attention.",
    "question": "How would you open up the conversation?",
    "context": "Your group is about to make a decision. One person has not spoken, and you want to hear any views the group may be missing.",
    "idea": "Make space without putting someone on the spot.",
    "discussion": "What makes it easier to speak up in your group? What makes it harder?",
    "mission": "In your next group discussion, invite another perspective. Give people time to respond and room to pass.",
    "answers": [
      "Ask everyone to give an opinion before you move on.",
      "Invite other views, with time to respond and room to pass."
    ],
    "feedback": [
      [
        "Equal turns can still create pressure.",
        "Asking everyone to speak sounds inclusive, but it can put someone on the spot. Offer an invitation they can accept or pass on, then give them time."
      ],
      [
        "An invitation, not an obligation.",
        "You have created a way into the conversation without demanding an answer. Now pause and give anyone who responds your attention."
      ]
    ]
  },
  "think": {
    "title": "Would you pass this on?",
    "category": "Clear thinking",
    "lessonTitle": "Being believable is not the same as being true.",
    "lessonBody": "A message can come from someone you trust and still contain a claim they have not checked. Knowing who passed it on is not the same as knowing where it began or what evidence supports it.",
    "lessonExample": "A friend sends a screenshot saying a local event has been cancelled, but the date and source are missing. Before forwarding it, check the organiser’s original announcement and whether it refers to the right event and date.",
    "takeaway": "Trace the source. Check the date and evidence. Then decide whether to share.",
    "question": "Your group plans to attend. What next?",
    "context": "Someone you trust sends a screenshot saying an event has been cancelled. It has no date or source, and nobody has checked with the organiser.",
    "idea": "Give a convincing claim a closer look.",
    "discussion": "What makes a claim feel trustworthy? What would actually help you check it?",
    "mission": "Before sharing your next news story, find the original source and check whether it supports the claim.",
    "answers": [
      "Share it with a warning that it might be wrong.",
      "Check the source and evidence before sharing."
    ],
    "feedback": [
      [
        "A warning is not a fact-check.",
        "Saying you are unsure is honest, but the claim still reaches more people. Check the source and evidence before passing it on as news."
      ],
      [
        "Check first. Then decide.",
        "An original source gives you something to assess, not automatic proof. Check its date and whether the evidence supports the claim before deciding to share."
      ]
    ]
  },
  "act": {
    "title": "Same invitation. Same chance?",
    "category": "Everyday fairness",
    "lessonTitle": "Being invited is not always enough.",
    "lessonBody": "Everyone can receive the same invitation without having the same chance to join. If the same person keeps missing out, look at the arrangement as well as the individual. What might be making participation difficult?",
    "lessonExample": "Your group always meets in the afternoon. Someone with a regular commitment has missed two meetings. Instead of assuming they are not interested, ask what might help: another time, rotating meetings or a different way to contribute.",
    "takeaway": "Notice who keeps missing out. Ask about the barrier. Explore what could change.",
    "question": "How should the group choose its meeting time?",
    "context": "Most people prefer afternoons. One member has a regular commitment then and has missed the last two meetings.",
    "idea": "Look beyond the invitation to the chance to take part.",
    "discussion": "Who keeps missing out on your group’s activities? What could you change to make joining easier?",
    "mission": "Ask someone who rarely joins a group activity what would make it easier to take part. Explore one change together.",
    "answers": [
      "Hold a vote and use the most popular time.",
      "Explore alternatives before choosing a time."
    ],
    "feedback": [
      [
        "A vote can miss a recurring barrier.",
        "A majority vote tells you what most people prefer, but not what keeps someone from joining. Ask about the barrier and explore options before settling on a time."
      ],
      [
        "Understand the barrier before deciding.",
        "You have not promised a perfect time for everyone. You have made room to consider another time, rotating meetings or a different way to contribute."
      ]
    ]
  }
};
  let current = 'listen';
  const $ = (selector) => document.querySelector(selector);
  const topicButtons = [...document.querySelectorAll('[data-topic]')];
  const answerButtons = [...document.querySelectorAll('[data-answer]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px), (max-height: 740px)');
  const together = $('#together');
  $('#quiz-content').hidden = true;
  if (mobile.matches || reduced.matches) {
    $('.shared-scene').removeAttribute('data-sc-verify-state');
  }
  const scroll = ScrollCraft.mount(document.body);
  const sheetObserver = new ResizeObserver(() => scroll.layout());
  sheetObserver.observe($('.lesson-sheet'));

  function showLearningStep(isQuiz, moveFocus = true) {
    $('#lesson-content').hidden = isQuiz;
    $('#quiz-content').hidden = !isQuiz;
    $('.lesson-sheet').setAttribute('aria-labelledby', isQuiz ? 'question-heading' : 'lesson-heading');
    document.querySelectorAll('.learning-steps li').forEach(step => step.removeAttribute('aria-current'));
    $(isQuiz ? ($('#xp-result').hidden ? '#step-quiz' : '#step-earn') : '#step-learn').setAttribute('aria-current', 'step');
    if (moveFocus) requestAnimationFrame(() => {
      $(isQuiz ? '#question-heading' : '#lesson-heading').focus({ preventScroll: true });
      $('.lesson-sheet').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    });
  }
  $('#start-quiz').addEventListener('click', event => { event.preventDefault(); showLearningStep(true); });
  $('#back-to-lesson').addEventListener('click', () => showLearningStep(false));
  document.querySelectorAll('.console-cta, .try-lesson').forEach(link => link.addEventListener('click', event => { event.preventDefault(); showLearningStep(false); }));

  function selectTopic(key) {
    current = key;
    const topic = topics[key];
    topicButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === key)));
    $('#sample-topic').textContent = topic.category;
    $('#lesson-heading').textContent = topic.lessonTitle;
    $('#lesson-body').textContent = topic.lessonBody;
    $('#lesson-example').textContent = topic.lessonExample;
    $('#lesson-takeaway').textContent = topic.takeaway;
    $('#question-heading').textContent = topic.question;
    $('#question-context').textContent = topic.context;
    answerButtons.forEach((button, index) => {
      button.querySelector('.answer-text').textContent = topic.answers[index];
      button.setAttribute('aria-pressed', 'false');
      button.querySelector('.answer-state').textContent = '↗';
    });
    const placeholder = document.createElement('p');
    placeholder.className = 'feedback-placeholder';
    placeholder.textContent = "Take a moment. You can try again.";
    $('#feedback').replaceChildren(placeholder);
    LearningRewards.resetQuestion();
    $('#shared-lesson').textContent = topic.title;
    $('#shared-lesson-description').textContent = topic.idea;
    $('#shared-discussion').textContent = topic.discussion;
    $('#shared-mission').textContent = topic.mission;
    showLearningStep(false);
  }
  topicButtons.forEach(button => button.addEventListener('click', () => selectTopic(button.dataset.topic)));
  answerButtons.forEach((button, index) => button.addEventListener('click', () => {
    answerButtons.forEach((other, otherIndex) => {
      other.setAttribute('aria-pressed', String(index === otherIndex));
      other.querySelector('.answer-state').textContent = index === otherIndex && index === 1 ? '✓' : '↗';
    });
    const [title, detail] = topics[current].feedback[index];
    const strong = document.createElement('strong');
    strong.textContent = `${index === 1 ? "That's right." : 'Not quite. Try again.'} ${title}`;
    const body = document.createElement('p');
    body.textContent = detail;
    $('#feedback').replaceChildren(strong, body);
    LearningRewards.answer(current, index === 1);
    document.querySelectorAll('.learning-steps li').forEach(step => step.removeAttribute('aria-current'));
    $(index === 1 ? '#step-earn' : '#step-quiz').setAttribute('aria-current', 'step');
    if (index !== 1) $('#feedback').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'nearest' });
  }));

  const scene = $('.learning-scene');
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced.matches) {
    scene.addEventListener('pointermove', (event) => {
      const box = scene.getBoundingClientRect();
      scene.style.setProperty('--mx', ((event.clientX - box.left) / box.width * 2 - 1).toFixed(3));
      scene.style.setProperty('--my', ((event.clientY - box.top) / box.height * 2 - 1).toFixed(3));
    }, { passive: true });
    scene.addEventListener('pointerleave', () => {
      scene.style.setProperty('--mx', '0');
      scene.style.setProperty('--my', '0');
    });
  }
  const shared = $('.shared-scene');
  let pending = false;
  function unfold() {
    pending = false;
    if (mobile.matches || reduced.matches) {
      shared.removeAttribute('data-sc-verify-state');
      shared.removeAttribute('data-sc-verify-hold');
      return;
    }
    const box = together.getBoundingClientRect();
    const travel = Math.max(1, together.offsetHeight - innerHeight);
    const progress = Math.max(0, Math.min(1, -box.top / travel));
    const value = Math.max(0, Math.min(1, progress / .87));
    shared.style.setProperty('--unfold', value.toFixed(3));
    shared.dataset.scVerifyState = `lesson:${Math.round(-190 * value)};mission:${Math.round(32 + 158 * value)}`;
    shared.dataset.scVerifyHold = String(value === 1 || box.top > 0);
  }
  addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(unfold); }
  }, { passive: true });
  addEventListener('resize', unfold, { passive: true });
  reduced.addEventListener('change', unfold);
  unfold();

})();
