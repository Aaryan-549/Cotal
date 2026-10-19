---
"@cotal-ai/manager": patch
"@cotal-ai/tmux": patch
---

A tmux seat that outlives its manager is now adopted by the next manager instead of closed. The manager records each adoptable seat, and on startup the successor checks the recorded tmux server, window and pane, then manages the seat again under its existing credential so a run's pending turn continues on it. A seat whose pane has exited is retired as before.
