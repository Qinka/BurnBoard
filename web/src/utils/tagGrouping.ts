/**
 * Represents a group of tags with a common prefix
 */
export interface TagGroup {
  name: string;
  tags: string[];
}

/**
 * Groups tags by their "/" prefix.
 * Tags with the same prefix are grouped together.
 * Tags without a "/" are treated as their own group.
 * 
 * @param tags - Array of tag names to group
 * @returns Array of TagGroup objects, sorted alphabetically by group name
 */
export const groupTagsByPrefix = (tags: string[]): TagGroup[] => {
  const groupMap = new Map<string, string[]>();
  
  tags.forEach(tag => {
    const slashIndex = tag.indexOf('/');
    if (slashIndex > 0) {
      // Has a prefix, group by it
      const prefix = tag.substring(0, slashIndex);
      const existing = groupMap.get(prefix) || [];
      existing.push(tag);
      groupMap.set(prefix, existing);
    } else {
      // No prefix, use tag itself as group
      const existing = groupMap.get(tag) || [];
      existing.push(tag);
      groupMap.set(tag, existing);
    }
  });
  
  // Convert to array and sort
  return Array.from(groupMap.entries())
    .map(([name, tags]) => ({ name, tags: tags.sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Gets the short name for a tag (part after the group prefix).
 * If the tag doesn't start with the group prefix, returns the full tag name.
 * 
 * @param tag - Full tag name
 * @param groupName - Group prefix name
 * @returns The short name (part after the prefix) or full tag name
 */
export const getShortTagName = (tag: string, groupName: string): string => {
  if (tag.startsWith(groupName + '/')) {
    return tag.substring(groupName.length + 1);
  }
  return tag;
};
