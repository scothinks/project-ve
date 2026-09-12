/* Non-sensitive prototype state only. Never use this as an XP claim or auth token. */
(() => {
  const key = 've_entry_design_preview';
  const allowed = ['listen', 'think', 'act'];
  let memory = { topics: [], claimed: false };
  function read() {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (value && typeof value === 'object') memory = {
        topics: [...new Set(Array.isArray(value.topics) ? value.topics.filter(topic => allowed.includes(topic)) : [])],
        claimed: value.claimed === true,
      };
    } catch { /* Storage unavailable: keep this page's in-memory preview. */ }
    return { ...memory, topics: [...memory.topics], xp: memory.topics.length * 10 };
  }
  function write(value) {
    memory = value;
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Local preview still works. */ }
  }
  window.PreviewSession = {
    read,
    setTopics(topics) { write({ topics: [...new Set(topics.filter(topic => allowed.includes(topic)))], claimed: read().claimed }); },
    claim() { const value = read(); write({ topics: value.topics, claimed: true }); },
  };
})();
