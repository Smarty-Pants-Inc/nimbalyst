export function isAssistantLangGraphMessage(
  message: Record<string, unknown>,
  options: { allowUntypedAssistant?: boolean } = {},
): boolean {
  const rawType = typeof message.type === 'string' ? message.type.toLowerCase() : '';
  const rawRole = typeof message.role === 'string' ? message.role.toLowerCase() : '';

  if (rawType.includes('tool') || typeof message.tool_call_id === 'string') {
    return false;
  }
  if (rawRole === 'tool' || rawRole === 'user' || rawType === 'human') {
    return false;
  }
  if (rawRole === 'assistant' || rawRole === 'ai') {
    return true;
  }
  if (rawType === 'ai' || rawType === 'assistant' || rawType === 'aimessage' || rawType === 'aimessagechunk') {
    return true;
  }

  return Boolean(options.allowUntypedAssistant && !rawType && !rawRole);
}
