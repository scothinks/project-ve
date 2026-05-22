export type ImageAsset = {
  src: string;
  alt: string;
};

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "locked" | "available" | "in_progress" | "completed";
export type LessonStatus = CourseStatus;

export type Course = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  level: CourseLevel;
  status: CourseStatus;
  thumbnail: ImageAsset;
  estimatedMinutes: number;
  progressPercent: number;
  lessons: Lesson[];
};

export type Lesson = {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  estimatedMinutes: number;
  status: LessonStatus;
  coverImage: ImageAsset;
  retryPolicy: LessonRetryPolicy;
  quizAccess: {
    requiresLessonCompletion: boolean;
  };
  pages: LessonPage[];
  quiz: Quiz;
};

export type LessonRetryPolicy = {
  mode: "anytime" | "cooldown" | "disabled";
  requiresReread?: boolean;
  cooldownHours?: number;
  maxRewardedAttempts?: number;
};

export type LessonPageType = "primer" | "concept" | "example" | "reflection" | "summary";

export type LessonPage = {
  id: string;
  lessonId: string;
  title: string;
  subtitle?: string;
  order: number;
  type: LessonPageType;
  estimatedMinutes?: number;
  coverImage?: ImageAsset;
  blocks: LessonContentBlock[];
};

export type LessonContentBlock =
  | TextBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | TableBlock
  | CalloutBlock;

export type TextBlock = {
  id: string;
  type: "text";
  heading?: string;
  body: string;
};

export type ImageBlock = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  caption?: string;
};

export type VideoBlock = {
  id: string;
  type: "video";
  src: string;
  poster?: string;
  title?: string;
  caption?: string;
};

export type AudioBlock = {
  id: string;
  type: "audio";
  src: string;
  title?: string;
  transcript?: string;
};

export type TableBlock = {
  id: string;
  type: "table";
  title?: string;
  columns: string[];
  rows: string[][];
  caption?: string;
};

export type CalloutBlock = {
  id: string;
  type: "callout";
  variant: "tip" | "warning" | "key_point" | "example";
  title: string;
  body: string;
};

export type Quiz = {
  id: string;
  lessonId: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
};

export type QuizQuestionType = "single_choice" | "multiple_choice" | "true_false";

export type QuizQuestion = {
  id: string;
  quizId: string;
  prompt: string;
  type: QuizQuestionType;
  options: QuizOption[];
  correctOptionIds: string[];
  explanation: string;
  xp: number;
  order: number;
};

export type QuizOption = {
  id: string;
  questionId: string;
  label: string;
  order: number;
};

export type PublicQuizQuestion = Omit<QuizQuestion, "correctOptionIds" | "explanation" | "options"> & {
  options: QuizOption[];
};

export type PublicQuiz = Omit<Quiz, "questions"> & {
  questions: PublicQuizQuestion[];
};

