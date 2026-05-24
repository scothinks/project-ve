import { createECDH, createHmac, createPrivateKey, createSign, randomBytes, createCipheriv } from "node:crypto";

type PushSubscriptionKeys = {
  auth?: string;
  p256dh?: string;
};

export type WebPushSubscription = {
  endpoint?: string;
  keys?: PushSubscriptionKeys;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
};

function base64UrlEncode(value: Buffer) {
  return value.toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let generatedLength = 0;
  let counter = 1;

  while (generatedLength < length) {
    const hmac = createHmac("sha256", prk);
    hmac.update(previous);
    hmac.update(info);
    hmac.update(Buffer.from([counter]));
    previous = hmac.digest();
    chunks.push(previous);
    generatedLength += previous.length;
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
}

function hkdfExtract(salt: Buffer, input: Buffer) {
  return createHmac("sha256", salt).update(input).digest();
}

function derToJose(signature: Buffer, length = 64) {
  let offset = 0;

  if (signature[offset++] !== 0x30) {
    throw new Error("Invalid ECDSA signature format.");
  }

  offset += 1;

  if (signature[offset++] !== 0x02) {
    throw new Error("Invalid ECDSA signature format.");
  }

  const rLength = signature[offset++];
  const r = signature.subarray(offset, offset + rLength);
  offset += rLength;

  if (signature[offset++] !== 0x02) {
    throw new Error("Invalid ECDSA signature format.");
  }

  const sLength = signature[offset++];
  const s = signature.subarray(offset, offset + sLength);

  const result = Buffer.alloc(length);
  r.subarray(Math.max(0, r.length - 32)).copy(result, Math.max(0, 32 - r.length));
  s.subarray(Math.max(0, s.length - 32)).copy(result, 32 + Math.max(0, 32 - s.length));
  return result;
}

function createVapidJwt(audience: string, subject: string, publicKey: Buffer, privateKey: Buffer) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKey);
  const derivedPublicKey = ecdh.getPublicKey(undefined, "uncompressed");
  const x = base64UrlEncode(derivedPublicKey.subarray(1, 33));
  const y = base64UrlEncode(derivedPublicKey.subarray(33, 65));
  const d = base64UrlEncode(privateKey);

  const keyObject = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d,
    },
    format: "jwk",
  });

  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();

  const signature = signer.sign(keyObject);
  const joseSignature = derToJose(signature).toString("base64url");

  return {
    authorization: `vapid t=${unsigned}.${joseSignature}, k=${base64UrlEncode(publicKey)}`,
    publicKey: base64UrlEncode(publicKey),
  };
}

function encodePayload(subscription: WebPushSubscription, payload: WebPushPayload) {
  if (!subscription.keys?.auth || !subscription.keys?.p256dh) {
    throw new Error("Push subscription keys are missing.");
  }

  const userPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);
  const salt = randomBytes(16);
  const serverECDH = createECDH("prime256v1");
  serverECDH.generateKeys();
  const serverPublicKey = serverECDH.getPublicKey(undefined, "uncompressed");
  const sharedSecret = serverECDH.computeSecret(userPublicKey);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublicKey,
    serverPublicKey,
  ]);
  const keyPrk = hkdfExtract(authSecret, sharedSecret);
  const ikm = hkdfExpand(keyPrk, keyInfo, 32);
  const contentPrk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(contentPrk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(contentPrk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const plaintext = Buffer.concat([
    Buffer.from(JSON.stringify(payload), "utf8"),
    Buffer.from([0x02]),
  ]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const header = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
  ]);

  return Buffer.concat([header, ciphertext]);
}

export async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payload: WebPushPayload,
) {
  const endpoint = subscription.endpoint;
  const publicKeyValue = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKeyValue = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT ?? "mailto:no-reply@projectve.local";

  if (!endpoint) {
    throw new Error("Push subscription endpoint is missing.");
  }

  if (!publicKeyValue || !privateKeyValue) {
    throw new Error("VAPID keys are not configured.");
  }

  const body = encodePayload(subscription, payload);
  const url = new URL(endpoint);
  const vapid = createVapidJwt(
    url.origin,
    subject,
    base64UrlDecode(publicKeyValue),
    base64UrlDecode(privateKeyValue),
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: vapid.authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      TTL: "60",
      Urgency: "normal",
    },
    body,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const error = new Error(responseText || `Push delivery failed with status ${response.status}.`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.status;
}
