export function formatToolbarPageName(title: string): string {
  const page = title.trim();
  return page === 'FirmShake' || page === '' ? 'Browse' : page;
}

export function formatToolbarTitle(title: string): string {
  return `FirmShake - ${formatToolbarPageName(title)}`;
}

/** Two-line mobile header: "FirmShake -" / "Selling" */
export function splitToolbarTitle(title: string): { line1: string; line2: string } {
  const pageName = formatToolbarPageName(title);
  return {
    line1: 'FirmShake -',
    line2: pageName,
  };
}
