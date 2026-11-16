// Helper to generate a 4-digit verification code
export const generateVerificationCode = () => {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return (1000 + (array[0] % 9000)).toString();
};

export const code = generateVerificationCode();
