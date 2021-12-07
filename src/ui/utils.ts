// We'll usually want to add one for the additional trailing newline.
export function clearNLines(num: number, addOne = true) {
  const lines = num + (addOne ? 1 : 0);
  console.log("\033[" + lines + "A");
}
