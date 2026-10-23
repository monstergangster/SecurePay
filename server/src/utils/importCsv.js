const REQUIRED_FIELDS = ['transactionId', 'customerId', 'amount', 'currency', 'timestamp'];

const CANONICAL_HEADERS = new Map(
  REQUIRED_FIELDS.map((field) => [field.toLowerCase(), field])
);

const normalizeImportHeader = (header) => {
  const trimmedHeader = String(header).replace(/^\uFEFF/, '').trim();
  const normalizedKey = trimmedHeader.replace(/[\s_-]+/g, '').toLowerCase();
  return CANONICAL_HEADERS.get(normalizedKey) || trimmedHeader;
};

module.exports = { REQUIRED_FIELDS, normalizeImportHeader };
