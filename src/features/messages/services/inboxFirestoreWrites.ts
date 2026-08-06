/**
 * Firestore inboxState writes — canonical path until VITE_USE_BFF_INBOX is enabled.
 */
export {
  archiveConversation,
  markConversationViewed,
  unarchiveConversation,
} from './inboxState';
