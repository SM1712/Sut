/**
 * FIREBASE CONFIG
 * ────────────────────────────────────────────────────────────────
 * ⚠️  REEMPLAZA estos valores con los de tu proyecto en Firebase.
 *
 * Pasos:
 *  1. Ir a https://console.firebase.google.com
 *  2. Seleccionar tu proyecto "SUT"
 *  3. Project Settings (⚙) → General → Tus apps → Web
 *  4. Copiar el objeto firebaseConfig y pegarlo aquí
 *
 * IMPORTANTE: No subas este archivo con valores reales a un repo público.
 * Usa variables de entorno o Firebase App Hosting secrets en producción.
 * ────────────────────────────────────────────────────────────────
 */
export const firebaseConfig = {
  apiKey:            "AIzaSyAdVgc9pP3zbE-O6FS3gOB9tFCdVxdq9rU",
  authDomain:        "sut1-afd4f.firebaseapp.com",
  projectId:         "sut1-afd4f",
  storageBucket:     "sut1-afd4f.firebasestorage.app",
  messagingSenderId: "564912488525",
  appId:             "1:564912488525:web:90c1d442061c4013071c04",
};

/** Cambia a false para deshabilitar Firebase y usar solo localStorage. */
export const FIREBASE_ENABLED = true;