export const courses: Course[] = [
  {
    id: "course-money-basics",
    slug: "everyday-civic-values",
    title: "Everyday Civic Values",
    category: "Values Education",
    description:
      "Build simple habits for fairness, respect, honesty, and responsibility in daily life.",
    level: "beginner",
    status: "in_progress",
    thumbnail: {
      src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
      alt: "A group of people sitting together in conversation",
    },
    estimatedMinutes: 35,
    progressPercent: 35,
    lessons: [
      {
        id: "lesson-starter-budget",
        courseId: "course-money-basics",
        slug: "fair-everyday-choices",
        title: "Make Fair Everyday Choices",
        summary: "Use fairness to guide small decisions before they become big issues.",
        order: 1,
        estimatedMinutes: 7,
        status: "in_progress",
        coverImage: {
          src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80",
          alt: "People gathered around a table writing notes",
        },
        retryPolicy: {
          mode: "anytime",
          requiresReread: true,
          maxRewardedAttempts: 5,
        },
        quizAccess: {
          requiresLessonCompletion: true,
        },
        pages: [
          {
            id: "page-budget-primer",
            lessonId: "lesson-starter-budget",
            title: "Start with fairness you can practice",
            subtitle: "Small choices show respect before big moments test it.",
            order: 1,
            type: "primer",
            estimatedMinutes: 1,
            blocks: [
              {
                id: "budget-key-point",
                type: "callout",
                variant: "key_point",
                title: "Fairness is a daily habit",
                body: "Fairness means giving people a reasonable chance, listening before judging, and choosing what is right even when nobody forces you.",
              },
              {
                id: "budget-intro-copy",
                type: "text",
                body: "Everyday civic values begin in ordinary moments: joining a queue, sharing a space, keeping a promise, or admitting a mistake. The goal is not perfection. The goal is to pause long enough to choose with care.",
              },
            ],
          },
          {
            id: "page-needs-wants",
            lessonId: "lesson-starter-budget",
            title: "Balance your needs with others",
            subtitle: "Fairness considers your needs and the effect on people around you.",
            order: 2,
            type: "concept",
            estimatedMinutes: 2,
            blocks: [
              {
                id: "needs-wants-copy",
                type: "text",
                heading: "Ask who is affected",
                body: "A fair choice does not ignore your own needs. It simply asks one extra question: who else is affected by what I am about to do?",
              },
              {
                id: "needs-wants-table",
                type: "table",
                title: "Fair Choice Check",
                columns: ["Situation", "Fair action"],
                rows: [
                  ["A queue is long", "Wait your turn instead of pushing ahead"],
                  ["A teammate made a mistake", "Correct the issue without humiliating them"],
                  ["You found lost property", "Return it or report it to a trusted person"],
                ],
              },
              {
                id: "needs-wants-image",
                type: "image",
                src: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
                alt: "People shaking hands after a conversation",
                caption: "Fairness is easier to practice when we think about the person on the other side of the choice.",
              },
            ],
          },
          {
            id: "page-budget-summary",
            lessonId: "lesson-starter-budget",
            title: "Pause, choose, explain",
            order: 3,
            type: "summary",
            estimatedMinutes: 1,
            blocks: [
              {
                id: "budget-audio-recap",
                type: "audio",
                src: "/media/budget-recap-placeholder.mp3",
                title: "One-minute recap",
                transcript:
                  "When a choice affects other people, pause first. Think about who is affected, choose the fair action, and be ready to explain your reason calmly.",
              },
              {
                id: "budget-summary",
                type: "text",
                body: "A fair person is not someone who always gets it right. A fair person is willing to pause, listen, correct mistakes, and choose what protects trust.",
              },
            ],
          },
        ],
        quiz: {
          id: "quiz-starter-budget",
          lessonId: "lesson-starter-budget",
          title: "Fair Choices Quiz",
          description: "Check your understanding and earn XP for correct answers.",
          questions: [
            {
              id: "q-budget-purpose",
              quizId: "quiz-starter-budget",
              prompt: "What is the main purpose of practicing fairness in everyday choices?",
              type: "single_choice",
              options: [
                {
                  id: "q-budget-purpose-a",
                  questionId: "q-budget-purpose",
                  label: "To make choices that consider both you and others",
                  order: 1,
                },
                {
                  id: "q-budget-purpose-b",
                  questionId: "q-budget-purpose",
                  label: "To make sure you always get your way",
                  order: 2,
                },
                {
                  id: "q-budget-purpose-c",
                  questionId: "q-budget-purpose",
                  label: "To avoid explaining your actions",
                  order: 3,
                },
              ],
              correctOptionIds: ["q-budget-purpose-a"],
              explanation: "Fairness asks you to consider how your choice affects other people.",
              xp: 10,
              order: 1,
            },
            {
              id: "q-budget-needs",
              quizId: "quiz-starter-budget",
              prompt: "Which actions show fairness?",
              type: "multiple_choice",
              options: [
                {
                  id: "q-budget-needs-a",
                  questionId: "q-budget-needs",
                  label: "Waiting your turn",
                  order: 1,
                },
                {
                  id: "q-budget-needs-b",
                  questionId: "q-budget-needs",
                  label: "Listening before judging",
                  order: 2,
                },
                {
                  id: "q-budget-needs-c",
                  questionId: "q-budget-needs",
                  label: "Taking a shortcut that blocks others",
                  order: 3,
                },
              ],
              correctOptionIds: ["q-budget-needs-a", "q-budget-needs-b"],
              explanation: "Fairness includes patience, listening, and respect for shared rules.",
              xp: 15,
              order: 2,
            },
            {
              id: "q-budget-flex",
              quizId: "quiz-starter-budget",
              prompt: "True or false: a fair choice can still consider your own needs.",
              type: "true_false",
              options: [
                {
                  id: "q-budget-flex-true",
                  questionId: "q-budget-flex",
                  label: "True",
                  order: 1,
                },
                {
                  id: "q-budget-flex-false",
                  questionId: "q-budget-flex",
                  label: "False",
                  order: 2,
                },
              ],
              correctOptionIds: ["q-budget-flex-true"],
              explanation:
                "Fairness balances your needs with the effect your action has on others.",
              xp: 10,
              order: 3,
            },
            {
              id: "q-budget-first-step",
              quizId: "quiz-starter-budget",
              prompt: "What should you do first when a choice affects other people?",
              type: "single_choice",
              options: [
                {
                  id: "q-budget-first-step-a",
                  questionId: "q-budget-first-step",
                  label: "Pause and think about who is affected",
                  order: 1,
                },
                {
                  id: "q-budget-first-step-b",
                  questionId: "q-budget-first-step",
                  label: "Act quickly before anyone complains",
                  order: 2,
                },
                {
                  id: "q-budget-first-step-c",
                  questionId: "q-budget-first-step",
                  label: "Blame someone else if it goes wrong",
                  order: 3,
                },
              ],
              correctOptionIds: ["q-budget-first-step-a"],
              explanation:
                "A short pause helps you choose with care instead of reacting selfishly.",
              xp: 20,
              order: 4,
            },
          ],
        },
      },
      {
        id: "lesson-track-spending",
        courseId: "course-money-basics",
        slug: "respect-for-a-week",
        title: "Practice Respect for a Week",
        summary: "Notice how respect shows up in speech, time, space, and disagreement.",
        order: 2,
        estimatedMinutes: 6,
        status: "available",
        coverImage: {
          src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
          alt: "People learning together around a table",
        },
        retryPolicy: {
          mode: "anytime",
          requiresReread: true,
          maxRewardedAttempts: 5,
        },
        quizAccess: {
          requiresLessonCompletion: true,
        },
        pages: [
          {
            id: "page-track-primer",
            lessonId: "lesson-track-spending",
            title: "Notice respect in small moments",
            subtitle: "Respect is easier to build when you can see it.",
            order: 1,
            type: "primer",
            estimatedMinutes: 1,
            blocks: [
              {
                id: "track-copy",
                type: "text",
                body: "For seven days, notice moments where you show respect or miss a chance to show it. The first goal is awareness, not self-blame.",
              },
            ],
          },
          {
            id: "page-track-method",
            lessonId: "lesson-track-spending",
            title: "Use a simple respect log",
            subtitle: "Keep the habit small enough to repeat.",
            order: 2,
            type: "concept",
            estimatedMinutes: 2,
            blocks: [
              {
                id: "track-method-copy",
                type: "text",
                heading: "Capture three details",
                body: "Each day, write one situation, the respectful action you took or could have taken, and what you learned. A notes app, paper, or simple table all work.",
              },
              {
                id: "track-method-table",
                type: "table",
                title: "Respect Log",
                columns: ["Situation", "Respectful action", "Lesson"],
                rows: [
                  ["Group chat disagreement", "Asked a question before replying", "Tone matters"],
                  ["Shared classroom space", "Cleaned up after myself", "Public spaces need care"],
                  ["Someone arrived late", "Corrected them privately", "Respect can be firm"],
                ],
              },
              {
                id: "track-method-video",
                type: "video",
                src: "/media/spending-log-placeholder.mp4",
                title: "How to use a respect log",
                caption: "A short walkthrough can be added here when lesson media is ready.",
              },
            ],
          },
          {
            id: "page-track-summary",
            lessonId: "lesson-track-spending",
            title: "Look for respect patterns",
            order: 3,
            type: "summary",
            estimatedMinutes: 1,
            blocks: [
              {
                id: "track-summary-callout",
                type: "callout",
                variant: "tip",
                title: "Choose one improvement",
                body: "At the end of the week, choose one area to improve: listening, punctuality, public cleanliness, tone, or keeping promises.",
              },
            ],
          },
        ],
        quiz: {
          id: "quiz-track-spending",
          lessonId: "lesson-track-spending",
          title: "Respect Practice Quiz",
          questions: [
            {
              id: "q-track-first-goal",
              quizId: "quiz-track-spending",
              prompt: "What is the first goal of keeping a respect log?",
              type: "single_choice",
              options: [
                {
                  id: "q-track-first-goal-a",
                  questionId: "q-track-first-goal",
                  label: "Awareness",
                  order: 1,
                },
                {
                  id: "q-track-first-goal-b",
                  questionId: "q-track-first-goal",
                  label: "Shame",
                  order: 2,
                },
              ],
              correctOptionIds: ["q-track-first-goal-a"],
              explanation: "Awareness helps you notice patterns before choosing what to improve.",
              xp: 10,
              order: 1,
            },
            {
              id: "q-track-details",
              quizId: "quiz-track-spending",
              prompt: "Which details should you capture in a simple respect log?",
              type: "multiple_choice",
              options: [
                {
                  id: "q-track-details-a",
                  questionId: "q-track-details",
                  label: "The situation",
                  order: 1,
                },
                {
                  id: "q-track-details-b",
                  questionId: "q-track-details",
                  label: "The respectful action",
                  order: 2,
                },
                {
                  id: "q-track-details-c",
                  questionId: "q-track-details",
                  label: "What you learned",
                  order: 3,
                },
                {
                  id: "q-track-details-d",
                  questionId: "q-track-details",
                  label: "Private gossip about the person",
                  order: 4,
                },
              ],
              correctOptionIds: [
                "q-track-details-a",
                "q-track-details-b",
                "q-track-details-c",
              ],
              explanation:
                "A useful respect log tracks the situation, the action, and the lesson.",
              xp: 15,
              order: 2,
            },
            {
              id: "q-track-judgement",
              quizId: "quiz-track-spending",
              prompt: "True or false: the first week of a respect log is mainly for judging yourself.",
              type: "true_false",
              options: [
                {
                  id: "q-track-judgement-true",
                  questionId: "q-track-judgement",
                  label: "True",
                  order: 1,
                },
                {
                  id: "q-track-judgement-false",
                  questionId: "q-track-judgement",
                  label: "False",
                  order: 2,
                },
              ],
              correctOptionIds: ["q-track-judgement-false"],
              explanation:
                "The first week is for awareness. You can choose one small improvement after you see the pattern.",
              xp: 10,
              order: 3,
            },
          ],
        },
      },
    ],
  },
  {
    id: "course-digital-safety",
    slug: "community-responsibility",
    title: "Community Responsibility",
    category: "Civic Responsibility",
    description: "Learn how truthful sharing, calm verification, and public-minded action protect trust.",
    level: "beginner",
    status: "available",
    thumbnail: {
      src: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=900&q=80",
      alt: "Community volunteers standing together",
    },
    estimatedMinutes: 22,
    progressPercent: 10,
    lessons: [
      {
        id: "lesson-avoid-scams",
        courseId: "course-digital-safety",
        slug: "check-rumors-before-sharing",
        title: "Check Rumors Before Sharing",
        summary: "Pause, verify, and share responsibly when information affects others.",
        order: 1,
        estimatedMinutes: 5,
        status: "available",
        coverImage: {
          src: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=900&q=80",
          alt: "Newspapers and a phone on a table",
        },
        retryPolicy: {
          mode: "cooldown",
          requiresReread: true,
          cooldownHours: 24,
          maxRewardedAttempts: 5,
        },
        quizAccess: {
          requiresLessonCompletion: true,
        },
        pages: [
          {
            id: "page-scam-pressure",
            lessonId: "lesson-avoid-scams",
            title: "Pressure is a sharing warning sign",
            subtitle: "Rumors often spread because people feel pushed to react quickly.",
            order: 1,
            type: "primer",
            estimatedMinutes: 1,
            blocks: [
              {
                id: "scam-warning",
                type: "callout",
                variant: "warning",
                title: "Pause before you forward",
                body: "If a message says everyone must act now, slow down. Urgent language can be used to spread fear, shame, or false information.",
              },
            ],
          },
          {
            id: "page-scam-checks",
            lessonId: "lesson-avoid-scams",
            title: "Run a quick truth check",
            subtitle: "Verify the source before you trust or share the message.",
            order: 2,
            type: "concept",
            estimatedMinutes: 2,
            coverImage: {
              src: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=900&q=80",
              alt: "A laptop showing research and verification work",
            },
            blocks: [
              {
                id: "scam-checks-copy",
                type: "text",
                heading: "Use a trusted source",
                body: "Before sharing, check who created the information, whether another reliable source confirms it, and whether the message is trying to make you angry or afraid.",
              },
              {
                id: "scam-checks-callout",
                type: "callout",
                variant: "warning",
                title: "Do not add harm",
                body: "A responsible citizen does not knowingly spread information that can endanger people, damage reputations, or create panic.",
              },
            ],
          },
          {
            id: "page-scam-summary",
            lessonId: "lesson-avoid-scams",
            title: "Pause, verify, then share",
            order: 3,
            type: "summary",
            estimatedMinutes: 1,
            blocks: [
              {
                id: "scam-summary",
                type: "text",
                body: "If a message names a person, group, place, or public issue, slow down. A two-minute check can protect people and strengthen public trust.",
              },
            ],
          },
        ],
        quiz: {
          id: "quiz-avoid-scams",
          lessonId: "lesson-avoid-scams",
          title: "Responsible Sharing Quiz",
          questions: [
            {
              id: "q-scam-pressure",
              quizId: "quiz-avoid-scams",
              prompt: "What should you do when a public message pressures you to share immediately?",
              type: "single_choice",
              options: [
                {
                  id: "q-scam-pressure-a",
                  questionId: "q-scam-pressure",
                  label: "Pause and verify",
                  order: 1,
                },
                {
                  id: "q-scam-pressure-b",
                  questionId: "q-scam-pressure",
                  label: "Forward it before checking",
                  order: 2,
                },
                {
                  id: "q-scam-pressure-c",
                  questionId: "q-scam-pressure",
                  label: "Add an angry caption to make it spread faster",
                  order: 3,
                },
              ],
              correctOptionIds: ["q-scam-pressure-a"],
              explanation: "Urgency can be used to spread false or harmful information.",
              xp: 15,
              order: 1,
            },
            {
              id: "q-scam-private-info",
              quizId: "quiz-avoid-scams",
              prompt: "Which checks should you make before sharing civic information?",
              type: "multiple_choice",
              options: [
                {
                  id: "q-scam-private-info-a",
                  questionId: "q-scam-private-info",
                  label: "Check the source",
                  order: 1,
                },
                {
                  id: "q-scam-private-info-b",
                  questionId: "q-scam-private-info",
                  label: "Look for confirmation from another reliable source",
                  order: 2,
                },
                {
                  id: "q-scam-private-info-c",
                  questionId: "q-scam-private-info",
                  label: "Consider who could be harmed",
                  order: 3,
                },
                {
                  id: "q-scam-private-info-d",
                  questionId: "q-scam-private-info",
                  label: "Share it if it matches your anger",
                  order: 4,
                },
              ],
              correctOptionIds: [
                "q-scam-private-info-a",
                "q-scam-private-info-b",
                "q-scam-private-info-c",
              ],
              explanation:
                "Responsible sharing checks source, confirmation, and possible harm.",
              xp: 20,
              order: 2,
            },
            {
              id: "q-scam-verify",
              quizId: "quiz-avoid-scams",
              prompt: "What is the safest way to verify a rumor about a community issue?",
              type: "single_choice",
              options: [
                {
                  id: "q-scam-verify-a",
                  questionId: "q-scam-verify",
                  label: "Check trusted sources or people directly connected to the issue",
                  order: 1,
                },
                {
                  id: "q-scam-verify-b",
                  questionId: "q-scam-verify",
                  label: "Trust it because many people are sharing it",
                  order: 2,
                },
                {
                  id: "q-scam-verify-c",
                  questionId: "q-scam-verify",
                  label: "Share first and correct it later if needed",
                  order: 3,
                },
              ],
              correctOptionIds: ["q-scam-verify-a"],
              explanation:
                "Trusted sources are safer than popularity, pressure, or emotion.",
              xp: 15,
              order: 3,
            },
            {
              id: "q-scam-urgency",
              quizId: "quiz-avoid-scams",
              prompt: "True or false: urgent language can be a warning sign in public messages.",
              type: "true_false",
              options: [
                {
                  id: "q-scam-urgency-true",
                  questionId: "q-scam-urgency",
                  label: "True",
                  order: 1,
                },
                {
                  id: "q-scam-urgency-false",
                  questionId: "q-scam-urgency",
                  label: "False",
                  order: 2,
                },
              ],
              correctOptionIds: ["q-scam-urgency-true"],
              explanation:
                "Urgency can stop people from checking carefully before sharing.",
              xp: 10,
              order: 4,
            },
          ],
        },
      },
    ],
  },
];

