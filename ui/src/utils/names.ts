/** A friendly name for the signed-in user, from the account name. The backend gives only an ID and a role. */
const ALIASES: Record<string, string> = { creator: 'Seller', external: 'Seller agent', owner: 'Seller' };

export function displayName(id: string): string {
  const alias = ALIASES[id.toLowerCase()];
  if (alias) return alias;
  const name = id.replace(/[_-]+/g, ' ').trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function roleName(role: string): string {
  return role === 'operator' ? 'Marketplace operator' : role === 'recipient' ? 'Seller' : role;
}
