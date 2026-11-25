// SPDX-License-Identifier: MIT
/**
 * Browser Gmail access goes through scanInboxForAlert.
 * That list is sender-filtered. This file stays so older imports fail closed
 * instead of growing a second fetch path.
 */
export {
  scanInboxForAlert,
  TOO_LATE,
  INBOX_CAP,
  DEFAULT_NIXLE_SENDERS,
  nixleSenderQuery,
} from "./inbox.js";
