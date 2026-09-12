export const welcomeTopics = {
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
    ]
  }
} as const;
export type WelcomeTopic = keyof typeof welcomeTopics;
export const topicIds = ["listen", "think", "act"] as const;
export const sampleXp = 10;
export function isWelcomeTopic(value: unknown): value is WelcomeTopic { return typeof value === "string" && topicIds.includes(value as WelcomeTopic); }
