/**
 * A helper function that returns a promise that resolves after a given time
 */
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
