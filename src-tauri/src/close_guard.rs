//! A close request must never be blocked forever.
//!
//! The page flushes pending saves before the window closes, so Tauri hands
//! the close request to the page and waits. If the page is broken, stuck, or
//! was never allowed to answer, nothing would ever close the window. Each close
//! request therefore starts a short timer here. The page cancels it only to
//! say a save failed and the student must decide; any later close request
//! starts a fresh timer.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// How long the page gets to flush and close before Rust closes the window.
pub const CLOSE_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Default)]
pub struct CloseGuard {
    seq: AtomicU64,
}

impl CloseGuard {
    /// Start a timer for a new close request. Returns its ticket.
    pub fn arm(&self) -> u64 {
        self.seq.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// The page keeps the window open on purpose: cancel pending timers.
    pub fn hold(&self) {
        self.seq.fetch_add(1, Ordering::SeqCst);
    }

    /// Whether a timer that holds this ticket may still close the window.
    pub fn may_force_close(&self, ticket: u64) -> bool {
        self.seq.load(Ordering::SeqCst) == ticket
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fresh_request_may_force_close() {
        let guard = CloseGuard::default();
        let ticket = guard.arm();
        assert!(guard.may_force_close(ticket));
    }

    #[test]
    fn a_hold_cancels_the_pending_timer() {
        let guard = CloseGuard::default();
        let ticket = guard.arm();
        guard.hold();
        assert!(!guard.may_force_close(ticket));
    }

    #[test]
    fn a_later_request_replaces_an_older_timer_and_is_not_held() {
        let guard = CloseGuard::default();
        let first = guard.arm();
        guard.hold();
        let second = guard.arm();
        assert!(!guard.may_force_close(first));
        assert!(guard.may_force_close(second));
    }
}