export const rewards = [
  {
    title: "N500 Meal Ticket",
    xp: 20,
    expires: "Valid this month",
  },
  {
    title: "Free Bet",
    xp: 100,
    expires: "Limited reward",
  },
  {
    title: "N1000 Meal Ticket",
    xp: 40,
    expires: "Valid this month",
  },
  {
    title: "Daily Jackpot",
    xp: 200,
    expires: "Limited reward",
  },
];

export const lessons = courses.flatMap((course) => course.lessons);

export function getQuizXP(quiz: Quiz) {
  return quiz.questions.reduce((total, question) => total + question.xp, 0);
}

export function getLessonXP(lesson: Lesson) {
  return getQuizXP(lesson.quiz);
}

export function getCourseXP(course: Course) {
  return course.lessons.reduce((total, lesson) => total + getLessonXP(lesson), 0);
}

export function getCourse(idOrSlug: string) {
  return courses.find((course) => course.id === idOrSlug || course.slug === idOrSlug) ?? courses[0];
}

export function getLesson(idOrSlug: string) {
  return lessons.find((lesson) => lesson.id === idOrSlug || lesson.slug === idOrSlug) ?? lessons[0];
}

export function getCourseByLessonId(lessonId: string) {
  const lesson = getLesson(lessonId);
  return getCourse(lesson.courseId);
}

