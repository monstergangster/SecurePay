const escapeCsvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
};

module.exports = { escapeCsvCell };
