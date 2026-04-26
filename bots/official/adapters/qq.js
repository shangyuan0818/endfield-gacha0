export function createQqEventHandler({
  router,
}) {
  return {
    async handleEvent(eventPayload) {
      const author = eventPayload?.author || {};
      const messageContent = String(eventPayload?.content || '').trim();

      const reply = await router.handleMessage({
        text: messageContent,
        platformUserId: String(author.id || ''),
        displayHandle: author.username ? `@${author.username}` : '',
        isPrivateChat: eventPayload?.channel_type === 'DIRECT',
      });

      return {
        content: reply?.text || '当前没有可返回的内容。',
      };
    },
  };
}

export default {
  createQqEventHandler,
};