export function getQuiz(id: string) {
  return lessons.map((lesson) => lesson.quiz).find((quiz) => quiz.id === id);
}

export function isQuestionCorrect(question: QuizQuestion, selectedOptionIds: string[]) {
  const selected = [...selectedOptionIds].sort();
  const correct = [...question.correctOptionIds].sort();

  return (
    selected.length === correct.length &&
    selected.every((optionId, index) => optionId === correct[index])
  );
}

export function getEarnedQuestionXP(question: QuizQuestion, selectedOptionIds: string[]) {
  return isQuestionCorrect(question, selectedOptionIds) ? question.xp : 0;
}

export function getEarnedQuizXP(
  quiz: Quiz,
  answers: Array<{ questionId: string; selectedOptionIds: string[] }>,
) {
  return quiz.questions.reduce((total, question) => {
    const answer = answers.find((item) => item.questionId === question.id);
    return total + getEarnedQuestionXP(question, answer?.selectedOptionIds ?? []);
  }, 0);
}

export function getPublicQuiz(quiz: Quiz, seed = quiz.id): PublicQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => {
      const { correctOptionIds, explanation, ...publicQuestion } = question;
      void correctOptionIds;
      void explanation;

      return {
        ...publicQuestion,
        options: shuffleOptions(question.options, `${seed}:${question.id}`),
      };
    }),
  };
}

export function shuffleOptions(options: QuizOption[], seed: string) {
  const random = createSeededRandom(seed);
  const shuffled = [...options];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.map((option, index) => ({ ...option, order: index + 1 }));
}

function createSeededRandom(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return function random() {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return (hash >>> 0) / 4294967296;
  };
}
