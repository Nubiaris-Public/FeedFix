/** Reject numeric spellings that JavaScript would silently round or underflow. */
export function supportedNumber(value: string): number {
  const number = Number(value);
  const significand = value.split(/[eE]/)[0];
  const digits = significand.replace(/[-.]/g, "").replace(/^0+/, "");
  if (
    !Number.isFinite(number) ||
    (Number.isInteger(number) && !Number.isSafeInteger(number)) ||
    digits.length > 15 ||
    (number === 0 && /[1-9]/.test(significand))
  )
    throw new Error(
      "Numeric precision exceeds the supported range or 15 significant digits",
    );
  return number;
}
