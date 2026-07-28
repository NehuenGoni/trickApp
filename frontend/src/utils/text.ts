/**
 * Iniciales para los avatares de fallback (usuarios sin foto, torneos sin logo).
 * Toma la primera letra de las dos primeras palabras, o solo la primera si hay
 * una sola palabra.
 */
export const getInitials = (name: string): string => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
