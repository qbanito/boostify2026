import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fal from "@fal-ai/serverless-client";

// Initialize Firebase Admin with credentials
const app = initializeApp({
  credential: cert({
    "type": "service_account",
    "project_id": "artist-boost",
    "private_key_id": "b0572b6b1c57a1bc30ffa8402c6d754b552baa8f",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDvkh3rZjsI4G+j\n4EGOsD1xg5AnYusLF239hEW+QCbZid1ABtqgr9cf0jWCkkx0lVfwc5CEhR376nJI\nZGPgWVSOFeAwkd5KH86dZ3L0Uy+FB9pNP+evREoJX1kAej727DRdAM7CNC/kKCtz\nA5kmtNSIDQSCJLUMLdi9inYntYvWzXfNxMyN3W0Sn4pVyzmeTosdtARPvRINowWl\nOsj8iAmzHqzeEQpChehf9yN7qUD/8SpUIwCvEJlYmnxXBVMcjjqT1b39BxPZhndb\noMbuEUUSuOP5aRITzVjkfSBrm6ss9ZRHiSCoXYW0RTrlNglp0lvLVVepqnjvTBVh\nKHna7gblAgMBAAECggEAdxP6uSnsSAI+m4b5LvJc6BJL0bfyOmYf7rYTcHg0l0ZW\nad++RcaBODjlDgyn4f7lYggfGi+Mcs3ali8IEdh1Fda7w4iNo+xhZ42m7th2Mzpv\nAJy2DUD1R+lTtNAOge9wK5YeLxt/fnmU9ysfscSKK0HFLucN8orLQ5MSHbS4WEB8\nb4G6FjwnOC6dXWmojpZugqHym1PMfFoT+O8WzeywnSkR6arroCl3x0zz8zdiJN6f\nnaiICap8M7oEQRoSIRWhwda08Ih9GYIVTOo08pw81HfrnmetoN8xm1Ncfdk9Mgh2\nqLDNUMmorxBndQJ9XF62QvlBpQJYrHtl0BjaxfNq1QKBgQD/gxU5danA/IysGHEG\nNSMNwdnOCdUC/1Omq5tGrFlIFUmhglNiTJZtrURD5jhFHrR+WkZAnniqlRbsTe6N\nyy3J0VO3j4LQk0JYMKIavhlhcbwcUBRJVpMeVJT/32WOW8aVztXk6f9MA3eVB+eQ\nnt4YkYp8AcfReXLL1Tm5R3wPswKBgQDwBz2N/JOJuZfBg/yobR12AqTJPPO/DWDW\nqhFunHLDFFZcMidIpAvRjB07c59TCCPLftLv4EoNmZXnuxR/ba+acGlPm2COKzLx\npl2ttqKSGqa5u63a+Z+mh6nC4I3S+08xo4ro7lKVMVNCSFPyTnRlKZdk0ixvV5N/\nuqPX4vuDBwKBgQCKbcgn8zle1vSXoD5LsKonH+kSmX0QPKhjWgGsDl/oj6/ukp7+\nWKP/E6oyZx4BRJthASOiirixIkjjCW2+4F8UQhZrEpM60S1WfjK07lzt0CKr7C6x\ndPgLrKN05OEueUZjj0WO2b94vUAiO8AXOBr3kJJIkOZi9Lte90xotvPdxQKBgEyt\ng3SAY4Fz0I75YxVLBkZUwd+noRY/Z9grrDXxtJetP4lkXDhQb5YZdJ0xaoxT5Vt0\nwF3xALcngUPt97Zdi+OCVaIguM+x7SxVQUflODoEWY6r7fYuGFpSrGCc67GipsHs\nxMt0lt0iTL637FlTxssqZjrHCXroNy5uqTimQkKxAoGBAKYeI5FuK/HNgvgrZddH\nQHQ69TxfTjK1ryxSqmqd7ALfa/ZRuDt287wv/V22Isrrq7KZRT6C5MGLWkSC0v3i\nXN20tGn48cUDG+lGbspC9DD+Vv7WJf1D7F9WE17KBMjUhTAc/59DpZD91+K8y51s\ngrq37Z+PdblgJVKpDJBv8HxD\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@artist-boost.iam.gserviceaccount.com",
    "client_id": "114213694920401981721",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40artist-boost.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  }),
});

const db = getFirestore();

// Configure fal.ai
fal.config({
  credentials: process.env.FAL_API_KEY,
});

export { db };