import crypto, { randomUUID } from "crypto";

function md5(data: any): string {
  const hash = crypto.createHash("md5").update(data.toString()).digest("hex");
  return hash.toString();
}

function randomMd5(): string {
  return md5(randomUUID());
}

export { md5, randomMd5 };
