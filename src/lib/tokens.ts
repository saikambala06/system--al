import { customAlphabet } from "nanoid";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const gen = customAlphabet(alphabet, 40);

export function generateApiToken() {
  return `jaf_${gen()}`;
}
