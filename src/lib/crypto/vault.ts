import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;

import { getRequiredEnv } from "@/lib/utils";

function getMasterKey() {
  const encodedKey = getRequiredEnv("VAULT_MASTER_KEY");

  try {
    const decodedKey = decodeBase64(encodedKey);

    if (decodedKey.length !== nacl.secretbox.keyLength) {
      throw new Error(`VAULT_MASTER_KEY must decode to ${nacl.secretbox.keyLength} bytes.`);
    }

    return decodedKey;
  } catch (error) {
    throw new Error(
      `Failed to decode VAULT_MASTER_KEY. ${error instanceof Error ? error.message : "Invalid base64 key."}`,
    );
  }
}

export function encrypt(plaintext: string, masterKey: Uint8Array = getMasterKey()) {
  try {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = decodeUTF8(plaintext);
    const encryptedBytes = nacl.secretbox(messageBytes, nonce, masterKey);

    return {
      encrypted: encodeBase64(encryptedBytes),
      nonce: encodeBase64(nonce),
    };
  } catch (error) {
    throw new Error(`Vault encryption failed. ${error instanceof Error ? error.message : "Unknown encryption error."}`);
  }
}

export function decrypt(encrypted: string, nonce: string, masterKey: Uint8Array = getMasterKey()) {
  try {
    const encryptedBytes = decodeBase64(encrypted);
    const nonceBytes = decodeBase64(nonce);
    const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, masterKey);

    if (!decrypted) {
      throw new Error("Vault decryption failed. The ciphertext, nonce, or master key is invalid.");
    }

    return encodeUTF8(decrypted);
  } catch (error) {
    throw new Error(`Vault decryption failed. ${error instanceof Error ? error.message : "Unknown decryption error."}`);
  }
}
