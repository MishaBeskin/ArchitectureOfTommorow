export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

export type ContactErrors = Partial<Record<keyof ContactValues, string>>;

/** What the contact server action returns to the form. */
export type ContactState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      /** A problem that is not about one field (rate limit, verification, server error). */
      message?: string;
      errors?: ContactErrors;
      /** Echoed back because React resets an uncontrolled form after an action runs. */
      values?: ContactValues;
    };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CONTACT_LIMITS = { name: 100, email: 254, message: 2000, messageMin: 10 } as const;

/** Pure and framework-free so the server action in step 13 can reuse the same rules. */
export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();

  if (!name) errors.name = "Enter your name.";
  else if (name.length > CONTACT_LIMITS.name) {
    errors.name = `Name must be ${CONTACT_LIMITS.name} characters or fewer.`;
  }

  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL.test(email) || email.length > CONTACT_LIMITS.email) {
    errors.email = "Enter a valid email address, like name@example.com.";
  }

  if (!message) errors.message = "Enter a message.";
  else if (message.length < CONTACT_LIMITS.messageMin) {
    errors.message = `Message must be at least ${CONTACT_LIMITS.messageMin} characters.`;
  } else if (message.length > CONTACT_LIMITS.message) {
    errors.message = `Message must be ${CONTACT_LIMITS.message} characters or fewer.`;
  }

  return errors;
}
