/** Money is sent as a string with up to 2 decimals, e.g. "250000" or "250000.50". */
export const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
export const MONEY_MSG = { message: 'must be an amount like 250000 or 250000.50' };
