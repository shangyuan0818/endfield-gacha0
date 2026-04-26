function buildCommandText(payload) {
  const commandName = payload?.data?.name;
  const options = Array.isArray(payload?.data?.options) ? payload.data.options : [];
  const suffix = options
    .map((option) => option?.value)
    .filter(Boolean)
    .join(' ');

  return `/${commandName}${suffix ? ` ${suffix}` : ''}`;
}

export function createDiscordInteractionHandler({
  router,
}) {
  return {
    async handleInteraction(payload) {
      if (!payload || payload.type === 1) {
        return { type: 1 };
      }

      const user = payload.member?.user || payload.user || {};
      const reply = await router.handleMessage({
        text: buildCommandText(payload),
        platformUserId: String(user.id || ''),
        displayHandle: user.username ? `@${user.username}` : '',
        isPrivateChat: !payload.guild_id,
      });

      return {
        type: 4,
        data: {
          content: reply?.text || '当前没有可返回的内容。',
        },
      };
    },
  };
}

export default {
  createDiscordInteractionHandler,
};
